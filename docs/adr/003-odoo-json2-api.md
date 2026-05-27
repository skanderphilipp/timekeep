# ADR-003: Odoo Integration via JSON-2 API (Not XML-RPC)

**Status:** Accepted  
**Date:** 2026-07-10  
**Deciders:** Alsabah Technical Team

## Context

timekeep must push attendance data to Odoo HR for payroll processing.
Odoo offers multiple API protocols: XML-RPC (`/xmlrpc/2`), JSON-RPC
(`/jsonrpc`), and the newer JSON-2 REST API (`/json/2`).

## Decision

**Use the Odoo JSON-2 API (`/json/2/{model}/{method}`) with Bearer token
authentication.**

- XML-RPC and JSON-RPC are deprecated and scheduled for removal in Odoo 22
  (fall 2028)
- JSON-2 is REST/JSON over HTTP — simpler to implement with `reqwest` + `serde_json`
- Authentication uses API keys (Bearer tokens), not username/password
- Employee mapping uses `hr.employee.barcode` field (unique, alphanumeric)

## Employee Mapping Strategy

ZKTeco devices store an "EmpCode" (user PIN). Odoo employees have a `barcode`
field (unique, alphanumeric, max 18 chars). We map:

```
ZKTeco EmpCode ("145")  →  hr.employee.search([("barcode", "=", "145")])
```

The `OdooDistributor` configuration accepts an `employee_field` parameter
(`"barcode"` by default, can be `"pin"` or a custom field) to support
different Odoo configurations.

## Attendance Record Flow

```
PunchReceived { punch } → OdooDistributor::on_event()
  ├── find_employee(barcode=punch.user_pin)
  │   └── POST /json/2/hr.employee/search
  │
  ├── [CheckIn] → find open attendance → create if none
  │   ├── POST /json/2/hr.attendance/search  (check_out = false)
  │   └── POST /json/2/hr.attendance/create  (in_mode = "technical")
  │
  └── [CheckOut] → find open attendance → set check_out
      ├── POST /json/2/hr.attendance/search  (check_out = false)
      └── POST /json/2/hr.attendance/write   (check_out = timestamp)
```

## Deduplication

Odoo enforces a "max 1 open attendance per employee" invariant. We rely on:
1. Odoo's own constraint (second create will fail)
2. Pre-flight check: search for open attendance before creating
3. The engine's `DedupCache` already filters duplicate `PunchReceived` events
   before they reach the distributor

## Consequences

- No username/password in config — API keys only
- API key rotation every 90 days (Odoo policy) — log warning on expiry
- `reqwest` + `serde_json` are the only dependencies needed (already in Cargo.toml)
- Timestamps sent as UTC naive strings (`"YYYY-MM-DD HH:MM:SS"`) — Odoo applies
  employee timezone context

## Alternatives Considered

- **XML-RPC**: Rejected — deprecated, scheduled for removal
- **Direct PostgreSQL writes to Odoo DB**: Rejected — bypasses Odoo business
  logic, breaks computed fields, risks data corruption
- **`_attendance_action_change` method**: Rejected — uses `now()` for timestamp,
  losing the device's actual punch time
