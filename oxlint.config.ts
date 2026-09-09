import { recommended as effectTsgoRecommended } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

import bun from "./tools/oxlint/bun-rules.js";
import commonBun from "./tools/oxlint/common-bun-rules.js";
import commonEffect from "./tools/oxlint/common-effect-rules.js";
import effect from "./tools/oxlint/effect-rules.js";
import mdx from "./tools/oxlint/mdx-rules.js";
import packageRules from "./tools/oxlint/package-rules.js";
import site from "./tools/oxlint/site-rules.js";

const enablePluginRules = (pluginName: string, plugin: { readonly rules: object }) =>
  Object.fromEntries(
    Object.keys(plugin.rules).map((ruleName) => [`${pluginName}/${ruleName}`, "error"]),
  );

const effectRules = enablePluginRules("effect", effect);
const commonEffectRules = enablePluginRules("common-effect", commonEffect);
const bunRules = enablePluginRules("bun", bun);
const commonBunRules = enablePluginRules("common-bun", commonBun);
const packageBoundaryRules = enablePluginRules("package", packageRules);
const siteRules = enablePluginRules("site", site);
const mdxRules = enablePluginRules("mdx", mdx);

const siteReact = {
  ...react,
  rules: {
    ...react.rules,
    // Effect Match and Option callbacks return JSX inline but do not define
    // stateful React components. Keep the rule for actual nested components.
    "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
  },
};

const siteVitest = {
  ...vitest,
  rules: {
    ...vitest.rules,
    "vitest/prefer-describe-function-title": "off",
  },
  overrides: vitest.overrides?.map((override) => ({
    ...override,
    rules: {
      ...override.rules,
      // Contract tests can need more than five assertions to cover one
      // lifecycle without splitting the useful behaviour across test cases.
      "vitest/max-expects": ["error", { max: 20 }],
      "vitest/prefer-describe-function-title": "off",
    },
  })),
};

const effectOwnedFiles = [
  "packages/domain/src/**/*.ts",
  "packages/effect-start/src/**/*.ts",
  "packages/http-api/src/**/*.ts",
  "packages/rpc/src/**/*.ts",
  "alchemy*.ts",
];

const sourceFiles = [
  "apps/**/*.ts",
  "apps/**/*.tsx",
  "packages/**/*.ts",
  "packages/**/*.tsx",
  "alchemy*.ts",
  "*.config.ts",
];

