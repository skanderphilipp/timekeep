//! Packet framing for the ZKTeco binary protocol.
//!
//! Every packet follows this structure:
//! ```text
//! [magic: u32 LE | payload_size: u32 LE | payload: ...]
//! ```
//!
//! The payload decomposes into:
//! ```text
//! [cmd_id: u16 LE | checksum: u16 LE | session_id: u16 LE | reply_id: u16 LE | data: ...]
//! ```
//!
//! Reference: `adrobinoga/zk-protocol` protocol.md

use super::checksum;

use timekeep_core::Error;

/// Magic bytes that prefix every ZKTeco protocol packet.
pub const PACKET_MAGIC: u32 = 0x5050827D;

/// A complete ZKTeco binary protocol packet, ready for wire format.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Packet {
    /// Command ID or reply code (see `sdk::commands::Command`)
    pub cmd_id: u16,
    /// 16-bit ones-complement checksum over the payload (excluding checksum field)
    pub checksum: u16,
    /// Session ID assigned by device after CONNECT
    pub session_id: u16,
    /// Monotonically increasing reply counter
    pub reply_id: u16,
    /// Command-specific payload data
    pub data: Vec<u8>,
}

impl Packet {
    /// Create a new packet with computed checksum.
    ///
    /// The checksum is computed over: cmd_id(u16 LE) + zero_checksum(u16 LE) +
    /// session_id(u16 LE) + reply_id(u16 LE) + data.
    pub fn new(cmd_id: u16, session_id: u16, reply_id: u16, data: Vec<u8>) -> Self {
        let checksum = compute_checksum(cmd_id, session_id, reply_id, &data);
        Self { cmd_id, checksum, session_id, reply_id, data }
    }

    /// Serialize this packet to the ZKTeco wire format.
    ///
    /// Format:
    /// ```text
    /// [magic: 4 bytes BE] [payload_size: u32 LE] [payload: 8 + data.len() bytes]
    /// ```
    /// PACKET_MAGIC is the byte sequence [0x50, 0x50, 0x82, 0x7D] sent as-is
    /// (big-endian / network byte order). All other multi-byte fields are LE.
    /// FIX: was incorrectly using to_le_bytes() which reversed the byte order.
    pub fn to_bytes(&self) -> Vec<u8> {
        let payload_size = 8 + self.data.len() as u32; // 8 = cmd_id + checksum + session_id + reply_id
        let mut buf = Vec::with_capacity(8 + payload_size as usize);

        // Header: magic (BE) + payload_size (LE)
        buf.extend_from_slice(&PACKET_MAGIC.to_be_bytes());
        buf.extend_from_slice(&payload_size.to_le_bytes());

        // Payload: cmd_id + checksum + session_id + reply_id + data
        buf.extend_from_slice(&self.cmd_id.to_le_bytes());
        buf.extend_from_slice(&self.checksum.to_le_bytes());
        buf.extend_from_slice(&self.session_id.to_le_bytes());
        buf.extend_from_slice(&self.reply_id.to_le_bytes());
        buf.extend_from_slice(&self.data);

        buf
    }

