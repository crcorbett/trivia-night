import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";

import { applyRoomAction, createInitialRoomState } from "../src/room";
import { RoomCode } from "../src/schemas";

describe("trivia room reducer", () => {
  it("keeps the live room transitions pure and serialisable", () => {
    const lobby = createInitialRoomState(RoomCode.make("RAE60"), 7);
    const joined = applyRoomAction(lobby, { type: "join", teamName: "The Bright Sparks" });
    assert.isTrue(Result.isSuccess(joined));
    if (Result.isFailure(joined)) return;

    const started = applyRoomAction(joined.success, { type: "start" });
    assert.isTrue(Result.isSuccess(started));
    if (Result.isFailure(started)) return;

    const team = started.success.teams[0];
    assert.isDefined(team);
    if (team === undefined) return;
    const scored = applyRoomAction(started.success, {
      type: "score",
      teamId: team.id,
      points: 5,
    });
    assert.isTrue(Result.isSuccess(scored));
    if (Result.isFailure(scored)) return;
    assert.strictEqual(scored.success.teams[0]?.score, 5);
  });

  it("rejects duplicate team names", () => {
    const lobby = createInitialRoomState(RoomCode.make("RAE60"), 7);
    const first = applyRoomAction(lobby, { type: "join", teamName: "The Bright Sparks" });
    assert.isTrue(Result.isSuccess(first));
    if (Result.isFailure(first)) return;
    const duplicate = applyRoomAction(first.success, {
      type: "join",
      teamName: "the bright sparks",
    });
    assert.isTrue(Result.isFailure(duplicate));
    if (Result.isSuccess(duplicate)) return;
    assert.strictEqual(duplicate.failure._tag, "TriviaRoomActionError");
    assert.strictEqual(duplicate.failure.reason, "duplicate-team-name");
  });
});
