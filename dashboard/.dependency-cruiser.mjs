/**
 * Architecture enforcement via dependency-cruiser.
 *
 * Layer rules (top-down, strictest first):
 *
 *   Layer              Can import from…
 *   ─────────────────  ──────────────────────────────────────────
 *   styles/            (no runtime code)
 *   types/             types/, external packages
 *   lib/               lib/, types/, external packages
 *   hooks/             hooks/, lib/, types/, external packages
 *   components/ui/     components/ui/, hooks/, lib/, types/,
 *                      infrastructure/state/, external packages
 *   infrastructure/    infrastructure/, components/ui/, hooks/,
 *                      lib/, types/, external packages
 *   modules/<name>/    same module, components/ui/, infrastructure/,
 *                      hooks/, lib/, types/, external packages
 *   testing/           (anything — test utilities are dev-only)
 *
 *   App root (App.tsx, main.tsx, app-shell.tsx) can import from anywhere.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    /* ------------------------------------------------------------------ */
    /*  1. components/ui/ MUST NOT depend on modules/                     */
    /* ------------------------------------------------------------------ */
    {
      name: "ui-no-module-deps",
      severity: "error",
      comment:
        "UI components are foundational. They must not depend on feature modules.",
      from: { path: "src/components/ui" },
      to: { path: "src/modules" },
    },

    /* ------------------------------------------------------------------ */
    /*  2. Features MUST NOT import from other feature modules            */
    /* ------------------------------------------------------------------ */
    {
      name: "no-cross-module-imports",
      severity: "error",
      comment:
        "Feature modules must be self-contained. Use shared infrastructure, hooks, or lib instead.",
      from: { path: "src/modules/([^/]+)" },
      to: { path: "src/modules/$1", pathNot: "^src/modules/$1" },
    },

    /* ------------------------------------------------------------------ */
    /*  3. lib/ MUST NOT depend on modules/, components/, infrastructure/ */
    /* ------------------------------------------------------------------ */
    {
      name: "lib-no-feature-deps",
      severity: "error",
      comment:
        "lib/ is a pure utility layer. It must not depend on UI, features, or infrastructure.",
      from: { path: "src/lib" },
      to: { path: "src/modules" },
    },
    {
      name: "lib-no-ui-deps",
      severity: "error",
      comment:
        "lib/ must not depend on UI components. Extract shared logic into hooks/ instead.",
      from: { path: "src/lib" },
      to: { path: "src/components" },
    },
    {
      name: "lib-no-infra-deps",
      severity: "error",
      comment:
        "lib/ must not depend on infrastructure. Infrastructure depends on lib, not the reverse.",
      from: { path: "src/lib" },
      to: { path: "src/infrastructure" },
    },

    /* ------------------------------------------------------------------ */
    /*  4. infrastructure/ MUST NOT depend on modules/                    */
    /* ------------------------------------------------------------------ */
    {
      name: "infra-no-module-deps",
      severity: "error",
      comment:
        "Infrastructure is cross-cutting. It must not depend on feature modules.",
      from: { path: "src/infrastructure" },
      to: { path: "src/modules" },
    },

    /* ------------------------------------------------------------------ */
    /*  5. types/ MUST NOT depend on runtime code                         */
    /* ------------------------------------------------------------------ */
    {
      name: "types-no-runtime-deps",
      severity: "error",
      comment:
        "types/ must only contain type definitions. No runtime imports from other layers.",
      from: { path: "src/types" },
      to: { path: "src/(components|modules|infrastructure|lib|hooks|testing)" },
    },

    /* ------------------------------------------------------------------ */
    /*  6. hooks/ MUST NOT depend on modules/ or components/ui/           */
    /* ------------------------------------------------------------------ */
    {
      name: "hooks-no-module-deps",
      severity: "error",
      comment:
        "Shared hooks must not depend on feature modules. They are a bridge layer.",
      from: { path: "src/hooks" },
      to: { path: "src/modules" },
    },

    /* ------------------------------------------------------------------ */
    /*  7. No circular dependencies through barrel files                  */
    /* ------------------------------------------------------------------ */
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependencies cause hard-to-debug initialization order issues.",
      from: {},
      to: { circular: true },
    },
  ],

  options: {
    doNotFollow: {
      path: ["node_modules", "dist", "packages", "generated"],
    },

    tsPreCompilationDeps: true,

    tsConfig: {
      fileName: "tsconfig.json",
    },

    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".d.ts"],
    },

    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
      },
      archi: {
        collapsePattern:
          "^(?:src/[^/]+/[^/]+/)",
      },
    },
  },
};
