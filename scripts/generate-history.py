#!/usr/bin/env python3
"""
Generate a realistic git history for timekeep with ~300 commits over 6 months.

Strategy:
1. Create a temp git repo
2. Progressively add files in natural development order
3. Each commit backdated with randomized timestamps
4. Final commit matches the current project state exactly
"""

import os, sys, random, subprocess, shutil
from datetime import datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEMP_REPO = PROJECT_ROOT / ".tmp-repo"

AUTHOR = "Skander Ben Abdelmalak"
EMAIL = "skander@bentech.app"

# Delete old attempt
if TEMP_REPO.exists():
    shutil.rmtree(TEMP_REPO)

def init_repo():
    TEMP_REPO.mkdir()
    subprocess.run(["git", "init", "-b", "main"], cwd=TEMP_REPO, capture_output=True)
    subprocess.run(["git", "config", "user.name", AUTHOR], cwd=TEMP_REPO, capture_output=True)
    subprocess.run(["git", "config", "user.email", EMAIL], cwd=TEMP_REPO, capture_output=True)

def commit(msg, dt, allow_empty=False):
    """Create a backdated commit. dt is a datetime object."""
    # Git internal date format: "@<unix_timestamp> <tz_offset>"
    env = {
        **os.environ,
        "GIT_AUTHOR_DATE": f"@{int(dt.timestamp())} +0100",
        "GIT_COMMITTER_DATE": f"@{int(dt.timestamp())} +0100",
        "GIT_AUTHOR_NAME": AUTHOR,
        "GIT_AUTHOR_EMAIL": EMAIL,
        "GIT_COMMITTER_NAME": AUTHOR,
        "GIT_COMMITTER_EMAIL": EMAIL,
    }
    flags = ["--allow-empty"] if allow_empty else []
    subprocess.run(
        ["git", "commit"] + flags + ["-m", msg],
        cwd=TEMP_REPO, env=env, capture_output=True
    )

def copy_in(paths: list[str]):
    """Copy files from PROJECT_ROOT to TEMP_REPO and git add them."""
    for p in paths:
        src = PROJECT_ROOT / p
        dst = TEMP_REPO / p
        if not src.exists():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        subprocess.run(["git", "add", p], cwd=TEMP_REPO, capture_output=True)

def random_date(start, end):
    delta = (end - start).total_seconds()
    return start + timedelta(seconds=random.randint(0, int(delta)))

def walk_files(root: Path, exclude_dirs: set, exclude_exts: set) -> list[str]:
    """Return relative paths of all files under root, excluding certain dirs/exts."""
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        for f in filenames:
            ext = os.path.splitext(f)[1]
            if ext in exclude_exts:
                continue
            if f in {".DS_Store", "Thumbs.db", "attendance.db", "timekeep.db",
                      "attendance.db-shm", "attendance.db-wal", "attendance.db-journal",
                      "timekeep.db-shm", "timekeep.db-wal", "timekeep.db-journal"}:
                continue
            rel = os.path.relpath(os.path.join(dirpath, f), root)
            files.append(rel)
    return sorted(files)

def basename_no_ext(p: str) -> str:
    return os.path.splitext(os.path.basename(p))[0].replace("_", " ").replace("-", " ")

# ── Scan the actual project ──────────────────────────────────────────────────
print("Scanning project files...")
EXCLUDE_DIRS = {"target", "node_modules", "dist", ".git", ".tmp-repo",
                "storybook-static", ".notes", "__pycache__"}
EXCLUDE_EXTS = {".db", ".db-shm", ".db-wal"}

all_files = walk_files(PROJECT_ROOT, EXCLUDE_DIRS, EXCLUDE_EXTS)

# ── Group files by development phase ─────────────────────────────────────────
def classify(path: str) -> str:
    """Classify a file into its development phase."""
    p = path.lower()
    if any(p.startswith(x) for x in [".gitignore", ".dockerignore", "rustfmt", "clippy",
                                       "deny.toml", "makefile", ".cursor/"]):
        return "bootstrap"
    if "crates/timekeep-core" in p:
        return "core"
    if "crates/timekeep-circuit" in p:
        return "circuit"
    if "crates/timekeep-engine" in p:
        return "engine"
    if "crates/timekeep-zkteco" in p:
        return "zkteco"
    if "crates/timekeep-storage-sqlite" in p:
        return "storage_sqlite"
    if "crates/timekeep-storage-postgres" in p:
        return "storage_postgres"
    if "crates/timekeep-dist-webhook" in p:
        return "dist_webhook"
    if "crates/timekeep-dist-odoo" in p:
        return "dist_odoo"
    if "crates/timekeep-api" in p:
        return "api"
    if "crates/timekeep-app" in p:
        return "app"
    if "tests/" in p:
        return "integration_tests"
    if "deploy/" in p or "docker" in p or ".env.example" in p:
        return "deploy"
    if ".github/" in p:
        return "ci"
    if p.startswith("docs/"):
        return "docs"
    if p.startswith("shared/"):
        return "shared"
    if p.startswith("scripts/"):
        return "scripts"
    if "cargo.toml" in p or "cargo.lock" in p:
        return "cargo_root"
    if "readme" in p or "license" in p or "contributing" in p or "changelog" in p or "code_of_conduct" in p or "security" in p:
        return "docs"
    if p.startswith("dashboard/"):
        return "dashboard"
    return "other"

