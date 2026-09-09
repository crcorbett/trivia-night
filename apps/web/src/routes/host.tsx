import { Option, Schema } from "effect";
import { triviaSections } from "@trivia-night/domain/sections";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { RoomCode } from "@trivia-night/domain/schemas";
import type { TriviaRoomAction } from "@trivia-night/domain/schemas";
import { Atom, AsyncResult } from "effect/unstable/reactivity";
import { useRoom } from "../lib/room";
import { newRoomCodeAtom, roomActionAtom } from "../lib/room-atoms";

const DEFAULT_ROOM_CODE = "RAE60";
const HostSearchSchema = Schema.Struct({ room: Schema.optional(RoomCode) });
type HostSearch = typeof HostSearchSchema.Type;
type HostSearchInput = typeof HostSearchSchema.Encoded;
const decodeHostSearch = Schema.decodeOption(HostSearchSchema);

const validateHostSearch = (search: HostSearchInput): HostSearch =>
  Option.getOrElse(decodeHostSearch(search), () => ({}));

export const Route = createFileRoute("/host")({
  component: HostDesk,
  validateSearch: validateHostSearch,
});

function HostDesk() {
  const { room, roomCode, isCreatingRoom, roomCreationFailed, startNewRoom } = useHostRoom();
  const state = room.state;
  const currentSection =
    state === undefined ? undefined : triviaSections[state.currentSectionIndex];
  const nextSection =
    state === undefined ? undefined : triviaSections[state.currentSectionIndex + 1];

  return (
    <main className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Host desk</p>
          <h1 className="room-title">Keep the room moving.</h1>
        </div>
        <Link className="button button-yellow" to="/display/$roomCode" params={{ roomCode }}>
          Open display view
        </Link>
      </div>

      <div className="room-layout">
        <section className="room-card room-card-coral panel-coral">
          <p className="eyebrow">Room code</p>
          <div className="room-code">{roomCode}</div>
          <p>Put this on the big screen. Teams join at the same address on their phones.</p>
          <HostRoomActions
            handleStart={startNewRoom}
            isCreatingRoom={isCreatingRoom}
            roomCode={roomCode}
            roomCreationFailed={roomCreationFailed}
          />
          <HostRoomControls
            handleAction={room.send}
            isCreatingRoom={isCreatingRoom}
            status={state?.status}
          />
          <p className="room-status">
            {state?.status ?? "connecting"} · {room.connected ? "connected" : "connecting"}
          </p>
          {room.error === undefined ? null : <p className="error-note">{room.error}</p>}
        </section>

        <section className="room-card room-card-light" aria-labelledby="scores-title">
          <p className="eyebrow">Live scoreboard</p>
          <h2 id="scores-title">Teams</h2>
          {state?.teams.length === 0 ? (
            <p>No teams yet. Open the player join view on a phone.</p>
          ) : (
            <ul className="score-list">
              {state?.teams.map((team) => (
                <li className="score-row" key={team.id}>
                  <span>{team.name}</span>
                  <span className="score-actions">
                    <button
                      onClick={() => room.send({ type: "score", teamId: team.id, points: 1 })}
                      type="button"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => room.send({ type: "score", teamId: team.id, points: 3 })}
                      type="button"
                    >
                      +3
                    </button>
                    <strong>{team.score}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="room-card room-card-yellow" aria-labelledby="current-title">
          <p className="eyebrow">On the screen now</p>
          <h2 id="current-title">{currentSection?.title ?? "The lobby"}</h2>
          <p>{currentSection?.theme ?? "Get the teams in and make them comfortable."}</p>
          {nextSection === undefined ? null : (
            <p className="up-next">
              Up next: <strong>{nextSection.title}</strong>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

const useHostRoom = () => {
  const { room: searchRoomCode } = Route.useSearch();
  const navigate = Route.useNavigate();
  const generatedRoomResult = useAtomValue(newRoomCodeAtom);
  const requestNewRoom = useAtomSet(newRoomCodeAtom);
  const resetGeneratedRoom = useAtomSet(newRoomCodeAtom);
  const resetRoomAction = useAtomSet(roomActionAtom);
  const generatedRoomCode = Option.getOrUndefined(AsyncResult.value(generatedRoomResult));
  const roomCode = searchRoomCode ?? DEFAULT_ROOM_CODE;
  const room = useRoom(roomCode);

  useEffect(() => {
    if (generatedRoomCode === undefined || generatedRoomCode === roomCode) return;

    resetGeneratedRoom(Atom.Reset);
    void navigate({ replace: true, search: { room: generatedRoomCode } });
  }, [generatedRoomCode, navigate, resetGeneratedRoom, roomCode]);

  return {
    isCreatingRoom: AsyncResult.isWaiting(generatedRoomResult),
    room,
    roomCode,
    roomCreationFailed: Option.isSome(AsyncResult.error(generatedRoomResult)),
    startNewRoom: () => {
      resetRoomAction(Atom.Reset);
      requestNewRoom(null);
    },
  } as const;
};

interface HostRoomActionsProps {
  readonly isCreatingRoom: boolean;
  readonly handleStart: () => void;
  readonly roomCode: string;
  readonly roomCreationFailed: boolean;
}

const HostRoomActions = ({
  handleStart,
  isCreatingRoom,
  roomCode,
  roomCreationFailed,
}: HostRoomActionsProps) => (
  <>
    <div className="room-actions">
      <Link className="button button-dark" to="/join/$roomCode" params={{ roomCode }}>
        Preview player join
      </Link>
      <button
        className="button button-yellow"
        disabled={isCreatingRoom}
        onClick={handleStart}
        type="button"
      >
        {isCreatingRoom ? "Creating new room…" : "Start a new room"}
      </button>
    </div>
    {roomCreationFailed ? (
      <p className="error-note">We could not start a new room. Try again.</p>
    ) : null}
  </>
);

interface HostRoomControlsProps {
  readonly isCreatingRoom: boolean;
  readonly handleAction: (action: TriviaRoomAction) => void;
  readonly status: "finished" | "live" | "lobby" | undefined;
}

const HostRoomControls = ({ handleAction, isCreatingRoom, status }: HostRoomControlsProps) => (
  <div className="control-bar">
    <button
      className="control-button"
      disabled={isCreatingRoom || status !== "lobby"}
      onClick={() => handleAction({ type: "start" })}
      type="button"
    >
      Start game
    </button>
    <button
      className="control-button"
      disabled={isCreatingRoom || status !== "live"}
      onClick={() => handleAction({ type: "advance" })}
      type="button"
    >
      Reveal next section
    </button>
    <button
      className="control-button"
      disabled={isCreatingRoom || status !== "live"}
      onClick={() => handleAction({ type: "finish" })}
      type="button"
    >
      Finish game
    </button>
  </div>
);
