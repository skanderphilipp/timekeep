//! ADMS command queue — stores pending commands for devices.
//!
//! Devices poll `GET /iclock/getrequest` to receive pending commands.
//! Commands are plain text strings in the ADMS protocol format
//! (e.g., "DATA QUERY ATTLOG", "REBOOT", "CLEAR DATA").
//!
//! Commands expire after a configurable TTL (default: 5 minutes)
//! and are garbage-collected on each poll.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

/// Allowed ADMS command prefixes (prevents injection of arbitrary commands).
const VALID_COMMANDS: &[&str] = &[
    "DATA QUERY",
    "DATA UPDATE",
    "CLEAR DATA",
    "REBOOT",
    "CHECK",
    "INFO",
    "SET OPTION",
    "CONTROL DEVICE",
    "UNLOCK",
];

/// Validate that a command string is safe to enqueue for a device.
///
/// Rejects:
/// - Empty strings
/// - Strings longer than 256 bytes
/// - Commands containing control characters or line breaks
/// - Commands that don't start with a known prefix
pub fn validate_command(command: &str) -> Result<(), String> {
    // Check for line breaks BEFORE trimming (injection: multiple commands)
    if command.contains('\n') || command.contains('\r') {
        return Err("command contains line breaks".to_string());
    }

    let cmd = command.trim();

    if cmd.is_empty() {
        return Err("command must not be empty".to_string());
    }

    if cmd.len() > 256 {
        return Err(format!("command too long: {} bytes (max 256)", cmd.len()));
    }

    // Reject control characters (injection prevention)
    if cmd.contains(|c: char| c.is_control() && c != ' ') {
        return Err("command contains control characters".to_string());
    }

    // Validate against known command prefixes
    let upper = cmd.to_uppercase();
    if !VALID_COMMANDS.iter().any(|prefix| upper.starts_with(prefix)) {
        return Err(format!("unknown command: {cmd}. Allowed: {}", VALID_COMMANDS.join(", ")));
    }

    Ok(())
}

/// Global monotonic command ID counter.
static NEXT_COMMAND_ID: AtomicU64 = AtomicU64::new(1);

/// A single pending command for a device.
#[derive(Debug, Clone)]
pub struct PendingCommand {
    /// Monotonic command ID (assigned at enqueue time)
    pub id: u64,
    /// The ADMS protocol command text
    pub command: String,
    /// When this command was enqueued
    created_at: Instant,
    /// Time-to-live before expiry
    ttl: Duration,
}

/// A queue of pending commands, keyed by device serial number.
///
/// Thread-safe via external locking (typically `Arc<Mutex<CommandQueue>>`).
#[derive(Debug, Default)]
pub struct CommandQueue {
    /// Per-device queues of pending commands
    queues: std::collections::HashMap<String, VecDeque<PendingCommand>>,
    /// Default TTL for new commands
    default_ttl: Duration,
}

impl CommandQueue {
    /// Create a new command queue with the given default TTL.
    pub fn new(default_ttl_secs: u64) -> Self {
        Self {
            queues: std::collections::HashMap::new(),
            default_ttl: Duration::from_secs(default_ttl_secs),
        }
    }

    /// Enqueue a command for a device.
    ///
    /// Validates the command before enqueueing. Returns a monotonic
    /// command ID for tracking, or an error if validation fails.
    pub fn enqueue(&mut self, device_sn: &str, command: &str) -> Result<u64, String> {
        validate_command(command)?;

        let id = NEXT_COMMAND_ID.fetch_add(1, Ordering::SeqCst);
        let pending = PendingCommand {
            id,
            command: command.to_string(),
            created_at: Instant::now(),
            ttl: self.default_ttl,
        };

        self.queues.entry(device_sn.to_string()).or_default().push_back(pending);

        tracing::info!(
            device = %device_sn,
            command_id = id,
            command,
            "command enqueued"
        );
        Ok(id)
    }

