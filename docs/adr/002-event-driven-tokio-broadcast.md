# ADR-002: Event-Driven Architecture with Tokio Broadcast

**Status:** Accepted  
**Date:** 2026-07-10  
**Deciders:** Alsabah Technical Team

## Context

timekeep must process attendance events from multiple sources (ADMS push,
SDK pull, API corrections) and fan them out to multiple sinks (storage,
webhooks, Odoo). The processing pipeline includes normalization, deduplication,
and enrichment — stages that operate independently and could fail without
affecting other stages.

## Decision

**In-process event bus using `tokio::sync::broadcast` with a processing pipeline.**

- The `EventBus` wraps a `broadcast::Sender<Arc<DomainEvent>>` with 1024 buffer
- Providers publish events; the engine subscribes and routes through a pipeline
- Each pipeline stage (normalize → dedup → enrich → store → distribute) is a
  pure function or async handler
- Failures in one stage do not block other stages

## Rationale

- **Scale**: ~200 events/day at Alsabah. An external message broker (NATS,
  Kafka) is overkill. The broadcast channel handles this with zero operational
  overhead.
- **Simplicity**: No serialization, no network, no broker to manage. Events are
  Rust enums passed by `Arc` — zero-copy within the process.
- **Graceful degradation**: If the dedup cache fails, punches still flow through.
  If a distributor is down, other distributors still receive events.
- **Future-proof**: The `EventBus` can be swapped for a NATS/Kafka publisher
  behind the same interface if multi-node deployment is ever needed.

## Consequences

- Single-process only — no horizontal scaling without an external broker
- Buffer overflow drops oldest events (1024 capacity = ~5 days of normal operation)
- No event persistence/replay — if the process crashes, in-flight events are lost
  (acceptable: scanners buffer punches locally and re-push on reconnect)

## Alternatives Considered

- **NATS / Kafka**: Rejected — operational complexity not justified at this scale
- **Channel-per-consumer (mpsc)**: Rejected — broadcast allows multiple subscribers
  (engine, API event handler, future SSE stream) to receive the same event
- **Actor model (Actix)**: Rejected — adds framework dependency; tokio primitives
  are sufficient
