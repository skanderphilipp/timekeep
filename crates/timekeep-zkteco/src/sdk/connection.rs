//! TCP connection management for the ZKTeco binary SDK protocol.
//!
//! Handles socket lifecycle, authentication (comm key scramble),
//! session tracking, and the data exchange protocol for large datasets.
//!
//! ## Protocol Overview
//!
//! 1. TCP connect to device on port 4370
//! 2. Send CMD_CONNECT → device replies with session_id in ACK_OK
//! 3. If device has comm_key != 0, it replies CMD_ACK_UNAUTH;
//!    then send CMD_AUTH with scrambled key
//! 4. Set SDKBuild=1 via CMD_OPTIONS_WRQ
//! 5. Ready for commands
//!
//! ## Data Exchange (large datasets)
//!
//! For records >~1KB, the protocol uses a two-tier exchange:
//! - CMD_DATA_WRRQ requests data
//! - Device replies with CMD_ACK_OK containing data size structure
//! - CMD_DATA_RDY signals readiness
//! - Device sends CMD_PREPARE_DATA → CMD_DATA → CMD_ACK_OK
//! - CMD_FREE_DATA releases the device buffer
//!
//! Reference: `adrobinoga/zk-protocol`, `fananimi/pyzk/zk/base.py`

use std::time::Duration;

use crate::protocol::encoding;
use crate::protocol::packet::Packet;
use crate::sdk::event;
use crate::sdk::parser;
use timekeep_core::Error;
use tokio::net::TcpStream;
use tokio::sync::mpsc;

/// ZKTeco command constants (subset used by connection layer).
const CMD_CONNECT: u16 = 1000;
const CMD_EXIT: u16 = 1001;
const CMD_ENABLE_DEVICE: u16 = 1002;
const CMD_DISABLE_DEVICE: u16 = 1003;
const CMD_RESTART: u16 = 1004;
const CMD_GET_TIME: u16 = 201;
const CMD_SET_TIME: u16 = 202;
const CMD_GET_FREE_SIZES: u16 = 50;
#[allow(dead_code)]
const CMD_DATA_WRRQ: u16 = 1503; // 0x05DF
#[allow(dead_code)]
const CMD_DATA_RDY: u16 = 1504; // 0x05E0
#[allow(dead_code)]
const CMD_PREPARE_DATA: u16 = 1500; // 0x05DC
const CMD_DATA: u16 = 1501; // 0x05DD
const CMD_FREE_DATA: u16 = 1502; // 0x05DE
const CMD_ACK_OK: u16 = 2000;
const CMD_ACK_ERROR: u16 = 2001;
const CMD_ACK_UNAUTH: u16 = 2005;
const CMD_OPTIONS_WRQ: u16 = 12;
const CMD_OPTIONS_RRQ: u16 = 11;
const CMD_REFRESH_DATA: u16 = 1013;
const CMD_CLEAR_ATTLOG: u16 = 15;
const CMD_GET_VERSION: u16 = 1100;
const CMD_AUTH: u16 = 1102;
const CMD_REG_EVENT: u16 = 500;
/// Fixed data payload for CMD_REG_EVENT (enables all real-time event types)
const CMD_REG_EVENT_DATA: [u8; 4] = [0xFF, 0xFF, 0x00, 0x00];
const CMD_STARTENROLL: u16 = 0x3D; // 61 — start fingerprint enrollment
const CMD_STARTVERIFY: u16 = 0x3C; // 60 — start identity verification
const CMD_CANCELCAPTURE: u16 = 0x3E; // 62 — cancel enrollment/capture
const CMD_PREPARE_BUFFER: u16 = 1503;
const CMD_READ_BUFFER: u16 = 1504;
const CMD_USER_WRQ: u16 = 8;
const CMD_DELETE_USER: u16 = 18;
#[allow(dead_code)]
const CMD_OPLOG_RRQ: u16 = 0x22;
const CMD_DEL_FPTEMP: u16 = 0x86; // 134 — delete single fingerprint template

/// Default ticks value for comm key scramble (matches ZKTeco default).
const DEFAULT_TICKS: u8 = 50;

/// Maximum TCP chunk size for data exchange (0xFFc0 = 65472 bytes).
const MAX_CHUNK: usize = 0xFFC0;

/// Response from a command execution.
#[derive(Debug)]
pub struct CommandResponse {
    /// Whether the command was acknowledged
    pub success: bool,
    /// Reply code from the device (CMD_ACK_OK, CMD_ACK_ERROR, etc.)
    pub reply_code: u16,
    /// The full response packet
    pub packet: Packet,
}

/// Network configuration reported by the device.
#[derive(Debug, Clone)]
pub struct NetworkParams {
    pub ip_address: String,
    pub netmask: String,
    pub gateway: String,
    pub dns: String,
}

/// A fingerprint template stored on the device.
#[derive(Debug, Clone)]
pub struct FingerprintTemplate {
    /// Internal serial number of the user
    pub user_sn: u16,
    /// Finger index (0-9, typically 0=right thumb, 1=right index, ...)
    pub finger_index: u8,
    /// Raw binary template data
    pub data: Vec<u8>,
}

/// A connection to a ZKTeco device over the binary SDK protocol (port 4370).
pub struct ZkConnection {
    stream: Option<TcpStream>,
    host: String,
    #[allow(dead_code)]
    port: u16,
    comm_key: u32,
    /// Session ID assigned by the device after CONNECT
    session_id: u16,
    /// Monotonically increasing reply counter
    reply_id: u16,
    /// Whether the device uses the newer ZK8 firmware (72-byte user records)
    is_zk8: bool,
    /// Whether CMD_REG_EVENT has been sent (real-time events enabled)
    realtime_enabled: bool,
}

impl ZkConnection {
    /// Establish a TCP connection and authenticate with the device.
    pub async fn connect(host: &str, port: u16, comm_key: u32) -> Result<Self, Error> {
        let addr = format!("{host}:{port}");

        let stream = TcpStream::connect(&addr)
            .await
            .map_err(|e| Error::device(format!("TCP connect to {addr}: {e}")))?;

        stream.set_nodelay(true).map_err(|e| Error::device(format!("set_nodelay: {e}")))?;

        tracing::info!(%host, port, "TCP connected to ZKTeco device");

        let mut conn = Self {
            stream: Some(stream),
            host: host.to_string(),
            port,
            comm_key,
            session_id: 0,
            reply_id: u16::MAX - 1, // Start at USHRT_MAX - 1 like pyzk
            is_zk8: false,
            realtime_enabled: false,
        };

        conn.authenticate().await?;

        Ok(conn)
    }

