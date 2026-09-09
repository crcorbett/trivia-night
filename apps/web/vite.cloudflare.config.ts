import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { defineConfig, mergeConfig } from "vite";

import appConfig from "./vite.config.ts";

export default defineConfig(
  mergeConfig(appConfig, {
    plugins: [
      cloudflare({
        compatibilityDate: "2026-06-24",
        compatibilityFlags: ["nodejs_compat"],
      }),
    ],
  }),
);
