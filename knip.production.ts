import type { KnipConfig } from "knip";
export default {
  workspaces: {
    ".": {
      entry: ["alchemy.run.ts", "vitest.tools.config.ts"],
      ignore: ["knip.ts", "tools/**"],
      ignoreDependencies: ["@trivia-night/web", "alchemy", "effect"],
    },
    "apps/*": {
      entry: ["src/routeTree.gen.ts", "vite*.config.ts"],
      ignoreIssues: {
        "src/routes/**/*.{ts,tsx}": ["exports"],
        "src/lib/runtime.server.ts": ["exports"],
      },
    },
    "packages/domain": {
      entry: ["src/schemas.ts", "src/errors.ts", "src/service.ts", "src/live.layer.ts"],
    },
    "packages/rpc": {
      entry: ["src/group.ts", "src/service.ts", "src/server.ts", "src/live.layer.ts"],
    },
    "packages/http-api": {
      entry: [
        "src/api.ts",
        "src/group.ts",
        "src/server.ts",
        "src/client/service.ts",
        "src/client/browser.layer.ts",
        "src/client/in-process.layer.ts",
      ],
    },
    "packages/effect-start": { entry: ["src/loader.ts"] },
  },
} satisfies KnipConfig;
