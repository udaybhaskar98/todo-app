const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

function createFileStore(dataDir) {
  const file = path.join(dataDir, "todos.json");

  function load() {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return [];
    }
  }

  function save(todos) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(todos, null, 2));
  }

  return {
    kind: "file",
    async init() {},

    async list({ filter = "all", priority, sort = "created" } = {}) {
      let todos = load();
      if (filter === "active") todos = todos.filter((t) => !t.done);
      if (filter === "done") todos = todos.filter((t) => t.done);
      if (priority) todos = todos.filter((t) => t.priority === priority);

      const sorters = {
        created: (a, b) => b.createdAt - a.createdAt,
        priority: (a, b) =>
          (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0) ||
          b.createdAt - a.createdAt,
        due: (a, b) => {
          if (a.due === b.due) return b.createdAt - a.createdAt;
          if (!a.due) return 1;
          if (!b.due) return -1;
          return a.due.localeCompare(b.due);
        },
      };
      return [...todos].sort(sorters[sort] || sorters.created);
    },

    async insert(todo) {
      const todos = load();
      todos.push(todo);
      save(todos);
      return todo;
    },

    async update(id, changes) {
      const todos = load();
      const todo = todos.find((t) => t.id === id);
      if (!todo) return null;
      Object.assign(todo, changes);
      save(todos);
      return todo;
    },

    async remove(id) {
      const todos = load();
      const next = todos.filter((t) => t.id !== id);
      if (next.length === todos.length) return false;
      save(next);
      return true;
    },
  };
}

function createPgStore(connectionString) {
  const pool = new Pool({ connectionString });

  function toTodo(row) {
    return {
      id: row.id,
      text: row.text,
      done: row.done,
      priority: row.priority,
      due: row.due,
      createdAt: Number(row.created_at),
    };
  }

  return {
    kind: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id         TEXT PRIMARY KEY,
          text       TEXT NOT NULL,
          done       BOOLEAN NOT NULL DEFAULT false,
          priority   TEXT NOT NULL DEFAULT 'medium',
          due        TEXT,
          created_at BIGINT NOT NULL
        )
      `);
    },

    async list({ filter = "all", priority, sort = "created" } = {}) {
      const where = [];
      const params = [];
      if (filter === "active") {
        params.push(false);
        where.push(`done = $${params.length}`);
      }
      if (filter === "done") {
        params.push(true);
        where.push(`done = $${params.length}`);
      }
      if (priority) {
        params.push(priority);
        where.push(`priority = $${params.length}`);
      }

      const orderBy = {
        created: `created_at DESC`,
        priority: `CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, created_at DESC`,
        due: `(due IS NULL) ASC, due ASC, created_at DESC`,
      }[sort] || `created_at DESC`;

      const sql = `SELECT * FROM todos ${
        where.length ? `WHERE ${where.join(" AND ")}` : ""
      } ORDER BY ${orderBy}`;
      const { rows } = await pool.query(sql, params);
      return rows.map(toTodo);
    },

    async insert(todo) {
      const { rows } = await pool.query(
        `INSERT INTO todos (id, text, done, priority, due, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [todo.id, todo.text, todo.done, todo.priority, todo.due, todo.createdAt]
      );
      return toTodo(rows[0]);
    },

    async update(id, changes) {
      const entries = Object.entries(changes);
      if (!entries.length) return null;
      const params = [];
      const sets = entries.map(([key, value]) => {
        params.push(value);
        return `${key} = $${params.length}`;
      });
      params.push(id);
      const { rows } = await pool.query(
        `UPDATE todos SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params
      );
      return rows.length ? toTodo(rows[0]) : null;
    },

    async remove(id) {
      const { rowCount } = await pool.query(`DELETE FROM todos WHERE id = $1`, [id]);
      return rowCount > 0;
    },
  };
}

module.exports = function createStore({ dataDir, connectionString }) {
  return connectionString
    ? createPgStore(connectionString)
    : createFileStore(dataDir);
};
