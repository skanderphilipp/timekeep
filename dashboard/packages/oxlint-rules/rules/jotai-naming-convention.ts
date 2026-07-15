import { defineRule } from "@oxlint/plugins";

export const RULE_NAME = "jotai-naming-convention";

/**
 * Enforces Jotai state naming conventions in `states/` directories.
 *
 * All exported Jotai atoms must follow:
 * - Writable: `{descriptor}State`   → `themeState`, `authTokenState`
 * - Selector:  `{descriptor}Selector` → `isAuthenticatedSelector`
 * - Family:    `{descriptor}FamilyState` → `tableSortFamilyState`
 * - Family sel:`{descriptor}FamilySelector` → `metadataStatusFamilySelector`
 *
 * Write-only action atoms are exempt (they end in `Atom` for clarity):
 *   `logoutAtom`, `toggleThemeAtom`, `openCreateUserFormAtom`, etc.
 */

// ── Patterns ────────────────────────────────────────────────────────────

const VALID_STATE_PATTERN = /^[a-z][a-zA-Z0-9]*State$/;
const VALID_SELECTOR_PATTERN = /^[a-z][a-zA-Z0-9]*Selector$/;
const VALID_FAMILY_STATE_PATTERN = /^[a-z][a-zA-Z0-9]*FamilyState$/;
const VALID_FAMILY_SELECTOR_PATTERN = /^[a-z][a-zA-Z0-9]*FamilySelector$/;

/** Exempt names: write-only action atoms and utility exports. */
const EXEMPT_NAMES = new Set([
  // Infrastructure action atoms
  "logoutAtom",
  "toggleThemeAtom",
  // Side panel
  "sidePanelOpenAtom",
  "sidePanelTitleAtom",
  "sidePanelContentAtom",
  "openSidePanelAtom",
  "closeSidePanelAtom",
  // Users CRUD
  "openCreateUserFormAtom",
  "openEditUserFormAtom",
  "closeUserFormAtom",
  "openDeleteUserDialogAtom",
  "closeDeleteUserDialogAtom",
  "openPasswordChangeDialogAtom",
  "closePasswordChangeDialogAtom",
  // Breadcrumb
  "pageBreadcrumbLabelAtom",
  // Sidebar (transient mobile overlay)
  "sidebarOpenAtom",
  // Filter utility
  "createFilterAtoms",
  // Row selection action atoms
  "toggleRowSelectionAtom",
  "selectAllRowsAtom",
  "deselectAllRowsAtom",
  // Non-atom exports
  "SIDE_PANEL_CONSTRAINTS",
  "SIDE_PANEL_WIDTH_VAR",
  "hasPermissionAtom",
]);

const isValidNaming = (name: string): boolean =>
  EXEMPT_NAMES.has(name) ||
  VALID_STATE_PATTERN.test(name) ||
  VALID_SELECTOR_PATTERN.test(name) ||
  VALID_FAMILY_STATE_PATTERN.test(name) ||
  VALID_FAMILY_SELECTOR_PATTERN.test(name);

const isStatesDirectory = (filepath: string): boolean =>
  filepath.includes("/states/");

const isTestFile = (filepath: string): boolean =>
  /\.(test|spec)\.tsx?$/.test(filepath) ||
  filepath.includes("/__tests__/");

const isAtomValue = (node: any): boolean => {
  // Check if the export declaration creates a Jotai atom
  const decl = node.declaration;
  if (!decl) return false;

  // Variable declaration: export const foo = createState(...)
  if (decl.type === "VariableDeclaration") {
    for (const d of decl.declarations ?? []) {
      const init = d.init;
      if (!init || init.type !== "CallExpression") continue;
      const callee = init.callee;
      if (!callee) continue;

      // Check for createState / createSelector / createFamilyState
      if (callee.type === "Identifier") {
        if (
          callee.name === "createState" ||
          callee.name === "createSelector" ||
          callee.name === "createFamilyState" ||
          callee.name === "createPersistentFamilyState" ||
          callee.name === "atom"
        ) {
          return true;
        }
      }
    }
  }
  return false;
};

export const rule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce Jotai state naming conventions: *State for writable atoms, *Selector for derived atoms, *FamilyState for families.",
    },
    messages: {
      invalidName:
        "Exported Jotai atom '{{ name }}' does not follow naming convention. " +
        "Writable atoms must end in State, derived atoms in Selector, " +
        "family atoms in FamilyState. Write-only action atoms (e.g., logoutAtom) " +
        "are exempt. See ADR-008 for full convention.",
    },
    schema: [],
  },
  create: (context) => {
    const filename = context.filename as string;

    // Only enforce in states/ directories
    if (!isStatesDirectory(filename)) return {};
    if (isTestFile(filename)) return {};

    return {
      ExportNamedDeclaration: (node: any) => {
        // Only check atom-creating exports
        if (!isAtomValue(node)) return;

        const decl = node.declaration;
        if (decl.type !== "VariableDeclaration") return;

        for (const d of decl.declarations ?? []) {
          const name = d.id?.name as string | undefined;
          if (!name) continue;

          if (!isValidNaming(name)) {
            context.report({
              node,
              messageId: "invalidName",
              data: { name },
            });
          }
        }
      },
    };
  },
});
