//! ADMS device simulator — HTTP client that behaves like a real ZKTeco
//! device pushing attendance data to the ADMS server.
//!
//! # Protocol
//!
//! A real ZKTeco device with ADMS enabled does:
//!
//! ```text
//! GET  /iclock/cdata?SN={sn}
//!      → server responds with "GET OPTION FROM: {sn}\nStamp=...\n..."
//!
//! POST /iclock/cdata?SN={sn}&table=ATTLOG
//!      body: "PIN\ttimestamp\tstatus\tverify\t0\t0\t\n..."
//!      → server responds "OK: N"
//!
//! GET  /iclock/getrequest?SN={sn}
//!      → server responds with pending commands or "OK"
//!
//! POST /iclock/devicecmd?SN={sn}
//!      body: command response
//!      → server responds "OK"
//! ```

use reqwest::Client;

/// A simulated ZKTeco device that pushes attendance data to an ADMS server.
pub struct AdmsDeviceSim {
    serial: String,
    base_url: String,
    client: Client,
}

impl AdmsDeviceSim {
    /// Create a new simulated device.
    ///
    /// `base_url` should be the ADMS server root, e.g. `"http://127.0.0.1:8085"`.
    pub fn new(serial: impl Into<String>, base_url: impl Into<String>) -> Self {
        Self { serial: serial.into(), base_url: base_url.into(), client: Client::new() }
    }

    /// Perform the ADMS handshake (GET /iclock/cdata).
    ///
    /// Returns the server's response body (the `GET OPTION FROM:...` text).
    pub async fn handshake(&self) -> Result<String, reqwest::Error> {
        let url = format!("{}/iclock/cdata?SN={}", self.base_url, self.serial);
        let resp = self.client.get(&url).send().await?;
        resp.text().await
    }

    /// Push attendance records to the ADMS server.
    ///
    /// Each punch is a tab-separated line in the format:
    /// `"PIN\ttimestamp\tstatus\tverify\t0\t0\t"`
    ///
    /// Returns the server's response (e.g. `"OK: 3"`).
    pub async fn push_attendance(&self, punches: &[AdmsPunch]) -> Result<String, reqwest::Error> {
        let body: String = punches
            .iter()
            .map(|p| {
                format!(
                    "{}\t{}\t{}\t{}\t0\t0\t\n",
                    p.pin, p.timestamp, p.status as u8, p.verify as u8
                )
            })
            .collect();

        let url = format!("{}/iclock/cdata?SN={}&table=ATTLOG", self.base_url, self.serial);
        let resp =
            self.client.post(&url).header("Content-Type", "text/plain").body(body).send().await?;
        resp.text().await
    }

    /// Poll for pending commands (GET /iclock/getrequest).
    pub async fn poll_commands(&self) -> Result<String, reqwest::Error> {
        let url = format!("{}/iclock/getrequest?SN={}", self.base_url, self.serial);
        let resp = self.client.get(&url).send().await?;
        resp.text().await
    }

    /// Confirm a command result (POST /iclock/devicecmd).
    pub async fn confirm_command(&self, result: &str) -> Result<String, reqwest::Error> {
        let url = format!("{}/iclock/devicecmd?SN={}", self.base_url, self.serial);
        let resp = self
            .client
            .post(&url)
            .header("Content-Type", "text/plain")
            .body(result.to_string())
            .send()
            .await?;
        resp.text().await
    }
}

/// A single attendance punch to push via ADMS.
#[derive(Debug, Clone)]
pub struct AdmsPunch {
    /// Employee PIN / user ID on the device.
    pub pin: String,
    /// Timestamp string in the format the device sends, e.g. `"2026-07-11 08:42:15"`.
    pub timestamp: String,
    /// Punch status: 0 = check-in, 1 = check-out, 2 = break-out, 3 = break-in, 4 = OT-in, 5 = OT-out.
    pub status: AdmsStatus,
    /// Verification method: 1 = fingerprint, 15 = face, 0 = password, 4 = card.
    pub verify: u8,
}

/// ADMS punch status codes.
#[derive(Debug, Clone, Copy)]
#[repr(u8)]
pub enum AdmsStatus {
    CheckIn = 0,
    CheckOut = 1,
    BreakOut = 2,
    BreakIn = 3,
    OvertimeIn = 4,
    OvertimeOut = 5,
}
