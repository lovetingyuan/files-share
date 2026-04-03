# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack application built with React + Vite + Hono, deployed to Cloudflare Workers.

## Commands

```bash
npm run dev        # Start Vite dev server (http://localhost:5173)
npm run build      # TypeScript compile + Vite build
npm run preview    # Build and preview locally
npm run deploy     # Deploy to Cloudflare Workers
npm run lint       # Run oxlint with auto-fix and format
npm run check      # Full check: tsc + build + dry-run deploy
npm run cf-typegen # Generate TypeScript types from wrangler config
```

## Architecture

```
src/
├── react-app/          # Frontend React application
└── worker/             # Cloudflare Worker backend
```

- **Frontend**: React 19 with Vite, Tailwind CSS v4, DaisyUI components
- **Backend**: Hono framework running on Cloudflare Workers
- **Build**: Vite builds the client to `dist/client/`, wrangler serves it as static assets with SPA fallback
- **TypeScript**: Separate configs for app (`tsconfig.app.json`), worker (`tsconfig.worker.json`), and build tools (`tsconfig.node.json`)

## Coding rules

- **API**: When using third-party APIs, you must first query the documentation for official usage.
- **style**: Styles must be written using tailwindcss. Try to avoid using style and creating separate CSS files. If you must use them, you must ask the user and explain the reasons.
- **React**: The number of rows per react component should be limited to 300 lines, and the excess should be optimized by abstraction constants, sub-components, and custom hooks.
- **React Hooks**: Try to avoid using useEffect; please refer to the corresponding best practices.
- **Honojs**: Hono routes must use full path definitions, and route processing methods are split into separate modules.
- **typescript**: Place common and global types at src/types.ts.

## Debug

- **use real browser**: local server is vite dev server, and the default user account is `test1@tingyuan.in` and password is `test1@tingyuan.inA`.
