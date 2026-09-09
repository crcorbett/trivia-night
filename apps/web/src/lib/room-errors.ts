import { Schema } from "effect";

import {
  TriviaRoomActionError,
  TriviaRoomStateError,
  TriviaRoomUnavailableError,
} from "@trivia-night/domain/errors";

const describeRoomError = (reason: string) => {
  switch (reason) {
    case "duplicate-team-name":
      return "That team name is already taken.";
    case "room-not-in-lobby":
      return "The room is already under way.";
    case "room-not-live":
      return "Start the game before changing the score.";
    case "room-finished":
      return "The game has finished.";
    case "unknown-team":
      return "That team is no longer in the room.";
    default:
      return "That action is not available yet.";
  }
};

export const RemoteRoomError = Schema.Union([
  TriviaRoomActionError,
  TriviaRoomStateError,
  TriviaRoomUnavailableError,
]);
export type RemoteRoomError = typeof RemoteRoomError.Type;

export const describeRemoteError = (error: RemoteRoomError) => {
  switch (error._tag) {
    case "TriviaRoomActionError":
      return describeRoomError(error.reason);
    case "TriviaRoomStateError":
    case "TriviaRoomUnavailableError":
      return "The room could not be reached.";
    default:
      return "The room could not be reached.";
  }
};
