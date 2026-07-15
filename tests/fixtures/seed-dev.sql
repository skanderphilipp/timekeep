-- ============================================================================
-- Comprehensive dev seed for timekeep
-- Covers all migration tables (v1–v12) for local development and testing.
--
-- Usage:
--   make seed-dev        → apply to existing timekeep.db
--   make seed-dev-reset  → wipe timekeep.db, then re-seed
--
-- Admin login after seeding:
--   Username: admin
--   Password: admin123
-- ============================================================================

-- ── v1: Devices ──────────────────────────────────────────────────────────

INSERT OR REPLACE INTO devices (serial_number, label, host, port, comm_key, push_enabled)
VALUES ('CQZ7232960836', 'Office Entrance', '192.168.1.100', 4370, 0, 1);

INSERT OR REPLACE INTO devices (serial_number, label, host, port, comm_key, push_enabled)
VALUES ('CQZ7232960807', 'Warehouse', '192.168.1.101', 4370, 0, 1);

-- ── v2: Device Users ─────────────────────────────────────────────────────

INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('9882', 'CQZ7232960836', 'Abdullah Al-Rashid', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('6735', 'CQZ7232960836', 'Hamad Al-Ghamdi', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('3143', 'CQZ7232960836', 'Faisal Al-Shammari', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('3345', 'CQZ7232960836', 'Khalid Al-Mansoori', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('6303', 'CQZ7232960836', 'Ayman Al-Qahtani', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('7517', 'CQZ7232960836', 'Karim Al-Farsi', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('9612', 'CQZ7232960836', 'Mohammed Al-Qahtani', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('7006', 'CQZ7232960836', 'Sami Al-Ghamdi', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('4385', 'CQZ7232960836', 'Rami Al-Omari', 0);
INSERT OR REPLACE INTO users (pin, device_sn, name, privilege) VALUES ('9344', 'CQZ7232960836', 'Mohammed Al-Kuwaiti', 0);

-- ── v1: Attendance Punches (sample for dev) ──────────────────────────────

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('00de3458d90e31d0', 'CQZ7232960836', '9882', '1711458362', 0, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('e46623c4e12e9a62', 'CQZ7232960836', '3345', '1711460027', 1, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('b60c22f923c9ef25', 'CQZ7232960836', '3143', '1711461055', 1, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('f368de7d73240f82', 'CQZ7232960836', '6735', '1711461140', 1, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('307267a56ca41500', 'CQZ7232960836', '9612', '1711461155', 1, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('035d274108ff322e', 'CQZ7232960836', '7006', '1711461216', 1, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('d94b828d5335b859', 'CQZ7232960836', '6303', '1711464760', 1, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('cfc468e1329854b6', 'CQZ7232960836', '7517', '1711519447', 0, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('37004bebe1e82b7c', 'CQZ7232960836', '7006', '1711524515', 0, 1);

INSERT OR IGNORE INTO attendance_punches (id, device_sn, user_pin, timestamp, status, verify_mode)
VALUES ('95a288853253fb93', 'CQZ7232960836', '6735', '1711524520', 0, 1);

-- ── v3: API Keys (dev integration key) ───────────────────────────────────

INSERT OR IGNORE INTO api_keys (id, name, key_hash, prefix, permissions, created_by, created_at, expires_at, revoked)
VALUES (
    'apikey-dev-001',
    'Dev Integration Key',
    -- SHA-256("tk_dev_AbCdEf1234567890abcdef1234567890"),
    -- Prefix: tk_dev_ → for easy identification in logs
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    'tk_dev_',
    '["read_punches","write_punches","read_devices"]',
    'admin',
    datetime('now'),
    NULL,
    0
);

-- ── v4: System Settings ──────────────────────────────────────────────────

INSERT OR REPLACE INTO settings (key, value_json)
VALUES ('system', json_object(
    'poll_interval_secs', 60,
    'auto_discover', json('false'),
    'work_policy', json_object(
        'start_time', '08:00',
        'end_time', '17:00',
        'late_threshold_minutes', 15,
        'overtime_threshold_minutes', 60,
        'working_days', json_array('monday', 'tuesday', 'wednesday', 'thursday', 'friday')
    ),
    'support_email', 'support@alsabah.example.com'
));

-- ── v5: Integration Endpoints ────────────────────────────────────────────

INSERT OR IGNORE INTO integration_endpoints (id, name, kind, enabled, config_json, created_at, updated_at)
VALUES (
    'ep-dev-001',
    'Dev Webhook (local)',
    'webhook',
    0,
    json_object('url', 'http://localhost:9999/webhook', 'secret', ''),
    unixepoch(),
    unixepoch()
);

INSERT OR IGNORE INTO integration_endpoints (id, name, kind, enabled, config_json, created_at, updated_at)
VALUES (
    'ep-dev-002',
    'Odoo Staging',
    'odoo',
    0,
    json_object('url', 'https://odoo-staging.example.com', 'api_key', '', 'database', 'staging'),
    unixepoch(),
    unixepoch()
);

-- ── v6: Audit Logs (sample entries) ──────────────────────────────────────

INSERT OR IGNORE INTO audit_logs (id, timestamp, actor, action, resource, detail_json, ip_address, status)
VALUES (
    'audit-dev-001',
    unixepoch(),
    'admin',
    'system.startup',
    'system',
    json_object('version', '0.1.0', 'db_backend', 'sqlite'),
    '127.0.0.1',
    'success'
);

INSERT OR IGNORE INTO audit_logs (id, timestamp, actor, action, resource, detail_json, ip_address, status)
VALUES (
    'audit-dev-002',
    unixepoch(),
    'admin',
    'device.added',
    'device:CQZ7232960836',
    json_object('label', 'Office Entrance', 'host', '192.168.1.100'),
    '127.0.0.1',
    'success'
);

INSERT OR IGNORE INTO audit_logs (id, timestamp, actor, action, resource, detail_json, ip_address, status)
VALUES (
    'audit-dev-003',
    unixepoch(),
    'admin',
    'device.added',
    'device:CQZ7232960807',
    json_object('label', 'Warehouse', 'host', '192.168.1.101'),
    '127.0.0.1',
    'success'
);

-- ── v7/v8: Dashboard Users ───────────────────────────────────────────────
--
-- Admin user with legacy SHA-256 hash.
-- Password: admin123  Salt: devseed12345678
-- The system verifies with SHA-256(salt + ":" + password) for non-PHC hashes.

INSERT OR IGNORE INTO dashboard_users (id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text)
VALUES (
    'duser-dev-admin',
    'admin',
    'be6810c1c843a2047f64f0473bebe1c8da3277dd3aa5c2a39056150caf316acd',
    'devseed12345678',
    'admin',
    'Dev Admin',
    1,
    unixepoch(),
    unixepoch(),
    ''
);

-- Operator user (password: operator123, salt: devoperator123456)
-- SHA-256("devoperator123456:operator123") = ...
INSERT OR IGNORE INTO dashboard_users (id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text)
VALUES (
    'duser-dev-operator',
    'operator',
    'fdeba9f8e9086018dc7951d6a83729bd44a5f3e8834c5faaa3c436d18984b0fa',
    'devoperator123456',
    'operator',
    'Dev Operator',
    1,
    unixepoch(),
    unixepoch(),
    ''
);

-- Viewer user (password: viewer123, salt: devviewer1234567)
-- SHA-256("devviewer1234567:viewer123") = ...
INSERT OR IGNORE INTO dashboard_users (id, username, password_hash, salt, role, display_name, active, created_at, updated_at, permissions_text)
VALUES (
    'duser-dev-viewer',
    'viewer',
    '62dd889a8c73a53ad94e3e55452000154606ba3927b1d4b473674a255344b300',
    'devviewer1234567',
    'viewer',
    'Dev Viewer',
    1,
    unixepoch(),
    unixepoch(),
    ''
);

-- ── v9: Device Events ────────────────────────────────────────────────────

INSERT OR IGNORE INTO device_events (id, device_sn, timestamp, event_type, metadata_json, created_at)
VALUES (
    'devent-dev-001',
    'CQZ7232960836',
    unixepoch(),
    'came_online',
    json_object('source', 'seed'),
    unixepoch()
);

INSERT OR IGNORE INTO device_events (id, device_sn, timestamp, event_type, metadata_json, created_at)
VALUES (
    'devent-dev-002',
    'CQZ7232960836',
    unixepoch(),
    'provisioning_completed',
    json_object('firmware', 'Ver 6.60 Apr 26 2023'),
    unixepoch()
);

INSERT OR IGNORE INTO device_events (id, device_sn, timestamp, event_type, metadata_json, created_at)
VALUES (
    'devent-dev-003',
    'CQZ7232960807',
    unixepoch(),
    'came_online',
    json_object('source', 'seed'),
    unixepoch()
);

INSERT OR IGNORE INTO device_events (id, device_sn, timestamp, event_type, metadata_json, created_at)
VALUES (
    'devent-dev-004',
    'CQZ7232960807',
    unixepoch(),
    'provisioning_completed',
    json_object('firmware', 'Ver 6.60 Apr 26 2023'),
    unixepoch()
);

-- ── v9: Device Info ──────────────────────────────────────────────────────

INSERT OR REPLACE INTO device_info (
    serial_number, vendor, model, firmware_version, platform, mac_address, ip_address,
    status, last_seen, first_seen,
    user_capacity, record_capacity, fingerprint_capacity, face_capacity, palm_capacity,
    user_count, record_count, fingerprint_count, face_count, palm_count,
    label, location, branch, installed_at, notes, updated_at
) VALUES (
    'CQZ7232960836',
    'zkteco',
    'Biopro SA40[ID]',
    'Ver 6.60 Apr 26 2023',
    'ZLM60_TFT',
    '00:17:61:AA:BB:CC',
    '192.168.1.100',
    'offline',
    NULL,
    unixepoch(),
    3000, 100000, 3000, 500, 0,
    10, 7, 0, 0, 0,
    'Office Entrance',
    'HQ Floor 1',
    'Main',
    unixepoch(),
    'Dev seed device — not a real scanner',
    unixepoch()
);

INSERT OR REPLACE INTO device_info (
    serial_number, vendor, model, firmware_version, platform, mac_address, ip_address,
    status, last_seen, first_seen,
    user_capacity, record_capacity, fingerprint_capacity, face_capacity, palm_capacity,
    user_count, record_count, fingerprint_count, face_count, palm_count,
    label, location, branch, installed_at, notes, updated_at
) VALUES (
    'CQZ7232960807',
    'zkteco',
    'Biopro SA40[ID]',
    'Ver 6.60 Apr 26 2023',
    'ZLM60_TFT',
    '00:17:61:DD:EE:FF',
    '192.168.1.101',
    'offline',
    NULL,
    unixepoch(),
    3000, 100000, 3000, 500, 0,
    0, 0, 0, 0, 0,
    'Warehouse',
    'Warehouse B',
    'Main',
    unixepoch(),
    'Dev seed device — not a real scanner',
    unixepoch()
);

-- ── v9: Providers ────────────────────────────────────────────────────────

INSERT OR REPLACE INTO providers (key, display_name, default_port, supports_adms, supports_sdk, capabilities_json, enabled, created_at)
VALUES (
    'zkteco',
    'ZKTeco',
    4370,
    1,
    1,
    json_object(
        'attendance_read', json('true'),
        'attendance_clear', json('true'),
        'user_read', json('true'),
        'user_write', json('true'),
        'user_delete', json('true'),
        'device_config_read', json('true'),
        'device_config_write', json('true'),
        'real_time_events', json('true'),
        'fingerprint_enroll', json('true'),
        'face_enroll', json('true'),
        'palm_enroll', json('false'),
        'time_sync', json('true'),
        'restart', json('true')
    ),
    1,
    unixepoch()
);

-- ── v10: Employees ───────────────────────────────────────────────────────

INSERT OR IGNORE INTO employees (id, pin, name, department, external_id, active, created_at, updated_at)
VALUES ('emp-dev-001', '9882', 'Abdullah Al-Rashid', 'Engineering', 'ODOO-1001', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO employees (id, pin, name, department, external_id, active, created_at, updated_at)
VALUES ('emp-dev-002', '6735', 'Hamad Al-Ghamdi', 'Engineering', 'ODOO-1002', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO employees (id, pin, name, department, external_id, active, created_at, updated_at)
VALUES ('emp-dev-003', '3143', 'Faisal Al-Shammari', 'Sales', 'ODOO-2001', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO employees (id, pin, name, department, external_id, active, created_at, updated_at)
VALUES ('emp-dev-004', '3345', 'Khalid Al-Mansoori', 'Sales', 'ODOO-2002', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO employees (id, pin, name, department, external_id, active, created_at, updated_at)
VALUES ('emp-dev-005', '6303', 'Ayman Al-Qahtani', 'HR', 'ODOO-3001', 1, datetime('now'), datetime('now'));

-- ── v10: Device Enrollments ──────────────────────────────────────────────

INSERT OR IGNORE INTO device_enrollments (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
VALUES ('emp-dev-001', 'CQZ7232960836', '9882', '["fingerprint","face"]', 2, 1, NULL, datetime('now'));

INSERT OR IGNORE INTO device_enrollments (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
VALUES ('emp-dev-002', 'CQZ7232960836', '6735', '["fingerprint"]', 1, 0, NULL, datetime('now'));

INSERT OR IGNORE INTO device_enrollments (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
VALUES ('emp-dev-003', 'CQZ7232960836', '3143', '["fingerprint","face","card"]', 2, 1, 'RF-001', datetime('now'));

INSERT OR IGNORE INTO device_enrollments (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
VALUES ('emp-dev-004', 'CQZ7232960836', '3345', '["password"]', 0, 0, NULL, datetime('now'));

INSERT OR IGNORE INTO device_enrollments (employee_id, device_sn, pin, biometric_types, fingerprint_count, face_enrolled, card_number, enrolled_at)
VALUES ('emp-dev-005', 'CQZ7232960836', '6303', '["fingerprint"]', 1, 0, NULL, datetime('now'));

-- ── v11: Pending Deliveries (empty — populated by outbox worker at runtime)

-- ── v11: Dead Letter Deliveries (empty — populated on permanent failure)

-- ── v12: Fingerprint Templates (sample binary blob)
--         Real templates are downloaded from devices after enrollment.
--         These are placeholder entries for schema validation.

INSERT OR IGNORE INTO fingerprint_templates (employee_id, device_sn, finger_index, template_data, size_bytes, downloaded_at)
VALUES ('emp-dev-001', 'CQZ7232960836', 0, X'DEADBEEF01020304', 8, unixepoch());

INSERT OR IGNORE INTO fingerprint_templates (employee_id, device_sn, finger_index, template_data, size_bytes, downloaded_at)
VALUES ('emp-dev-001', 'CQZ7232960836', 1, X'CAFEBABE05060708', 8, unixepoch());

INSERT OR IGNORE INTO fingerprint_templates (employee_id, device_sn, finger_index, template_data, size_bytes, downloaded_at)
VALUES ('emp-dev-002', 'CQZ7232960836', 0, X'BEEFCAFE090A0B0C', 8, unixepoch());
