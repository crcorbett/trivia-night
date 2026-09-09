import { defineConfig } from "oxfmt";
export default defineConfig({
  ignorePatterns: [
    "**/.agents/skills/**",
    "**/.claude/skills/**",
    "**/dist/**",
    "**/.output/**",
    "**/routeTree.gen.ts",
  ],
});
