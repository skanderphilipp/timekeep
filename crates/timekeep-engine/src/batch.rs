//! Batch writer for efficient bulk storage.
//!
//! Accumulates punches in memory and flushes them to storage in batches,
//! replacing N individual INSERTs with a single multi-row INSERT.
//!
//! ## Behavior
//! - Punches are accumulated in a lock-free queue
//! - A background task flushes the queue every `flush_interval_ms`
//!   or when the batch reaches `max_batch_size`
//! - On shutdown (`Drop`), any remaining punches are flushed

use std::sync::Arc;
use std::time::Duration;

use timekeep_core::{model::AttendancePunch, traits::Storage};
use tokio::sync::mpsc;

/// A batch writer that accumulates punches and flushes them in bulk.
pub struct BatchWriter {
    /// Channel sender: the engine pushes punches here
    tx: mpsc::UnboundedSender<AttendancePunch>,
    /// Handle for the background flush task
    flush_handle: Option<tokio::task::JoinHandle<()>>,
    /// Shutdown signal
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl BatchWriter {
    /// Create a new batch writer.
    ///
    /// Spawns a background task that flushes accumulated punches
    /// to `storage` every `flush_interval_ms` milliseconds or when
    /// `max_batch_size` punches are accumulated.
    pub fn new(storage: Arc<dyn Storage>, max_batch_size: usize, flush_interval_ms: u64) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<AttendancePunch>();
        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

        let flush_handle = tokio::spawn(async move {
            let mut buffer: Vec<AttendancePunch> = Vec::with_capacity(max_batch_size);
            let flush_interval = Duration::from_millis(flush_interval_ms);

            loop {
                // Wait for either: a punch to arrive, the flush interval to elapse, or shutdown
                let flush_reason = tokio::select! {
                    // A punch arrived
                    maybe_punch = rx.recv() => {
                        match maybe_punch {
                            Some(punch) => {
                                buffer.push(punch);
                                if buffer.len() >= max_batch_size {
                                    Some("batch_full")
                                } else {
                                    None // keep accumulating
                                }
                            }
                            None => Some("channel_closed"), // all senders dropped
                        }
                    }
                    // Flush interval elapsed
                    _ = tokio::time::sleep(flush_interval) => {
                        if !buffer.is_empty() {
                            Some("interval")
                        } else {
                            None
                        }
                    }
                    // Shutdown requested
                    _ = &mut shutdown_rx => {
                        // Drain any remaining items from the channel
                        while let Ok(punch) = rx.try_recv() {
                            buffer.push(punch);
                        }
                        Some("shutdown")
                    }
                };

                if let Some(reason) = flush_reason {
                    if !buffer.is_empty() {
                        let batch: Vec<AttendancePunch> = std::mem::take(&mut buffer);
                        let count = batch.len();

                        match storage.store_punches(&batch).await {
                            Ok(stored) => {
                                tracing::debug!(
                                    batch_size = count,
                                    stored,
                                    reason,
                                    "batch writer flushed"
                                );
                            },
                            Err(e) => {
                                tracing::error!(
                                    batch_size = count,
                                    reason,
                                    error = %e,
                                    "batch writer flush failed"
                                );
                            },
                        }
                    }

                    if reason == "shutdown" || reason == "channel_closed" {
                        tracing::info!("batch writer shutting down");
                        break;
                    }
                }
            }
        });

        Self { tx, flush_handle: Some(flush_handle), shutdown_tx: Some(shutdown_tx) }
    }

    /// Enqueue a punch for batch writing.
    ///
    /// Non-blocking: the punch is sent to the background task
    /// which accumulates and flushes in batches.
    pub fn enqueue(&self, punch: AttendancePunch) {
        if let Err(e) = self.tx.send(punch) {
            tracing::error!(error = %e, "batch writer channel closed, punch dropped");
        }
    }

    /// Shut down the batch writer gracefully, flushing any remaining punches.
    pub async fn shutdown(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        if let Some(handle) = self.flush_handle.take() {
            let _ = tokio::time::timeout(Duration::from_secs(5), handle).await;
        }
    }
}

