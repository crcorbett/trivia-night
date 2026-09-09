import { Schema } from "effect";

const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0));
const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const TriviaSectionId = Schema.Literals([
  "time-capsule",
  "passport",
  "living-art-gallery",
  "courts-crowns-and-myths",
  "soundtrack",
  "movies",
  "birthday-finale",
]).pipe(Schema.brand("TriviaSectionId"));
export type TriviaSectionId = typeof TriviaSectionId.Type;

export const TriviaSectionMode = Schema.Literals([
  "rapid-fire",
  "travel",
  "art",
  "history",
  "music",
  "films",
  "finale",
]);
export type TriviaSectionMode = typeof TriviaSectionMode.Type;

export const TriviaSection = Schema.Struct({
  id: TriviaSectionId,
  order: PositiveInt,
  title: Schema.Trimmed.check(Schema.isMinLength(1)),
  theme: Schema.Trimmed.check(Schema.isMinLength(1)),
  durationMinutes: PositiveInt,
  mode: TriviaSectionMode,
  format: Schema.Trimmed.check(Schema.isMinLength(1)),
  topics: Schema.Array(Schema.Trimmed.check(Schema.isMinLength(1))),
});
export type TriviaSection = typeof TriviaSection.Type;

export const TeamId = Schema.Trimmed.check(Schema.isMinLength(1)).pipe(Schema.brand("TeamId"));
export type TeamId = typeof TeamId.Type;

export const TeamName = Schema.Trimmed.check(Schema.isMinLength(1)).check(Schema.isMaxLength(32));
export type TeamName = typeof TeamName.Type;

export const RoomCode = Schema.Trimmed.check(Schema.isMinLength(3))
  .check(Schema.isMaxLength(8))
  .pipe(Schema.brand("RoomCode"));
export type RoomCode = typeof RoomCode.Type;

export const TriviaRoomStatus = Schema.Literals(["lobby", "live", "finished"]);
export type TriviaRoomStatus = typeof TriviaRoomStatus.Type;

export const TriviaTeam = Schema.Struct({
  id: TeamId,
  name: TeamName,
  score: NonNegativeInt,
});
export type TriviaTeam = typeof TriviaTeam.Type;

export const TriviaRoomState = Schema.Struct({
  code: RoomCode,
  status: TriviaRoomStatus,
  currentSectionIndex: NonNegativeInt,
  totalSections: PositiveInt,
  teams: Schema.Array(TriviaTeam),
});
export type TriviaRoomState = typeof TriviaRoomState.Type;

export const TriviaRoomAction = Schema.Union([
  Schema.Struct({ type: Schema.Literal("join"), teamName: TeamName }),
  Schema.Struct({ type: Schema.Literal("start") }),
  Schema.Struct({ type: Schema.Literal("advance") }),
  Schema.Struct({ type: Schema.Literal("finish") }),
  Schema.Struct({
    type: Schema.Literal("score"),
    teamId: TeamId,
    points: NonNegativeInt.check(Schema.isLessThanOrEqualTo(10)),
  }),
]);
export type TriviaRoomAction = typeof TriviaRoomAction.Type;

export const TriviaRoomActionErrorReason = Schema.Literals([
  "room-not-in-lobby",
  "room-not-live",
  "room-finished",
  "duplicate-team-name",
  "unknown-team",
  "invalid-transition",
]);
export type TriviaRoomActionErrorReason = typeof TriviaRoomActionErrorReason.Type;
