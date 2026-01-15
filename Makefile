# ─── timekeep Makefile ──────────────────────────────────────────
#
# Targets:
#   make build          Build for current platform (dashboard + Rust)
#   make build-docker   Build the Docker image
#   make dev            Run dashboard dev server + Rust backend
#   make test           Run all tests (Rust + dashboard)
#   make lint           Run all linters (clippy + oxlint + rustfmt)
#   make clean          Remove build artifacts
#   make release        Build optimized release binary + Docker image
#
# Prerequisites:
#   - Rust 1.85+ (rustup)
#   - Node 22+ + pnpm  (for dashboard)
#   - Docker            (for Docker targets)

.PHONY: build build-rust build-dashboard build-docker dev dev-rust dev-dashboard \
        test test-rust test-dashboard lint lint-rust lint-dashboard \
        clean release help seed-db seed-db-reset

# ─── Default target ──────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Build ───────────────────────────────────────────────────────────

build: build-dashboard build-rust ## Build dashboard + Rust binary (release)

build-dashboard: ## Build the React dashboard
	cd dashboard && pnpm install --frozen-lockfile && pnpm build
	@echo "✅ Dashboard built → dashboard/dist/"

build-rust: ## Build the Rust binary (release)
	cargo build --release --bin timekeep
	@echo "✅ Binary built → target/release/timekeep"

build-docker: ## Build the Docker image
	docker build -t timekeep:latest .
	@echo "✅ Docker image built → timekeep:latest"

# ─── Development ─────────────────────────────────────────────────────

dev: ## Start dashboard dev server + Rust backend in parallel
	@echo "Starting development environment..."
	@echo "  Dashboard: http://localhost:5173"
	@echo "  API:       http://localhost:3000"
	@echo "  ADMS:      http://localhost:8085/iclock/"
	@trap 'kill 0' EXIT; \
		(cd dashboard && pnpm dev) & \
		cargo run --bin timekeep & \
		wait

dev-rust: ## Start only the Rust backend
	cargo run --bin timekeep

dev-dashboard: ## Start only the dashboard dev server (proxies API to :3000)
	cd dashboard && pnpm dev

# ─── Testing ─────────────────────────────────────────────────────────

test: test-rust test-dashboard ## Run all tests

test-rust: ## Run all Rust tests
	cargo test --workspace

test-dashboard: ## Run dashboard tests
	cd dashboard && pnpm test

# ─── Linting ─────────────────────────────────────────────────────────

lint: lint-rust lint-dashboard ## Run all linters

lint-rust: ## Run clippy + rustfmt check
	cargo fmt --all --check
	cargo clippy --workspace --all-targets -- -D warnings

lint-dashboard: ## Run oxlint + typecheck + format check
	cd dashboard && pnpm check

# ─── Cleanup ─────────────────────────────────────────────────────────

clean: ## Remove all build artifacts
	cargo clean
	rm -rf dashboard/dist dashboard/node_modules
	@echo "✅ Build artifacts removed"

# ─── Release ─────────────────────────────────────────────────────────

release: build build-docker ## Build everything for release
	@echo ""
	@echo "✅ Release artifacts:"
	@echo "  Binary: target/release/timekeep ($(shell du -h target/release/timekeep | cut -f1))"
	@echo "  Docker: timekeep:latest"
	@echo ""
	@echo "Next steps:"
	@echo "  docker tag timekeep:latest ghcr.io/skanderphilipp/timekeep:v$$(grep version Cargo.toml | head -1 | cut -d'"' -f2)"
	@echo "  docker push ghcr.io/skanderphilipp/timekeep:v$$(grep version Cargo.toml | head -1 | cut -d'"' -f2)"

# ─── Database Seeding ───────────────────────────────────────────────

seed-db: ## Seed database with test fixture data
	@echo "📥 Applying seed to timekeep.db ..."
	sqlite3 timekeep.db < tests/fixtures/seed-biotime.sql
	@echo "✅ Database seeded."

seed-db-reset: ## Reset database to empty, then re-seed
	@echo "🗑️  Resetting timekeep.db ..."
	rm -f timekeep.db timekeep.db-shm timekeep.db-wal
	@echo "📥 Applying seed ..."
	sqlite3 timekeep.db < tests/fixtures/seed-biotime.sql
	@echo "✅ Database seeded."