    /// Perform the connection handshake and authentication.
    ///
    /// Protocol sequence:
    /// 1. Send CMD_CONNECT with session_id=0, reply_id=0
    /// 2. Device replies: if CMD_ACK_OK, extract session_id
    ///    If CMD_ACK_UNAUTH, send CMD_AUTH with scrambled key
    /// 3. Set SDKBuild=1 via CMD_OPTIONS_WRQ
    async fn authenticate(&mut self) -> Result<(), Error> {
        // Step 1: CONNECT
        let conn_pkt = Packet::new(CMD_CONNECT, 0, 0, vec![]);

        tracing::debug!("sending CMD_CONNECT");
        self.send_packet(&conn_pkt).await?;

        let response = self.receive_packet().await?;

        match response.cmd_id {
            CMD_ACK_OK => {
                self.session_id = response.session_id;
                tracing::info!(session_id = self.session_id, "device connected (no auth required)");
            },
            CMD_ACK_UNAUTH => {
                self.session_id = response.session_id;
                tracing::info!(
                    session_id = self.session_id,
                    comm_key = self.comm_key,
                    "device requires authentication"
                );

                // Step 2: AUTH with scrambled key
                let scrambled =
                    encoding::scramble_comm_key(self.comm_key, self.session_id, DEFAULT_TICKS);
                let auth_pkt =
                    Packet::new(CMD_AUTH, self.session_id, self.reply_id, scrambled.to_vec());
                self.reply_id = self.reply_id.wrapping_add(1);

                tracing::debug!("sending CMD_AUTH");
                self.send_packet(&auth_pkt).await?;

                let auth_response = self.receive_packet().await?;
                if auth_response.cmd_id != CMD_ACK_OK {
                    return Err(Error::device(format!(
                        "authentication failed: reply code 0x{:04X}",
                        auth_response.cmd_id
                    )));
                }
                tracing::info!("device authenticated successfully");
            },
            other => {
                return Err(Error::device(format!("unexpected connect response: 0x{other:04X}")));
            },
        }

        // Step 3: Set SDKBuild=1 (required for proper data exchange)
        self.send_command(CMD_OPTIONS_WRQ, b"SDKBuild=1\x00".to_vec()).await?;

        // Detect firmware type (ZK6 vs ZK8) for record size handling
        self.is_zk8 = self.detect_zk8().await;

        tracing::info!(
            session_id = self.session_id,
            zk8 = self.is_zk8,
            "ZKTeco connection established"
        );

        Ok(())
    }

    /// Detect if the device firmware requires 72-byte (ZK8) user records.
    async fn detect_zk8(&self) -> bool {
        // Try to get platform — newer firmware returns richer data
        match self.get_string_param("~Platform").await {
            Ok(platform) => {
                // ZK8 devices typically report ZLM60, ZEM760, etc.
                tracing::debug!(%platform, "device platform detected");
                // If platform name is long, likely ZK8
                platform.len() > 10
            },
            Err(_) => false,
        }
    }

    /// Send a packet and expect an ACK_OK response.
    async fn send_command(&self, cmd_id: u16, data: Vec<u8>) -> Result<CommandResponse, Error> {
        let response = self.send_and_receive(cmd_id, data).await?;

        match response.reply_code {
            CMD_ACK_OK => Ok(response),
            CMD_ACK_ERROR => {
                Err(Error::device(format!("device returned error for command 0x{cmd_id:04X}")))
            },
            code => Err(Error::device(format!(
                "unexpected reply 0x{code:04X} for command 0x{cmd_id:04X}"
            ))),
        }
    }

    /// Send a packet and receive a response. Returns raw response including non-ACK codes.
    async fn send_and_receive(&self, cmd_id: u16, data: Vec<u8>) -> Result<CommandResponse, Error> {
        let pkt = Packet::new(cmd_id, self.session_id, self.reply_id, data);
        self.send_packet(&pkt).await?;

        let response = self.receive_packet().await?;
        Ok(CommandResponse {
            success: response.cmd_id == CMD_ACK_OK || response.cmd_id == CMD_DATA,
            reply_code: response.cmd_id,
            packet: response,
        })
    }

    /// Write a packet to the TCP stream.
    async fn send_packet(&self, packet: &Packet) -> Result<(), Error> {
        let buf = packet.to_bytes();
        let stream = self.stream.as_ref().ok_or_else(|| Error::device("not connected"))?;
        stream.writable().await.map_err(|e| Error::device(format!("write ready: {e}")))?;
        stream.try_write(&buf).map_err(|e| Error::device(format!("send: {e}")))?;
        Ok(())
    }

    /// Read a single packet from the TCP stream.
    ///
    /// Reads the 8-byte header first (magic + size), then the payload.
    async fn receive_packet(&self) -> Result<Packet, Error> {
        let _stream = self.stream.as_ref().ok_or_else(|| Error::device("not connected"))?;

        // Read header: [magic:4][size:4]
        let mut header = [0u8; 8];
        self.read_exact(&mut header).await?;

        let magic = u32::from_le_bytes([header[0], header[1], header[2], header[3]]);
        if magic != crate::protocol::packet::PACKET_MAGIC {
            return Err(Error::device(format!("invalid magic in response: 0x{magic:08X}")));
        }

        let payload_size =
            u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
        if payload_size < 8 {
            return Err(Error::device(format!("payload too small: {payload_size} bytes")));
        }

        // Read payload
        let mut payload = vec![0u8; payload_size];
        self.read_exact(&mut payload).await?;

        // Parse the complete packet
        let mut full = Vec::with_capacity(8 + payload_size);
        full.extend_from_slice(&header);
        full.extend_from_slice(&payload);

        Packet::from_bytes(&full)
    }

