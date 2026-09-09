import { Result } from "effect";

import { TriviaRoomActionError } from "./errors";
import type {
  RoomCode,
  TeamId,
  TriviaRoomAction,
  TriviaRoomActionErrorReason,
  TriviaRoomState,
} from "./schemas";
import { TeamId as TeamIdSchema } from "./schemas";

export const createInitialRoomState = (code: RoomCode, totalSections: number): TriviaRoomState => ({
  code,
  status: "lobby",
  currentSectionIndex: 0,
  totalSections,
  teams: [],
});

const failure = (reason: TriviaRoomActionErrorReason) =>
  Result.fail(new TriviaRoomActionError({ reason }));

export const applyRoomAction = (
  state: TriviaRoomState,
  action: TriviaRoomAction,
): Result.Result<TriviaRoomState, TriviaRoomActionError> => {
  switch (action.type) {
    case "join": {
      if (state.status !== "lobby") {
        return failure("room-not-in-lobby");
      }
      const name = action.teamName.toLowerCase();
      if (state.teams.some((team) => team.name.toLowerCase() === name)) {
        return failure("duplicate-team-name");
      }
      const id: TeamId = TeamIdSchema.make(`team-${state.teams.length + 1}`);
      return Result.succeed({
        ...state,
        teams: [...state.teams, { id, name: action.teamName, score: 0 }],
      });
    }
    case "start":
      return state.status === "lobby"
        ? Result.succeed({ ...state, status: "live" })
        : failure(state.status === "finished" ? "room-finished" : "invalid-transition");
    case "advance":
      if (state.status !== "live") {
        return failure(state.status === "finished" ? "room-finished" : "room-not-live");
      }
      return state.currentSectionIndex + 1 >= state.totalSections
        ? Result.succeed({ ...state, status: "finished" })
        : Result.succeed({
            ...state,
            currentSectionIndex: state.currentSectionIndex + 1,
          });
    case "finish":
      return state.status === "live"
        ? Result.succeed({ ...state, status: "finished" })
        : failure(state.status === "finished" ? "room-finished" : "room-not-live");
    case "score": {
      if (state.status === "lobby") {
        return failure("room-not-live");
      }
      if (!state.teams.some((team) => team.id === action.teamId)) {
        return failure("unknown-team");
      }
      return Result.succeed({
        ...state,
        teams: state.teams.map((team) =>
          team.id === action.teamId ? { ...team, score: team.score + action.points } : team,
        ),
      });
    }
    default:
      return failure("invalid-transition");
  }
};
