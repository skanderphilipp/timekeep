export default {
  "*.{ts,tsx,mts,cts}": ["oxfmt", "oxlint", () => "depcruise src --config .dependency-cruiser.mjs"],
  "*.{json,css,md}": ["oxfmt"],
  "*.scss": ["oxfmt"],
};
