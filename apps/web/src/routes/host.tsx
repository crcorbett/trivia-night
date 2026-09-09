import { triviaSections } from "@trivia-night/domain/sections";
import { Link, createFileRoute } from "@tanstack/react-router";

import { useRoom } from "../lib/room";

const DEFAULT_ROOM_CODE = "RAE60";

export const Route = createFileRoute("/host")({ component: HostDesk });

function HostDesk() {
  const room = useRoom(DEFAULT_ROOM_CODE);
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
        <Link
          className="button button-yellow"
          to="/display/$roomCode"
          params={{ roomCode: DEFAULT_ROOM_CODE }}
        >
          Open display view
        </Link>
      </div>

      <div className="room-layout">
        <section className="room-card room-card-coral panel-coral">
          <p className="eyebrow">Room code</p>
          <div className="room-code">{DEFAULT_ROOM_CODE}</div>
          <p>Put this on the big screen. Teams join at the same address on their phones.</p>
          <Link
            className="button button-dark"
            to="/join/$roomCode"
            params={{ roomCode: DEFAULT_ROOM_CODE }}
          >
            Preview player join
          </Link>
          <div className="control-bar">
            <button
              className="control-button"
              disabled={state?.status !== "lobby"}
              onClick={() => room.send({ type: "start" })}
              type="button"
            >
              Start game
            </button>
            <button
              className="control-button"
              disabled={state?.status !== "live"}
              onClick={() => room.send({ type: "advance" })}
              type="button"
            >
              Reveal next section
            </button>
            <button
              className="control-button"
              disabled={state?.status !== "live"}
              onClick={() => room.send({ type: "finish" })}
              type="button"
            >
              Finish game
            </button>
          </div>
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
