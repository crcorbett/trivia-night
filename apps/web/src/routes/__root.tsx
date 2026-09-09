/// <reference types="vite/client" />

import { createRootRoute, HeadContent, Link, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Trivia Night" },
      {
        name: "description",
        content: "A live, interactive birthday trivia night for the whole room.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="site-header">
          <Link to="/" className="brand">
            <span className="brand-mark">TN</span>
            <span>Trivia Night</span>
          </Link>
          <span className="header-note">Rae's birthday edition</span>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
