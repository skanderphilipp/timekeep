# Plan: Real-Time Events & Enrollment — Task Plan, Consumer Value, Test Gap Analysis

> Created: 2026-07-10 | Status: Phase 1 ✅ Complete | Phase 2 ⏳ Next

---

## 1. Executive Summary

Two remaining P2 tasks form a dependency chain:

```
reg_event (#18) ──► enroll_user (#17)
```

**`reg_event`** enables the device to PUSH unsolicited real-time event packets to our
persistent TCP connection — punches, alarms, finger scores, enrollment results.
It's the prerequisite for **`enroll_user`**, which runs a 3-sample fingerprint
capture loop driven by those real-time events.

Both require architectural changes: our current connection model is
request-response (send command → receive reply) but real-time events are
**unsolicited pushes** from the device. We need a background event-receive task
that runs alongside the request-response channel.

---

## 2. Consumer Value Analysis

### 2.1 `reg_event` — Real-Time Event Receive Loop

**What it does:** After calling `CMD_REG_EVENT(0x01F4)` with data `0xFFFF0000`,
the device starts sending unsolicited event packets whenever something happens.
The client must ACK each event with `CMD_ACK_OK` (reply_id=0).

**Event types received:**

| Event Code | Name | Consumer |
|-----------|------|----------|
| `EF_ATTLOG (0x01)` | Attendance punch just happened | **Odoo (instant punch push)**, Dashboard (live "who's in"), Management API |
| `EF_FINGER (0x02)` | Finger placed on reader | Enrollment workflow, Kiosk UI |
| `EF_ENROLLFINGER (0x08)` | Enrollment complete (result+fingerprint) | Management API (onboarding), Scanner provisioning UI |
| `EF_VERIFY (0x80)` | User identity verified | Door access integration, Audit logging |
| `EF_FPFTR (0x100)` | Fingerprint quality score (0/100) | Enrollment workflow (sample quality feedback) |
| `EF_ALARM (0x200)` | Tamper, duress, door forced, exit button | Alerting system, Security dashboard |

**Business value:**

| Stakeholder | Value |
|-------------|-------|
| **Odoo consumer** | Instant punch delivery instead of 60s polling delay. Attendance appears in ERP as it happens. |
| **Management API** | `GET /api/realtime/{sn}` WebSocket or SSE stream for live dashboards. "Who's currently in the building?" with zero latency. |
| **Security** | Alarm events (tamper, duress, forced door) become actionable within milliseconds, not 60s. |
| **IT Ops** | Monitor device connection health in real time. No more "scanner was offline for 55 seconds before we noticed." |

**Without reg_event:** We poll every 60s. A punch at t=0 appears at t=0-60s.
A duress alarm at t=0 is processed at t=60s. That's unacceptable for security use cases.

### 2.2 `enroll_user` — Live Fingerprint Enrollment

**What it does:** Run the 3-sample fingerprint capture workflow remotely —
no need to walk to the device and use its menu.

**Protocol flow:**
```
1. CMD_CANCELCAPTURE    — clear any in-progress capture
2. CMD_STARTENROLL      — begin enrollment for user_id + finger_index
3. CMD_STARTVERIFY       — tell device to start identifying
4. [EF_FPFTR events] × 3 — wait for 3 good samples (score=100 each)
5. [EF_ENROLLFINGER]    — enrollment result (success/fail + template)
```

**Business value:**

