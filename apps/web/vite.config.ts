import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { conditions: ["@trivia-night/source"], tsconfigPaths: true },
  plugins: [tanstackStart({ srcDirectory: "src" }), viteReact()],
});
