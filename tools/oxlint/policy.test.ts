import { describe, expect, test } from "bun:test";
import {
  forbiddenRuntimePattern,
  genericClientPattern,
  isRelativeWorkspaceImport,
  primitiveSemanticConfigPattern,
  rawSemanticIdPattern,
  runtimeClassPolicyPattern,
  sourceConditionFirst,
  uncheckedClientOutputPattern,
} from "./policy";

describe("repository policy", () => {
  test("workspace/source-condition-order", () => {
    expect(
      sourceConditionFirst(
        { ["@trivia-night/source"]: "src", types: "d.ts", default: "js" },
        "@trivia-night/source",
      ),
    ).toBe(true);
    expect(
      sourceConditionFirst(
        { types: "d.ts", ["@trivia-night/source"]: "src", default: "js" },
        "@trivia-night/source",
      ),
    ).toBe(false);
  });
  test("workspace/rejects-relative-cross-workspace-imports", () => {
    expect(
      isRelativeWorkspaceImport("/repo/tools/readback.ts", "../packages/domain/src/schemas"),
    ).toBe(true);
    expect(
      isRelativeWorkspaceImport("/repo/packages/domain/src/service.ts", "../../rpc/src/service"),
    ).toBe(true);
    expect(
      isRelativeWorkspaceImport(
        "/repo/apps/web/src/lib/runtime.ts",
        "../../../../packages/domain/src/service",
      ),
    ).toBe(true);
  });
  test("workspace/allows-owned-relative-imports-and-package-exports", () => {
    expect(isRelativeWorkspaceImport("/repo/packages/domain/src/live.layer.ts", "./service")).toBe(
      false,
    );
    expect(
      isRelativeWorkspaceImport("/repo/apps/web/src/runtime.ts", "@trivia-night/domain/service"),
    ).toBe(false);
  });
  test("effect/no-runtime-outside-boundary", () =>
    expect(forbiddenRuntimePattern.test("Effect.runPromise(program)")).toBe(true));
  test("effect/no-generic-client-escape", () =>
    expect(genericClientPattern.test("readonly use: <A>() => A")).toBe(true));
  test("effect/provider-boundary-negative-fixtures", () => {
    expect(rawSemanticIdPattern.test("readonly id: string")).toBe(true);
    expect(primitiveSemanticConfigPattern.test('Config.string("API_KEY")')).toBe(true);
    expect(runtimeClassPolicyPattern.test("error instanceof ProviderError")).toBe(true);
    expect(uncheckedClientOutputPattern.test("Effect.Effect<A>")).toBe(true);
  });
  test("effect/scans-maintained-source", async () => {
    const root = new URL("../../", import.meta.url).pathname;
    const files = Array.from(
      new Bun.Glob("{apps,packages}/*/src/**/*.{ts,tsx}").scanSync({
        cwd: root,
        onlyFiles: true,
      }),
    );
    for (const file of files) {
      const source = await Bun.file(new URL(file, "file://" + root)).text();
      expect(source, file).not.toMatch(forbiddenRuntimePattern);
      expect(source, file).not.toMatch(genericClientPattern);
      expect(source, file).not.toMatch(rawSemanticIdPattern);
      expect(source, file).not.toMatch(primitiveSemanticConfigPattern);
      expect(source, file).not.toMatch(runtimeClassPolicyPattern);
      expect(source, file).not.toMatch(uncheckedClientOutputPattern);
    }
  });
});
