//! Persistence for integration endpoint configuration.
//!
//! Separated from the monolithic [`Storage`](super::storage::Storage) trait
//! as part of the Store decomposition (see ADR-001).
//!
//! Endpoints define where attendance events are distributed: webhook URLs,
//! Odoo instances, MQTT brokers, etc.

use async_trait::async_trait;

use crate::Error;
use crate::model::settings::IntegrationEndpoint;
use crate::query::ListResult;
use crate::query::filters::EndpointFilter;

/// Persists and queries integration endpoint configurations.
#[async_trait]
pub trait EndpointStore: Send + Sync {
    /// List all integration endpoints.
    async fn list_endpoints(&self) -> Result<Vec<IntegrationEndpoint>, Error> {
        Ok(vec![])
    }

    /// List integration endpoints with search, sort, and pagination.
    async fn list_endpoints_filtered(
        &self,
        _filter: &EndpointFilter,
    ) -> Result<ListResult<IntegrationEndpoint>, Error> {
        let all = self.list_endpoints().await?;
        Ok(ListResult::single_page(all))
    }

    /// Create a new integration endpoint.
    async fn create_endpoint(&self, _endpoint: &IntegrationEndpoint) -> Result<(), Error> {
        Err(Error::storage("endpoint storage not implemented for this backend"))
    }

    /// Update an existing integration endpoint (full replace).
    async fn update_endpoint(&self, _endpoint: &IntegrationEndpoint) -> Result<(), Error> {
        Err(Error::storage("endpoint storage not implemented for this backend"))
    }

    /// Delete an integration endpoint by ID.
    async fn delete_endpoint(&self, _id: &str) -> Result<(), Error> {
        Err(Error::storage("endpoint storage not implemented for this backend"))
    }
}
