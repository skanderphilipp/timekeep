//! User sync domain — value objects for device user comparison.
//!
//! When employees change, they need to be pushed to all assigned devices.
//! This module provides the value objects for comparing user lists
//! and computing sync operations.

use serde::{Deserialize, Serialize};

use super::user::User;

/// A snapshot of a device's user list, used for comparison operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceUsers {
    /// The device serial number this snapshot came from.
    pub device_sn: String,

    /// All users currently registered on the device.
    pub users: Vec<User>,
}

impl DeviceUsers {
    /// Create a snapshot from a device's user list.
    pub fn new(device_sn: impl Into<String>, users: Vec<User>) -> Self {
        Self { device_sn: device_sn.into(), users }
    }

    /// Number of users on the device.
    pub fn count(&self) -> usize {
        self.users.len()
    }

    /// Find a user by PIN (the HR identifier, not internal_sn).
    pub fn find_by_pin(&self, pin: &str) -> Option<&User> {
        self.users.iter().find(|u| u.pin == pin)
    }

    /// Compute the difference between this snapshot (source) and
    /// another snapshot (target). The result tells you what operations
    /// are needed to make target match source.
    ///
    /// Users are matched by PIN (the stable HR identifier), not by
    /// device-internal serial number which varies per device.
    pub fn diff(&self, target: &DeviceUsers) -> UserDiff {
        let mut missing_on_target = Vec::new();
        let mut extra_on_target = Vec::new();
        let mut changed = Vec::new();

        for src_user in &self.users {
            match target.find_by_pin(&src_user.pin) {
                Some(tgt_user) => {
                    if src_user.name != tgt_user.name || src_user.privilege != tgt_user.privilege {
                        changed.push((src_user.clone(), tgt_user.clone()));
                    }
                },
                None => {
                    missing_on_target.push(src_user.clone());
                },
            }
        }

        for tgt_user in &target.users {
            if self.find_by_pin(&tgt_user.pin).is_none() {
                extra_on_target.push(tgt_user.clone());
            }
        }

        UserDiff { missing_on_target, extra_on_target, changed }
    }
}

/// The result of comparing two device user lists.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDiff {
    /// Users present in source but NOT on target — should be pushed.
    pub missing_on_target: Vec<User>,

    /// Users present on target but NOT in source — candidates for removal.
    pub extra_on_target: Vec<User>,

    /// Users on both devices but with different name or privilege.
    pub changed: Vec<(User, User)>,
}

impl UserDiff {
    /// Whether this diff represents a clean state (no differences).
    pub fn is_empty(&self) -> bool {
        self.missing_on_target.is_empty()
            && self.extra_on_target.is_empty()
            && self.changed.is_empty()
    }

    /// Total number of operations needed to synchronise.
    pub fn operation_count(&self) -> usize {
        self.missing_on_target.len() + self.extra_on_target.len() + self.changed.len()
    }
}

/// Summary of a completed user sync operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub device_sn: String,
    pub pushed: u32,
    pub deleted: u32,
    pub templates_transferred: u32,
    pub failed: u32,
    pub duration_ms: u64,
}

impl SyncResult {
    pub fn new(device_sn: impl Into<String>) -> Self {
        Self {
            device_sn: device_sn.into(),
            pushed: 0,
            deleted: 0,
            templates_transferred: 0,
            failed: 0,
            duration_ms: 0,
        }
    }

