import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { appendUrlPath, decodePathSegments, decodeUrl, toWebSocketUrl } from "./url";

describe("URL boundaries", () => {
  it("uses schemas for URL and path segment decoding", () => {
    const url = decodeUrl("https://example.test/rooms/DEMO/?view=display");
    expect(Option.isSome(url)).toBeTruthy();
    if (Option.isNone(url)) return;

    const segments = decodePathSegments(url.value.pathname);
    expect(Option.isSome(segments)).toBeTruthy();
    if (Option.isNone(segments)) return;
    expect(segments.value).toStrictEqual(["rooms", "DEMO"]);
  });

  it("appends paths and converts HTTP URLs to WebSocket URLs", () => {
    const url = decodeUrl("https://example.test/base");
    expect(Option.isSome(url)).toBeTruthy();
    if (Option.isNone(url)) return;

    const appended = appendUrlPath(url.value, ["rooms", "DEMO", "ws"]);
    expect(Option.isSome(appended)).toBeTruthy();
    if (Option.isNone(appended)) return;
    expect(appended.value.pathname).toBe("/base/rooms/DEMO/ws");

    const websocket = toWebSocketUrl(appended.value);
    expect(Option.isSome(websocket)).toBeTruthy();
    if (Option.isNone(websocket)) return;
    expect(websocket.value.protocol).toBe("wss:");
  });

  it("rejects relative URLs at the URL boundary", () => {
    expect(Option.isNone(decodeUrl("/rooms/DEMO"))).toBeTruthy();
  });
});