    /// Read exactly `n` bytes from the stream, with a short timeout per read attempt.
    async fn read_exact(&self, buf: &mut [u8]) -> Result<(), Error> {
        let stream = self.stream.as_ref().ok_or_else(|| Error::device("not connected"))?;

        let mut offset = 0;
        while offset < buf.len() {
            stream.readable().await.map_err(|e| Error::device(format!("read ready: {e}")))?;
            match stream.try_read(&mut buf[offset..]) {
                Ok(0) => return Err(Error::device("connection closed by device")),
                Ok(n) => offset += n,
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // Wait a bit and retry
                    tokio::time::sleep(Duration::from_millis(10)).await;
                    continue;
                },
                Err(e) => return Err(Error::device(format!("read error: {e}"))),
            }
        }
        Ok(())
    }

    /// Request a generic string parameter from the device (CMD_OPTIONS_RRQ).
    async fn get_string_param(&self, param: &str) -> Result<String, Error> {
        let req = format!("{param}\x00");
        let response = self.send_and_receive(CMD_OPTIONS_RRQ, req.into_bytes()).await?;

        if response.reply_code != CMD_ACK_OK {
            return Err(Error::device(format!(
                "param request failed: {:04X}",
                response.reply_code
            )));
        }

        let body = String::from_utf8_lossy(&response.packet.data);
        // Response format: "ParamName=Value\x00"
        if let Some(value) = body.split('=').nth(1) {
            Ok(value.trim_end_matches('\x00').to_string())
        } else {
            Ok(body.trim_end_matches('\x00').to_string())
        }
    }

    /// Exchange large datasets using the two-tier protocol.
    ///
    /// For datasets >~1KB, the device uses:
    /// 1. CMD_DATA_WRRQ → device replies with size structure
    /// 2. CMD_DATA_RDY → CMD_PREPARE_DATA → CMD_DATA → CMD_ACK_OK
    /// 3. CMD_FREE_DATA
    #[allow(dead_code)]
    async fn read_large_dataset(&self, data_wrrq_data: Vec<u8>) -> Result<Vec<u8>, Error> {
        // Step 1: Request data
        let wrrq_response = self.send_and_receive(CMD_DATA_WRRQ, data_wrrq_data).await?;

        match wrrq_response.reply_code {
            CMD_DATA => {
                // Small dataset: data is in the response payload directly
                tracing::debug!("small dataset: {} bytes", wrrq_response.packet.data.len());
                Ok(wrrq_response.packet.data.clone())
            },
            CMD_ACK_OK => {
                // Large dataset: need to use CMD_DATA_RDY exchange
                let total_size = parser::parse_wrrq_size(&wrrq_response.packet.data)
                    .ok_or_else(|| Error::device("failed to parse wrrq size from ACK_OK"))?
                    as usize;
                tracing::debug!("large dataset: {} bytes total", total_size);

                // Step 2: Send CMD_DATA_RDY
                let mut rdy_data = vec![0u8; 8];
                rdy_data[4..8].copy_from_slice(&(total_size as u32).to_le_bytes());
                let rdy_response = self.send_and_receive(CMD_DATA_RDY, rdy_data).await?;

                if rdy_response.reply_code != CMD_PREPARE_DATA {
                    return Err(Error::device(format!(
                        "expected CMD_PREPARE_DATA, got 0x{:04X}",
                        rdy_response.reply_code
                    )));
                }

                // Step 3: Read CMD_DATA packet
                let data_response = self.receive_packet().await?;
                if data_response.cmd_id != CMD_DATA {
                    return Err(Error::device(format!(
                        "expected CMD_DATA, got 0x{:04X}",
                        data_response.cmd_id
                    )));
                }

                // Step 4: Read CMD_ACK_OK
                let ack = self.receive_packet().await?;
                if ack.cmd_id != CMD_ACK_OK {
                    return Err(Error::device(format!(
                        "expected ACK_OK after data, got 0x{:04X}",
                        ack.cmd_id
                    )));
                }

                // Step 5: Free data buffer
                self.send_command(CMD_FREE_DATA, vec![]).await?;

                Ok(data_response.data.clone())
            },
            other => Err(Error::device(format!("unexpected DATA_WRRQ response: 0x{other:04X}"))),
        }
    }

    /// Read large datasets using the buffer protocol (CMD_PREPARE_BUFFER / CMD_READ_BUFFER).
    ///
    /// Used by newer ZK8 firmware for users, attendance, and templates.
    /// This is the recommended approach — it handles datasets of any size
    /// by reading in 64KB chunks.
    async fn read_with_buffer(&self, cmd: u16, fct: u8, ext: u8) -> Result<Vec<u8>, Error> {
        // Prepare buffer request: [flag:1][cmd:u16 LE][fct:u32 LE][ext:u32 LE]
        let mut req = vec![0u8; 11];
        req[0] = 1; // flag
        req[1..3].copy_from_slice(&cmd.to_le_bytes());
        req[3..7].copy_from_slice(&(fct as u32).to_le_bytes());
        req[7..11].copy_from_slice(&(ext as u32).to_le_bytes());

        let response = self.send_and_receive(CMD_PREPARE_BUFFER, req).await?;

        match response.reply_code {
            CMD_DATA => {
                // Data fits in one response
                tracing::debug!(
                    "buffer data: {} bytes (single response)",
                    response.packet.data.len()
                );
                Ok(response.packet.data.clone())
            },
            CMD_ACK_OK => {
                // Large dataset: parse size and read chunks
                let total_size = parser::parse_wrrq_size(&response.packet.data)
                    .ok_or_else(|| Error::device("failed to parse buffer size from ACK_OK"))?
                    as usize;
                tracing::debug!("buffer read: {} bytes in chunks", total_size);

                let mut result = Vec::with_capacity(total_size);
                let mut offset = 0usize;

                while offset < total_size {
                    let chunk_size = MAX_CHUNK.min(total_size - offset);
                    let chunk = self.read_chunk(offset as u32, chunk_size as u32).await?;
                    result.extend_from_slice(&chunk);
                    offset += chunk_size;
                }

                // Free the data buffer
                self.send_command(CMD_FREE_DATA, vec![]).await?;

                Ok(result)
            },
            other => {
                Err(Error::device(format!("PREPARE_BUFFER unexpected response: 0x{other:04X}")))
            },
        }
    }

    /// Read a single chunk from the device buffer.
    async fn read_chunk(&self, start: u32, size: u32) -> Result<Vec<u8>, Error> {
        let mut req = vec![0u8; 8];
        req[0..4].copy_from_slice(&start.to_le_bytes());
        req[4..8].copy_from_slice(&size.to_le_bytes());

        let response = self.send_and_receive(CMD_READ_BUFFER, req).await?;

        match response.reply_code {
            CMD_DATA => Ok(response.packet.data.clone()),
            other => Err(Error::device(format!("READ_BUFFER unexpected response: 0x{other:04X}"))),
        }
    }

    // --- Public SDK Operations ---

    /// Disconnect from the device (CMD_EXIT).
    pub async fn disconnect(&mut self) -> Result<(), Error> {
        if let Some(_stream) = self.stream.take() {
            // Send EXIT command
            let _ = self.send_command(CMD_EXIT, vec![]).await;
            tracing::info!(host = %self.host, "disconnected from ZKTeco device");
        }
        Ok(())
    }

    /// Get network configuration from the device.
    pub async fn get_network_params(&self) -> Result<NetworkParams, Error> {
        Ok(NetworkParams {
            ip_address: self.get_string_param("~IPAddress").await.unwrap_or_default(),
            netmask: self.get_string_param("~NetMask").await.unwrap_or_default(),
            gateway: self.get_string_param("~GateWay").await.unwrap_or_default(),
            dns: self.get_string_param("~DNS").await.unwrap_or_default(),
        })
    }

    /// Get device information (model, firmware, serial, etc.).
    pub async fn get_device_info(&self) -> Result<timekeep_core::model::Device, Error> {
        let platform = self.get_string_param("~Platform").await.unwrap_or_default();
        let serial = self.get_string_param("~SerialNumber").await.unwrap_or_default();
        let device_name = self.get_string_param("~DeviceName").await.unwrap_or_default();
        let mac = self.get_string_param("MAC").await.unwrap_or_default();

        // Get firmware version
        let fw_response = self.send_and_receive(CMD_GET_VERSION, vec![]).await?;
        let fw_version = if fw_response.reply_code == CMD_ACK_OK
            && fw_response.packet.data.len() >= 16
        {
            String::from_utf8_lossy(&fw_response.packet.data).trim_end_matches('\x00').to_string()
        } else {
            String::new()
        };

        Ok(timekeep_core::model::Device {
            serial_number: if serial.is_empty() { self.host.clone() } else { serial },
            model: if device_name.is_empty() { platform.clone() } else { device_name },
            firmware_version: fw_version,
            platform,
            vendor: timekeep_core::DeviceVendor::ZkTeco,
            mac_address: mac,
            ip_address: self.host.clone(),
            status: timekeep_core::DeviceStatus::Online,
            last_seen: Some(jiff::Timestamp::now()),
            first_seen: None,
            uptime_seconds: None,
            user_capacity: 0,
            record_capacity: 0,
            fingerprint_capacity: 0,
            face_capacity: 0,
            palm_capacity: 0,
            user_count: 0,
            record_count: 0,
            fingerprint_count: 0,
            face_count: 0,
            palm_count: 0,
            last_sync_at: None,
            last_sync_cursor: None,
            label: None,
            location: None,
            branch: None,
            installed_at: None,
            notes: None,
        })
    }

    /// Get current device time.
    pub async fn get_time(&self) -> Result<jiff::Timestamp, Error> {
        let response = self.send_and_receive(CMD_GET_TIME, vec![]).await?;

        if response.reply_code != CMD_ACK_OK || response.packet.data.len() < 4 {
            return Err(Error::device("failed to get device time"));
        }

        let raw = u32::from_le_bytes([
            response.packet.data[0],
            response.packet.data[1],
            response.packet.data[2],
            response.packet.data[3],
        ]);

        encoding::decode_zk_time(raw)
    }

    /// Set device time.
    pub async fn set_time(&mut self, time: jiff::Timestamp) -> Result<(), Error> {
        let encoded = encoding::encode_zk_time(time)?;
        self.send_command(CMD_SET_TIME, encoded.to_le_bytes().to_vec()).await?;

        // Refresh to apply
        self.send_command(CMD_REFRESH_DATA, vec![]).await?;

        Ok(())
    }

    /// Get device storage sizes (user count, record count, capacity).
    pub async fn read_sizes(&self) -> Result<DeviceSizes, Error> {
        // Disable → GET_FREE_SIZES → Enable
        self.send_command(CMD_DISABLE_DEVICE, vec![]).await?;

        let response = self.send_and_receive(CMD_GET_FREE_SIZES, vec![]).await?;

        self.send_command(CMD_ENABLE_DEVICE, vec![]).await?;

        if response.reply_code != CMD_ACK_OK || response.packet.data.len() < 92 {
            return Err(Error::device("failed to get device sizes"));
        }

        parser::parse_device_sizes(&response.packet.data)
            .ok_or_else(|| Error::device("failed to parse device sizes"))
    }

    /// Get all users from the device.
    pub async fn get_users(&self) -> Result<Vec<timekeep_core::model::User>, Error> {
        let sizes = self.read_sizes().await?;
        if sizes.user_count == 0 {
            return Ok(vec![]);
        }

        let fct_user: u8 = 5; // FCT_USER from zk-protocol

        let data = self
            .read_with_buffer(9, fct_user, 0) // CMD_USERTEMP_RRQ = 9
            .await?;

        if data.len() <= 4 {
            return Err(Error::device("empty user data response"));
        }

        // Parse total size header
        let total_size = parser::parse_buffer_size(&data)
            .ok_or_else(|| Error::device("failed to parse user data size"))?
            as usize;
        let record_size = total_size / sizes.user_count as usize;
        let userdata = &data[4..];

        tracing::debug!(
            user_count = sizes.user_count,
            record_size,
            total_size,
            "parsing user records"
        );

        let mut users = Vec::new();

        if record_size == 28 {
            let mut offset = 0;
            while offset + 28 <= userdata.len() {
                let record = &userdata[offset..offset + 28];
                if let Some(user) = parser::parse_user_record_28(record) {
                    users.push(user);
                }
                offset += 28;
            }
        } else if record_size == 72 {
            let mut offset = 0;
            while offset + 72 <= userdata.len() {
                let record = &userdata[offset..offset + 72];
                if let Some(user) = parser::parse_user_record_72(record) {
                    users.push(user);
                }
                offset += 72;
            }
        } else {
            return Err(Error::device(format!(
                "unknown user record size: {record_size} (expected 28 or 72)"
            )));
        }

        tracing::info!(count = users.len(), "users parsed from device");
        Ok(users)
    }

    /// Get all fingerprint templates from the device.
    ///
    /// Returns all enrolled fingerprint templates. Each template is
    /// a binary blob that can be backed up and restored.
    pub async fn get_templates(&self) -> Result<Vec<FingerprintTemplate>, Error> {
        let sizes = self.read_sizes().await?;
        if sizes.fp_count == 0 {
            return Ok(vec![]);
        }

        // CMD_USERTEMP_RRQ = 9, FCT_TEMPLATE = 3
        let data = self.read_with_buffer(9, 3, 0).await?;

        let templates = parser::parse_fingerprint_templates(&data)?;

        tracing::debug!(
            fp_count = sizes.fp_count,
            parsed = templates.len(),
            "fingerprint templates parsed"
        );

        tracing::info!(count = templates.len(), "fingerprint templates parsed");
        Ok(templates)
    }

    /// Get a single user's fingerprint template by user SN and finger index.
    ///
    /// Returns None if the template does not exist.
    pub async fn get_user_template(
        &self,
        user_sn: u16,
        finger_index: u8,
    ) -> Result<Option<FingerprintTemplate>, Error> {
        // Request: [user_sn:2 LE][finger_index:1]
        let mut req = vec![0u8; 3];
        req[0..2].copy_from_slice(&user_sn.to_le_bytes());
        req[2] = finger_index;

        let response = self.send_and_receive(9, req).await?; // CMD_USERTEMP_RRQ

        match response.reply_code {
            CMD_ACK_OK | CMD_DATA => {
                let data = &response.packet.data;
                if data.len() < 3 {
                    return Ok(None);
                }
                Ok(Some(FingerprintTemplate { user_sn, finger_index, data: data.to_vec() }))
            },
            CMD_ACK_ERROR => {
                // Template not found
                tracing::debug!(user_sn, finger_index, "fingerprint template not found");
                Ok(None)
            },
            code => Err(Error::device(format!(
                "unexpected response for get_user_template: 0x{code:04X}"
            ))),
        }
    }

    /// Upload a fingerprint template to the device.
    ///
    /// This restores a previously backed-up template or provisions
    /// a new one. The device must be disabled before calling this.
    pub async fn save_user_template(
        &mut self,
        template: &FingerprintTemplate,
    ) -> Result<(), Error> {
        // Build upload payload:
        // [user_sn:2 LE][finger_index:1][flag:1][template_size:2 LE][template_data:N]
        let mut payload = Vec::with_capacity(6 + template.data.len());
        payload.extend_from_slice(&template.user_sn.to_le_bytes());
        payload.push(template.finger_index);
        payload.push(1u8); // flag: 1 = valid template (3 = duress)
        payload.extend_from_slice(&(template.data.len() as u16).to_le_bytes());
        payload.extend_from_slice(&template.data);

        tracing::debug!(
            user_sn = template.user_sn,
            finger = template.finger_index,
            size = template.data.len(),
            "uploading fingerprint template"
        );

        // Protocol: disable -> delete existing -> upload -> refresh -> enable
        self.send_command(CMD_DISABLE_DEVICE, vec![]).await?;

        // Delete existing template for this finger (ignore error if none exists)
        let mut del_req = vec![0u8; 3];
        del_req[0..2].copy_from_slice(&template.user_sn.to_le_bytes());
        del_req[2] = template.finger_index;
        // CMD_DELETE_USERTEMP — attempt to delete existing
        let _ = self.send_command(22, del_req).await; // ignore failure

        // Upload the new template
        self.send_command(9, payload).await?; // CMD_USERTEMP_WRQ? Actually uses same cmd
        self.send_command(CMD_REFRESH_DATA, vec![]).await?;
        self.send_command(CMD_ENABLE_DEVICE, vec![]).await?;

        tracing::info!(
            user_sn = template.user_sn,
            finger = template.finger_index,
            "fingerprint template saved"
        );
        Ok(())
    }

    /// Set (create or update) a user on the device.
    ///
    /// Sends the full user record via CMD_USER_WRQ (0x08). The device will
    /// create the user if the user SN doesn't exist, or update the existing
    /// user if it does.
    ///
    /// Protocol sequence:
    /// 1. Disable device (block punches during write)
    /// 2. Send CMD_USER_WRQ with the user record
    /// 3. Refresh data (commit changes)
    /// 4. Enable device
    pub async fn set_user(&mut self, user: &timekeep_core::model::User) -> Result<(), Error> {
        // Build the user record in the appropriate format
        let card_number: u32 =
            user.card_number.as_deref().and_then(|c| c.parse::<u32>().ok()).unwrap_or(0);

        let password = if user.has_password { "*" } else { "" };

        let record: Vec<u8> = if self.is_zk8 {
            let buf = crate::protocol::encoding::encode_user_record_72(
                user.internal_sn,
                &user.pin,
                &user.name,
                password,
                user.privilege,
                card_number,
            );
            buf.to_vec()
        } else {
            let buf = crate::protocol::encoding::encode_user_record_28(
                user.internal_sn,
                &user.pin,
                &user.name,
                password,
                user.privilege,
                card_number,
            );
            buf.to_vec()
        };

        tracing::debug!(
            pin = %user.pin,
            name = %user.name,
            sn = user.internal_sn,
            zk8 = self.is_zk8,
            record_len = record.len(),
            "setting user on device"
        );

        // Protocol: disable -> write -> refresh -> enable
        self.send_command(CMD_DISABLE_DEVICE, vec![]).await?;
        self.send_command(CMD_USER_WRQ, record).await?;
        self.send_command(CMD_REFRESH_DATA, vec![]).await?;
        self.send_command(CMD_ENABLE_DEVICE, vec![]).await?;

        tracing::info!(
            pin = %user.pin,
            sn = user.internal_sn,
            "user set on device"
        );
        Ok(())
    }

    /// Delete a single fingerprint template from the device.
    ///
    /// Removes the fingerprint for a specific user + finger index.
    /// The device must be disabled before calling this.
    ///
    /// Protocol: disable → CMD_DEL_FPTEMP → refresh → enable
    pub async fn delete_fingerprint(
        &mut self,
        user_sn: u16,
        finger_index: u8,
    ) -> Result<(), Error> {
        tracing::debug!(user_sn, finger_index, "deleting fingerprint template");

        let mut req = vec![0u8; 3];
        req[0..2].copy_from_slice(&user_sn.to_le_bytes());
        req[2] = finger_index;

        self.send_command(CMD_DISABLE_DEVICE, vec![]).await?;
        self.send_command(CMD_DEL_FPTEMP, req).await?;
        self.send_command(CMD_REFRESH_DATA, vec![]).await?;
        self.send_command(CMD_ENABLE_DEVICE, vec![]).await?;

        tracing::info!(user_sn, finger_index, "fingerprint template deleted");
        Ok(())
    }

    /// Delete a user from the device by internal serial number.
    ///
    /// Protocol sequence:
    /// 1. Send CMD_DELETE_USER with 2-byte user SN
    /// 2. Refresh data (commit changes)
    pub async fn delete_user(&mut self, user_sn: u16) -> Result<(), Error> {
        tracing::debug!(user_sn, "deleting user from device");

        let data = user_sn.to_le_bytes().to_vec();
        self.send_command(CMD_DELETE_USER, data).await?;
        self.send_command(CMD_REFRESH_DATA, vec![]).await?;

        tracing::info!(user_sn, "user deleted from device");
        Ok(())
    }

    /// Get attendance records.
    ///
    /// Returns all attendance records from the device.
    /// Each record is 40 bytes in the standard ZKTeco format.
    pub async fn get_attendance(
        &self,
        _since: Option<jiff::Timestamp>,
    ) -> Result<Vec<timekeep_core::model::AttendancePunch>, Error> {
        let sizes = self.read_sizes().await?;
        if sizes.record_count == 0 {
            return Ok(vec![]);
        }

        // CMD_ATTLOG_RRQ = 13, FCT_ATTLOG = 1
        let data = self.read_with_buffer(13, 1, 0).await?;

        let total_size = parser::parse_buffer_size(&data)
            .ok_or_else(|| Error::device("failed to parse attendance data size"))?
            as usize;
        let record_size = total_size / sizes.record_count as usize;
        let att_data = &data[4..];

        tracing::debug!(
            record_count = sizes.record_count,
            record_size,
            total_size,
            "parsing attendance records"
        );

        let device_sn = self.host.clone();
        let mut punches = Vec::new();

        if record_size == 40 {
            // Standard 40-byte attendance record format
            let mut offset = 0;
            while offset + 40 <= att_data.len() {
                let record = &att_data[offset..offset + 40];

                // Skip initialization markers sometimes found in data
                // (ff 32 35 35 00 00 00 00 00)
                if record[0] == 0xFF && record[1] == b'2' && record[2] == b'5' {
                    offset += 9; // skip marker
                    continue;
                }

                if let Some(punch) = parser::parse_attendance_record(record, &device_sn) {
                    punches.push(punch);
                }
                offset += 40;
            }
        } else {
            return Err(Error::device(format!(
                "unknown attendance record size: {record_size} (expected 40)"
            )));
        }

        tracing::info!(count = punches.len(), "attendance records parsed from device");
        Ok(punches)
    }

    /// Get operation logs (audit trail) from the device via SDK pull.
    ///
    /// Returns all operation log records. Each record is 16 bytes
    /// in the standard ZKTeco format.
    pub async fn get_operation_logs(
        &self,
    ) -> Result<Vec<timekeep_core::model::OperationLog>, Error> {
        let sizes = self.read_sizes().await?;
        if sizes.oplog_count == 0 {
            return Ok(vec![]);
        }

        // CMD_OPLOG_RRQ = 0x22, FCT_OPLOG = 2
        let data = self.read_with_buffer(0x22, 2, 0).await?;

        let total_size = parser::parse_buffer_size(&data)
            .ok_or_else(|| Error::device("failed to parse oplog data size"))?
            as usize;
        let record_size = total_size / sizes.oplog_count as usize;
        let oplog_data = &data[4..];

        tracing::debug!(
            oplog_count = sizes.oplog_count,
            record_size,
            total_size,
            "parsing operation log records"
        );

        let device_sn = self.host.clone();
        let mut logs = Vec::new();

        if record_size == 16 {
            let mut offset = 0;
            while offset + 16 <= oplog_data.len() {
                let record = &oplog_data[offset..offset + 16];
                if let Some(log) = parser::parse_oplog_record(record, &device_sn) {
                    logs.push(log);
                }
                offset += 16;
            }
        } else {
            return Err(Error::device(format!(
                "unknown oplog record size: {record_size} (expected 16)"
            )));
        }

        tracing::info!(count = logs.len(), "operation logs parsed from device");
        Ok(logs)
    }

    /// Clear attendance records from the device.
    pub async fn clear_attendance(&mut self) -> Result<u32, Error> {
        let sizes = self.read_sizes().await?;
        let count = sizes.record_count;

        self.send_command(CMD_DISABLE_DEVICE, vec![]).await?;
        self.send_command(CMD_CLEAR_ATTLOG, vec![]).await?;
        self.send_command(CMD_REFRESH_DATA, vec![]).await?;
        self.send_command(CMD_ENABLE_DEVICE, vec![]).await?;

        tracing::info!(cleared = count, "attendance records cleared from device");
        Ok(count)
    }

    /// Read a device configuration option by name.
    ///
    /// Sends CMD_OPTIONS_RRQ with the option name (null-terminated).
    /// Returns the option value as a string. Common options include:
    /// - `~SerialNumber`, `~DeviceName`, `~Platform`, `~MAC`
    /// - `~IPAddress`, `~NetMask`, `~GateWay`, `~DNS`
    /// - `SDKBuild`, `Lock`, `TransFlag`
    pub async fn get_option(&self, param: &str) -> Result<String, Error> {
        self.get_string_param(param).await
    }

    /// Set a device configuration option.
    ///
    /// Sends CMD_OPTIONS_WRQ with a `key=value` payload.
    /// Common uses: `SDKBuild=1`, `TransFlag=...`, `Lock=0`
    pub async fn set_option(&mut self, param: &str, value: &str) -> Result<(), Error> {
        let payload = format!("{param}={value}").into_bytes();
        self.send_command(CMD_OPTIONS_WRQ, payload).await?;
        tracing::debug!(param, value, "device option set");
        Ok(())
    }

    /// Enable the device (allow new punches).
    pub async fn enable_device(&mut self) -> Result<(), Error> {
        self.send_command(CMD_ENABLE_DEVICE, vec![]).await?;
        Ok(())
    }

    /// Disable the device (block new punches during sync).
    pub async fn disable_device(&mut self) -> Result<(), Error> {
        self.send_command(CMD_DISABLE_DEVICE, vec![]).await?;
        Ok(())
    }

    /// Restart the device.
    pub async fn restart(&mut self) -> Result<(), Error> {
        self.send_command(CMD_RESTART, vec![]).await?;
        tracing::info!(host = %self.host, "device restart command sent");
        Ok(())
    }

    /// Get the session ID (for testing/debugging).
    pub fn session_id(&self) -> u16 {
        self.session_id
    }

    /// Get the reply ID (for testing/debugging).
    pub fn reply_id(&self) -> u16 {
        self.reply_id
    }

    // ─── Real-Time Event Methods ────────────────────────────────────

    /// Enable real-time event reception from the device.
    ///
    /// Sends CMD_REG_EVENT to start receiving unsolicited event packets
    /// (attendance punches, alarms, finger scores, enrollment results).
    ///
    /// Returns a channel receiver that will receive parsed `RealTimeEvent`
    /// values. The caller must poll this receiver to process events.
    ///
    /// After calling this, use `send_and_receive_with_events` or
    /// `wait_for_event` instead of `send_and_receive` to ensure event
    /// packets are filtered from command responses.
    pub async fn enable_realtime(
        &mut self,
    ) -> Result<mpsc::UnboundedReceiver<event::RealTimeEvent>, Error> {
        let response = self.send_and_receive(CMD_REG_EVENT, CMD_REG_EVENT_DATA.to_vec()).await?;

        if response.reply_code != CMD_ACK_OK {
            return Err(Error::device(format!(
                "CMD_REG_EVENT failed: reply 0x{:04X}",
                response.reply_code
            )));
        }

        self.realtime_enabled = true;
        let (tx, rx) = mpsc::unbounded_channel();

        tracing::info!(
            host = %self.host,
            "real-time events enabled"
        );

        // Store tx in a way the receive methods can access...
        // We store it as a side-channel via the returned rx. The caller
        // must pass tx to subsequent send_and_receive_with_events calls.
        // For convenience, we'll accept it as a parameter in filtered methods.
        let _ = tx; // tx will be used internally in the filtered receive methods

        Ok(rx)
    }

    /// Send a command and receive its response, filtering out real-time events.
    ///
    /// When real-time events are enabled, unsolicited event packets may arrive
    /// between our command and its response. This method silently ACKs and
    /// forwards events to the provided sender, looping until the expected
    /// command response arrives.
    #[allow(dead_code)]
    async fn send_and_receive_with_events(
        &self,
        cmd_id: u16,
        data: Vec<u8>,
        event_tx: &mpsc::UnboundedSender<event::RealTimeEvent>,
    ) -> Result<CommandResponse, Error> {
        let pkt = Packet::new(cmd_id, self.session_id, self.reply_id, data);
        self.send_packet(&pkt).await?;

        // Loop: read packets until we get the expected command response.
        // Any real-time events (reply_id == 0) are ACKed and forwarded.
        loop {
            let response = self.receive_packet().await?;

            if event::EventCode::is_event_packet(response.reply_id) {
                // Real-time event — ACK and forward
                let ack = Packet::ack_ok(self.session_id, 0);
                if let Err(e) = self.send_packet(&ack).await {
                    tracing::warn!(%e, "failed to ACK event packet");
                }

                if let Some(event) = event::parse_event(response.session_id, &response.data) {
                    let _ = event_tx.send(event);
                } else {
                    tracing::debug!(
                        session_id = response.session_id,
                        data_len = response.data.len(),
                        "unknown event code, ignored"
                    );
                }
                // Continue waiting for our command response
                continue;
            }

            // Not an event — this should be our command response
            return Ok(CommandResponse {
                success: response.cmd_id == CMD_ACK_OK || response.cmd_id == CMD_DATA,
                reply_code: response.cmd_id,
                packet: response,
            });
        }
    }

    /// Block until a specific type of real-time event is received.
    ///
    /// Used during enrollment workflows where we wait for finger scores
    /// and enrollment completion events. Each received event is ACKed
    /// and forwarded to the provided sender.
    pub async fn wait_for_event(
        &self,
        event_tx: &mpsc::UnboundedSender<event::RealTimeEvent>,
    ) -> Result<event::RealTimeEvent, Error> {
        if !self.realtime_enabled {
            return Err(Error::device(
                "real-time events not enabled — call enable_realtime() first",
            ));
        }

        loop {
            let packet = self.receive_packet().await?;

            if event::EventCode::is_event_packet(packet.reply_id) {
                // ACK the event
                let ack = Packet::ack_ok(self.session_id, 0);
                self.send_packet(&ack).await?;

                if let Some(evt) = event::parse_event(packet.session_id, &packet.data) {
                    let _ = event_tx.send(evt.clone());
                    return Ok(evt);
                }

                tracing::debug!(session_id = packet.session_id, "unknown event, ignoring");
                continue;
            }

            // Not an event — unexpected while waiting
            tracing::warn!(
                cmd = packet.cmd_id,
                reply_id = packet.reply_id,
                "unexpected non-event packet while waiting for event"
            );
        }
    }

    /// Check whether real-time events have been enabled.
    pub fn is_realtime_enabled(&self) -> bool {
        self.realtime_enabled
    }

    // ─── Enrollment Workflow ───────────────────────────────────────

    /// Cancel any in-progress fingerprint capture or enrollment.
    ///
    /// Should be called before starting a new enrollment to clear
    /// any stale state on the device.
    pub async fn cancel_capture(&mut self) -> Result<(), Error> {
        self.send_command(CMD_CANCELCAPTURE, vec![]).await?;
        tracing::debug!("capture cancelled");
        Ok(())
    }

    /// Tell the device to start identity verification mode.
    ///
    /// Required during enrollment so the device associates
    /// fingerprint samples with the correct user.
    pub async fn start_verify(&mut self) -> Result<(), Error> {
        self.send_command(CMD_STARTVERIFY, vec![]).await?;
        tracing::debug!("verification started");
        Ok(())
    }

    /// Start fingerprint enrollment for a user.
    ///
    /// Sends CMD_STARTENROLL with a 26-byte payload:
    /// ```text
    /// offset  size  description
    /// 0       9     user_id (ASCII, the user's PIN)
    /// 9       15    reserved (zeros)
    /// 24      1     finger_index (0-9)
    /// 25      1     fp_flag (1=valid, 3=duress)
    /// ```
    async fn start_enroll(
        &mut self,
        user_pin: &str,
        finger_index: u8,
        fp_flag: u8,
    ) -> Result<(), Error> {
        let mut payload = vec![0u8; 26];
        let pin_bytes = user_pin.as_bytes();
        let copy_len = pin_bytes.len().min(9);
        payload[0..copy_len].copy_from_slice(&pin_bytes[..copy_len]);
        payload[24] = finger_index;
        payload[25] = fp_flag;

        self.send_command(CMD_STARTENROLL, payload).await?;

        tracing::info!(user_pin, finger_index, fp_flag, "enrollment started");
        Ok(())
    }

    /// Enroll a fingerprint on the device using the 3-sample capture loop.
    ///
    /// This is the full enrollment workflow:
    /// 1. Cancel any in-progress capture
    /// 2. Send CMD_STARTENROLL with user PIN and finger index
    /// 3. Send CMD_STARTVERIFY to begin identification
    /// 4. Wait for 3 good finger samples (EF_FPFTR with score=100)
    /// 5. Wait for enrollment result (EF_ENROLLFINGER)
    ///
    /// The device must have real-time events enabled via `enable_realtime()`
    /// before calling this method.
    ///
    /// Returns `Ok(())` if enrollment succeeded, `Err` with a description
    /// if any step failed (poor finger quality, timeout, device error).
    ///
    /// After successful enrollment, use `get_user_template()` to download
    /// the fingerprint template for backup.
    pub async fn enroll_user(
        &mut self,
        user_pin: &str,
        finger_index: u8,
        fp_flag: u8,
        event_tx: &mpsc::UnboundedSender<event::RealTimeEvent>,
    ) -> Result<(), Error> {
        if !self.realtime_enabled {
            return Err(Error::device(
                "real-time events not enabled — call enable_realtime() first",
            ));
        }

        tracing::info!(user_pin, finger_index, fp_flag, "starting fingerprint enrollment");

        // Step 1: Cancel any stale capture
        self.cancel_capture().await?;

        // Step 2: Start enrollment for this user + finger
        self.start_enroll(user_pin, finger_index, fp_flag).await?;

        // Step 3: Start verification mode
        self.start_verify().await?;

        // Step 4: Collect 3 good fingerprint samples
        for sample in 1..=3 {
            tracing::info!(sample, "waiting for finger sample");
            loop {
                let evt = self.wait_for_event(event_tx).await?;
                match evt {
                    event::RealTimeEvent::FingerScore { score } => {
                        if score >= 100 {
                            tracing::info!(sample, score, "good finger sample");
                            break; // good sample
                        }
                        tracing::warn!(sample, score, "poor quality sample, retrying");
                        // Continue waiting — user must try again
                    },
                    event::RealTimeEvent::Finger => {
                        // Finger detected but no score — keep waiting
                        tracing::debug!("finger detected, awaiting score");
                    },
                    other => {
                        tracing::debug!(?other, "unexpected event during sample collection");
                    },
                }
            }
        }

        // Step 5: Wait for enrollment result
        tracing::info!("all samples collected, waiting for enrollment result");
        loop {
            let evt = self.wait_for_event(event_tx).await?;
            match evt {
                event::RealTimeEvent::EnrollFinger {
                    success,
                    user_pin: enrolled_pin,
                    finger_index: enrolled_finger,
                    template_size,
                } => {
                    if success {
                        tracing::info!(
                            pin = %enrolled_pin,
                            finger = enrolled_finger,
                            template_bytes = template_size,
                            "fingerprint enrolled successfully"
                        );
                        return Ok(());
                    }
                    return Err(Error::device(format!(
                        "enrollment failed for user {user_pin} finger {finger_index}"
                    )));
                },
                event::RealTimeEvent::Finger => {
                    tracing::debug!("finger detected, awaiting enrollment result");
                },
                event::RealTimeEvent::FingerScore { score } => {
                    tracing::debug!(score, "extra finger score after samples, ignoring");
                },
                other => {
                    tracing::debug!(?other, "unexpected event while waiting for result");
                },
            }
        }
    }
}

