const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const createStore = require("./store");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DIST_DIR = path.join(__dirname, "dist");

const PRIORITIES = ["low", "medium", "high"];

const store = createStore({
  dataDir: DATA_DIR,
  connectionString: process.env.DATABASE_URL,
});

const app = express();
app.use(express.json());

function parsePriority(value) {
  return PRIORITIES.includes(value) ? value : null;
}

function parseDue(value) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.get(
  "/api/todos",
  wrap(async (req, res) => {
    const todos = await store.list({
      filter: req.query.filter,
      priority: parsePriority(req.query.priority),
      sort: req.query.sort,
    });
    res.json(todos);
  })
);

app.post(
  "/api/todos",
  wrap(async (req, res) => {
    const text = (req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    const todo = {
      id: crypto.randomUUID(),
      text,
      done: false,
      priority: parsePriority(req.body.priority) || "medium",
      due: parseDue(req.body.due),
      createdAt: Date.now(),
    };
    res.status(201).json(await store.insert(todo));
  })
);

app.put(
  "/api/todos/:id",
  wrap(async (req, res) => {
    const changes = {};
    if (typeof req.body.done === "boolean") changes.done = req.body.done;
    if (typeof req.body.text === "string" && req.body.text.trim())
      changes.text = req.body.text.trim();
    if (req.body.priority !== undefined) {
      const p = parsePriority(req.body.priority);
      if (p) changes.priority = p;
    }
    if (req.body.due !== undefined) changes.due = parseDue(req.body.due);

    const todo = await store.update(req.params.id, changes);
    if (!todo) return res.status(404).json({ error: "not found" });
    res.json(todo);
  })
);

app.delete(
  "/api/todos/:id",
  wrap(async (req, res) => {
    const ok = await store.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", storage: store.kind });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal error" });
});

store
  .init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Todo app listening on http://localhost:${PORT} (storage: ${store.kind})`
      );
    });
  })
  .catch((err) => {
    console.error("Failed to initialize storage:", err.message);
    process.exit(1);
  });
