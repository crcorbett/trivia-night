import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  TriviaRoomActionError,
  TriviaRoomStateError,
  TriviaRoomUnavailableError,
} from "@trivia-night/domain/errors";

import { describeRemoteError, RemoteRoomError } from "./room-errors";

describe("room error messages", () => {
  it("decodes tagged action errors into user messages", () => {
    expect(describeRemoteError(new TriviaRoomActionError({ reason: "duplicate-team-name" }))).toBe(
      "That team name is already taken.",
    );
    expect(describeRemoteError(new TriviaRoomActionError({ reason: "room-not-in-lobby" }))).toBe(
      "The room is already under way.",
    );
    expect(describeRemoteError(new TriviaRoomActionError({ reason: "room-finished" }))).toBe(
      "The game has finished.",
    );
  });

  it("keeps availability and state errors separate from action errors", () => {
    expect(describeRemoteError(new TriviaRoomUnavailableError({ reason: "rpc-client" }))).toBe(
      "The room could not be reached.",
    );
    expect(describeRemoteError(new TriviaRoomStateError({ reason: "invalid-state" }))).toBe(
      "The room could not be reached.",
    );
    expect(
      Option.isNone(Schema.decodeUnknownOption(RemoteRoomError)({ _tag: "unexpected" })),
    ).toBeTruthy();
  });
});
