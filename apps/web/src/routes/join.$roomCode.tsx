import { RoomCode, TeamName } from "@trivia-night/domain/schemas";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Result, Schema } from "effect";
import { useState } from "react";
import type { FormEvent } from "react";

import { useRoom } from "../lib/room";

export const Route = createFileRoute("/join/$roomCode")({ component: JoinRoom });

function JoinRoom() {
  const { roomCode } = Route.useParams();
  const room = useRoom(roomCode);
  const [teamName, setTeamName] = useState("");
  const [formError, setFormError] = useState<string | undefined>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const decodedName = Schema.decodeUnknownResult(TeamName)(teamName);
    if (Result.isFailure(decodedName)) {
      setFormError("Give your team a name, up to 32 characters.");
      return;
    }
    setFormError(undefined);
    room.send({ type: "join", teamName: decodedName.success });
    setTeamName("");
  };

  const validCode = Schema.decodeUnknownResult(RoomCode)(roomCode.trim().toUpperCase());
  const joinedTeams = room.state?.teams ?? [];

  return (
    <main className="page-shell">
      <div className="room-layout">
        <section className="room-card room-card-light">
          <p className="eyebrow">Player join</p>
          <h1 className="room-title">Choose your table name.</h1>
          {Result.isFailure(validCode) ? (
            <p className="error-note">That room code is not valid.</p>
          ) : (
            <>
              <p>
                Room <strong>{validCode.success}</strong> is open. Add your team below.
              </p>
              <form className="room-form" onSubmit={submit}>
                <label className="sr-only" htmlFor="team-name">
                  Team name
                </label>
                <input
                  id="team-name"
                  maxLength={32}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="The Bright Sparks"
                  value={teamName}
                />
                <button className="button button-dark" type="submit">
                  Join room
                </button>
              </form>
              {formError === undefined ? null : <p className="error-note">{formError}</p>}
              {room.error === undefined ? null : <p className="error-note">{room.error}</p>}
            </>
          )}
        </section>

        <section className="room-card room-card-yellow" aria-labelledby="joined-title">
          <p className="eyebrow">Already in</p>
          <h2 id="joined-title">
            {joinedTeams.length} team{joinedTeams.length === 1 ? "" : "s"}
          </h2>
          <ul className="score-list">
            {joinedTeams.map((team) => (
              <li className="score-row" key={team.id}>
                <span>{team.name}</span>
                <strong>{team.score}</strong>
              </li>
            ))}
          </ul>
          <Link to="/" className="button button-dark">
            See the running order
          </Link>
        </section>
      </div>
    </main>
  );
}