| Stakeholder | Value |
|-------------|-------|
| **HR / Admin** | Enroll new employee from the web dashboard. No need to physically touch the scanner's admin menu. |
| **Scanner provisioning (#31)** | `POST /api/devices/{sn}/enroll` — web form → device enrollment in one API call. |
| **Self-service kiosk** | Employee walks up, enters PIN, places finger 3 times. The kiosk drives the enrollment via API. |
| **BioTime migration (#37)** | Bulk-import users from old BioTime MySQL → automatically enroll fingerprints on new scanner. No manual per-user enrollment. |

**Without enroll_user:** Every new employee requires an admin to physically walk
to the scanner, enter the admin menu, select "Enroll User", navigate to the
right finger slot, and guide the 3-sample process. For a company with 100+
employees and high turnover, this is hours of wasted admin time per month.

---

## 3. Protocol Deep-Dive

### 3.1 How Real-Time Events Work

The key architectural difference from our current code:

```
CURRENT (request-response):
  Client ──send_command──► Device
  Client ◄──recv_reply─── Device
  (TCP is idle between commands)

WITH REG_EVENT (persistent listener):
  Client ──CMD_REG_EVENT──► Device
  Client ◄──ACK_OK──────── Device
  
  [Device sends unsolicited events whenever something happens]
  Device ──rtpacket(event=EF_ATTLOG)──► Client
  Client ──ACK_OK(reply_id=0)─────────► Device
  
  Device ──rtpacket(event=EF_FPFTR)───► Client
  Client ──ACK_OK(reply_id=0)─────────► Device
  
  [Meanwhile, client can still send commands]
  Client ──CMD_GET_TIME──► Device
  Client ◄──ACK_OK+data─── Device
```

**Critical detail from zk-protocol:** Real-time event packets have `reply_id = 0`
and use the `session_id` field as the **event code** (not session ID):

```
Normal packet:     [cmd_id | checksum | session_id | reply_id | data]
Real-time packet:  [cmd_id | checksum | EF_CODE   | 0x0000    | event_data]
```

The `session_id` field is repurposed as the event type code. The `reply_id` is
always `0x0000` for real-time events. The client MUST reply with `CMD_ACK_OK`
using `reply_id = 0` (matching the event's reply_id).

### 3.2 Enrollment Data Structures

**CMD_STARTENROLL payload (26 bytes):**
```
Offset  Size  Description
0       9     User PIN (ASCII string, null-padded)
9       15    Reserved (zeros)
24      1     Finger index (0-9)
25      1     FP flag (1=valid, 3=duress)
```

**EF_FPFTR event (finger score):**
```
Offset  Size  Description
0       1     Score: 0 (bad quality) or 100 (good quality)
```

**EF_ENROLLFINGER event (enrollment result):**
```
Offset  Size  Description
0       2     Error code: 0=success, non-zero=error (u16 LE)
2       2     Fingerprint template size (u16 LE)
4       9     User PIN (ASCII string)
13      1     Finger index
```

### 3.3 EF_ATTLOG Event (real-time attendance punch)

```
Offset  Size  Description
0       9     User PIN (ASCII string, null-padded)
9       15    Reserved (zeros)
24      2     Verify type (u16 LE)
26      6     Timestamp: YY MM DD HH mm SS (each 1 byte)
```

This is different from the 40-byte binary attendance record format. It uses
packed BCD-like bytes for the date/time (each byte is a decimal digit).

---

## 4. Test Gap Analysis

### 4.1 Current Test Coverage (99 tests)

| Layer | Count | Status |
|-------|-------|--------|
| Packet framing + checksum | 15 | ✅ Good |
| Time encoding + comm key scramble | 14 | ✅ Good |
| User record encoding (28/72 byte) | 12 | ✅ Good |
| Dedup cache | 7 | ✅ Good |
| PIN normalization | 6 | ✅ Good |
| Device sizes parsing | 2 | ⚠️ Minimal (2 tests, no full 92-byte parse test) |
| Webhook retry + HMAC | 11 | ✅ Good |
| Batch writer | 4 | ✅ Good |
| ADMS OPERLOG text parsing | 11 | ✅ Good |
| ADMS command queue | 10 | ✅ Good |
| ADMS ATTLOG text parsing | 0 | 🔴 None |
| ADMS USERINFO parsing | 0 | 🔴 None |
| ADMS KV pair parsing | 0 | 🔴 None |
| ADMS handlers (HTTP) | 0 | 🔴 None |
| SDK attendance binary parsing (40-byte) | 0 | 🔴 None |
| SDK user list parsing (28/72-byte) | 0 | 🔴 None |
| SDK operation log binary parsing (16-byte) | 0 | 🔴 None |
| SDK fingerprint template parsing | 0 | 🔴 None |
| SDK data exchange protocol (read_large_dataset) | 0 | 🔴 None |
| SDK buffer protocol (read_with_buffer/read_chunk) | 0 | 🔴 None |
| SDK `get_option`/`set_option` | 0 | 🔴 None |
| SDK `delete_fingerprint` | 0 | 🔴 None |
| SDK `get_network_params` | 0 | 🔴 None |
| **ZkTecoDevice adapter** (SDK→domain events) | 0 | 🔴 None |
| **Full polling pipeline** (SDK→dedup→storage) | 0 | 🔴 None |
| **Real-time event parsing** | N/A | 🟡 Not yet implemented |
| **Enrollment workflow** | N/A | 🟡 Not yet implemented |
| **Integration (real device)** | 6 (ignored) | ⏳ Blocked |

### 4.2 Critical Test Gaps (What MUST Be Tested)

The `connection.rs` methods do parsing **inline** — they receive bytes from the
network and parse them into domain objects in the same function. This makes
unit-testing impossible without mocking TCP.

**The fix:** Extract parsing logic into testable, pure functions that take
`&[u8]` and return domain structs. This is already done for `encoding.rs`
(encode_user_record_72, decode_zk_time, etc.) but NOT done for the higher-level
parsing in `connection.rs`.

#### Gap Category A: Binary Record Parsing (High Priority)

These MUST be tested because they parse untrusted binary data from the device:

| Test | What | Input | Expected |
|------|------|-------|----------|
| `parse_attendance_record_40` | Parse a 40-byte binary attendance record | Known 40-byte hex from pyzk test fixtures | Correct user_pin, timestamp, status, verify_mode |
| `parse_attendance_record_skip_marker` | Skip `FF 32 35 35` init markers | Data with marker prefix | Marker skipped, record parsed |
| `parse_attendance_record_bad_timestamp` | Graceful fallback on corrupt timestamp | Record with 0xFFFFFFFF timestamp | Returns `now()` instead of crashing |
| `parse_oplog_record_16` | Parse a 16-byte binary oplog record | Known hex from pyzatt | Correct op_code, timestamp, params |
| `parse_oplog_record_all_types` | Every operation type code maps correctly | All known op codes (0-30) | Correct `OperationType` enum variant |
| `parse_user_record_72` | Parse 72-byte ZK8 user record | Known hex | Correct pin, name, privilege, card |
| `parse_user_record_28` | Parse 28-byte legacy user record | Known hex | Correct pin, name, privilege, card |
| `parse_fingerprint_template` | Parse template from binary blob | Known template data | Correct user_sn, finger_index, data |

#### Gap Category B: Protocol Parsing (Medium Priority)

| Test | What |
|------|------|
| `parse_sizes_from_92_bytes` | Full 92-byte GET_FREE_SIZES response → `DeviceSizes` struct with all 14 fields |
| `parse_read_with_buffer_header` | Parse the 4-byte total_size from buffer protocol response |
| `parse_data_wrrq_size` | Parse the 5-byte size structure from CMD_DATA_WRRQ ACK_OK |
| `parse_network_params_from_options` | Parse IP/netmask/gateway/DNS from options responses |

#### Gap Category C: Real-Time Event Parsing (NEW — to implement)

| Test | What |
|------|------|
| `parse_real_time_attlog` | Parse EF_ATTLOG event packet (32 bytes) → user_pin, verify_type, timestamp |
| `parse_real_time_enroll_finger` | Parse EF_ENROLLFINGER event → result, user_pin, finger_index, template_size |
| `parse_real_time_finger_score` | Parse EF_FPFTR event → score (0 or 100) |
| `parse_real_time_verify` | Parse EF_VERIFY event → user_sn |
| `parse_real_time_alarm_misoperation` | Parse EF_ALARM (type=0x3A) → alarm type |
| `parse_real_time_alarm_duress` | Parse EF_ALARM duress (12 bytes) → alarm_type, user_sn, match_type |
| `parse_real_time_event_code_from_session_id` | Extract event code from session_id field |
| `is_real_time_packet` | Detect real-time packet (reply_id == 0 after REG_EVENT) |

#### Gap Category D: ADMS Text Parsing (Medium Priority)

Already have OPERLOG, missing:

| Test | What |
|------|------|
| `parse_adms_attendance_basic` | Tab-separated ATTLOG line → correct punch |
| `parse_adms_attendance_escaped_tabs` | `\\t` escapes normalized |
| `parse_adms_attendance_all_statuses` | All PunchStatus values parse correctly |
| `parse_adms_attendance_all_verify_modes` | All VerifyMode codes map correctly |
| `parse_adms_users_basic` | USERINFO key=value line → correct User |
| `parse_adms_users_multiple_users` | Multiple lines → multiple users |
| `parse_adms_users_missing_fields` | Missing optional fields → defaults |
| `parse_adms_kv_pairs` | Key=value pairs parsed into HashMap |

#### Gap Category E: Integration/End-to-End (High Priority, Hard)

| Test | What |
|------|------|
| `test_full_sdk_pipeline` | Connect → get_users → get_attendance → parse → dedup → store (mocked storage) |
| `test_full_adms_pipeline` | POST cdata → parse → dedup → store |
| `test_dedup_cross_mode` | Same punch via ADMS then SDK → stored once |
| `test_adms_handler_cdata_attlog` | HTTP POST to /iclock/cdata with ATTLOG body |
| `test_adms_handler_cdata_operlog` | HTTP POST to /iclock/cdata with OPERLOG body |
| `test_adms_handler_getrequest` | GET /iclock/getrequest returns pending commands |
| `test_adms_handler_devicecmd` | POST /iclock/devicecmd confirms command |
| `test_option_get_set_roundtrip` | get_option after set_option returns same value (integration) |

### 4.3 Test Strategy: Extract → Test → Implement

The pattern to follow:

1. **Extract parsing into pure functions** in a new `crates/timekeep-zkteco/src/sdk/parser.rs`
2. **Write tests against known binary fixtures** from pyzk/pyzatt reference
3. **Use these parsers in `connection.rs`** instead of inline parsing
4. **Write new features (reg_event, enroll) test-first**

This is the same approach that already works for `encoding.rs` (14 tests) and
`adms/parser.rs` (11 tests).

---

## 5. Implementation Plan

### Phase 1: Extract & Test Parsing Logic (Test-First) ⏱ 2h

**Why first:** Before adding new features, we need the existing parsing to be
provably correct. Currently, we have zero tests proving that attendance records,
user records, oplog records, templates, or device sizes parse correctly from
binary data.

**Deliverables:**
- New file: `crates/timekeep-zkteco/src/sdk/parser.rs`
- Pure functions extracted from `connection.rs`:
  - `parse_attendance_record(data: &[u8], device_sn: &str) -> Result<AttendancePunch>`
  - `parse_user_record_zk8(data: &[u8]) -> Result<User>`
  - `parse_user_record_legacy(data: &[u8]) -> Result<User>`
  - `parse_oplog_record(data: &[u8], device_sn: &str) -> Result<OperationLog>`
  - `parse_fingerprint_templates(data: &[u8]) -> Result<Vec<FingerprintTemplate>>`
  - `parse_device_sizes(data: &[u8]) -> Result<DeviceSizes>`
  - `parse_buffer_header(data: &[u8]) -> Result<u32>` (total_size)
  - `parse_wrrq_size(data: &[u8]) -> Result<u32>` (total_size from DATA_WRRQ)
- **15+ new unit tests** with known binary fixtures
- **Refactor `connection.rs`** methods to call parser functions instead of inline parsing
- Run existing 70 tests → all still pass (behavior unchanged)

### Phase 2: Real-Time Event Parsing ⏱ 2h

**Why:** This is testable in isolation. We can parse event packets without a
live connection.

**Deliverables:**
- Add to `parser.rs`:
  - `EventCode` enum (EF_ATTLOG=1, EF_FINGER=2, EF_ENROLLFINGER=8, EF_VERIFY=128, EF_FPFTR=256, EF_ALARM=512)
  - `RealTimeEvent` enum (AttLog, Finger, EnrollFinger, Verify, FingerScore, Alarm)
  - `parse_event_code(session_id: u16) -> EventCode`
  - `parse_event_packet(packet: &Packet) -> Result<RealTimeEvent>`
  - Individual parsers for each event type's payload
- **8+ new unit tests** with known event hex from zk-protocol spec
- Connection constant: `CMD_REG_EVENT_DATA: [u8; 4] = [0xFF, 0xFF, 0x00, 0x00]`

### Phase 3: Real-Time Event Receive Loop ⏱ 2h

**Why:** The core architectural change. This is where the async design matters.

**Deliverables:**
- New method on `ZkConnection`:
  ```rust
  pub async fn enable_realtime(&mut self) -> Result<mpsc::Receiver<RealTimeEvent>>
  ```
- Implementation:
  1. Send `CMD_REG_EVENT` with `[0xFF, 0xFF, 0x00, 0x00]`
  2. Spawn a background `tokio::task` that loops reading packets from the TCP stream
  3. For each packet with `reply_id == 0`: parse as event, send ACK_OK, push to channel
  4. For packets with non-zero `reply_id`: they're command responses (defer to existing handler)
  5. The channel receiver is returned to the caller
- **This requires refactoring `receive_packet`** to distinguish event packets from response packets
- The current `send_and_receive` method expects a command response with matching reply_id.
  With events enabled, unsolicited events arrive between command/response cycles.
  We need to buffer/handle them transparently.

**Design Decision:** The real-time event loop runs in a **background task** that
owns the TCP read half. Commands still use `send_and_receive`, but the receive
logic now skips over real-time events (ACKing them and pushing to channel)
until it finds the expected command response.

```rust
// Simplified architecture:
async fn receive_with_event_filter(
    stream: &mut TcpStream,
    expected_reply_id: u16,
    event_tx: &mpsc::Sender<RealTimeEvent>,
) -> Result<Packet> {
    loop {
        let packet = read_packet(stream).await?;
        if packet.reply_id == 0 {
            // Real-time event — ACK and forward
            send_ack_ok(stream, packet.session_id, 0).await?;
            let _ = event_tx.send(parse_event(&packet)).await;
            // Keep waiting for our expected response
            continue;
        }
        if packet.reply_id == expected_reply_id {
            return Ok(packet);
        }
        // Mismatched reply_id — unexpected
        return Err("unexpected reply_id");
    }
}
```

### Phase 4: Enrollment Workflow ⏱ 2h

**Why:** Depends on Phase 3 (needs real-time events for finger scores and
enrollment result).

**Deliverables:**
- New method on `ZkConnection`:
  ```rust
  pub async fn enroll_user(
      &mut self,
      user_pin: &str,
      finger_index: u8,
      fp_flag: u8,  // 1=valid, 3=duress
      event_rx: &mut mpsc::Receiver<RealTimeEvent>,
  ) -> Result<FingerprintTemplate>
  ```
- Implementation:
  1. `cancel_capture()` — send CMD_CANCELCAPTURE
  2. `start_enroll(user_pin, finger_index, fp_flag)` — send CMD_STARTENROLL with 26-byte payload
  3. `start_verify()` — send CMD_STARTVERIFY
  4. Wait for 3 `EF_FPFTR` events with score=100 (retry on score=0)
  5. Wait for `EF_ENROLLFINGER` event
  6. Parse template from enrollment result
  7. Return `FingerprintTemplate`
- **5+ unit tests** for the workflow logic (mock the event channel)
- **Integration test** (requires real device, ignored by default)
- Expose on `ZkTecoDevice` as vendor-specific method

### Phase 5: ADMS & API Gap Tests ⏱ 1h

**Why:** The ADMS parser has no tests for attendance, users, or KV pairs. The
HTTP handlers have zero test coverage.

**Deliverables:**
- Tests for `parse_attendance` (basic, escaped tabs, all statuses, all verify modes)
- Tests for `parse_users` (basic, multiple users, missing fields)
- Tests for `parse_kv_pairs` (basic, multiple pairs, empty input)
- Tests for ADMS HTTP handlers using `axum::test` helpers (or defer to P3)

---

## 6. Prioritized Task List

| # | Phase | Task | Effort | New Tests |
|---|-------|------|--------|-----------|
| G1 | Phase 1 | Extract binary record parsers to `sdk/parser.rs` | 1.5h | +15 |
| G2 | Phase 1 | Write tests for extracted parsers | 0.5h | (included) |
| G3 | Phase 2 | Implement real-time event parsing | 1h | +8 |
| G4 | Phase 2 | Write tests for event parsers | 0.5h | (included) |
| G5 | Phase 3 | Implement event receive loop with channel | 1.5h | +3 |
| G6 | Phase 3 | Refactor `send_and_receive` for event filtering | 0.5h | — |
| G7 | Phase 4 | Implement enrollment workflow | 1.5h | +5 |
| G8 | Phase 4 | Write enrollment workflow tests | 0.5h | (included) |
| G9 | Phase 5 | ADMS parser gap tests | 0.5h | +8 |
| G10 | Phase 5 | SDK parser gap tests (device sizes, buffer) | 0.5h | +5 |
| **Total** | | | **~8.5h** | **+44 tests** |

This brings us from 99 → ~143 tests, covering the entire parsing surface.

---

## 7. Implementation Order

```
Phase 1 (Parser extraction) ────────────────── 2h
    │
    ├──► Phase 2 (Event parsing) ──────────── 1.5h
    │         │
    │         └──► Phase 3 (Event loop) ───── 2h
    │                    │
    │                    └──► Phase 4 (Enrollment) ── 2h
    │
    └──► Phase 5 (ADMS + SDK gap tests) ──── 1h
```

Phases 1 and 5 can proceed independently of the real-time event work. Phases
2-4 form a strict dependency chain.

**Recommended approach:** Start with Phase 1 (parser extraction + tests) because:
1. It de-risks the entire codebase by testing the parsing that's currently untested
2. It creates the foundation that Phases 2-4 need
3. It's backward-compatible — no behavior change, just refactoring + tests
4. It delivers immediate value: we go from 0 to 15+ tests proving binary parsing works

---

## 8. What NOT to Implement (Yet)

These are valuable but out of scope for this plan:

- **Door state monitoring** (EF_BUTTON, EF_UNLOCK) — attendance domain only
- **HID card events** — no card readers deployed
- **WebSocket/SSE push to browser** — P4 dashboard work
- **Multi-device real-time** — we only have one scanner
- **Event persistence / replay** — P3 ADMS improvements
- **Access control integration** (EF_VERIFY → unlock) — out of attendance scope
