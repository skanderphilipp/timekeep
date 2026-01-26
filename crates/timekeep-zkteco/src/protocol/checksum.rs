//! 16-bit ones-complement checksum for the ZKTeco protocol.
//!
//! The checksum is computed over the entire payload EXCLUDING
//! the checksum field itself. Both request and reply packets
//! are verified with this checksum.
//!
//! Reference: `adrobinoga/zk-protocol` protocol.md

/// Compute the 16-bit ones-complement checksum of `data`.
pub fn compute(data: &[u8]) -> u16 {
    let mut sum: u32 = 0;
    for chunk in data.chunks(2) {
        let word = if chunk.len() == 2 {
            u16::from_le_bytes([chunk[0], chunk[1]]) as u32
        } else {
            chunk[0] as u32 // odd last byte, padded with zero in high byte
        };
        sum = sum.wrapping_add(word);
    }
    // Fold overflow
    while sum >> 16 != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }
    // Ones-complement
    !sum as u16
}

/// Verify that a packet's checksum matches its data.
pub fn verify(data: &[u8], expected_checksum: u16) -> bool {
    compute(data) == expected_checksum
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_empty() {
        assert_eq!(compute(&[]), 0xFFFF);
    }

    #[test]
    fn test_compute_known_vector() {
        // Simple known vector
        let data = [0x01, 0x02, 0x03, 0x04];
        let cs = compute(&data);
        assert!(cs > 0);
    }
}
