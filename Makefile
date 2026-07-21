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
        clean release help seed-db seed-db-reset seed-dev seed-dev-reset \
        docs-screenshots docs-pdf docs

# ─── Default target ──────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-24s\033[0m %s\n", $$1, $$2}'

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

e2e: seed-e2e ## Run E2E tests against real Rust backend + seeded DB
	@echo "🧪 Running E2E tests (real backend)..."
	cd dashboard && pnpm test:e2e
	@echo "✅ E2E tests passed"

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

seed-db: ## Seed database with test fixture data (legacy — devices + users + all punches)
	@echo "📥 Applying seed to timekeep.db ..."
	sqlite3 timekeep.db < tests/fixtures/seed-biotime.sql
	@echo "✅ Database seeded."

seed-db-reset: ## Reset database to empty, then re-seed (legacy)
	@echo "🗑️  Resetting timekeep.db ..."
	rm -f timekeep.db timekeep.db-shm timekeep.db-wal
	@echo "📥 Applying seed ..."
	sqlite3 timekeep.db < tests/fixtures/seed-biotime.sql
	@echo "✅ Database seeded."

seed-dev: ## Seed database with comprehensive dev data (all tables v1–v12)
	@echo "📥 Applying dev seed to timekeep.db ..."
	sqlite3 timekeep.db < tests/fixtures/seed-dev.sql
	@echo "✅ Dev database seeded (admin / admin123)."

seed-dev-reset: ## Reset database to empty, then re-seed with dev data
	@echo "🗑️  Resetting timekeep.db ..."
	rm -f timekeep.db timekeep.db-shm timekeep.db-wal
	@echo "📥 Applying dev seed ..."
	sqlite3 timekeep.db < tests/fixtures/seed-dev.sql
	@echo "✅ Dev database seeded (admin / admin123)."

# ─── Documentation ─────────────────────────────────────────────────────

seed-e2e: ## Generate realistic E2E test database (120 employees, 8 devices, 2yr history)
	@echo "🌱 Generating realistic E2E database..."
	rm -f timekeep-e2e.db timekeep-e2e.db-shm timekeep-e2e.db-wal
	cargo run -p timekeep --bin seed --features seed -- \
		--employees 120 --devices 8 --days 730 \
		--today $$(date +%Y-%m-%d) \
		--admin-password admin123 \
		--operator-password operator123 \
		--viewer-password viewer123 \
		--output timekeep-e2e.db --force --seed 42
	@echo "✅ E2E database generated (timekeep-e2e.db)"
	@echo "   Admin login:    admin / admin123"
	@echo "   Operator login: operator / operator123"
	@echo "   Viewer login:   viewer / viewer123"

docs-screenshots: ## Capture screenshots with mocked API (fast, no backend needed)
	@echo "📸 Capturing documentation screenshots (mock mode)..."
	@echo "   Dashboard dev server must be running: cd dashboard && pnpm dev"
	cd dashboard && npx tsx docs-scripts/capture-flows.ts
	@echo "✅ Screenshots saved to docs/screenshots/"

docs-screenshots-real: seed-e2e ## Capture screenshots against real seeded backend (E2E quality)
	@echo "📸 Capturing screenshots against REAL backend..."
	@echo "   Database: 120 employees, 8 devices, 730 days of punches"
	@trap 'kill 0' EXIT; \
		cargo run -p timekeep -- --db timekeep-e2e.db & \
		sleep 4; \
		echo "Starting dashboard dev server (port 5173)..."; \
		cd dashboard && pnpm dev & \
		sleep 5; \
		echo ""; \
		cd dashboard && npx tsx docs-scripts/capture-flows.ts --real; \
		echo ""; \
		echo "✅ Real-backend screenshots saved to docs/screenshots/"

docs-pdf: ## Compile all Typst user guides to PDF
	@echo "📄 Compiling user guides to PDF..."
	@which typst > /dev/null || (echo "❌ typst not found. Install: brew install typst" && exit 1)
	@mkdir -p dist/docs
	typst compile --root . docs/guides/admin/01-device-setup.typ dist/docs/admin-01-device-setup.pdf
	typst compile --root . docs/guides/hr/01-daily-attendance.typ dist/docs/hr-01-daily-attendance.pdf
	typst compile --root . docs/guides/supervisor/01-team-overview.typ dist/docs/supervisor-01-team-overview.pdf
	@echo "✅ PDFs saved to dist/docs/"

docs: docs-screenshots-real docs-pdf ## Full docs pipeline: real backend screenshots + compile PDFs
