import type { Plugin } from 'vite'

const launcherHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ACCS local role launcher</title>
    <style>
      :root { color-scheme: light; font: 16px/1.5 system-ui, sans-serif; color: #17202b; background: #f4f6f8; }
      body { margin: 0; padding: 2rem 1rem; }
      main { max-width: 880px; margin: 0 auto; }
      h1 { margin: 0 0 .5rem; }
      #status { color: #45515e; }
      #status.error { color: #a32121; }
      #accounts { display: grid; gap: .75rem; }
      article { display: grid; grid-template-columns: 1fr auto; gap: .25rem 1rem; align-items: center; padding: 1rem; border: 1px solid #d9dfe5; border-radius: .75rem; background: white; }
      article h2, article p { margin: 0; }
      article .details { grid-column: 1; color: #45515e; }
      article a { grid-column: 2; grid-row: 1 / span 2; }
      a { color: #0759a5; font-weight: 600; }
      @media (max-width: 600px) { article { grid-template-columns: 1fr; } article .details, article a { grid-column: 1; grid-row: auto; } }
    </style>
  </head>
  <body>
    <main>
      <h1 id="title">ACCS local role launcher</h1>
      <p id="status" role="status" aria-live="polite">Loading…</p>
      <section id="accounts"></section>
    </main>
    <script>
      const status = document.getElementById('status')
      const accountsRoot = document.getElementById('accounts')

      function showError(error) {
        status.className = 'error'
        status.textContent = error instanceof Error ? error.message : 'The request could not be completed.'
      }

      async function request(path, options) {
        const response = await fetch(path, { credentials: 'include', ...options })
        const body = await response.json().catch(() => undefined)
        if (!response.ok) {
          throw new Error(typeof body?.message === 'string' ? body.message : 'The API request failed (' + response.status + ').')
        }
        return body
      }

      function slugsFor(accounts) {
        const slugs = new Map()
        const used = new Set()
        for (const account of accounts) {
          const base = String(account.id)
            .normalize('NFKD')
            .toLowerCase()
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 63)
            .replace(/-+$/g, '') || 'account'
          let slug = base
          for (let suffix = 2; used.has(slug); suffix += 1) {
            const ending = '-' + suffix
            slug = base.slice(0, 63 - ending.length).replace(/-+$/g, '') + ending
          }
          used.add(slug)
          slugs.set(account.id, slug)
        }
        return slugs
      }

      function addBackLink() {
        const url = new URL('/__roles', window.location.origin)
        url.hostname = 'localhost'
        const link = document.createElement('a')
        link.href = url.href
        link.textContent = 'Back to the launcher'
        accountsRoot.replaceChildren(link)
      }

      async function launchRole() {
        document.getElementById('title').textContent = 'Signing in to ACCS'
        const accountId = new URLSearchParams(window.location.search).get('account')
        if (!accountId) throw new Error('This role link is missing an account.')
        if (window.location.hostname !== slugsFor([{ id: accountId }]).get(accountId) + '.localhost') {
          throw new Error('This account does not match the current local host.')
        }
        status.textContent = 'Signing in as ' + accountId + '…'
        const session = await request('/api/auth/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailOrId: accountId, password: 'Accs@Qcu2026!' }),
        })
        window.location.replace(session?.user?.roles?.includes('administrator') ? '/admin' : '/home')
      }

      if (window.location.pathname === '/__role') {
        launchRole().catch((error) => {
          showError(error)
          addBackLink()
        })
      } else {
        status.textContent = 'Open /__role?account=<account ID> on <slug>.localhost, where the slug is the lowercased account ID, to start an independent local session.'
      }
    </script>
  </body>
</html>`

function allowedHost(hostHeader: string | undefined) {
  if (!hostHeader) return false
  const host = hostHeader.toLowerCase()
  const match = /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.localhost)(?::(\d{1,5}))?$/.exec(host)
  if (!match) return false
  return match[2] === undefined || (Number(match[2]) > 0 && Number(match[2]) <= 65535)
}

export function localRoleLauncher(): Plugin {
  return {
    name: 'accs-local-role-launcher',
    configureServer(server) {
      if (server.config.server.host !== '127.0.0.1') {
        throw new Error('ACCS_ROLE_LAUNCHER requires Vite to bind to 127.0.0.1 only.')
      }

      server.middlewares.use((req, res, next) => {
        if (!allowedHost(req.headers.host)) {
          res.statusCode = 421
          res.end('This local development host is not allowed.')
          return
        }

        let pathname: string
        try {
          pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        } catch {
          res.statusCode = 400
          res.end('Invalid request URL.')
          return
        }

        if (pathname !== '/__roles' && pathname !== '/__role') {
          next()
          return
        }
        if (req.method !== 'GET') {
          res.statusCode = 404
          res.end('Not found.')
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(launcherHtml)
      })
    },
  }
}
