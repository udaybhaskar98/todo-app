# Todo App

A todo app with due dates & priorities, built to learn deployment.

## Stack

| Layer    | Tech                              |
| -------- | --------------------------------- |
| Backend  | Node.js + Express                 |
| Frontend | React (Vite), served from `dist/` |
| Storage  | JSON file OR Postgres (see below) |

## Run it

```bash
npm install
npm run dev        # dev server (Vite on :5173, proxies /api to :3000)
# in another terminal:
npm start          # API + built frontend on :3000
```

Production build for deployment:

```bash
npm run build      # outputs static frontend to dist/
npm start          # Express serves API + dist/ on PORT (default 3000)
```

## Run with Docker

Build the production image and run it with a named volume so JSON todos persist
when the container is recreated:

```bash
docker build -t todo-app .
docker run --name todo-app -p 3000:3000 -v todo-data:/app/data todo-app
```

Open http://localhost:3000. Stop and remove the container with:

```bash
docker stop todo-app
docker rm todo-app
```

To use Postgres instead of the JSON file store, pass `DATABASE_URL` when starting
the app. The Postgres container must be reachable from the app container, so use
a shared Docker network:

```bash
docker network create todo-network
docker run -d --name todo-db --network todo-network \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=todos postgres
docker run --name todo-app --network todo-network -p 3000:3000 \
  -e DATABASE_URL=postgres://postgres:dev@todo-db:5432/todos todo-app
```

Env vars: `PORT` (default 3000), `DATA_DIR` (default `./data`),
`DATABASE_URL` (optional — see storage).

## Storage

Two backends, chosen automatically:

- **JSON file** (default): no env vars set → `data/todos.json`.
- **Postgres**: set `DATABASE_URL` (e.g. `postgres://user:pass@host:5432/db`)
  → a `todos` table is created on startup and used instead.

`/health` reports which backend is active: `{ "status": "ok", "storage": "file" | "postgres" }`.

Local Postgres to try it:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=todos postgres
DATABASE_URL=postgres://postgres:dev@localhost:5432/todos npm start
```

## API

| Method | Path             | Body                                              |
| ------ | ---------------- | ------------------------------------------------- |
| GET    | `/api/todos`     | query: `filter=all\|active\|done`, `priority`, `sort=created\|priority\|due` |
| POST   | `/api/todos`     | `{ "text": "...", "due?": "YYYY-MM-DD", "priority?": "low\|medium\|high" }` |
| PUT    | `/api/todos/:id` | `{ "done"?, "text"?, "due"?, "priority"? }`       |
| DELETE | `/api/todos/:id` | —                                                 |
| GET    | `/health`        | —                                                 |

## Files

```
server.js            Express API (also serves built frontend)
store.js             Storage layer: file store or Postgres store
index.html           Vite entry
vite.config.js       Dev proxy + React plugin
src/                 React app (App.jsx, api.js, styles.css)
data/todos.json      Created at runtime, gitignored
dist/                Build output (gitignored, generated)
```