    pub fn has_changes(&self) -> bool {
        self.pushed > 0 || self.deleted > 0 || self.templates_transferred > 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::User;

    fn make_user(pin: &str, name: &str, privilege: u8) -> User {
        User {
            internal_sn: pin.parse().unwrap_or(1),
            pin: pin.to_string(),
            name: name.to_string(),
            privilege,
            card_number: None,
            has_password: false,
            fingerprint_count: 0,
            has_face: false,
        }
    }

    #[test]
    fn device_users_count() {
        let users = vec![make_user("1", "Alice", 0), make_user("2", "Bob", 0)];
        let snapshot = DeviceUsers::new("SN001", users);
        assert_eq!(snapshot.count(), 2);
        assert_eq!(snapshot.device_sn, "SN001");
    }

    #[test]
    fn device_users_find_by_pin() {
        let users = vec![make_user("1001", "Alice", 0), make_user("1002", "Bob", 14)];
        let snapshot = DeviceUsers::new("SN001", users);
        assert!(snapshot.find_by_pin("1001").is_some());
        assert!(snapshot.find_by_pin("9999").is_none());
    }

    #[test]
    fn diff_identical_lists_is_empty() {
        let src = DeviceUsers::new("A", vec![make_user("1", "Alice", 0)]);
        let tgt = DeviceUsers::new("B", vec![make_user("1", "Alice", 0)]);
        assert!(src.diff(&tgt).is_empty());
    }

    #[test]
    fn diff_detects_missing_users() {
        let src = DeviceUsers::new("A", vec![make_user("1", "Alice", 0), make_user("2", "Bob", 0)]);
        let tgt = DeviceUsers::new("B", vec![make_user("1", "Alice", 0)]);
        let diff = src.diff(&tgt);
        assert_eq!(diff.missing_on_target.len(), 1);
        assert_eq!(diff.missing_on_target[0].pin, "2");
    }

    #[test]
    fn diff_detects_extra_users() {
        let src = DeviceUsers::new("A", vec![make_user("1", "Alice", 0)]);
        let tgt = DeviceUsers::new("B", vec![make_user("1", "Alice", 0), make_user("2", "Bob", 0)]);
        let diff = src.diff(&tgt);
        assert_eq!(diff.extra_on_target.len(), 1);
        assert_eq!(diff.extra_on_target[0].pin, "2");
    }

    #[test]
    fn diff_detects_changed_users() {
        let src = DeviceUsers::new("A", vec![make_user("1", "Alice Updated", 14)]);
        let tgt = DeviceUsers::new("B", vec![make_user("1", "Alice", 0)]);
        let diff = src.diff(&tgt);
        assert_eq!(diff.changed.len(), 1);
        assert_eq!(diff.changed[0].0.name, "Alice Updated");
        assert_eq!(diff.changed[0].1.name, "Alice");
    }

    #[test]
    fn diff_complex_scenario() {
        let src = DeviceUsers::new(
            "A",
            vec![
                make_user("1", "Alice", 0),
                make_user("2", "Bob V2", 14),
                make_user("3", "Carol", 0),
            ],
        );
        let tgt = DeviceUsers::new(
            "B",
            vec![make_user("1", "Alice", 0), make_user("2", "Bob", 0), make_user("4", "Dave", 0)],
        );
        let diff = src.diff(&tgt);
        assert_eq!(diff.missing_on_target.len(), 1);
        assert_eq!(diff.extra_on_target.len(), 1);
        assert_eq!(diff.changed.len(), 1);
        assert_eq!(diff.operation_count(), 3);
    }

    #[test]
    fn diff_empty_source() {
        let src = DeviceUsers::new("A", vec![]);
        let tgt = DeviceUsers::new("B", vec![make_user("1", "Alice", 0)]);
        let diff = src.diff(&tgt);
        assert!(diff.missing_on_target.is_empty());
        assert_eq!(diff.extra_on_target.len(), 1);
    }

    #[test]
    fn diff_empty_target() {
        let src = DeviceUsers::new("A", vec![make_user("1", "Alice", 0)]);
        let tgt = DeviceUsers::new("B", vec![]);
        let diff = src.diff(&tgt);
        assert_eq!(diff.missing_on_target.len(), 1);
        assert!(diff.extra_on_target.is_empty());
    }

    #[test]
    fn diff_both_empty() {
        let src = DeviceUsers::new("A", vec![]);
        let tgt = DeviceUsers::new("B", vec![]);
        assert!(src.diff(&tgt).is_empty());
    }

    #[test]
    fn sync_result_new_defaults_zero() {
        let result = SyncResult::new("SN001");
        assert_eq!(result.pushed, 0);
        assert_eq!(result.deleted, 0);
        assert!(!result.has_changes());
    }

    #[test]
    fn sync_result_has_changes_when_pushed() {
        let mut result = SyncResult::new("SN001");
        result.pushed = 5;
        assert!(result.has_changes());
    }
}