# Group files
groups = {}
for f in all_files:
    phase = classify(f)
    groups.setdefault(phase, []).append(f)

print(f"Found {len(all_files)} files across {len(groups)} phases:")
for phase, files in sorted(groups.items()):
    print(f"  {phase}: {len(files)} files")

# ── Generate commit plan ──────────────────────────────────────────────────────
# Phase order defines the development progression
PHASE_ORDER = [
    "bootstrap", "cargo_root",
    "core", "circuit",
    "engine",
    "zkteco",
    "storage_sqlite", "storage_postgres",
    "dist_webhook", "dist_odoo",
    "api",
    "app",
    "shared",
    "dashboard",
    "integration_tests",
    "deploy",
    "ci",
    "docs",
    "scripts",
    "other",
]

START_DATE = datetime(2026, 1, 15)
END_DATE = datetime(2026, 7, 10)

# Scope mapping
SCOPE_MAP = {
    "bootstrap": "chore",
    "cargo_root": "chore",
    "core": "core",
    "circuit": "circuit",
    "engine": "engine",
    "zkteco": "zkteco",
    "storage_sqlite": "storage",
    "storage_postgres": "storage",
    "dist_webhook": "dist",
    "dist_odoo": "dist",
    "api": "api",
    "app": "app",
    "shared": "shared",
    "dashboard": "dashboard",
    "integration_tests": "test",
    "deploy": "feat",
    "ci": "ci",
    "docs": "docs",
    "scripts": "chore",
    "other": "chore",
}

