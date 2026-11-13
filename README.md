# Frontend

Vite + React + TypeScript, with TanStack Router (file-based routes) and TanStack Query.

```
npm install
npm run dev    # http://localhost:5173, proxies /api to :3000
npm run build  # vite build, then tsc -b
npm test       # Vitest
```

`VITE_API_URL` is the API base URL, set at build time (default `/api`). The deploy workflow sets it from the stack's `ApiUrl` output. Routes live in `src/routes/`; `src/routeTree.gen.ts` is generated on first `dev`/`build`.

## Compare seeded accounts in separate tabs

Start the local role launcher with the frontend API URL set to the Vite proxy:

```sh
ACCS_ROLE_LAUNCHER=1 VITE_API_URL=/api npm run dev -- --port 5188
```

Port 5188 is only this example's choice, so the launcher can run beside the normal dev server, which uses 5173.

Open `http://<account id lowercased>.localhost:5188/__role?account=<ACCOUNT ID>` (for example `qcu-stu-it-a.localhost`). The launcher signs in with the backend's local default seed password, which a stack that sets its own `SEED_PASSWORD` rejects, on a separate `<account>.localhost` hostname; `/__roles` only shows these instructions, because the account list endpoint was removed. The tab opens Home, or Administration for an administrator. Reloading a tab keeps its account; signing in on another account's hostname does not replace its cookie. Tabs opened on the same account hostname share that account's session.

`ACCS_DEV_API_TARGET` selects the API proxied by Vite. It defaults to `http://localhost:3000`; set it to the development API origin to use the hosted pilot data. Keep `VITE_API_URL=/api` so requests use the local proxy. The account tabs share the selected API's records, so changes made in one role are visible to other roles according to their permissions.

The launcher requires `ACCS_ROLE_LAUNCHER=1` and binds Vite to `127.0.0.1`. It rejects other hosts and cannot run with a public `--host` binding. Its `/__roles` and `/__role` pages are available only on the opted-in dev server; they are not part of the production build. Starting Vite normally keeps the existing API proxy behavior.

## Accounts and first sign-in

`/first-login` is the only page open to an account with temporary credentials; every other page in the app redirects there. `/accounts` is for the Dean (activate the secretary) and the secretary (faculty, advisors, program chairs, students). The student import reads `.xlsx` files in the browser with `read-excel-file`, loaded on demand. Its column names are assumptions until a sample MIS file is provided.

## Dev toolbox

A floating account switcher for the development stack. It is built in only under `npm run dev` or when `VITE_DEV_TOOLBOX=true` is set at build time. The deploy workflow sets it only for the `dev` branch build; `main` builds leave it unset and contain no toolbox code. It needs the backend dev routes, which exist only on the `accs-dev-` stack ([backend README](../backend/README.md#dev-toolbox)).

## Module sites

The signed-in app has seven module sites (Home, Forums, Schedule, Cases, Evaluations, Records, Admin). They are navigation groups on one host, `portal.access-ccs.com` (`portal-dev.access-ccs.com` on dev), so moving between them never leaves the app. Site definitions are in `src/lib/sites.ts`; the design is in [`docs/deltas/2026-11-05-one-portal-host.md`](../docs/deltas/2026-11-05-one-portal-host.md).

**Tests:** `npm test` runs Vitest, including `src/lib/sites.test.ts`. It checks that each of the 58 DOC003 modules is assigned to exactly one site and is reachable through one of its pages on that site, and that every page maps to a site. The module list is `src/lib/doc003-modules.json`, generated from the DOC003 module inventory.

## Errors

`src/main.tsx` sets router-wide not-found and error screens (`src/components/app/route-fallbacks.tsx`); a route with its own `errorComponent` still handles its own errors. The session check redirects to sign-in only on a 401. A network error or a 5xx shows a "Couldn't load this page" screen with Try again, so a server fault does not look like a sign-out. A failed sign-out shows an alert with Try again and keeps the person signed in; the cache is cleared only after the server confirms.
