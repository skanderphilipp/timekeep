import type { LinguiConfig } from "@lingui/conf";
import { LOCALE_CONFIG } from "./src/infrastructure/locale/locale";

const config: LinguiConfig = {
  sourceLocale: LOCALE_CONFIG[0].code,
  locales: LOCALE_CONFIG.map((c) => c.code),
  fallbackLocales: {
    default: LOCALE_CONFIG[0].code,
  },
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}",
      include: ["src"],
    },
  ],
  format: "po",
  compileNamespace: "ts",
};

export default config;
