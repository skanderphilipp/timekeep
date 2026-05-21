declare module "rtl-detect" {
  export function getLangDir(locale: string): "ltr" | "rtl";
  export function isRtlLang(locale: string): boolean;
}
