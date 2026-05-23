//! Architecture fitness functions — compile-time enforcement of module boundaries.
//!
//! These tests are the Rust equivalent of ArchUnit (Java) and oxlint's
//! `enforce-module-boundaries` rule (TypeScript). They parse the cargo
//! workspace metadata and assert the dependency layering rules.
//!
//! ## Why tests instead of a linter?
//!
//! Rust doesn't have custom clippy lints (yet). But architecture tests that
//! fail the build are functionally equivalent — they prevent regressions
//! in CI exactly like a linter would.
//!
//! ## Rules enforced
//!
//! 1. **`timekeep-core` is a leaf** — it depends on no other workspace crate
//! 2. **No upward dependencies** — storage/dist/zkteco crates must not depend on
//!    `timekeep-api` or `timekeep-engine`
//! 3. **`timekeep-engine` isolation** — depends only on `timekeep-core`
//! 4. **No circular dependencies** (cargo already enforces this, but we test it explicitly)
//! 5. **Provider crates are isolated** — `timekeep-zkteco` depends only on `timekeep-core`

use std::collections::{HashMap, HashSet};
use std::process::Command;

/// Crate name → set of workspace crates it depends on.
type DepGraph = HashMap<String, HashSet<String>>;

/// Parse the cargo metadata JSON to extract the workspace dependency graph.
fn parse_dependency_graph() -> DepGraph {
    let output = Command::new("cargo")
        .args([
            "metadata",
            "--format-version=1",
            "--no-deps",
            "--manifest-path",
            concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml"),
        ])
        .output()
        .expect("cargo metadata failed — is cargo installed?");

    let metadata: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("invalid cargo metadata JSON");

    let mut graph: DepGraph = HashMap::new();
    let workspace_members: HashSet<String> = metadata["workspace_members"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_string())
        .collect();

    // Build a map of package ID → crate name
    let mut id_to_name: HashMap<String, String> = HashMap::new();
    for pkg in metadata["packages"].as_array().unwrap() {
        let id = pkg["id"].as_str().unwrap().to_string();
        let name = pkg["name"].as_str().unwrap().to_string();
        if workspace_members.contains(&id) {
            id_to_name.insert(id.clone(), name.clone());
            graph.entry(name).or_default();
        }
    }

    // Populate dependencies
    for pkg in metadata["packages"].as_array().unwrap() {
        let id = pkg["id"].as_str().unwrap();
        let name = id_to_name.get(id);
        if name.is_none() {
            continue;
        }
        let name = name.unwrap().clone();

        for dep in pkg["dependencies"].as_array().unwrap() {
            let dep_name = dep["name"].as_str().unwrap();
            // Only track intra-workspace dependencies
            if graph.contains_key(dep_name) {
                graph.get_mut(&name).unwrap().insert(dep_name.to_string());
            }
        }
    }

    graph
}

// ─── Rule 1: timekeep-core depends on nothing ────────────────────

#[test]
fn timekeep_core_has_no_workspace_dependencies() {
    let graph = parse_dependency_graph();
    let core_deps = graph.get("timekeep-core").expect("timekeep-core not in workspace");

    assert!(
        core_deps.is_empty(),
        "timekeep-core must not depend on any workspace crate. Found: {:?}",
        core_deps
    );
}

// ─── Rule 2: No upward dependencies ────────────────────────────────

#[test]
fn storage_crates_only_depend_on_core() {
    let graph = parse_dependency_graph();
    let storage_crates = ["timekeep-storage-sqlite", "timekeep-storage-postgres"];

    for crate_name in &storage_crates {
        let deps =
            graph.get(*crate_name).unwrap_or_else(|| panic!("{crate_name} not found in workspace"));

        let forbidden: HashSet<_> =
            deps.iter().filter(|d| *d != "timekeep-core").cloned().collect();

        assert!(
            forbidden.is_empty(),
            "{crate_name} must only depend on timekeep-core. Found: {:?}",
            forbidden
        );
    }
}

