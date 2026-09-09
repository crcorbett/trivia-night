# `trivia-night`

A Bun/Turbo monorepo for a live, interactive 60-minute birthday trivia night.
The browser app is TanStack Start/Vite, the game rules are Effect schemas and
pure functions, and Alchemy owns the desired Cloudflare Worker and Durable
Object topology.

The current running order is seven sections: two time capsules, travel, art,
history and mythology, music, films, and a birthday finale. The three-minute
join window makes the whole session 60 minutes.

```bash
bun install
bun --filter web dev
```

With no `VITE_ROOM_API_URL`, the host, player and display views rehearse in the
browser using BroadcastChannel and localStorage. Alchemy supplies that URL for
deployed rooms; deployment is an explicit operator action and is not run by
the normal local checks. The Effect TS and Alchemy source references are
available under [`.references/`](.references/); initialise them with
`git submodule update --init --depth 1` after cloning.

No secret is needed for local rehearsal. When a future approved Cloudflare or
Alchemy command needs credentials, use Doppler to inject them for that command;
do not create a committed `.env` file. Alchemy's deployment state is separate
from Doppler's secret store.

The repository gate is:

```bash
bun run verification
```

Read `AGENTS.md`, then use [`docs/README.md`](docs/README.md) to load only the
semantic owners needed for the change. Begin with the active
[bootstrap harness plan](docs/exec-plans/active/bootstrap-harness.md) and
qualify the repository profile, journeys, lockfile, and checks. Generated route
trees, lockfiles, output, and caches are tool-owned rather than templates. The
dependency versions and exact upstream reference commits are recorded in
[`.references/README.md`](.references/README.md) and the repository receipt.