    /// Parse a ZKTeco wire-format packet from bytes.
    ///
    /// Returns `Err` if the magic header is wrong or the data is truncated.
    /// DOES verify the checksum — mismatched checksum returns `Err`.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        if bytes.len() < 16 {
            return Err(Error::device(format!(
                "packet too short: {} bytes (need at least 16)",
                bytes.len()
            )));
        }

        // Read magic (4 bytes BE — PACKET_MAGIC is big-endian on the wire)
        let magic = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        if magic != PACKET_MAGIC {
            return Err(Error::device(format!(
                "invalid magic: 0x{magic:08X} (expected 0x{PACKET_MAGIC:08X})"
            )));
        }

        // Read payload size (4 bytes LE)
        let payload_size = u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]) as usize;

        if bytes.len() < 8 + payload_size {
            return Err(Error::device(format!(
                "truncated packet: have {} bytes, need {}",
                bytes.len(),
                8 + payload_size
            )));
        }

        let payload = &bytes[8..8 + payload_size];
        if payload.len() < 8 {
            return Err(Error::device("payload too short"));
        }

        // Parse payload fields
        let cmd_id = u16::from_le_bytes([payload[0], payload[1]]);
        let checksum = u16::from_le_bytes([payload[2], payload[3]]);
        let session_id = u16::from_le_bytes([payload[4], payload[5]]);
        let reply_id = u16::from_le_bytes([payload[6], payload[7]]);
        let data = payload[8..].to_vec();

        // Verify checksum
        let expected = compute_checksum(cmd_id, session_id, reply_id, &data);
        if checksum != expected {
            return Err(Error::device(format!(
                "checksum mismatch: got 0x{checksum:04X}, expected 0x{expected:04X}"
            )));
        }

        Ok(Self { cmd_id, checksum, session_id, reply_id, data })
    }

    /// Convenience: create an ACK_OK response packet.
    pub fn ack_ok(session_id: u16, reply_id: u16) -> Self {
        Self::new(2000, session_id, reply_id, vec![])
    }

    /// Convenience: create an ACK_ERROR response packet.
    pub fn ack_error(session_id: u16, reply_id: u16) -> Self {
        Self::new(2001, session_id, reply_id, vec![])
    }
}