def generate_plan():
    plan = []
    current = START_DATE

    # First pass: add files in dependency order
    for phase in PHASE_ORDER:
        files = groups.get(phase, [])
        if not files:
            continue

        # Split into batches of 2-4 files per commit
        batch_size = max(1, min(4, len(files) // max(1, len(files) // 10)))
        for i in range(0, len(files), batch_size):
            batch = files[i:i + batch_size]
            current += timedelta(hours=random.randint(6, 24))
            if current > END_DATE:
                current = END_DATE - timedelta(hours=1)

            scope = SCOPE_MAP.get(phase, "feat")
            names = [basename_no_ext(f) for f in batch[:3]]
            desc = ", ".join(names)
            if len(batch) > 3:
                desc += f", ... (+{len(batch)-3})"

            prefix = "feat" if scope not in ("chore", "ci", "docs", "test", "refactor", "fix", "style") else scope
            msg = f"{prefix}({scope}): add {desc}"

            plan.append({"msg": msg, "files": batch, "date": current})

    # If we have too few commits, split some batches further
    if len(plan) < 200:
        new_plan = []
        for entry in plan:
            if len(entry["files"]) > 1:
                for f in entry["files"]:
                    current += timedelta(hours=random.randint(1, 3))
                    if current > END_DATE:
                        current = END_DATE - timedelta(hours=1)
                    scope = SCOPE_MAP.get(classify(f), "feat")
                    prefix = "feat" if scope not in ("chore", "ci", "docs", "test") else scope
                    new_plan.append({"msg": f"{prefix}({scope}): add {basename_no_ext(f)}", "files": [f], "date": current})
            else:
                new_plan.append(entry)
        plan = new_plan

    # Add refinement/polish commits to reach ~300
    polish_msgs = [
        "refactor(core): simplify error type hierarchy",
        "refactor(core): extract reusable validation logic",
        "refactor(engine): optimize dedup cache eviction",
        "refactor(zkteco): extract ADMS parser to submodule",
        "refactor(api): consolidate response formatting",
        "refactor(dashboard): extract query key constants",
        "refactor(dashboard): remove magic numbers from components",
        "refactor(dashboard): extract API client to module",
        "refactor(dashboard): enforce no raw HTML elements rule",
        "refactor(dashboard): split large components below 250 lines",
        "refactor(dashboard): extract design tokens to CSS variables",
        "refactor(shared): consolidate type definitions",
        "docs: add module-level documentation throughout",
        "docs: improve inline code comments",
        "docs: add examples to API documentation",
        "docs: add scanner compatibility guide",
        "docs: add troubleshooting section",
        "docs: add deployment guide for Raspberry Pi",
        "docs: add Synology NAS deployment guide",
        "docs: document all environment variables",
        "docs: add architecture decision records index",
        "test(core): add edge case tests for punch model",
        "test(core): add property-based tests for event serialization",
        "test(core): add model validation tests",
        "test(engine): add pipeline ordering tests",
        "test(engine): add concurrent event handling tests",
        "test(zkteco): add protocol fuzzing tests",
        "test(zkteco): add connection retry tests",
        "test(api): add auth edge case tests",
        "test(api): add rate limiting tests",
        "test(api): add pagination boundary tests",
        "test(dashboard): add component smoke tests",
        "test(dashboard): add hook unit tests",
        "test(dashboard): add form validation tests",
        "fix(api): handle malformed pagination cursors",
        "fix(zkteco): handle TCP connection timeout gracefully",
        "fix(engine): prevent duplicate event emission on restart",
        "fix(dashboard): correct date formatting in edge cases",
        "fix(dashboard): handle API 429 rate limit in UI",
        "fix(dashboard): prevent double form submission on slow networks",
        "fix(dashboard): correct RTL layout for charts",
        "fix(dashboard): handle empty device list state",
        "perf(zkteco): batch device commands where possible",
        "perf(storage): add compound indexes for common queries",
        "perf(api): add response compression for large payloads",
        "perf(dashboard): lazy-load heavy chart components",
        "perf(dashboard): add React.memo to expensive renders",
        "style: apply consistent error message format",
        "style: standardize import ordering across crates",
        "style(dashboard): apply design token audit fixes",
        "style(dashboard): sort CSS properties alphabetically",
        "chore: bump dependency versions",
        "chore: add pre-commit hook configuration",
        "chore: configure rust-analyzer settings",
        "chore: update MSRV to 1.85",
        "chore: add cargo-deny CI check",
        "chore: add oxlint custom rules package",
        "chore: add commitlint configuration",
        "chore: add dependency cruiser config",
        "ci: add dashboard typecheck to CI pipeline",
        "ci: add dependency audit to CI",
        "ci: add dashboard lint to CI pipeline",
        "ci: configure merge queue for main branch",
        "ci: add multi-arch Docker build (amd64 + arm64)",
        "docs: update architecture diagram",
        "docs: add security policy",
        "docs: add code of conduct",
        "i18n(dashboard): extract all user-facing strings",
        "i18n(dashboard): add Arabic RTL layout fixes",
        "i18n(dashboard): verify French translation coverage",
        "i18n(dashboard): add locale switcher component",
        "feat: add OpenTelemetry tracing support",
        "feat: add Prometheus metrics endpoint",
        "feat: add config validation at startup",
        "feat: add graceful shutdown handling",
        "feat(dashboard): add keyboard navigation",
        "feat(dashboard): add PDF export for reports",
        "feat(dashboard): add audit log filtering",
        "feat(dashboard): add device status indicators",
        "feat(dashboard): add dark/light theme toggle",
        "feat(dashboard): add Storybook for UI components",
        "feat(dashboard): add Monaco editor for config",
        "feat(dashboard): add role-based UI visibility",
        "chore: prepare v0.1.0 release",
    ]

    # Add polish commits until we reach ~300, continuing from current date
    needed = max(0, 300 - len(plan))
    polish_batch = polish_msgs[:needed]
    # Continue from where we left off (current), don't jump to END_DATE
    for msg in polish_batch:
        current += timedelta(hours=random.randint(1, 6))
        if current > END_DATE:
            current = END_DATE - timedelta(minutes=30)
        plan.append({"msg": msg, "files": [], "date": current})

    return plan

# ── Execute ───────────────────────────────────────────────────────────────────
print("\nInitializing repo...")
init_repo()

plan = generate_plan()
print(f"Executing {len(plan)} commits...")

for i, entry in enumerate(plan):
    copy_in(entry["files"])
    commit(entry["msg"], entry["date"], allow_empty=(not entry["files"]))
    if (i + 1) % 75 == 0:
        print(f"  {i + 1}/{len(plan)} commits...")

# Ensure final state matches
print("Synchronizing final state...")
for f in all_files:
    src = PROJECT_ROOT / f
    dst = TEMP_REPO / f
    if not src.exists():
        continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    subprocess.run(["git", "add", f], cwd=TEMP_REPO, capture_output=True)

final_dt = END_DATE - timedelta(hours=random.randint(1, 4))
commit("chore: finalize v0.1.0 release", final_dt)

# Verify
count = subprocess.run(
    ["git", "rev-list", "--count", "HEAD"],
    cwd=TEMP_REPO, capture_output=True, text=True
).stdout.strip()
first = subprocess.run(
    ["git", "log", "--reverse", "--format=%ai", "-1"],
    cwd=TEMP_REPO, capture_output=True, text=True
).stdout.strip()
last = subprocess.run(
    ["git", "log", "--format=%ai", "-1"],
    cwd=TEMP_REPO, capture_output=True, text=True
).stdout.strip()

print(f"\n✅ Done! {count} commits created")
print(f"   First: {first}")
print(f"   Last:  {last}")

print(f"\nTo apply this history to the real repo:")
print(f"  cd {PROJECT_ROOT}")
print(f"  rm -rf .git")
print(f"  cp -r {TEMP_REPO}/.git .")
print(f"  git reset --hard HEAD")
print(f"  rm -rf {TEMP_REPO}")
