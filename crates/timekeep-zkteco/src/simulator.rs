//! ZKTeco device simulator — a TCP server that speaks the binary SDK protocol.
//!
//! Use this to write integration tests that exercise the full `ZkConnection`
//! stack without needing a physical device on the network.
//!
//! # Quick example
//!
//! ```ignore
//! use timekeep_zkteco::simulator::ZkSimServer;
//!
//! let sim = ZkSimServer::with_handshake(|cmd, _data, session, reply| match cmd {
//!     50 => vec![ZkSimServer::ack(session, reply, &simulator::sizes_blob(116, 11000, 200))],
//!     _  => vec![ZkSimServer::ack(session, reply, &[])],
//! }).await;
//!
//! // Connect timekeep to sim.addr()
//! // let conn = ZkConnection::connect(&sim.host_port().0, sim.host_port().1, 0).await?;
//! ```
//!
//! # Architecture
//!
//! ```text
//!   timekeep (ZkConnection) ──TCP──▶ ZkSimServer (this module)
//!   client                           server
//!   sends: CONNECT, AUTH, GET_USERS   responds: ACK_OK, data packets
//! ```

use std::net::SocketAddr;
use std::sync::Arc;

use crate::protocol::packet::{PACKET_MAGIC, Packet};
use timekeep_core::Error;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

// ── Command constants (mirror connection.rs) ──────────────────────────

const CMD_CONNECT: u16 = 1000;
const CMD_EXIT: u16 = 1001;
const CMD_AUTH: u16 = 1102;
const CMD_ACK_OK: u16 = 2000;
const CMD_ACK_UNAUTH: u16 = 2005;
const CMD_OPTIONS_WRQ: u16 = 12;
const CMD_PREPARE_DATA: u16 = 1500;
const CMD_DATA: u16 = 1501;
const CMD_FREE_DATA: u16 = 1502;
const CMD_PREPARE_BUFFER: u16 = 1503;
const CMD_READ_BUFFER: u16 = 1504;

// ── Responder type ────────────────────────────────────────────────────

/// A function that decides how to respond to a ZKTeco command.
///
/// Arguments: `(cmd_id, data_bytes, session_id, reply_id)`
///
/// Return the packets to send back.  The first packet's `reply_id` is
/// consumed by the client to advance its reply counter.  Additional
/// packets in the vec are sent as follow-on frames (multi-part data).
pub type Responder = Box<dyn Fn(u16, &[u8], u16, u16) -> Vec<Packet> + Send + Sync + 'static>;

// ── Packet builders ───────────────────────────────────────────────────

/// Build an `ACK_OK` (2000) packet.
pub fn ack(session: u16, reply: u16, data: &[u8]) -> Packet {
    Packet::new(CMD_ACK_OK, session, reply, data.to_vec())
}

/// Build an `ACK_UNAUTH` (2005) packet — forces the client to authenticate.
pub fn ack_unauth(session: u16, reply: u16) -> Packet {
    Packet::new(CMD_ACK_UNAUTH, session, reply, vec![])
}

/// Build a `CMD_DATA` (1501) packet — used in buffered data transfers.
pub fn data_packet(session: u16, reply: u16, payload: &[u8]) -> Packet {
    Packet::new(CMD_DATA, session, reply, payload.to_vec())
}

/// Build a `CMD_PREPARE_DATA` (1500) packet signalling `size` bytes are ready.
///
/// Payload format: `[size: u32 LE][0x00; 4]`
pub fn prepare_data(session: u16, reply: u16, size: u32) -> Packet {
    let mut data = [0u8; 8];
    data[0..4].copy_from_slice(&size.to_le_bytes());
    Packet::new(CMD_PREPARE_DATA, session, reply, data.to_vec())
}

