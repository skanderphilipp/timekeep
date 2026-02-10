import { definePlugin } from '@oxlint/plugins';

import {
  rule as componentPropsNaming,
  RULE_NAME as componentPropsNamingName,
} from './rules/component-props-naming';
import {
  rule as effectComponents,
  RULE_NAME as effectComponentsName,
} from './rules/effect-components';
import {
  rule as enforceModuleBoundaries,
  RULE_NAME as enforceModuleBoundariesName,
} from './rules/enforce-module-boundaries';
import {
  rule as enforceScssModules,
  RULE_NAME as enforceScssModulesName,
} from './rules/enforce-scss-modules';
import {
  rule as folderStructure,
  RULE_NAME as folderStructureName,
} from './rules/folder-structure';
import {
  rule as matchingStateVariable,
  RULE_NAME as matchingStateVariableName,
} from './rules/matching-state-variable';
import {
  rule as maxConstsPerFile,
  RULE_NAME as maxConstsPerFileName,
} from './rules/max-consts-per-file';
import {
  rule as noBareConsole,
  RULE_NAME as noBareConsoleName,
} from './rules/no-bare-console';
import {
  rule as noRawHtmlElements,
  RULE_NAME as noRawHtmlElementsName,
} from './rules/no-raw-html-elements';
import {
  rule as noLogicInPages,
  RULE_NAME as noLogicInPagesName,
} from './rules/no-logic-in-pages';
import {
  rule as noHardcodedColors,
  RULE_NAME as noHardcodedColorsName,
} from './rules/no-hardcoded-colors';
import {
  rule as noNavigatePreferLink,
  RULE_NAME as noNavigatePreferLinkName,
} from './rules/no-navigate-prefer-link';
import {
  rule as noPrimitiveDuplication,
  RULE_NAME as noPrimitiveDuplicationName,
} from './rules/no-primitive-duplication';
import {
  rule as noStateUseref,
  RULE_NAME as noStateUserefName,
} from './rules/no-state-useref';
import {
  rule as noStorybookA11yDisable,
  RULE_NAME as noStorybookA11yDisableName,
} from './rules/no-storybook-a11y-disable';
import {
  rule as sortCssPropertiesAlphabetically,
  RULE_NAME as sortCssPropertiesAlphabeticallyName,
} from './rules/sort-css-properties-alphabetically';

export default definePlugin({
  meta: { name: 'bentech' },
  rules: {
    [componentPropsNamingName]: componentPropsNaming,
    [effectComponentsName]: effectComponents,
    [enforceModuleBoundariesName]: enforceModuleBoundaries,
    [enforceScssModulesName]: enforceScssModules,
    [folderStructureName]: folderStructure,
    [matchingStateVariableName]: matchingStateVariable,
    [maxConstsPerFileName]: maxConstsPerFile,
    [noHardcodedColorsName]: noHardcodedColors,
    [noNavigatePreferLinkName]: noNavigatePreferLink,
    [noPrimitiveDuplicationName]: noPrimitiveDuplication,
    [noStateUserefName]: noStateUseref,
    [noStorybookA11yDisableName]: noStorybookA11yDisable,
    [sortCssPropertiesAlphabeticallyName]: sortCssPropertiesAlphabetically,
    [noBareConsoleName]: noBareConsole,
    [noRawHtmlElementsName]: noRawHtmlElements,
    [noLogicInPagesName]: noLogicInPages,
  },
});