impl Drop for BatchWriter {
    fn drop(&mut self) {
        // Fire-and-forget shutdown: we can't await in Drop,
        // but the oneshot signal will trigger a final flush.
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use timekeep_core::Error;
    use std::sync::Mutex as StdMutex;
    use std::sync::atomic::{AtomicU64, Ordering};

    /// A test storage that counts calls and stores punches in memory.
    struct TestStorage {
        stored: Arc<StdMutex<Vec<AttendancePunch>>>,
        store_punches_calls: Arc<AtomicU64>,
    }

    impl TestStorage {
        fn new() -> (Self, Arc<StdMutex<Vec<AttendancePunch>>>, Arc<AtomicU64>) {
            let stored = Arc::new(StdMutex::new(Vec::new()));
            let calls = Arc::new(AtomicU64::new(0));
            (Self { stored: stored.clone(), store_punches_calls: calls.clone() }, stored, calls)
        }
    }

    #[async_trait::async_trait]
    impl Storage for TestStorage {
        async fn store_punch(&self, _punch: &AttendancePunch) -> Result<(), Error> {
            Ok(())
        }

        async fn store_punches(&self, punches: &[AttendancePunch]) -> Result<u64, Error> {
            self.store_punches_calls.fetch_add(1, Ordering::SeqCst);
            self.stored.lock().unwrap().extend_from_slice(punches);
            Ok(punches.len() as u64)
        }

        async fn query_punches(
            &self,
            _filter: &timekeep_core::traits::storage::PunchFilter,
        ) -> Result<Vec<AttendancePunch>, Error> {
            Ok(vec![])
        }
        async fn upsert_device(
            &self,
            _device: &timekeep_core::model::Device,
        ) -> Result<(), Error> {
            Ok(())
        }
        async fn upsert_device_config(
            &self,
            _config: &timekeep_core::DeviceConfig,
        ) -> Result<(), Error> {
            Ok(())
        }
        async fn list_device_configs(&self) -> Result<Vec<timekeep_core::DeviceConfig>, Error> {
            Ok(vec![])
        }
        async fn delete_device_config(&self, _sn: &str) -> Result<(), Error> {
            Ok(())
        }
        async fn latest_punch_for_device(
            &self,
            _device_sn: &str,
        ) -> Result<Option<jiff::Timestamp>, Error> {
            Ok(None)
        }
        async fn punch_exists(&self, _dedup_id: &str) -> Result<bool, Error> {
            Ok(false)
        }
    }

    fn test_punch(pin: &str) -> AttendancePunch {
        AttendancePunch {
            id: format!("id-{pin}"),
            device_sn: "TEST001".into(),
            user_pin: pin.to_string(),
            timestamp: jiff::Timestamp::now(),
            status: timekeep_core::PunchStatus::CheckIn,
            verify_mode: timekeep_core::VerifyMode::Fingerprint,
            work_code: None,
            sub_status: None,
            employee_name: None,
            device_label: None,
            raw_data: None,
        }
    }

    #[tokio::test]
    async fn test_batch_writer_flushes_on_batch_full() {
        let (storage, stored, calls) = TestStorage::new();
        let mut writer = BatchWriter::new(Arc::new(storage), 3, 10_000); // batch=3, long interval

        writer.enqueue(test_punch("1"));
        writer.enqueue(test_punch("2"));
        // Not yet 3, should not flush
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(stored.lock().unwrap().len(), 0);

        writer.enqueue(test_punch("3")); // This triggers flush (batch full)
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(stored.lock().unwrap().len(), 3);
        assert_eq!(calls.load(Ordering::SeqCst), 1);

        writer.shutdown().await;
    }

    #[tokio::test]
    async fn test_batch_writer_flushes_on_interval() {
        let (storage, stored, _calls) = TestStorage::new();
        let mut writer = BatchWriter::new(Arc::new(storage), 100, 50); // 50ms interval

        writer.enqueue(test_punch("1"));
        writer.enqueue(test_punch("2"));

        // Wait for the flush interval to trigger
        tokio::time::sleep(Duration::from_millis(150)).await;
        assert!(stored.lock().unwrap().len() >= 2);

        writer.shutdown().await;
    }

    #[tokio::test]
    async fn test_batch_writer_flushes_on_shutdown() {
        let (storage, stored, _calls) = TestStorage::new();
        let mut writer = BatchWriter::new(Arc::new(storage), 10, 10_000);

        writer.enqueue(test_punch("1"));
        writer.enqueue(test_punch("2"));

        // Shutdown should flush remaining
        writer.shutdown().await;
        assert_eq!(stored.lock().unwrap().len(), 2);
    }

    #[tokio::test]
    async fn test_batch_writer_multiple_batches() {
        let (storage, stored, calls) = TestStorage::new();
        let mut writer = BatchWriter::new(Arc::new(storage), 2, 10_000);

        for i in 0..6 {
            writer.enqueue(test_punch(&i.to_string()));
        }
        tokio::time::sleep(Duration::from_millis(100)).await;

        assert_eq!(stored.lock().unwrap().len(), 6);
        assert_eq!(calls.load(Ordering::SeqCst), 3); // 6 punches / 2 per batch

        writer.shutdown().await;
    }
}