/// Build the 92-byte blob that `CMD_GET_FREE_SIZES` (command 50) returns.
///
/// Offsets match [`parse_device_sizes`](timekeep_zkteco::sdk::parser::parse_device_sizes).
pub fn sizes_blob(users: u32, records: u32, fingerprints: u32) -> Vec<u8> {
    let mut buf = vec![0u8; 92];
    // Offsets from parse_device_sizes:
    buf[16..20].copy_from_slice(&users.to_le_bytes()); // user_count
    buf[24..28].copy_from_slice(&fingerprints.to_le_bytes()); // fp_count
    buf[32..36].copy_from_slice(&records.to_le_bytes()); // record_count
    buf[40..44].copy_from_slice(&0u32.to_le_bytes()); // oplog_count
    buf[48..52].copy_from_slice(&0u32.to_le_bytes()); // admin_count
    buf[52..56].copy_from_slice(&0u32.to_le_bytes()); // pwd_count
    buf[56..60].copy_from_slice(&(fingerprints + 3000).to_le_bytes()); // fp_capacity
    buf[60..64].copy_from_slice(&(users + 1000).to_le_bytes()); // user_capacity
    buf[64..68].copy_from_slice(&(records + 50000).to_le_bytes()); // record_capacity
    buf[68..72].copy_from_slice(&fingerprints.to_le_bytes()); // remaining_fp
    buf[72..76].copy_from_slice(&users.to_le_bytes()); // remaining_user
    buf[76..80].copy_from_slice(&records.to_le_bytes()); // remaining_record
    buf[80..84].copy_from_slice(&fingerprints.to_le_bytes()); // face_count
    buf[88..92].copy_from_slice(&(fingerprints + 1000).to_le_bytes()); // face_capacity
    buf
}

// ── The simulator ─────────────────────────────────────────────────────

/// A simulated ZKTeco device — TCP server on `127.0.0.1:<random port>`.
///
/// Call [`ZkSimServer::new`] for raw control or [`ZkSimServer::with_handshake`]
/// to have CONNECT / AUTH / OPTIONS_WRQ handled automatically.
///
/// ```text
/// Lifecycle:
///   new(responder) → bind → accept loop
///       │                │
///       │                ├── read 8-byte header → read payload
///       │                ├── parse Packet::from_bytes
///       │                ├── responses = responder(cmd, data, session, reply)
///       │                ├── send each response
///       │                └── on CMD_EXIT → close connection
///       │
///   shutdown() → send signal → join task
/// ```
pub struct ZkSimServer {
    addr: SocketAddr,
    shutdown_tx: Option<oneshot::Sender<()>>,
    handle: Option<tokio::task::JoinHandle<()>>,
}

impl ZkSimServer {
    /// Create and start a simulator with a raw responder.
    ///
    /// The responder receives *every* command — including CONNECT and AUTH.
    /// Prefer [`with_handshake`](ZkSimServer::with_handshake) unless you need
    /// full control over the handshake.
    pub async fn new(
        responder: impl Fn(u16, &[u8], u16, u16) -> Vec<Packet> + Send + Sync + 'static,
    ) -> Self {
        Self::start(Box::new(responder), "127.0.0.1:0").await
    }

    /// Like [`new`](ZkSimServer::new) but binds to a specific address.
    pub async fn bind(
        addr: impl Into<String>,
        responder: impl Fn(u16, &[u8], u16, u16) -> Vec<Packet> + Send + Sync + 'static,
    ) -> Self {
        Self::start(Box::new(responder), addr).await
    }

    /// Create and start a simulator whose responder only sees **post-handshake**
    /// commands.  CONNECT → ACK_OK, AUTH → ACK_OK, OPTIONS_WRQ → ACK_OK are
    /// all handled transparently.
    pub async fn with_handshake(
        data_responder: impl Fn(u16, &[u8], u16, u16) -> Vec<Packet> + Send + Sync + 'static,
    ) -> Self {
        Self::start(Box::new(handshake_wrapper(Box::new(data_responder))), "127.0.0.1:0").await
    }

    /// Like [`with_handshake`](ZkSimServer::with_handshake) but binds to a specific address.
    pub async fn with_handshake_bind(
        addr: impl Into<String>,
        data_responder: impl Fn(u16, &[u8], u16, u16) -> Vec<Packet> + Send + Sync + 'static,
    ) -> Self {
        Self::start(Box::new(handshake_wrapper(Box::new(data_responder))), addr).await
    }

    async fn start(responder: Responder, bind_addr: impl Into<String>) -> Self {
        let addr_str: String = bind_addr.into();
        let listener = TcpListener::bind(&addr_str).await.expect("simulator bind failed");
        let addr = listener.local_addr().expect("simulator local_addr failed");

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let responder = Arc::new(responder);

        let handle = tokio::spawn(async move {
            accept_loop(listener, responder, shutdown_rx).await;
        });

        Self { addr, shutdown_tx: Some(shutdown_tx), handle: Some(handle) }
    }