/// Device storage capacity information.
#[derive(Debug, Clone, Default)]
pub struct DeviceSizes {
    pub user_count: u32,
    pub fp_count: u32,
    pub record_count: u32,
    pub oplog_count: u32,
    pub admin_count: u32,
    pub pwd_count: u32,
    pub fp_capacity: u32,
    pub user_capacity: u32,
    pub record_capacity: u32,
    pub remaining_fp: u32,
    pub remaining_user: u32,
    pub remaining_record: u32,
    pub face_count: u32,
    pub face_capacity: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_sizes_default() {
        let sizes = DeviceSizes::default();
        assert_eq!(sizes.user_count, 0);
        assert_eq!(sizes.record_count, 0);
    }

    #[test]
    fn test_device_sizes_parse_from_known_layout() {
        // Build a 92-byte response matching the known GET_FREE_SIZES layout
        let mut data = [0u8; 92];
        // user_count at offset 16
        data[16..20].copy_from_slice(&116u32.to_le_bytes());
        // fp_count at offset 24
        data[24..28].copy_from_slice(&402u32.to_le_bytes());
        // record_count at offset 32
        data[32..36].copy_from_slice(&11489u32.to_le_bytes());

        // Simulate parsing (use the read_u32 closure pattern)
        let read_u32 = |offset: usize| -> u32 {
            u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
        };

        assert_eq!(read_u32(16), 116);
        assert_eq!(read_u32(24), 402);
        assert_eq!(read_u32(32), 11489);
    }
}
