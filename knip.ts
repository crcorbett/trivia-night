import type { KnipConfig } from "knip";
export default {
  workspaces: {
    ".": { entry: ["alchemy.run.ts", "knip.production.ts", "vitest.tools.config.ts"] },
    "apps/*": {
      entry: ["src/routeTree.gen.ts", "vite*.config.ts"],
      ignoreIssues: {
        "src/routes/**/*.{ts,tsx}": ["exports"],
        "src/lib/runtime.server.ts": ["exports"],
      },
    },
    "packages/*": { entry: ["src/**/*.ts"] },
  },
} satisfies KnipConfig;
