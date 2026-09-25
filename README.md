# Instar

Frontend for Instar, the coaching business app that tells the coach what needs them today
instead of showing a dashboard of charts. Built in Next.js (App Router) as a faithful
implementation of the **Obsidian+** direction — the client-approved look from the design
concept and design system exports.

## What's here

- `/` — Today: the greeting, the action queue, revenue, roster pulse, agenda and an insight card.
- `/clients`, `/grow`, `/business` — the three space overviews with their tile grids.
- All content (queue items, roster, copy) is ported verbatim from the approved concept in `lib/data.ts`.
- Styling follows the exported design system 1:1: `app/styles/tokens.css` (colour/type/spacing
  tokens for dark and light), `app/styles/components.css` (`.ins-*` component classes), and
  `app/styles/layout.css` (page chrome not covered by the component bundle: top bar, sidebar,
  hero, grids, command palette, toast, motion, responsive rules).
- Fonts (Unbounded, Figtree, IBM Plex Mono) load via `next/font/google`.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run build   # production build
npm run lint    # ESLint
```

## Deploying

This is a zero-config Next.js app — connect the repository in the Vercel dashboard, or deploy
from the CLI with `vercel`.
