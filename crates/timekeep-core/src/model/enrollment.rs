//! Device enrollment — the link between an Employee and a biometric device.
//!
//! An enrollment represents the fact that an employee is registered
//! (with a PIN and optionally biometric data) on a specific device.
//! Without an enrollment, the device will not recognize the employee.
//!
//! # Fingerprint Templates
//!
//! Fingerprint templates are stored centrally as part of the enrollment.
//! When an employee is enrolled on a device with fingerprint, the raw
//! template data is downloaded from the device and stored here. This
//! enables cross-device transfer: when the same employee needs to be
//! added to a new device, the stored templates can be pushed without
//! requiring the employee to re-scan their fingers.
//!
//! This mirrors BioTime's architecture where `iclock_biodata` stores
//! templates centrally, linked to employees.

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

/// A single fingerprint template stored centrally.
///
/// Each template represents one finger of one employee on one device.
/// The `data` field contains the raw binary template as returned by
/// the ZKTeco SDK's `get_user_template()`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FingerprintTemplate {
    /// Which finger this template is for (0–9 on ZKTeco devices).
    /// 0 = right thumb, 1 = right index, etc.
    pub finger_index: u8,

    /// Raw binary template data from the device.
    pub data: Vec<u8>,

    /// Size of the template data in bytes.
    #[serde(default)]
    pub size_bytes: u32,

    /// When this template was downloaded from the device.
    #[serde(default = "Timestamp::now")]
    pub downloaded_at: Timestamp,
}

impl FingerprintTemplate {
    /// Create a new fingerprint template record.
    pub fn new(finger_index: u8, data: Vec<u8>) -> Self {
        let size_bytes = data.len() as u32;
        Self { finger_index, data, size_bytes, downloaded_at: Timestamp::now() }
    }
}

/// Represents an employee's registration on a specific device.
///
/// # Invariants
///
/// - Each (employee_id, device_sn) pair is unique — an employee can only
///   be enrolled once per device.
/// - `pin` may differ from the employee's primary PIN (device-specific).
/// - `fingerprint_templates` is populated after enrollment: templates are
///   downloaded from the device and stored centrally for cross-device transfer.
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

    /// Stored fingerprint templates for cross-device transfer.
    ///
    /// These are downloaded from a device after enrollment and stored
    /// centrally. When the employee is added to a new device, these
    /// templates are pushed so the employee doesn't need to re-scan.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fingerprint_templates: Vec<FingerprintTemplate>,

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
            fingerprint_templates: vec![],
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

    /// Add a fingerprint template to this enrollment.
    pub fn add_template(&mut self, finger_index: u8, data: Vec<u8>) {
        // Remove existing template for this finger if present
        self.fingerprint_templates.retain(|t| t.finger_index != finger_index);
        self.fingerprint_templates.push(FingerprintTemplate::new(finger_index, data));
        self.fingerprint_count = self.fingerprint_templates.len() as u32;
    }

    /// Get all stored templates, sorted by finger index.
    pub fn templates_sorted(&self) -> Vec<&FingerprintTemplate> {
        let mut sorted: Vec<&FingerprintTemplate> = self.fingerprint_templates.iter().collect();
        sorted.sort_by_key(|t| t.finger_index);
        sorted
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
        assert!(enrollment.fingerprint_templates.is_empty());
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

    #[test]
    fn add_template_updates_count() {
        let emp_id = EmployeeId::new();
        let mut enrollment =
            DeviceEnrollment::new(emp_id, "DEV001", "145", vec![BiometricType::Fingerprint]);
        assert_eq!(enrollment.fingerprint_count, 0);

        enrollment.add_template(0, vec![0x01, 0x02]);
        assert_eq!(enrollment.fingerprint_count, 1);

        enrollment.add_template(1, vec![0x03, 0x04]);
        assert_eq!(enrollment.fingerprint_count, 2);

        // Replacing same finger
        enrollment.add_template(0, vec![0xAA, 0xBB]);
        assert_eq!(enrollment.fingerprint_count, 2);
    }

    #[test]
    fn templates_sorted_by_finger_index() {
        let emp_id = EmployeeId::new();
        let mut enrollment =
            DeviceEnrollment::new(emp_id, "DEV001", "145", vec![BiometricType::Fingerprint]);
        enrollment.add_template(3, vec![0x03]);
        enrollment.add_template(1, vec![0x01]);
        enrollment.add_template(2, vec![0x02]);

        let sorted = enrollment.templates_sorted();
        assert_eq!(sorted[0].finger_index, 1);
        assert_eq!(sorted[1].finger_index, 2);
        assert_eq!(sorted[2].finger_index, 3);
    }
}