export default defineConfig({
  extends: [core, siteReact, siteVitest, effectTsgoRecommended],
  ignorePatterns: [
    ".context/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".cursor/**",
    "**/.git/**",
    "**/dist/**",
    "**/.output/**",
    "**/routeTree.gen.ts",
    "tools/oxlint/**",
  ],
  jsPlugins: [
    "./tools/oxlint/effect-rules.js",
    {
      name: "common-effect",
      specifier: "./tools/oxlint/common-effect-rules.js",
    },
    "./tools/oxlint/bun-rules.js",
    {
      name: "common-bun",
      specifier: "./tools/oxlint/common-bun-rules.js",
    },
    "./tools/oxlint/site-rules.js",
    "./tools/oxlint/mdx-rules.js",
    "./tools/oxlint/package-rules.js",
    {
      name: "anti-slop",
      specifier: "./tools/oxlint/anti-slop/index.ts",
    },
    {
      name: "anti-slop-effect",
      specifier: "./tools/oxlint/anti-slop/effect/index.ts",
    },
    {
      name: "repository",
      specifier: "./tools/oxlint/policy.ts",
    },
  ],
  rules: {
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "anti-slop-effect/no-service-constructor-imports": "error",
    "no-console": "error",
    "no-debugger": "error",
    "repository/no-relative-workspace-imports": "error",
    // Keep the repository's existing callback and object-literal style while
    // the specialised Effect and anti-slop rules enforce correctness.
    "eslint/curly": "off",
    "eslint/func-names": "off",
    "eslint/func-style": "off",
    "eslint/max-classes-per-file": "off",
    "eslint/no-nested-ternary": "off",
    "eslint/no-shadow": "off",
    "eslint/no-duplicate-imports": "off",
    "eslint/no-use-before-define": "off",
    "eslint/prefer-destructuring": "off",
    "eslint/sort-keys": "off",
    "import/newline-after-import": "off",
    "import/no-duplicates": "off",
    "promise/prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",
    "react/function-component-definition": "off",
    "react/no-unescaped-entities": "off",
    "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    "typescript/no-non-null-assertion": "error",
    "typescript/no-unsafe-argument": "off",
    "typescript/no-unsafe-assignment": "off",
    "typescript/no-unsafe-call": "off",
    "typescript/no-unsafe-member-access": "off",
    "typescript/no-unsafe-return": "off",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/no-confusing-void-expression": "off",
    "typescript/consistent-return": "off",
    "typescript/promise-function-async": "off",
    "typescript/strict-boolean-expressions": "off",
    "unicorn/no-array-sort": "off",
    "unicorn/no-nested-ternary": "off",
    "unicorn/switch-case-braces": "off",
    "unicorn/throw-new-error": "off",
    "vitest/prefer-describe-function-title": "off",
  },
  overrides: [
    {
      files: ["**/*.{ts,tsx,mts,cts}"],
      rules: {
        "no-redeclare": "off",
      },
    },
    {
      files: ["tools/**/*.ts", "**/*.config.ts"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: sourceFiles,
      rules: {
        ...bunRules,
        ...commonBunRules,
        ...packageBoundaryRules,
        "site/no-context-nullish-default": siteRules["site/no-context-nullish-default"],
        "site/no-relative-workspace-imports": siteRules["site/no-relative-workspace-imports"],
        "site/no-unsafe-type-token-line-height": siteRules["site/no-unsafe-type-token-line-height"],
        "site/no-unscoped-tanstack-server-functions":
          siteRules["site/no-unscoped-tanstack-server-functions"],
      },
    },
    {
      files: effectOwnedFiles,
      rules: {
        ...effectRules,
        ...commonEffectRules,
      },
    },
    {
      files: ["apps/web/src/routes/**/*.{ts,tsx}"],
      rules: {
        ...mdxRules,
        "site/no-design-page-wrapper": siteRules["site/no-design-page-wrapper"],
        "site/no-manual-json-ld-script": siteRules["site/no-manual-json-ld-script"],
        "site/no-route-local-markdown-negotiation":
          siteRules["site/no-route-local-markdown-negotiation"],
        "site/no-route-local-seo": siteRules["site/no-route-local-seo"],
        "site/no-route-local-typography-utilities":
          siteRules["site/no-route-local-typography-utilities"],
        "site/no-space-axis-utilities": siteRules["site/no-space-axis-utilities"],
      },
    },
    {
      files: ["apps/web/src/**/*.{ts,tsx}"],
      rules: {
        "site/no-component-local-typography-utilities":
          siteRules["site/no-component-local-typography-utilities"],
        "site/no-module-owned-public-asset-url": siteRules["site/no-module-owned-public-asset-url"],
        "site/no-unsafe-type-token-line-height": siteRules["site/no-unsafe-type-token-line-height"],
      },
    },
    {
      files: ["apps/web/src/lib/seo-aeo/**/*.{ts,tsx}"],
      rules: {
        "site/no-web-http-globals-in-seo-aeo": siteRules["site/no-web-http-globals-in-seo-aeo"],
      },
    },
    {
      files: ["packages/**/src/**/*.{ts,tsx}"],
      rules: {
        "site/no-component-local-typography-utilities":
          siteRules["site/no-component-local-typography-utilities"],
      },
    },
    {
      files: ["**/*.test.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
      rules: {
        "effect/no-ambient-time-or-random": "off",
        "effect/no-effect-test-global-mix": "error",
        "effect/no-module-level-mutable-test-state": "error",
        "effect/no-native-array-methods": "off",
        "effect/no-nested-wrapper-calls": "off",
        "effect/no-runtime-execution-outside-boundaries": "off",
        "effect/no-schema-decoder-outside-ingress": "off",
        "effect/no-schema-encoder-outside-egress": "off",
        "effect/no-throwing-schema-sync-codec": "off",
        "effect/no-non-throwing-schema-sync-decoder-outside-consumer": "off",
        "site/no-component-local-typography-utilities": "off",
        "site/no-route-local-typography-utilities": "off",
        "site/no-unsafe-type-token-line-height": "off",
        "vitest/prefer-describe-function-title": "off",
      },
    },
    {
      files: ["packages/domain/src/**/*.ts"],
      rules: {
        // The domain keeps readonly data collections as ordinary arrays. The
        // Effect Array rule remains active for transport and service packages.
        "effect/no-native-array-methods": "off",
      },
    },
    {
      files: ["packages/domain/src/room.ts"],
      rules: {
        // This is a pure tagged-union reducer. Its switch is exhaustive over
        // a domain value and does not run Effect control flow.
        "effect/no-switch": "off",
      },
    },
    {
      files: ["packages/effect-start/src/loader.ts"],
      rules: {
        // This helper is itself the serialisation boundary for TanStack
        // loaders, so its schema codec is deliberately an ingress/egress.
        "effect/no-schema-decoder-outside-ingress": "off",
        "effect/no-schema-encoder-outside-egress": "off",
        "effect/no-non-throwing-schema-sync-decoder-outside-consumer": "off",
      },
    },
    {
      files: ["packages/http-api/src/client/in-process.layer.ts"],
      rules: {
        // FetchHttpClient's adapter contract is a Web Promise boundary owned by
        // this file; application and service code remains Effect-based.
        "common-effect/no-async-await-promise": "off",
      },
    },
    {
      files: ["apps/web/src/lib/runtime.server.ts"],
      rules: {
        // The server runtime and Web handlers are process-owned application
        // boundaries, created once and disposed by the host lifecycle.
        "effect/no-unscoped-managed-runtime": "off",
        "effect/no-unscoped-web-handler": "off",
      },
    },
    {
      files: ["apps/web/src/room-worker.ts"],
      rules: {
        // Durable Object request and storage payloads are explicit Cloudflare
        // ingress/egress boundaries, where JSON is decoded immediately into
        // Effect Schemas.
        "common-effect/no-unchecked-json": "off",
        "effect/no-json-parse-stringify": "off",
        "effect/no-schema-decoder-outside-ingress": "off",
        "effect/no-schema-encoder-outside-egress": "off",
        "effect/no-non-throwing-schema-sync-decoder-outside-consumer": "off",
        "effect/no-typeof": "off",
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
        "eslint/class-methods-use-this": "off",
        "eslint/no-empty-function": "off",
        "eslint/require-await": "off",
        "typescript/no-misused-spread": "off",
        "typescript/return-await": "off",
      },
    },
    {
      files: ["apps/web/src/lib/room.ts"],
      rules: {
        // This browser adapter owns WebSocket, localStorage, JSON and fetch
        // conversion; the domain package receives only decoded values.
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
      },
    },
  ],
});
