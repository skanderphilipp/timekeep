import { definePlugin } from "@oxlint/plugins";

import {
  rule as componentPropsNaming,
  RULE_NAME as componentPropsNamingName,
} from "./rules/component-props-naming";
import {
  rule as effectComponents,
  RULE_NAME as effectComponentsName,
} from "./rules/effect-components";
import {
  rule as enforceModuleBoundaries,
  RULE_NAME as enforceModuleBoundariesName,
} from "./rules/enforce-module-boundaries";
import {
  rule as enforceScssModules,
  RULE_NAME as enforceScssModulesName,
} from "./rules/enforce-scss-modules";
import {
  rule as folderStructure,
  RULE_NAME as folderStructureName,
} from "./rules/folder-structure";
import {
  rule as jotaiNamingConvention,
  RULE_NAME as jotaiNamingConventionName,
} from "./rules/jotai-naming-convention";
import {
  rule as jotaiNoRawAtom,
  RULE_NAME as jotaiNoRawAtomName,
} from "./rules/jotai-no-raw-atom";
import {
  rule as jotaiStateLocation,
  RULE_NAME as jotaiStateLocationName,
} from "./rules/jotai-state-location";
import {
  rule as matchingStateVariable,
  RULE_NAME as matchingStateVariableName,
} from "./rules/matching-state-variable";
import {
  rule as maxConstsPerFile,
  RULE_NAME as maxConstsPerFileName,
} from "./rules/max-consts-per-file";
import { rule as noBareConsole, RULE_NAME as noBareConsoleName } from "./rules/no-bare-console";
import {
  rule as noRawHtmlElements,
  RULE_NAME as noRawHtmlElementsName,
} from "./rules/no-raw-html-elements";
import { rule as noLogicInPages, RULE_NAME as noLogicInPagesName } from "./rules/no-logic-in-pages";
import {
  rule as noCrossModuleImports,
  RULE_NAME as noCrossModuleImportsName,
} from "./rules/no-cross-module-imports";
import {
  rule as noHardcodedColors,
  RULE_NAME as noHardcodedColorsName,
} from "./rules/no-hardcoded-colors";
import {
  rule as noNavigatePreferLink,
  RULE_NAME as noNavigatePreferLinkName,
} from "./rules/no-navigate-prefer-link";
import {
  rule as noPrimitiveDuplication,
  RULE_NAME as noPrimitiveDuplicationName,
} from "./rules/no-primitive-duplication";
import { rule as noStateUseref, RULE_NAME as noStateUserefName } from "./rules/no-state-useref";
import {
  rule as noStorybookA11yDisable,
  RULE_NAME as noStorybookA11yDisableName,
} from "./rules/no-storybook-a11y-disable";
import {
  rule as sortCssPropertiesAlphabetically,
  RULE_NAME as sortCssPropertiesAlphabeticallyName,
} from "./rules/sort-css-properties-alphabetically";
import {
  rule as noDeepUiImports,
  RULE_NAME as noDeepUiImportsName,
} from "./rules/no-deep-ui-imports";
import {
  rule as requireStoryLevelTag,
  RULE_NAME as requireStoryLevelTagName,
} from "./rules/require-story-level-tag";
import {
  rule as maxLinesPerFile,
  RULE_NAME as maxLinesPerFileRuleName,
} from "./rules/max-lines-per-file";
import {
  rule as requireDataListView,
  RULE_NAME as requireDataListViewName,
} from "./rules/require-data-list-view";
import {
  rule as noDomainTypesInDataRenderer,
  RULE_NAME as noDomainTypesInDataRendererName,
} from "./rules/no-domain-types-in-data-renderer";
import {
  rule as noSchemaTypeRedeclaration,
  RULE_NAME as noSchemaTypeRedeclarationName,
} from "./rules/no-schema-type-redeclaration";
import {
  rule as requireDataSlot,
  RULE_NAME as requireDataSlotName,
} from "./rules/require-data-slot";

export default definePlugin({
  meta: { name: "bentech" },
  rules: {
    [componentPropsNamingName]: componentPropsNaming,
    [effectComponentsName]: effectComponents,
    [enforceModuleBoundariesName]: enforceModuleBoundaries,
    [enforceScssModulesName]: enforceScssModules,
    [folderStructureName]: folderStructure,
    [jotaiNamingConventionName]: jotaiNamingConvention,
    [jotaiNoRawAtomName]: jotaiNoRawAtom,
    [jotaiStateLocationName]: jotaiStateLocation,
    [matchingStateVariableName]: matchingStateVariable,
    [maxConstsPerFileName]: maxConstsPerFile,
    [noHardcodedColorsName]: noHardcodedColors,
    [noCrossModuleImportsName]: noCrossModuleImports,
    [noNavigatePreferLinkName]: noNavigatePreferLink,
    [noPrimitiveDuplicationName]: noPrimitiveDuplication,
    [noStateUserefName]: noStateUseref,
    [noStorybookA11yDisableName]: noStorybookA11yDisable,
    [sortCssPropertiesAlphabeticallyName]: sortCssPropertiesAlphabetically,
    [noBareConsoleName]: noBareConsole,
    [noRawHtmlElementsName]: noRawHtmlElements,
    [noLogicInPagesName]: noLogicInPages,
    [noDeepUiImportsName]: noDeepUiImports,
    [requireStoryLevelTagName]: requireStoryLevelTag,
    [maxLinesPerFileRuleName]: maxLinesPerFile,
    [requireDataListViewName]: requireDataListView,
    [noDomainTypesInDataRendererName]: noDomainTypesInDataRenderer,
    [noSchemaTypeRedeclarationName]: noSchemaTypeRedeclaration,
    [requireDataSlotName]: requireDataSlot,
  },
});
