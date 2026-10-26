# Todo App

A todo app with due dates & priorities, built to learn deployment — split into
three microservices: frontend, backend, database.

## Stack

| Service    | Tech                                                        |
| ---------- | ----------------------------------------------------------- |
| `frontend` | React (Vite build) served by nginx, proxies `/api` → backend |
| `backend`  | Node.js + Express (API only)                                |
| `db`       | Postgres 17                                                 |

Request flow: **browser → frontend (nginx) → backend (Express) → db (Postgres)**

---

## Prerequisites

- Docker + Docker Compose (`docker compose version`)
- Node.js 18+ (only for local development without Docker)
- Optional: `curl` to run the checks below

---

## Step 1 — Start the database

```bash
npm run db:migrate
```

This runs two commands under the hood:

```bash
npm run db:up      # docker compose up -d db  → Postgres on localhost:5432
npm run db:seed    # copies data/todos.json into Postgres (safe to re-run)
```

Check it:

```bash
docker compose ps db          # STATUS should end in "(healthy)"
docker compose logs db        # Postgres startup logs
```

The database persists in a Docker volume (`pgdata`) — it survives container
restarts until you run `npm run db:reset`.

## Step 2 — Build and start all three services

```bash
docker compose up --build
```

First run builds two images (Vite build → nginx for frontend, Node image for
backend), then starts `db`, `backend`, `frontend`. Detached instead:

```bash
docker compose up --build -d
docker compose ps             # all 3 should be "Up (healthy)"
docker compose logs -f backend  # follow one service's logs (Ctrl+C to stop)
```

Open **http://localhost:3000** in your browser and add a todo.

> Port 3000 busy (e.g. a `kubectl port-forward` running)? Pick another host
> port — nothing else needs to change:
>
> ```bash
> APP_PORT=3100 docker compose up --build -d
> # now open http://localhost:3100
> ```

## Step 3 — Verify each service

```bash
# 1. whole chain: nginx → backend → db (should say "postgres")
curl localhost:3000/health

# 2. backend directly, bypassing nginx (host port API_PORT, default 3001)
curl localhost:3001/health

# 3. data actually comes from Postgres (your seeded todos)
curl localhost:3000/api/todos

# 4. nginx serves the frontend
curl -I localhost:3000/          # HTTP/1.1 200 OK
```

`/health` should return `{ "status": "ok", "storage": "postgres" }`. If it says
`"file"`, the backend is not getting `DATABASE_URL` — check `docker compose ps`
and `docker compose logs backend`.

## Step 4 — Use the API

```bash
# create
curl -X POST localhost:3000/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"text":"learn k8s","priority":"high","due":"2026-10-15"}'

# list / filter / sort
curl 'localhost:3000/api/todos?filter=active&priority=high&sort=due'

# mark done (use an id from the list response)
curl -X PUT localhost:3000/api/todos/<ID> \
  -H 'Content-Type: application/json' -d '{"done":true}'

# delete
curl -X DELETE localhost:3000/api/todos/<ID>
```

Full reference in [API](#api) below.

---

## Everyday commands

| Task                     | Command                              |
| ------------------------ | ------------------------------------ |
| Start everything         | `docker compose up --build -d`       |
| Status                   | `docker compose ps`                  |
| Logs (all / one service) | `docker compose logs -f` / `-f backend` |
| Stop, keep data          | `docker compose down`                |
| Stop + wipe the database | `npm run db:reset`                   |
| Re-import JSON todos     | `npm run db:seed`                    |
| Shell into Postgres      | `docker compose exec db psql -U postgres -d todos` |
| Shell into backend       | `docker compose exec backend sh`     |
| Rebuild after code change| `docker compose up --build -d backend` (frontend: `... frontend`) |

Ports (host side, all overridable):

| Service   | Default       | Override           |
| --------- | ------------- | ------------------ |
| frontend  | `3000` → 80   | `APP_PORT=3100`    |
| backend   | `3001` → 3000 | `API_PORT=3002`    |
| db        | `5432` → 5432 | edit `docker-compose.yml` |

Example: `APP_PORT=3100 API_PORT=3002 docker compose up --build -d`

---

## Local development (no Docker for the app)

Run Vite + the API on your machine, using the Dockerized database for storage:

```bash
npm install
npm run db:migrate   # ensure Postgres is up and seeded (once)

# terminal 1 — API on :3000
DATABASE_URL=postgres://postgres:dev@localhost:5432/todos npm start

# terminal 2 — Vite dev server on :5173, hot reload, proxies /api → :3000
npm run dev
```

Open http://localhost:5173. Edits to `src/` hot-reload.

Without `DATABASE_URL`, `npm start` falls back to the JSON file store
(`data/todos.json`) — no database needed at all.

Production build served by Express in a single process (the old pre-split way):

```bash
npm run build && npm start   # everything on :3000
```

---

## Storage

Two backends, chosen automatically:

- **JSON file** (default): no env vars set → `data/todos.json`.
- **Postgres**: set `DATABASE_URL` (e.g. `postgres://user:pass@host:5432/db`)
  → a `todos` table is created on startup and used instead.

`/health` reports which backend is active: `{ "status": "ok", "storage": "file" | "postgres" }`.

DB helper scripts (all use `docker-compose.yml`):

| Script                | What it does                                              |
| --------------------- | --------------------------------------------------------- |
| `npm run db:up`       | Start the Postgres container (`:5432`)                    |
| `npm run db:seed`     | Copy `data/todos.json` into Postgres (idempotent)         |
| `npm run db:migrate`  | Start DB + seed in one step                               |
| `npm run db:stop`     | Stop the DB container                                     |
| `npm run db:reset`    | Stop all services and delete the DB volume (data gone)    |

## API

| Method | Path             | Body                                              |
| ------ | ---------------- | ------------------------------------------------- |
| GET    | `/api/todos`     | query: `filter=all\|active\|done`, `priority`, `sort=created\|priority\|due` |
| POST   | `/api/todos`     | `{ "text": "...", "due?": "YYYY-MM-DD", "priority?": "low\|medium\|high" }` |
| PUT    | `/api/todos/:id` | `{ "done"?, "text"?, "due"?, "priority"? }`       |
| DELETE | `/api/todos/:id` | —                                                 |
| GET    | `/health`        | —                                                 |

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `port is already allocated` on up | Another process holds the port → `APP_PORT=3100 docker compose up --build -d` |
| frontend returns `502 Bad Gateway` | backend isn't up yet → `docker compose ps`, `docker compose logs backend` |
| `/health` says `"storage": "file"` | `DATABASE_URL` missing → `docker compose up -d` from the repo root (compose sets it) |
| frontend still shows old JS | browser cache → hard refresh, or `docker compose up --build -d frontend` |
| db not healthy | `docker compose logs db` — usually a leftover volume from another Postgres version → `npm run db:reset` |
| changed nginx routing | `docker compose up --build -d frontend` (config is baked into the image) |

## Files

```
docker-compose.yml   frontend + backend + db services
backend/Dockerfile   Node API image (no static files)
frontend/Dockerfile  Vite build → nginx image
frontend/nginx.conf  Serves SPA, proxies /api + /health to backend
server.js            Express API (also serves dist/ when run locally)
store.js             Storage layer: file store or Postgres store
scripts/seed.js      Imports data/todos.json into Postgres
index.html           Vite entry
vite.config.js       Dev proxy + React plugin
src/                 React app (App.jsx, api.js, styles.css)
data/todos.json      Created at runtime, gitignored
dist/                Build output (gitignored, generated)
```
