import {
  triviaJoinMinutes,
  triviaPlayMinutes,
  triviaSections,
  triviaSessionMinutes,
} from "@trivia-night/domain/sections";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="page-shell">
      <section className="hero panel panel-coral">
        <p className="eyebrow">Mum's 60th birthday</p>
        <h1>A night of tiny clues, big memories and very serious guesses.</h1>
        <p className="hero-copy">
          A 60-minute, live trivia game for four teams of two. Put the questions on the big screen,
          let everyone join on their phone, and keep the room moving together.
        </p>
        <div className="hero-actions">
          <Link className="button button-dark" to="/host">
            Open host desk
          </Link>
          <span className="quiet-note">
            {triviaSessionMinutes} minutes · {triviaSections.length} sections
          </span>
        </div>
      </section>

      <section className="intro-grid">
        <div>
          <p className="eyebrow">The shape of the night</p>
          <h2>Enough variety to keep every table in the game.</h2>
        </div>
        <div className="intro-copy">
          <p>
            Start with a three-minute join window, then run seven short sections. Questions can be
            revealed one at a time, with music, images, maps and a final wager adding a little
            theatre.
          </p>
          <p className="stat-line">
            <strong>{triviaJoinMinutes} min</strong> join · <strong>{triviaPlayMinutes} min</strong>{" "}
            play · <strong>4 × 2</strong> teams
          </p>
        </div>
      </section>

      <section className="agenda" aria-labelledby="agenda-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Running order</p>
            <h2 id="agenda-title">Seven ways into the same family story.</h2>
          </div>
          <span className="section-total">{triviaPlayMinutes} minutes of play</span>
        </div>
        <div className="agenda-list">
          {triviaSections.map((section) => (
            <article className="agenda-row" key={section.id}>
              <span className="agenda-number">{String(section.order).padStart(2, "0")}</span>
              <div className="agenda-main">
                <h3>{section.title}</h3>
                <p>{section.theme}</p>
              </div>
              <div className="agenda-side">
                <span>{section.durationMinutes} min</span>
                <small>{section.format}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="page-footer">
        <span>Built for a room full of people, not a room full of tabs.</span>
        <Link to="/host">Start a room →</Link>
      </footer>
    </main>
  );
}
