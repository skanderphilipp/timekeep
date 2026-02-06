/**
 * Commitlint configuration — Conventional Commits enforcement.
 *
 * Supported types (standard + custom):
 *   build | chore | ci | docs | feat | fix | perf |
 *   refactor | revert | style | test | deps | dx
 *
 * Format: type(scope?): description
 *
 * Examples:
 *   feat(auth): add JWT refresh interceptor
 *   fix(chart): handle empty data gracefully
 *   chore(deps): bump ky to 2.0
 *   dx(lint): add no-raw-html-elements oxlint rule
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",    // Build system or external dependencies
        "chore",    // Miscellaneous tasks (not src or test changes)
        "ci",       // CI/CD configuration
        "docs",     // Documentation only
        "feat",     // New feature
        "fix",      // Bug fix
        "perf",     // Performance improvement
        "refactor", // Code change that neither fixes a bug nor adds a feature
        "revert",   // Revert a previous commit
        "style",    // Code style changes (formatting, etc.)
        "test",     // Adding or correcting tests
        "deps",     // Dependency updates
        "dx",       // Developer experience (tooling, lint rules, config)
      ],
    ],
    "subject-case": [0], // Allow any case (PascalCase component names, etc.)
  },
};