    /// Get all pending (non-expired) commands for a device.
    ///
    /// Expired commands are silently dropped. Returns the commands
    /// as newline-separated text suitable for the ADMS response,
    /// or "OK" if there are no pending commands.
    ///
    /// Each command line includes its ID for correlation:
    /// `ID=123\tDATA QUERY ATTLOG`
    pub fn get_pending(&mut self, device_sn: &str) -> String {
        let queue = match self.queues.get_mut(device_sn) {
            Some(q) => q,
            None => return "OK".to_string(),
        };

        // Remove expired commands
        let now = Instant::now();
        queue.retain(|cmd| now.duration_since(cmd.created_at) < cmd.ttl);

        if queue.is_empty() {
            return "OK".to_string();
        }

        // Collect all pending commands with their IDs
        let commands: Vec<String> =
            queue.iter().map(|cmd| format!("ID={}\t{}", cmd.id, cmd.command)).collect();

        tracing::info!(
            device = %device_sn,
            count = commands.len(),
            "returning pending commands"
        );

        commands.join("\n")
    }

    /// Confirm that a command was executed and remove it from the queue.
    ///
    /// Matches by command ID if present in the confirmation text
    /// (format: `ID=123`), falling back to text matching for
    /// backward compatibility with devices that don't return IDs.
    pub fn confirm(&mut self, device_sn: &str, confirm_text: &str) -> bool {
        let queue = match self.queues.get_mut(device_sn) {
            Some(q) => q,
            None => return false,
        };

        // Try to extract command ID from confirmation text
        let cmd_id: Option<u64> = confirm_text
            .strip_prefix("ID=")
            .and_then(|s| s.split('\t').next())
            .and_then(|s| s.parse().ok());

        if let Some(id) = cmd_id {
            // Match by ID (preferred)
            if let Some(pos) = queue.iter().position(|cmd| cmd.id == id) {
                let removed = queue.remove(pos).unwrap();
                let cmd_id = removed.id;
                let cmd_text = removed.command;
                tracing::info!(
                    device = %device_sn,
                    command_id = cmd_id,
                    command = cmd_text,
                    "command confirmed executed (by ID)"
                );
                return true;
            }
        }

        // Fallback: match by command text
        if let Some(pos) = queue.iter().position(|cmd| cmd.command == confirm_text) {
            let removed = queue.remove(pos).unwrap();
            let cmd_id = removed.id;
            tracing::info!(
                device = %device_sn,
                command_id = cmd_id,
                command = confirm_text,
                "command confirmed executed (by text match)"
            );
            true
        } else {
            tracing::debug!(
                device = %device_sn,
                text = confirm_text,
                "command confirmation received but not found in queue"
            );
            false
        }
    }

    /// Get the number of pending commands for a device.
    #[allow(dead_code)]
    pub fn pending_count(&self, device_sn: &str) -> usize {
        self.queues.get(device_sn).map(|q| q.len()).unwrap_or(0)
    }

    /// Clear all commands for a device.
    #[allow(dead_code)]
    pub fn clear(&mut self, device_sn: &str) {
        if let Some(queue) = self.queues.get_mut(device_sn) {
            queue.clear();
        }
    }

