# Contributing to timekeep

## Getting Started

```bash
# Prerequisites: Rust 1.85+ (edition 2024)
cargo build
cargo check --workspace
cargo test --workspace
```

## Project Structure

See [docs/OVERVIEW.md](docs/OVERVIEW.md) for the architecture and domain model.

```
crates/
├── timekeep-core/          # Domain model, traits, events
├── timekeep-engine/        # Event bus, handlers, pipeline
├── timekeep-zkteco/        # ZKTeco provider (ADMS + SDK)
├── timekeep-storage-sqlite/ # SQLite backend
├── timekeep-storage-postgres/ # PostgreSQL backend
├── timekeep-dist-webhook/  # Generic webhook distributor
├── timekeep-dist-odoo/     # Odoo XML-RPC distributor
├── timekeep-api/           # REST API (management + integration)
└── timekeep-app/           # Binary entry point
```

## Code Style

- `cargo fmt` before committing
- `cargo clippy --workspace -- -D warnings` must pass
- All TODO markers use the `TODO(ENTERPRISE)` format
- Domain types go in `timekeep-core/model/`
- Traits go in `timekeep-core/traits/`
- Events go in `timekeep-core/events/`

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <description>

Types: feat, fix, docs, refactor, test, chore
Scopes: core, engine, zkteco, storage, dist, api, app
```

## License

GNU AGPL v3. See [LICENSE](LICENSE).
