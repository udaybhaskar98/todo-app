const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://postgres:dev@localhost:5432/todos";

if (process.argv.includes("--help")) {
  console.log(`Usage: DATABASE_URL=<url> npm run db:seed
Defaults to ${DATABASE_URL} (matches docker-compose.yml).`);
  process.exit(0);
}

const file = path.join(__dirname, "..", "data", "todos.json");

async function main() {
  const todos = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  if (!todos.length) {
    console.log("No todos in data/todos.json, nothing to seed.");
    return;
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  let inserted = 0;
  try {
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
    for (const t of todos) {
      const { rowCount } = await pool.query(
        `INSERT INTO todos (id, text, done, priority, due, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.text, t.done, t.priority || "medium", t.due || null, t.createdAt]
      );
      inserted += rowCount;
    }
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM todos");
    console.log(`Seeded ${inserted} of ${todos.length} todos (table now has ${rows[0].n}).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
