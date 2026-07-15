use super::PostgresStorage;
use timekeep_core::Error;

#[derive(sqlx::FromRow)]
pub(super) struct PendingDeliveryRowPg {
    id: String,
    endpoint_id: String,
    event_json: serde_json::Value,
    attempt_count: i32,
    next_retry_at: i64,
    created_at: i64,
}

impl PendingDeliveryRowPg {
    fn into_delivery(self) -> timekeep_core::PendingDelivery {
        let event_json = serde_json::to_string(&self.event_json).unwrap_or_default();
        timekeep_core::PendingDelivery {
            id: self.id,
            endpoint_id: self.endpoint_id,
            event_json,
            attempt_count: self.attempt_count,
            next_retry_at: self.next_retry_at,
            created_at: self.created_at,
        }
    }
}

impl PostgresStorage {
    pub(super) async fn enqueue_pending_delivery(
        &self,
        delivery: &timekeep_core::PendingDelivery,
    ) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO pending_deliveries (id, endpoint_id, event_json, attempt_count, next_retry_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(&delivery.id)
        .bind(&delivery.endpoint_id)
        .bind(&delivery.event_json)
        .bind(delivery.attempt_count)
        .bind(delivery.next_retry_at)
        .bind(delivery.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("enqueue pending delivery: {e}")))?;

        Ok(())
    }

    pub(super) async fn list_pending_deliveries(
        &self,
    ) -> Result<Vec<timekeep_core::PendingDelivery>, Error> {
        let now = jiff::Timestamp::now().as_second();
        let rows = sqlx::query_as::<_, PendingDeliveryRowPg>(
            "SELECT id, endpoint_id, event_json, attempt_count, next_retry_at, created_at
             FROM pending_deliveries
             WHERE next_retry_at <= $1
             ORDER BY next_retry_at ASC",
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("list pending deliveries: {e}")))?;

        Ok(rows.into_iter().map(|r| r.into_delivery()).collect())
    }

    pub(super) async fn update_delivery_retry(
        &self,
        id: &str,
        attempt_count: i32,
        next_retry_at: i64,
    ) -> Result<(), Error> {
        sqlx::query(
            "UPDATE pending_deliveries SET attempt_count = $1, next_retry_at = $2 WHERE id = $3",
        )
        .bind(attempt_count)
        .bind(next_retry_at)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("update delivery retry: {e}")))?;

        Ok(())
    }

    pub(super) async fn delete_pending_delivery(&self, id: &str) -> Result<(), Error> {
        sqlx::query("DELETE FROM pending_deliveries WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete pending delivery: {e}")))?;

        Ok(())
    }

    pub(super) async fn move_to_dead_letter(
        &self,
        id: &str,
        last_error: Option<&str>,
    ) -> Result<(), Error> {
        let row: Option<PendingDeliveryRowPg> =
            sqlx::query_as("SELECT id, endpoint_id, event_json, attempt_count, next_retry_at, created_at FROM pending_deliveries WHERE id = $1")
                .bind(id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Error::storage(format!("find delivery for dead letter: {e}")))?;

        let Some(found) = row else {
            return Ok(());
        };

        let now = jiff::Timestamp::now().as_second();

        sqlx::query(
            "INSERT INTO dead_letter_deliveries (id, endpoint_id, event_json, attempt_count, last_error, created_at, moved_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(&found.id)
        .bind(&found.endpoint_id)
        .bind(&found.event_json)
        .bind(found.attempt_count)
        .bind(last_error)
        .bind(found.created_at)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| Error::storage(format!("move to dead letter: {e}")))?;

        sqlx::query("DELETE FROM pending_deliveries WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| Error::storage(format!("delete after dead letter: {e}")))?;

        Ok(())
    }
}
