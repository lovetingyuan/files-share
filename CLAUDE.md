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
│   ├── main.tsx        # Entry point
│   ├── App.tsx         # Root component
│   └── index.css       # Tailwind + DaisyUI imports
│
└── worker/             # Cloudflare Worker backend
    └── index.ts        # Hono app entry point (exported as default)
```

- **Frontend**: React 19 with Vite, Tailwind CSS v4, DaisyUI components
- **Backend**: Hono framework running on Cloudflare Workers
- **Build**: Vite builds the client to `dist/client/`, wrangler serves it as static assets with SPA fallback
- **TypeScript**: Separate configs for app (`tsconfig.app.json`), worker (`tsconfig.worker.json`), and build tools (`tsconfig.node.json`)

## Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

### Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

### Commands

| Command               | Purpose                   |
| --------------------- | ------------------------- |
| `npx wrangler dev`    | Local development         |
| `npx wrangler deploy` | Deploy to Cloudflare      |
| `npx wrangler types`  | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

### Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

### Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

### Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`
