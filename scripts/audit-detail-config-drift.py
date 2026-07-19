#!/usr/bin/env python3
"""Audit script: find missing required fields in entity detail configs.

Compares each entity's DetailViewConfig fields against the required fields
in the corresponding Create*Request type from the OpenAPI spec.

Usage:
  cd timekeep
  python3 scripts/audit-detail-config-drift.py
"""

import json, subprocess, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ── 1. Fetch OpenAPI spec from running server ────────────────────────────

def fetch_openapi():
    try:
        result = subprocess.run(
            ["curl", "-s", "http://127.0.0.1:3000/api/docs/openapi.json"],
            capture_output=True, text=True, timeout=10
        )
        return json.loads(result.stdout)
    except Exception as e:
        print(f"ERROR: Could not fetch OpenAPI spec: {e}")
        print("Make sure the server is running on port 3000")
        sys.exit(1)

# ── 2. Extract Create*Request required fields ────────────────────────────

def get_required_create_fields(spec):
    """Map entity_type -> set of required field names"""
    schemas = spec["components"]["schemas"]
    
    # Map schema names to entity types
    schema_to_entity = {
        "CreateDeviceGroupRequest": "device_group",
        "CreateDepartmentRequest": "department",
        "CreateEmployeeRequest": "employee",
        "CreateWorkPolicyTemplateRequest": "work_policy",
        "CreateDashboardUserRequest": "user",
        "CreateApiKeyRequest": "api_key",
        "CreateEndpointRequest": "endpoint",
    }
    
    result = {}
    for schema_name, entity in schema_to_entity.items():
        if schema_name in schemas:
            required = set(schemas[schema_name].get("required", []))
            all_fields = set(schemas[schema_name].get("properties", {}).keys())
            result[entity] = {"required": required, "all": all_fields}
    
    return result

# ── 3. Extract DetailViewConfig fields from registry.ts ──────────────────

def get_detail_config_fields(registry_path):
    """Map entity_type -> set of configured field IDs"""
    with open(registry_path) as f:
        content = f.read()
    
    # Maps variable names to entity types
    var_to_entity = {
        "deviceGroupDetailConfig": "device_group",
        "departmentDetailConfig": "department",
        "employeeDetailConfig": "employee",
        "workPolicyDetailConfig": "work_policy",
        "userDetailConfig": "user",
        "apiKeyDetailConfig": "api_key",
        "endpointDetailConfig": "endpoint",
        "deviceDetailConfig": "device",
        "punchDetailConfig": "punch",
        "auditDetailConfig": "audit",
    }
    
    result = {}
    current_entity = None
    current_fields = set()
    
    for line in content.split("\n"):
        # Detect entity config variable
        for var_name, entity in var_to_entity.items():
            if f"const {var_name}" in line:
                if current_entity:
                    result[current_entity] = current_fields
                current_entity = entity
                current_fields = set()
                break
        
        # Extract fieldId values
        if current_entity:
            m = re.search(r'fieldId:\s*["\'](\w+)["\']', line)
            if m:
                current_fields.add(m.group(1))
    
    if current_entity:
        result[current_entity] = current_fields
    
    return result

# ── 4. Check which entities have createFn in registry ────────────────────

def get_creatable_entities(registry_path):
    with open(registry_path) as f:
        content = f.read()
    
    # Find entities that have createFn
    creatable = set()
    # Look for createFn: in entity blocks
    pattern = r'(\w+):\s*\{[^}]*createFn:'
    for m in re.finditer(pattern, content, re.DOTALL):
        entity = m.group(1)
        if entity not in ("punch", "audit", "device"):
            creatable.add(entity)
    
    # Manual: all entities except device, punch, audit have createFn
    return {"employee", "department", "device_group", "work_policy", "user", "api_key", "endpoint"}

# ── 5. Generate report ────────────────────────────────────────────────────

def main():
    print("=" * 70)
    print("  Detail Config Drift Audit")
    print("  Compares DetailViewConfig fields vs Create*Request required fields")
    print("=" * 70)
    print()
    
    spec = fetch_openapi()
    required_fields = get_required_create_fields(spec)
    config_fields = get_detail_config_fields(ROOT / "dashboard/src/modules/record-detail/entity-definitions/registry.ts")
    creatable = get_creatable_entities(ROOT / "dashboard/src/modules/record-detail/entity-definitions/registry.ts")
    
    total_missing = 0
    for entity in sorted(creatable):
        if entity not in required_fields:
            print(f"⚠️  {entity}: No Create*Request schema found in OpenAPI spec")
            continue
        
        req_all = required_fields[entity]["all"]
        req_required = required_fields[entity]["required"]
        config = config_fields.get(entity, set())
        
        missing_required = req_required - config
        missing_optional = req_all - req_required - config
        extra = config - req_all
        
        has_issues = missing_required or missing_optional or extra
        
        if has_issues:
            status = "❌ DRIFT" if missing_required else "🟡 INCOMPLETE"
        else:
            status = "✅ OK"
        
        print(f"{status}  {entity}")
        if missing_required:
            print(f"      Missing REQUIRED: {sorted(missing_required)}")
            total_missing += len(missing_required)
        if missing_optional:
            print(f"      Missing optional: {sorted(missing_optional)}")
        if extra:
            print(f"      Extra (not in request): {sorted(extra)}")
        if not has_issues:
            print(f"      All {len(req_all)} fields covered")
        print()
    
    print("-" * 70)
    if total_missing:
        print(f"❌ {total_missing} required fields missing across {len(creatable)} entities")
        print("   These entities CANNOT be created via the side panel.")
    else:
        print("✅ All required create fields are covered in detail configs")
    print("=" * 70)

if __name__ == "__main__":
    main()
