import { describe, expect, it } from "vitest";

import bun from "./bun-rules.js";
import commonBun from "./common-bun-rules.js";
import commonEffect from "./common-effect-rules.js";
import effect from "./effect-rules.js";
import mdx from "./mdx-rules.js";
import packageRules from "./package-rules.js";
import site from "./site-rules.js";
import antiSlop from "./anti-slop/index.ts";
import antiSlopEffect from "./anti-slop/effect/index.ts";
import oxlintConfig from "../../oxlint.config.ts";

type Plugin = { readonly rules: object };

const plugins = [
  ["effect", effect],
  ["common-effect", commonEffect],
  ["bun", bun],
  ["common-bun", commonBun],
  ["site", site],
  ["mdx", mdx],
  ["package", packageRules],
  ["anti-slop", antiSlop],
  ["anti-slop-effect", antiSlopEffect],
] as const satisfies ReadonlyArray<readonly [string, Plugin]>;

const isEnabled = (setting: unknown): boolean =>
  setting !== "off" && (!Array.isArray(setting) || setting[0] !== "off");

const collectEnabledRuleIds = (value: unknown): ReadonlySet<string> => {
  const ruleIds = new Set<string>();
  const visited = new Set<object>();

  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current !== "object" || current === null) return;
    if (visited.has(current)) return;
    visited.add(current);

    const record = current as { readonly [key: string]: unknown };
    const rules = record.rules;
    if (typeof rules === "object" && rules !== null && !Array.isArray(rules)) {
      for (const [ruleId, setting] of Object.entries(rules)) {
        if (ruleId.includes("/") && isEnabled(setting)) ruleIds.add(ruleId);
      }
    }

    visit(record.extends);
    visit(record.overrides);
  };

  visit(value);
  return ruleIds;
};

describe("Oxlint rule source coverage", () => {
  const enabledRuleIds = collectEnabledRuleIds(oxlintConfig);

  it.each(plugins)("enables every rule exported by %s", (pluginName, plugin) => {
    for (const ruleName of Object.keys(plugin.rules)) {
      expect(enabledRuleIds, `${pluginName}/${ruleName}`).toContain(`${pluginName}/${ruleName}`);
    }
  });
});
