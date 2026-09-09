import { triviaSections } from "@trivia-night/domain/sections";
import { Link, createFileRoute } from "@tanstack/react-router";

import { useRoom } from "../lib/room";

export const Route = createFileRoute("/display/$roomCode")({ component: DisplayRoom });

function DisplayRoom() {
  const { roomCode } = Route.useParams();
  const room = useRoom(roomCode);
  const state = room.state;
  const section = state === undefined ? undefined : triviaSections[state.currentSectionIndex];
  const scores = [...(state?.teams ?? [])].sort((left, right) => right.score - left.score);

  return (
    <main className="page-shell display-shell">
      <div className="display-hero">
        <div>
          <p className="eyebrow">Mum's 60th · room {room.code ?? roomCode}</p>
          <p className="display-index">
            {state?.status === "lobby"
              ? "Get ready"
              : state?.status === "finished"
                ? "Final scores"
                : `Section ${(state?.currentSectionIndex ?? 0) + 1} of ${triviaSections.length}`}
          </p>
          <h1 className="room-title">
            {section?.title ??
              (state?.status === "finished" ? "That is a wrap." : "Welcome, teams.")}
          </h1>
          <p className="hero-copy">
            {section?.theme ?? "Join on your phone, then keep your best guesses close."}
          </p>
        </div>
        <div className="room-card room-card-yellow">
          <p className="eyebrow">Live score</p>
          <ul className="score-list">
            {scores.length === 0 ? (
              <li className="score-row">
                <span>Waiting for teams</span>
              </li>
            ) : (
              scores.map((team) => (
                <li className="score-row" key={team.id}>
                  <span>{team.name}</span>
                  <strong>{team.score}</strong>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <footer className="page-footer">
        <span>{room.connected ? "Live room connected" : "Local rehearsal room"}</span>
        <Link to="/host">Host controls →</Link>
      </footer>
    </main>
  );
}
