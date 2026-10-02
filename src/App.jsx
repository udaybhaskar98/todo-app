import { useEffect, useState } from "react";
import { api, PRIORITIES } from "./api.js";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("created");
  const [error, setError] = useState(null);

  async function load(params = {}) {
    try {
      setTodos(await api.list({ filter, sort, ...params }));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [filter, sort]);

  async function addTodo(todo) {
    try {
      const created = await api.create(todo);
      setTodos((prev) => [created, ...prev]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateTodo(id, patch) {
    try {
      const updated = await api.update(id, patch);
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteTodo(id) {
    try {
      await api.remove(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Todos</h1>
        <p className="count">{todos.length} shown</p>
      </header>

      {error && <div className="error">{error}</div>}

      <form
        className="add-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.target);
          addTodo({
            text: form.get("text"),
            due: form.get("due") || null,
            priority: form.get("priority") || "medium",
          });
          e.target.reset();
        }}
      >
        <input
          className="text-input"
          name="text"
          type="text"
          placeholder="What needs to be done?"
          required
        />
        <input className="date-input" name="due" type="date" />
        <select className="priority-input" name="priority" defaultValue="medium">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit">Add</button>
      </form>

      <div className="toolbar">
        <div className="segmented">
          {["all", "active", "done"].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="created">Newest first</option>
          <option value="priority">By priority</option>
          <option value="due">By due date</option>
        </select>
      </div>

      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id} className={`todo ${todo.done ? "done" : ""}`}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={(e) => updateTodo(todo.id, { done: e.target.checked })}
            />
            <span className="text">{todo.text}</span>
            <input
              className="due"
              type="date"
              value={todo.due || ""}
              onChange={(e) => updateTodo(todo.id, { due: e.target.value || null })}
            />
            <select
              className="priority"
              value={todo.priority}
              onChange={(e) => updateTodo(todo.id, { priority: e.target.value })}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              className="delete"
              onClick={() => deleteTodo(todo.id)}
              aria-label="Delete"
            >
              x
            </button>
          </li>
        ))}
      </ul>
      {todos.length === 0 && <p className="empty">Nothing here yet.</p>}
    </div>
  );
}
