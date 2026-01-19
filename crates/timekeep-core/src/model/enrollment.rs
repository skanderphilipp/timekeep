//! Device enrollment — the link between an Employee and a biometric device.
//!
//! An enrollment represents the fact that an employee is registered
//! (with a PIN and optionally biometric data) on a specific device.
//! Without an enrollment, the device will not recognize the employee.

use jiff::Timestamp;

use super::employee::EmployeeId;

/// Types of biometric data enrolled on a device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BiometricType {
    Fingerprint,
    Face,
    Palm,
    Card,
    Password,
}

/// Represents an employee's registration on a specific device.
///
/// # Invariants
///
/// - Each (employee_id, device_sn) pair is unique — an employee can only
///   be enrolled once per device.
/// - `pin` may differ from the employee's primary PIN (device-specific).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeviceEnrollment {
    /// The employee registered on the device.
    pub employee_id: EmployeeId,

    /// The device serial number.
    pub device_sn: String,

    /// The PIN used on this device (may differ from employee.pin).
    pub pin: String,

    /// Types of biometric data enrolled.
    pub biometric_types: Vec<BiometricType>,

    /// Number of fingerprint templates stored.
    pub fingerprint_count: u32,

    /// Whether face recognition is enrolled.
    pub face_enrolled: bool,

    /// Optional card number for RF card access.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card_number: Option<String>,

    /// When this enrollment was created.
    pub enrolled_at: Timestamp,
}

impl DeviceEnrollment {
    /// Create a new device enrollment.
    pub fn new(
        employee_id: EmployeeId,
        device_sn: impl Into<String>,
        pin: impl Into<String>,
        biometric_types: Vec<BiometricType>,
    ) -> Self {
        Self {
            employee_id,
            device_sn: device_sn.into(),
            pin: pin.into(),
            biometric_types,
            fingerprint_count: 0,
            face_enrolled: false,
            card_number: None,
            enrolled_at: Timestamp::now(),
        }
    }

    /// Whether this enrollment includes fingerprint data.
    pub fn has_fingerprint(&self) -> bool {
        self.biometric_types.contains(&BiometricType::Fingerprint)
    }

    /// Whether this enrollment includes face recognition.
    pub fn has_face(&self) -> bool {
        self.biometric_types.contains(&BiometricType::Face)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::employee::EmployeeId;

    #[test]
    fn new_enrollment_has_timestamp() {
        let emp_id = EmployeeId::new();
        let enrollment = DeviceEnrollment::new(
            emp_id.clone(),
            "DEV001",
            "145",
            vec![BiometricType::Fingerprint],
        );
        assert_eq!(enrollment.device_sn, "DEV001");
        assert_eq!(enrollment.pin, "145");
        assert!(enrollment.has_fingerprint());
        assert!(!enrollment.has_face());
    }

    #[test]
    fn enrollment_with_multiple_biometrics() {
        let emp_id = EmployeeId::new();
        let enrollment = DeviceEnrollment::new(
            emp_id,
            "DEV001",
            "145",
            vec![BiometricType::Fingerprint, BiometricType::Face, BiometricType::Card],
        );
        assert!(enrollment.has_fingerprint());
        assert!(enrollment.has_face());
        assert_eq!(enrollment.biometric_types.len(), 3);
    }
}
