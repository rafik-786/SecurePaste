# SecurePaste frontend

The single-page application (SPA) for SecurePaste. It encrypts every paste in
the browser with AES-256-GCM (Advanced Encryption Standard, Galois/Counter
Mode) through the Web Crypto API, puts the key in the URL fragment, and only
ever sends ciphertext to the API.

Stack: React 19, TypeScript in strict mode, Vite 8, React Router 7
(declarative mode), highlight.js for syntax highlighting, CSS (Cascading Style
Sheets) modules on global custom properties. No component library and no
third-party requests at runtime: the two web fonts, IBM Plex Sans and
JetBrains Mono, are self-hosted from `node_modules` through the build.

## Prerequisites

- Node.js 22.13 or later, or 24.
- Google Chrome installed, for the end-to-end tests. Playwright drives the
  installed Chrome (`channel: 'chrome'`), so no browser download is needed.
- For anything that talks to a real backend: the API from `src/backend` and a
  PostgreSQL 16 database, set up below.

`.npmrc` pins the public npm registry, so a machine-wide private feed is not
used for this project.

## Commands

Run from `src/frontend`.

```bash
npm ci
```

| Command                      | What it does                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                | development server on http://localhost:5173; proxies `/api`, `/healthz` and `/readyz` to the API                                                                                   |
| `npm run build`              | type check and production build into `dist/`                                                                                                                                       |
| `npm run preview`            | serves `dist/` with the same proxy                                                                                                                                                 |
| `npm run check`              | everything that must stay green: type check, lint with zero warnings, format check, unit and component tests, build, bundle budget, contrast on glass                              |
| `npm test`                   | unit tests (`src/lib`, `src/api`, Node environment) and component tests (everything else, jsdom)                                                                                   |
| `npm run coverage`           | the same with coverage; `src/lib` and `src/api` must stay at 90% of lines or more                                                                                                  |
| `npm run test:e2e`           | end-to-end tests against the production build, API mocked, content security policy live; includes the accessibility scan (axe, Web Content Accessibility Guidelines (WCAG) 2.2 AA) |
| `npm run test:e2e:fullstack` | end-to-end tests against the real API and database (opt-in, setup below)                                                                                                           |
| `npm run check:budget`       | bundle sizes against the performance budget; needs a build first                                                                                                                   |
| `npm run check:contrast`     | text and border contrast on every glass surface, over the plain page and over each glow, read from `src/styles/tokens.css`                                                         |

The proxy target defaults to `http://localhost:5000`. Override it with
`VITE_API_PROXY_TARGET`. The footer holds only a "Source code" link, and it is
rendered only when `VITE_SOURCE_URL` is set to an http or https URL at build
time. `npm run test:e2e` builds with a placeholder URL, so the layout tests run
with the footer in place.

Web Crypto only runs in a secure context: `localhost` works, but opening the
dev server from a phone over the local network needs HTTPS.

## Running against the real backend

On Windows, `dev.ps1` at the repo root does all of the steps below in one go.
It starts (or creates) the PostgreSQL container, applies the migrations, then
opens the API and the dev server in their own Windows Terminal tabs (separate
windows when Windows Terminal is missing). The flags at the top of the file
choose what runs: `$RunBackend`, `$RunFrontend` and `$ApplyMigrations`. Ctrl+C
in a tab stops that process; the database keeps running. The manual steps are:

Start PostgreSQL 16, then, from `src/backend` (where the Entity Framework
tool manifest lives), restore the tools and apply the migrations once:

```bash
docker run -d --name securepaste-pg -e POSTGRES_USER=securepaste -e POSTGRES_PASSWORD=securepaste -e POSTGRES_DB=securepaste -p 5432:5432 postgres:16-alpine
```

```bash
dotnet tool restore
```

```bash
dotnet ef database update --project src/Modules/SecurePaste.Modules.Pastes --startup-project src/Modules/SecurePaste.Modules.Pastes --connection "Host=localhost;Port=5432;Database=securepaste;Username=securepaste;Password=securepaste"
```

Then start the API, still from `src/backend`, in the Development environment
so it reads the connection string from `appsettings.Development.json`. It
listens on http://localhost:5000:

```bash
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/SecurePaste.Api --no-launch-profile
```

With the API up, `npm run dev` or `npm run preview` gives the whole app, and
`npm run test:e2e:fullstack` runs the full-stack suite. That suite stops at
once if `/readyz` does not answer 200. It counts its own calls and stays under
the API's rate limits (20 creates and 60 claims per minute per address), so
running it twice within one minute is fine and a third run gets 429 responses.

## Layout

| Folder                 | Holds                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/lib`              | pure logic: crypto, strict base64, payload, limits, time and size formatting, the highlighter loader |
| `src/api`              | the typed API client and its mapping of RFC 9457 (Request for Comments) problem responses            |
| `src/components`       | the shared component set                                                                             |
| `src/hooks`            | announcer, focus, countdown, request timeout, leave guard                                            |
| `src/routes`           | one folder per route; `shared` holds what more than one route uses                                   |
| `src/styles`           | design tokens, base styles, the backdrop glows and the shared glass class                            |
| `e2e`, `e2e-fullstack` | Playwright suites, mocked and real backend                                                           |
| `scripts`              | the bundle budget check and the contrast check                                                       |

Everything outside `src/routes` (and `src/routes/shared`) is bundled into the
entry chunk on purpose, so the first load of `/` stays at nine requests. Put
code that only one route uses inside that route's folder.

## Deployment notes

Deployment is not set up yet. When it is:

- The production build injects the content security policy as a meta tag. A
  response header is stronger and is the only way to set
  `frame-ancestors 'none'`; send it together with
  `X-Content-Type-Options: nosniff`.
- Serve `index.html` with `Cache-Control: no-store`. Hashed files under
  `assets/` can be cached for a year.
- Serve `index.html` for every path that is not a file, so `/p/...` and
  `/d/...` load the app.
- Do not publish `dist/.vite/`. It holds the build manifest the budget check
  reads.
