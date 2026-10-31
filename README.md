# Frontend

Vite + React + TypeScript, with TanStack Router (file-based routes) and TanStack Query.

```
pnpm install   # or npm install
pnpm dev       # http://localhost:5173, proxies /api to :3000
pnpm build
```

## Compare demo accounts in separate tabs

Start the local role launcher with the frontend API URL set to the Vite proxy:

```sh
ACCS_ROLE_LAUNCHER=1 VITE_API_URL=/api npm run dev -- --port 5188
```

Open `http://localhost:5188/__roles`. Each account's **Open in a new tab** link signs in through the demo API on a separate `<account>.localhost` hostname. The tab opens Home, or Administration for an administrator. Reloading a tab keeps its account; signing in on another account's hostname does not replace its cookie. Tabs opened on the same account hostname share that account's session.

`ACCS_DEV_API_TARGET` selects the API proxied by Vite. It defaults to `http://localhost:3000`; set it to the development API origin to use the hosted demo data. Keep `VITE_API_URL=/api` so requests use the local proxy. The account tabs share the selected API's records, so changes made in one role are visible to other roles according to their permissions.

The launcher requires `ACCS_ROLE_LAUNCHER=1` and binds Vite to `127.0.0.1`. It rejects other hosts and cannot run with a public `--host` binding. Its `/__roles` and `/__role` pages are available only on the opted-in dev server; they are not part of the production build. Starting Vite normally keeps the existing API proxy behavior.

- Routes live in `src/routes/`. `src/routeTree.gen.ts` is generated on first `dev`/`build`.
- System concept not defined yet.