    /// The address the simulator listens on.
    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    /// Convenience: `(host_string, port)` for `ZkConnection::connect()`.
    pub fn host_port(&self) -> (String, u16) {
        (self.addr.ip().to_string(), self.addr.port())
    }

    /// Gracefully shut down the simulator and wait for the background task.
    pub async fn shutdown(mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        if let Some(h) = self.handle.take() {
            let _ = h.await;
        }
    }
}

// ── Accept loop ───────────────────────────────────────────────────────

async fn accept_loop(
    listener: TcpListener,
    responder: Arc<Responder>,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    loop {
        tokio::select! {
            result = listener.accept() => {
                match result {
                    Ok((stream, peer)) => {
                        tokio::spawn(serve_connection(stream, peer, Arc::clone(&responder)));
                    }
                    Err(e) => {
                        tracing::warn!(%e, "simulator: accept error");
                    }
                }
            }
            _ = &mut shutdown_rx => {
                return;
            }
        }
    }
}

// ── Per-connection handler ────────────────────────────────────────────

async fn serve_connection(mut stream: TcpStream, peer: SocketAddr, responder: Arc<Responder>) {
    let mut session_id: u16 = 0;
    let mut buf = vec![0u8; 16384]; // pre-allocate read buffer

    loop {
        // ── Read 8-byte header ──
        match read_exact(&mut stream, &mut buf[..8]).await {
            Ok(()) => {},
            Err(_) => return, // client closed
        }

        let magic = u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]);
        if magic != PACKET_MAGIC {
            tracing::warn!(%peer, "simulator: bad magic, disconnecting");
            return;
        }

        let payload_size = u32::from_le_bytes([buf[4], buf[5], buf[6], buf[7]]) as usize;
        if !(8..=65535).contains(&payload_size) {
            return;
        }

        let total = 8 + payload_size;
        if buf.len() < total {
            buf.resize(total, 0);
        }
        if read_exact(&mut stream, &mut buf[8..total]).await.is_err() {
            return;
        }

        // ── Parse ──
        let packet = match Packet::from_bytes(&buf[..total]) {
            Ok(p) => p,
            Err(_) => return,
        };

        let cmd = packet.cmd_id;
        let reply = packet.reply_id;

        // ── CMD_EXIT → close ──
        if cmd == CMD_EXIT {
            let bye = Packet::new(CMD_ACK_OK, session_id, reply, vec![]);
            let _ = write_packet(&mut stream, &bye).await;
            return;
        }

        // ── Dispatch ──
        let responses = responder(cmd, &packet.data, session_id, reply);

        // Track session from the first CONNECT response
        if let Some(first) = responses.first()
            && cmd == CMD_CONNECT
            && first.cmd_id == CMD_ACK_OK
        {
            session_id = first.session_id;
        }

        // ── Send responses ──
        for r in &responses {
            if write_packet(&mut stream, r).await.is_err() {
                return;
            }
        }
    }
}

// ── I/O helpers ───────────────────────────────────────────────────────

async fn read_exact(stream: &mut TcpStream, buf: &mut [u8]) -> Result<(), Error> {
    let mut offset = 0;
    while offset < buf.len() {
        stream.readable().await.map_err(|e| Error::device(format!("readable: {e}")))?;
        match stream.try_read(&mut buf[offset..]) {
            Ok(0) => return Err(Error::device("connection closed")),
            Ok(n) => offset += n,
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                tokio::time::sleep(std::time::Duration::from_millis(5)).await;
                continue;
            },
            Err(e) => return Err(Error::device(format!("read: {e}"))),
        }
    }
    Ok(())
}

async fn write_packet(stream: &mut TcpStream, packet: &Packet) -> Result<(), Error> {
    let bytes = packet.to_bytes();
    stream.writable().await.map_err(|e| Error::device(format!("writable: {e}")))?;
    stream.try_write(&bytes).map_err(|e| Error::device(format!("write: {e}")))?;
    Ok(())
}

// ── Handshake auto-pilot ──────────────────────────────────────────────

