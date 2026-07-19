//! ZKTeco SDK protocol command definitions.
//!
//! All commands and their parameters as documented in
//! `adrobinoga/zk-protocol`. Used by both the SDK pull
//! module and the ADMS command queue.

/// ZKTeco binary protocol command IDs.
///
/// Values verified against pyzatt reference implementation.
/// The authoritative constants are in `connection.rs`; this enum
/// mirrors them for code readability and external reference.
#[allow(dead_code)]
#[repr(u16)]
pub enum Command {
    /// Establish session (CMD_CONNECT)
    Connect = 1000,
    /// Terminate session (CMD_EXIT)
    Exit = 1001,
    /// Enable device — allow punches, biometric reads (CMD_ENABLE_DEVICE)
    EnableDevice = 1002,
    /// Disable device — block punches during sync (CMD_DISABLE_DEVICE)
    DisableDevice = 1003,
    /// Restart device (CMD_RESTART)
    Restart = 1004,
    /// Power off device
    Poweroff = 1005,
    /// Set device time (CMD_SET_TIME)
    SetTime = 202,
    /// Get device time (CMD_GET_TIME)
    GetTime = 201,
    /// Get firmware version (CMD_GET_VERSION)
    GetVersion = 1100,
    /// Authenticate session with comm key scramble (CMD_AUTH)
    Auth = 1102,
    /// Get platform info
    GetPlatform = 1103,
    /// Get MAC address
    GetMac = 1104,
    /// Get device name
    GetDeviceName = 1107,
    /// Get device capacity / free sizes (CMD_GET_FREE_SIZES)
    GetFreeSizes = 50,
    /// Start bulk data request — users, attendance, templates (CMD_DATA_WRRQ).
    /// Also aliased as CMD_PREPARE_BUFFER in buffer protocol context.
    DataWrrq = 1503,
    /// Prepare for data transfer (CMD_PREPARE_DATA, 0x05DC)
    PrepareData = 1500,
    /// Data chunk received (CMD_DATA, 0x05DD)
    Data = 1501,
    /// Free data after transfer complete (CMD_FREE_DATA, 0x05DE)
    FreeData = 1502,
    /// Data ready — initiate chunked read (CMD_DATA_RDY).
    /// Also aliased as CMD_READ_BUFFER in buffer protocol context.
    DataRdy = 1504,
    /// ACK — command succeeded
    AckOk = 2000,
    /// NAK — command failed
    AckError = 2001,
    /// Unauthorized — need CMD_AUTH with scrambled key
    AckUnauth = 2005,
    /// Write option to device (CMD_OPTIONS_WRQ)
    OptionsWrq = 12,
    /// Read option from device (CMD_OPTIONS_RRQ)
    OptionsRrq = 11,
    /// Refresh data — commit changes, re-enable reads (CMD_REFRESH_DATA)
    RefreshData = 1013,
    /// Clear attendance records (CMD_CLEAR_ATTLOG)
    ClearAttLog = 15,
    /// Clear all data on device
    ClearData = 52,
    /// Write user record — create or update (CMD_USER_WRQ)
    UserWrq = 8,
    /// Delete user by serial number (CMD_DELETE_USER)
    DeleteUser = 18,
    /// Read/write user fingerprint template (CMD_USERTEMP_RRQ/WRQ)
    UserTemp = 9,
    /// Delete single fingerprint template (CMD_DEL_FPTEMP)
    DeleteFingerprint = 134,
    /// Read attendance log records (CMD_ATTLOG_RRQ)
    AttLogRrq = 13,
    /// Read operation log records (CMD_OPLOG_RRQ)
    OpLogRrq = 34,
    /// Register for real-time events (CMD_REG_EVENT)
    RegEvent = 500,
    /// Unlock door relay
    Unlock = 31,
    /// Start identity verification
    StartVerify = 60,
    /// Start fingerprint enrollment
    StartEnroll = 61,
    /// Cancel capture / enrollment
    CancelCapture = 62,
}

/// ADMS protocol commands (text-based, sent via HTTP response).
#[allow(dead_code)]
pub mod adms_commands {
    /// Request device information
    pub const INFO: &str = "INFO";
    /// Heartbeat
    pub const CHECK: &str = "CHECK";
    /// Query all users
    pub const DATA_QUERY_USERINFO: &str = "DATA QUERY USERINFO";
    /// Query attendance logs
    pub const DATA_QUERY_ATTLOG: &str = "DATA QUERY ATTLOG";
    /// Query operation logs
    pub const DATA_QUERY_OPERLOG: &str = "DATA QUERY OPERLOG";
    /// Trigger door relay
    pub const CONTROL_DEVICE_1_1: &str = "CONTROL DEVICE 1 1";
    /// Restart device
    pub const REBOOT: &str = "REBOOT";
    /// Sync device clock
    pub const SET_OPTION_SERVER_TIME: &str = "SET OPTION ServerLocalTime=";
}
