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

## Module sites

The signed-in app is seven module sites (Home, Forums, Schedule, Cases, Evaluations, Records, Admin). One build serves all of them, and each site has its own host. Routes and permissions do not change. Site definitions, host resolution, and link rewriting are in `src/lib/sites.ts`; the design is in [`docs/deltas/2026-11-01-subdomain-sites.md`](../docs/deltas/2026-11-01-subdomain-sites.md).

- **Unified mode:** `http://localhost:5173` serves every route on one host, with no cross-host redirects. This is the default for `npm run dev`.
- **Several hosts locally:** open `http://<site>.localhost:5173`, where `<site>` is `portal`, `forums`, `schedule`, `cases`, `evaluations`, `records`, or `admin`. A route that belongs to another site loads on that site's host. The dev proxy is per host, so each host keeps its own session and you sign in once per host.
- **Deployed builds:** set `VITE_SITE_ORIGINS` at build time to a JSON map of site to origin, for example `VITE_SITE_ORIGINS='{"portal":"https://portal.example","forums":"https://forums.example"}'`. The deploy scripts fill it from the stack's `SiteOrigins` output ([`architecture/README.md`](../architecture/README.md)). A site with no entry stays on the current host.
- **Tests:** `npm test` runs Vitest, including `src/lib/sites.test.ts`. It checks that each of the 58 DOC003 modules is assigned to exactly one site and is reachable through one of its pages on that site, that every page maps to a site, and the cross-host link rules. The module list is `src/lib/doc003-modules.json`, generated from the DOC003 module inventory.

- Routes live in `src/routes/`. `src/routeTree.gen.ts` is generated on first `dev`/`build`.