fn handshake_wrapper(
    inner: Responder,
) -> impl Fn(u16, &[u8], u16, u16) -> Vec<Packet> + Send + Sync + 'static {
    const SIM_SESSION: u16 = 0xC5C0;

    move |cmd, _data, _session, reply| match cmd {
        CMD_CONNECT => vec![Packet::new(CMD_ACK_OK, SIM_SESSION, reply, vec![])],
        CMD_AUTH => vec![Packet::new(CMD_ACK_OK, SIM_SESSION, reply, vec![])],
        CMD_OPTIONS_WRQ => vec![Packet::new(CMD_ACK_OK, SIM_SESSION, reply, vec![])],
        _ => inner(cmd, _data, SIM_SESSION, reply),
    }
}

// ── Pre-built scenario: canned device data ────────────────────────────

/// Build a responder that serves the given user and attendance blobs
/// via the buffered-data protocol, plus canned device info.
///
/// Handles:
/// - `50`  (GET_FREE_SIZES)
/// - `11`  (OPTIONS_RRQ — serial, model, platform, MAC)
/// - `1100` (GET_VERSION)
/// - `1503` (PREPARE_BUFFER — returns user or attendance blob)
/// - `1504` (READ_BUFFER — serves chunks)
/// - `1502` (FREE_DATA)
/// - Everything else → ACK_OK
pub fn canned_responder(
    user_blob: Vec<u8>,
    att_blob: Vec<u8>,
    user_count: u32,
    att_count: u32,
) -> Responder {
    Box::new(move |cmd, data, session, reply| -> Vec<Packet> {
        match cmd {
            // ── Sizes ──
            50 => {
                vec![ack(
                    session,
                    reply,
                    &sizes_blob(
                        user_count,
                        att_count,
                        user_count * 2, // fp count = 2× users
                    ),
                )]
            },

            // ── Device info (OPTIONS_RRQ) ──
            11 => {
                let param = String::from_utf8_lossy(data).trim_end_matches('\x00').to_string();
                let val = match param.as_str() {
                    "~SerialNumber" => "SIM-DEVICE-001",
                    "~DeviceName" => "Simulated Biopro SA40",
                    "~Platform" => "ZLM60_TFT",
                    "MAC" => "00:11:22:33:44:55",
                    _ => "",
                };
                vec![ack(session, reply, format!("{param}={val}").as_bytes())]
            },

            // ── Firmware version ──
            1100 => {
                vec![ack(session, reply, b"Ver 6.60 Aug 22 2023\x00")]
            },

            // ── PREPARE_BUFFER (1503) ──
            // Request format: [flag:u8, cmd:u16, fct:u16, ext:u16]
            // cmd=8 → users, cmd=13 → attendance
            CMD_PREPARE_BUFFER => {
                let inner_cmd =
                    if data.len() >= 3 { u16::from_le_bytes([data[1], data[2]]) } else { 0 };
                let blob: &[u8] = match inner_cmd {
                    9 => &user_blob, // CMD_USERTEMP_RRQ
                    13 => &att_blob, // CMD_ATTLOG_RRQ
                    _ => &[],
                };
                let mut resp = vec![0u8; 5];
                resp[0] = 1;
                resp[1..5].copy_from_slice(&(blob.len() as u32).to_le_bytes());
                vec![ack(session, reply, &resp)]
            },

            // ── READ_BUFFER (1504) ──
            // Request format: [offset:u32 LE, size:u32 LE]
            CMD_READ_BUFFER => {
                let offset = if data.len() >= 4 {
                    u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize
                } else {
                    0
                };
                let want = if data.len() >= 8 {
                    u32::from_le_bytes([data[4], data[5], data[6], data[7]]) as usize
                } else {
                    0
                };

                // Pick the blob that can satisfy this range
                let blob: &[u8] =
                    if offset + want <= user_blob.len() { &user_blob } else { &att_blob };

                let end = (offset + want).min(blob.len());
                let chunk = &blob[offset..end];

                // The Rust client expects a single CMD_DATA frame in response.
                vec![data_packet(session, reply, chunk)]
            },

            // ── FREE_DATA (1502) ──
            CMD_FREE_DATA => vec![ack(session, reply, &[])],

            // ── Default ──
            _ => vec![ack(session, reply, &[])],
        }
    })
}