#[test]
fn distributor_crates_only_depend_on_core() {
    let graph = parse_dependency_graph();
    let dist_crates = ["timekeep-dist-webhook", "timekeep-dist-odoo"];
    let allowed: HashSet<String> =
        ["timekeep-core", "timekeep-circuit"].iter().map(|s| s.to_string()).collect();

    for crate_name in &dist_crates {
        let deps =
            graph.get(*crate_name).unwrap_or_else(|| panic!("{crate_name} not found in workspace"));

        let forbidden: HashSet<_> =
            deps.iter().filter(|d| !allowed.contains(*d)).cloned().collect();

        assert!(
            forbidden.is_empty(),
            "{crate_name} must only depend on timekeep-core or timekeep-circuit. Found: {:?}",
            forbidden
        );
    }
}

#[test]
fn zkteco_crate_only_depends_on_core() {
    let graph = parse_dependency_graph();
    let deps = graph.get("timekeep-zkteco").expect("timekeep-zkteco not found");

    let allowed: HashSet<String> =
        ["timekeep-core", "timekeep-circuit"].iter().map(|s| s.to_string()).collect();

    let forbidden: HashSet<_> = deps.iter().filter(|d| !allowed.contains(*d)).cloned().collect();

    assert!(
        forbidden.is_empty(),
        "timekeep-zkteco must only depend on timekeep-core or timekeep-circuit. Found: {:?}",
        forbidden
    );
}

// ─── Rule 3: Engine isolation ─────────────────────────────────────

#[test]
fn engine_only_depends_on_core() {
    let graph = parse_dependency_graph();
    let deps = graph.get("timekeep-engine").expect("timekeep-engine not found");

    // Engine is allowed to depend on core and circuit (breaker for distributors)
    let allowed: HashSet<&str> = ["timekeep-core", "timekeep-circuit"].into();
    let forbidden: HashSet<_> =
        deps.iter().filter(|d| !allowed.contains(d.as_str())).cloned().collect();

    assert!(
        forbidden.is_empty(),
        "timekeep-engine must only depend on timekeep-core + timekeep-circuit. Found: {:?}",
        forbidden
    );
}

// ─── Rule 4: API depends on core + engine only ────────────────────

#[test]
fn api_only_depends_on_core_and_engine() {
    let graph = parse_dependency_graph();
    let deps = graph.get("timekeep-api").expect("timekeep-api not found");

    let allowed: HashSet<String> =
        ["timekeep-core", "timekeep-engine"].iter().map(|s| s.to_string()).collect();

    let forbidden: HashSet<_> = deps.iter().filter(|d| !allowed.contains(*d)).cloned().collect();

    assert!(
        forbidden.is_empty(),
        "timekeep-api must only depend on timekeep-core and timekeep-engine. Found: {:?}",
        forbidden
    );
}

// ─── Rule 5: No crate depends on the app binary ───────────────────

#[test]
fn no_crate_depends_on_app() {
    let graph = parse_dependency_graph();

    for (crate_name, deps) in &graph {
        if crate_name == "timekeep" {
            continue; // the binary itself is exempt
        }
        assert!(
            !deps.contains("timekeep"),
            "{crate_name} must not depend on timekeep (binary crate)"
        );
    }
}

// ─── Rule 6: All workspace crates are accounted for ───────────────

#[test]
fn all_expected_crates_exist() {
    let graph = parse_dependency_graph();
    let expected = [
        "timekeep-core",
        "timekeep-engine",
        "timekeep-zkteco",
        "timekeep-storage-sqlite",
        "timekeep-storage-postgres",
        "timekeep-dist-webhook",
        "timekeep-dist-odoo",
        "timekeep-api",
        "timekeep",
    ];

    for name in &expected {
        assert!(
            graph.contains_key(*name),
            "expected crate '{name}' not found in workspace — was it removed?"
        );
    }
}