    /// Remove empty queues for devices that no longer have pending commands.
    pub fn gc(&mut self) {
        self.queues.retain(|_, q| !q.is_empty());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ─── Validation Tests ──────────────────────────────────────────

    #[test]
    fn test_validate_valid_commands() {
        assert!(validate_command("REBOOT").is_ok());
        assert!(validate_command("DATA QUERY ATTLOG").is_ok());
        assert!(validate_command("CLEAR DATA").is_ok());
        assert!(validate_command("CHECK").is_ok());
        assert!(validate_command("SET OPTION ServerLocalTime=123").is_ok());
    }

    #[test]
    fn test_validate_rejects_empty() {
        assert!(validate_command("").is_err());
        assert!(validate_command("  ").is_err());
    }

    #[test]
    fn test_validate_rejects_control_chars() {
        assert!(validate_command("REBOOT\n").is_err());
        assert!(validate_command("REBOOT\r").is_err());
    }

    #[test]
    fn test_validate_rejects_too_long() {
        let long = "X".repeat(300);
        assert!(validate_command(&long).is_err());
    }

    #[test]
    fn test_validate_rejects_unknown_prefix() {
        assert!(validate_command("rm -rf /").is_err());
        assert!(validate_command("DROP TABLE users").is_err());
        assert!(validate_command("$(cat /etc/passwd)").is_err());
    }

    // ─── Queue Tests ───────────────────────────────────────────────

    #[test]
    fn test_enqueue_and_get_pending() {
        let mut queue = CommandQueue::new(300);
        let id = queue.enqueue("TEST001", "REBOOT").expect("should enqueue");
        assert!(id > 0);

        let pending = queue.get_pending("TEST001");
        assert!(pending.contains("REBOOT"));
        assert!(pending.contains(&format!("ID={id}")));
    }

    #[test]
    fn test_multiple_commands() {
        let mut queue = CommandQueue::new(300);
        queue.enqueue("TEST001", "REBOOT").unwrap();
        queue.enqueue("TEST001", "DATA QUERY ATTLOG").unwrap();

        let pending = queue.get_pending("TEST001");
        assert!(pending.contains("REBOOT"));
        assert!(pending.contains("DATA QUERY ATTLOG"));
        assert_eq!(pending.lines().count(), 2);
    }

    #[test]
    fn test_no_pending_returns_ok() {
        let mut queue = CommandQueue::new(300);
        let result = queue.get_pending("NONEXISTENT");
        assert_eq!(result, "OK");
    }

    #[test]
    fn test_confirm_by_id() {
        let mut queue = CommandQueue::new(300);
        let id = queue.enqueue("TEST001", "REBOOT").unwrap();

        // Confirm with ID prefix
        let confirm_text = format!("ID={id}\tREBOOT");
        assert!(queue.confirm("TEST001", &confirm_text));

        let pending = queue.get_pending("TEST001");
        assert_eq!(pending, "OK");
    }

    #[test]
    fn test_confirm_by_text_fallback() {
        let mut queue = CommandQueue::new(300);
        queue.enqueue("TEST001", "REBOOT").unwrap();

        // Confirm by text alone (no ID prefix) — backward compat
        assert!(queue.confirm("TEST001", "REBOOT"));
        assert_eq!(queue.get_pending("TEST001"), "OK");
    }

    #[test]
    fn test_confirm_nonexistent() {
        let mut queue = CommandQueue::new(300);
        queue.enqueue("TEST001", "REBOOT").unwrap();
        assert!(!queue.confirm("TEST001", "UNKNOWN COMMAND"));
    }

    #[test]
    fn test_confirm_empties_queue() {
        let mut queue = CommandQueue::new(300);
        let id = queue.enqueue("TEST001", "REBOOT").unwrap();
        queue.confirm("TEST001", &format!("ID={id}\tREBOOT"));

        let pending = queue.get_pending("TEST001");
        assert_eq!(pending, "OK");
    }

    #[test]
    fn test_expired_commands_dropped() {
        let mut queue = CommandQueue::new(0); // TTL = 0 seconds (immediately expired)
        queue.enqueue("TEST001", "REBOOT").unwrap();

        // Command should be expired immediately
        let pending = queue.get_pending("TEST001");
        assert_eq!(pending, "OK");
    }

    #[test]
    fn test_pending_count() {
        let mut queue = CommandQueue::new(300);
        assert_eq!(queue.pending_count("TEST001"), 0);
        queue.enqueue("TEST001", "REBOOT").unwrap();
        assert_eq!(queue.pending_count("TEST001"), 1);
    }

    #[test]
    fn test_clear() {
        let mut queue = CommandQueue::new(300);
        queue.enqueue("TEST001", "REBOOT").unwrap();
        queue.clear("TEST001");
        assert_eq!(queue.pending_count("TEST001"), 0);
    }

    #[test]
    fn test_commands_per_device_independent() {
        let mut queue = CommandQueue::new(300);
        queue.enqueue("DEV_A", "REBOOT").unwrap();
        queue.enqueue("DEV_B", "DATA QUERY ATTLOG").unwrap();

        assert!(queue.get_pending("DEV_A").contains("REBOOT"));
        assert!(queue.get_pending("DEV_B").contains("DATA QUERY ATTLOG"));
    }

    #[test]
    fn test_enqueue_rejects_invalid() {
        let mut queue = CommandQueue::new(300);
        assert!(queue.enqueue("DEV_A", "").is_err());
        assert!(queue.enqueue("DEV_A", "rm -rf /").is_err());
    }
}
