import { defineConfig } from "oxlint";
export default defineConfig({
  ignorePatterns: ["**/dist/**", "**/.output/**", "**/routeTree.gen.ts"],
  jsPlugins: [
    {
      name: "repository",
      specifier: "./tools/oxlint/policy.ts",
    },
  ],
  rules: {
    "no-console": "error",
    "no-debugger": "error",
    "repository/no-relative-workspace-imports": "error",
  },
  overrides: [{ files: ["tools/**/*.ts", "**/*.config.ts"], rules: { "no-console": "off" } }],
});