/// Compute the 16-bit ones-complement checksum over the packet payload.
///
/// The checksum is computed over `cmd_id + [zero u16] + session_id + reply_id + data`,
/// all in little-endian format. The `[zero u16]` fills the checksum field slot.
fn compute_checksum(cmd_id: u16, session_id: u16, reply_id: u16, data: &[u8]) -> u16 {
    // Build the buffer that the checksum is computed over
    let mut buf = Vec::with_capacity(8 + data.len());
    buf.extend_from_slice(&cmd_id.to_le_bytes());
    buf.extend_from_slice(&0u16.to_le_bytes()); // checksum slot (zeroed)
    buf.extend_from_slice(&session_id.to_le_bytes());
    buf.extend_from_slice(&reply_id.to_le_bytes());
    buf.extend_from_slice(data);

    checksum::compute(&buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_packet_roundtrip_empty_data() {
        let packet = Packet::new(1000, 0xC5C0, 0x0000, vec![]);
        let bytes = packet.to_bytes();
        let parsed = Packet::from_bytes(&bytes).expect("should parse");
        assert_eq!(parsed.cmd_id, 1000);
        assert_eq!(parsed.session_id, 0xC5C0);
        assert_eq!(parsed.reply_id, 0x0000);
        assert!(parsed.data.is_empty());
    }

    #[test]
    fn test_packet_roundtrip_with_data() {
        let data = vec![0x01, 0x02, 0x03, 0x04, 0xAA, 0xBB];
        let packet = Packet::new(0x03E8, 0xC5C0, 0x0001, data.clone());
        let bytes = packet.to_bytes();
        let parsed = Packet::from_bytes(&bytes).expect("should parse");
        assert_eq!(parsed.cmd_id, 0x03E8);
        assert_eq!(parsed.session_id, 0xC5C0);
        assert_eq!(parsed.reply_id, 0x0001);
        assert_eq!(parsed.data, data);
        assert_eq!(parsed.checksum, packet.checksum);
    }

    #[test]
    fn test_packet_connect_command() {
        // Real CONNECT command: cmd=0x03E8 (1000), session=0, reply=65534
        let packet = Packet::new(1000, 0, 65534, vec![]);
        let bytes = packet.to_bytes();
        assert!(bytes.len() >= 16);

        // Verify magic bytes are present
        assert_eq!(&bytes[0..4], &PACKET_MAGIC.to_be_bytes());

        let parsed = Packet::from_bytes(&bytes).expect("should parse");
        assert_eq!(parsed.cmd_id, 1000);
        assert_eq!(parsed.session_id, 0);
        assert_eq!(parsed.reply_id, 65534);
    }

    #[test]
    fn test_packet_auth_command() {
        // AUTH command with scrambled key data
        let key = [0x12, 0x34, 0x56, 0x78];
        let packet = Packet::new(1102, 0xC5C0, 0x0001, key.to_vec());
        let bytes = packet.to_bytes();
        let parsed = Packet::from_bytes(&bytes).expect("should parse");
        assert_eq!(parsed.cmd_id, 1102);
        assert_eq!(parsed.data, key);
    }

    #[test]
    fn test_packet_bad_magic_rejected() {
        let result = Packet::from_bytes(&[0x00; 16]);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("invalid magic"));
    }

    #[test]
    fn test_packet_truncated_rejected() {
        let packet = Packet::new(1000, 0, 0, vec![0x55; 20]);
        let bytes = packet.to_bytes();
        // Truncate to just the header
        let result = Packet::from_bytes(&bytes[..10]);
        assert!(result.is_err());
    }

    #[test]
    fn test_packet_checksum_tampering_detected() {
        let packet = Packet::new(1000, 0xC5C0, 0x0000, vec![0xAA]);
        let mut bytes = packet.to_bytes();
        // Corrupt the data byte (at offset 16)
        bytes[16] ^= 0xFF;
        let result = Packet::from_bytes(&bytes);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("checksum mismatch"));
    }

    #[test]
    fn test_compute_checksum_deterministic() {
        let data = vec![0x01, 0x02, 0x03];
        let cs1 = compute_checksum(1000, 0xC5C0, 0x0000, &data);
        let cs2 = compute_checksum(1000, 0xC5C0, 0x0000, &data);
        assert_eq!(cs1, cs2);
    }

    #[test]
    fn test_compute_checksum_differs_by_data() {
        let cs1 = compute_checksum(1000, 0xC5C0, 0, &[0x00]);
        let cs2 = compute_checksum(1000, 0xC5C0, 0, &[0x01]);
        assert_ne!(cs1, cs2);
    }

    #[test]
    fn test_compute_checksum_differs_by_cmd() {
        let cs1 = compute_checksum(1000, 0xC5C0, 0, &[]);
        let cs2 = compute_checksum(1001, 0xC5C0, 0, &[]);
        assert_ne!(cs1, cs2);
    }

    #[test]
    fn test_ack_ok_packet() {
        let pkt = Packet::ack_ok(0xC5C0, 0x0002);
        assert_eq!(pkt.cmd_id, 2000); // CMD_ACK_OK
        assert!(pkt.data.is_empty());
        let bytes = pkt.to_bytes();
        let _ = Packet::from_bytes(&bytes).expect("ack_ok should parse");
    }

    #[test]
    fn test_ack_error_packet() {
        let pkt = Packet::ack_error(0xC5C0, 0x0002);
        assert_eq!(pkt.cmd_id, 2001); // CMD_ACK_ERROR
        assert!(pkt.data.is_empty());
    }

    #[test]
    fn test_packet_with_real_sized_data() {
        // Simulate a 40-byte attendance record
        let record = vec![0u8; 40];
        let packet = Packet::new(0x05DD, 0xC5C0, 0x0003, record.clone());
        let bytes = packet.to_bytes();
        let parsed = Packet::from_bytes(&bytes).expect("should parse");
        assert_eq!(parsed.data.len(), 40);
        assert_eq!(parsed.data, record);
    }

    #[test]
    fn test_packet_with_real_user_data() {
        // Simulate a 72-byte user record (ZKTeco v8 format)
        let user_record = {
            let mut buf = vec![0u8; 72];
            // UID at offset 0 (u16 LE)
            buf[0] = 0x0D;
            buf[1] = 0x00;
            buf
        };
        let packet = Packet::new(0x05DD, 0xC5C0, 0x0004, user_record.clone());
        let bytes = packet.to_bytes();
        let parsed = Packet::from_bytes(&bytes).expect("should parse");
        assert_eq!(parsed.data.len(), 72);
        assert_eq!(parsed.data[0], 0x0D);
    }
}
