import React, { useEffect, useMemo, useState } from "react";

// =============================================================
// 🗓️ Daily Planner (30-minute slots + priority tags)
// =============================================================
// ✅ Features:
// - 48 half-hour slots per day (00:00–23:30)
// - Add quick notes or timeframe tasks
// - Priority tags: Urgent / High / Normal / Low
// - Filter by priority
// - Saves automatically in browser localStorage
// =============================================================

// ---------- Helpers ----------
function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const PRIORITIES = ["urgent", "high", "normal", "low"];
const PRIORITY_META = {
  urgent: {
    label: "Urgent",
    badge: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  high: {
    label: "High",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  normal: {
    label: "Normal",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  low: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
};

const SLOT_TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function clampTimeToSlots(t) {
  let [h, m] = t.split(":").map(Number);
  if (m >= 30) m = 30;
  else m = 0;
  h = Math.max(0, Math.min(23, h));
  if (h === 23 && m === 30) return "23:30";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function betweenInclusive(t, start, end) {
  const tm = toMinutes(t);
  return tm >= toMinutes(start) && tm <= toMinutes(end);
}

function useCoverage(tasks) {
  return useMemo(() => {
    const cover = Object.fromEntries(SLOT_TIMES.map((t) => [t, []]));
    tasks.forEach((task) => {
      SLOT_TIMES.forEach((slot) => {
        if (betweenInclusive(slot, task.start, task.end)) {
          cover[slot].push(task.id);
        }
      });
    });
    return cover;
  }, [tasks]);
}

// ---------- Storage ----------
function useDayData(selectedDate) {
  const key = `dailyPlanner:${dateKey(selectedDate)}`;
  const [data, setData] = useState({ tasks: [], notes: [] });

  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch {
        setData({ tasks: [], notes: [] });
      }
    } else {
      setData({ tasks: [], notes: [] });
    }
  }, [key]);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(data));
  }, [key, data]);

  return [data, setData];
}

// ---------- Component ----------
export default function DailyPlanner() {
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [data, setData] = useDayData(date);
  const coverage = useCoverage(data.tasks);

  const [inlineEdit, setInlineEdit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    start: "09:00",
    end: "10:00",
    color: "#c7d2fe",
    priority: "normal",
  });

  function addNote({ time, title, priority }) {
    const note = { id: makeId(), time, title, priority };
    setData((d) => ({ ...d, notes: [...d.notes, note] }));
  }

  function addTask() {
    if (!taskDraft.title) return;
    const start = clampTimeToSlots(taskDraft.start);
    const end = clampTimeToSlots(taskDraft.end);
    const normalized = {
      id: makeId(),
      title: taskDraft.title.trim(),
      description: taskDraft.description?.trim() || "",
      start,
      end,
      color: taskDraft.color || "#c7d2fe",
      priority: taskDraft.priority || "normal",
    };
    setData((d) => ({ ...d, tasks: [...d.tasks, normalized] }));
    setShowModal(false);
  }

  function removeTask(id) {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }

  function removeNote(id) {
    setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
  }

  function clearDay() {
    if (!confirm("Clear all tasks & notes for this day?")) return;
    setData({ tasks: [], notes: [] });
  }

  function taskVisible(task) {
    return priorityFilter === "all" || task.priority === priorityFilter;
  }

  function noteVisible(note) {
    return priorityFilter === "all" || note.priority === priorityFilter;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
  <h1 className="text-2xl font-semibold">Daily Planner</h1>

  {/* ✅ Add this clock below */}
  <p className="text-xs text-gray-600">
    Dhaka Time:{" "}
    {new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Dhaka",
    }).format(new Date())}
  </p>

  <span className="text-xs text-gray-500">30-minute slots</span>
</div>


        <div className="flex flex-wrap items-center gap-2">
          {/* Priority filter */}
          <div className="flex items-center gap-1 rounded-xl border px-1 py-1 bg-white">
            {["all", ...PRIORITIES].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`text-xs px-2 py-1 rounded-lg border ${
                  priorityFilter === p
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {p === "all" ? "All" : PRIORITY_META[p].label}
              </button>
            ))}
          </div>

          <input
            type="date"
            className="rounded-lg border px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button
            onClick={() => setShowModal(true)}
            className="rounded-2xl px-4 py-2 text-sm font-medium shadow-sm border bg-white hover:bg-gray-50"
          >
            + Add Task
          </button>

          <button
            onClick={clearDay}
            className="rounded-2xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 border"
          >
            Clear Day
          </button>
        </div>
      </div>

      {/* Timeline grid */}
      <div className="grid grid-cols-[80px_1fr] rounded-2xl overflow-hidden border shadow-sm">
        {/* Timeline column (12-hour time) */}
<div className="bg-gray-50 border-r">
  {SLOT_TIMES.map((t) => {
    // Convert 24h -> 12h
    let [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const label = `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
    return (
      <div
        key={t}
        className="h-12 px-2 flex items-center justify-end text-xs text-gray-500"
        title={t}
      >
        {label}
      </div>
    );
  })}
</div>

        {/* Slots */}
        <div>
          {SLOT_TIMES.map((t) => {
            const taskIdsAtTime = coverage[t];
            const tasksAtTime = taskIdsAtTime
              .map((id) => data.tasks.find((x) => x.id === id))
              .filter(Boolean)
              .filter(taskVisible);

            const notesAtTime = data.notes.filter(
              (n) => n.time === t && noteVisible(n)
            );

            return (
              <div
                key={t}
                className="h-12 px-3 py-2 border-b bg-white hover:bg-indigo-50/60 relative"
                onClick={() =>
                  setInlineEdit({ time: t, title: "", priority: "normal" })
                }
              >
                {/* Task backgrounds */}
                {tasksAtTime.map((task) => (
                  <div
                    key={task.id}
                    className="absolute inset-0 opacity-30"
                    style={{ background: task.color }}
                  />
                ))}

                <div className="relative z-10 flex flex-col gap-1">
                  {/* Tasks */}
                  {tasksAtTime.map((task) =>
                    t === task.start ? (
                      <div
                        key={task.id}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="inline-flex items-center gap-2 rounded px-2 py-0.5 text-xs font-medium border bg-white/80 backdrop-blur">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 border ${PRIORITY_META[task.priority].badge}`}
                          >
                            {PRIORITY_META[task.priority].label}
                          </span>
                          {task.title}{" "}
                          <span className="text-gray-500">
                            ({task.start}–{task.end})
                          </span>
                        </span>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTask(task.id);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null
                  )}

                  {/* Notes */}
                  {notesAtTime.map((n) => (
                    <div key={n.id} className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded px-2 py-0.5 text-xs font-medium border bg-white/90">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 border ${PRIORITY_META[n.priority].badge}`}
                        >
                          {PRIORITY_META[n.priority].label}
                        </span>
                        {n.title}
                      </span>
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNote(n.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {/* Inline add note */}
                  {inlineEdit?.time === t && (
                    <div className="mt-1 flex flex-col sm:flex-row gap-2 items-start">
                      <input
                        autoFocus
                        placeholder="Note title"
                        className="w-full sm:w-48 rounded border px-2 py-1 text-xs"
                        value={inlineEdit.title}
                        onChange={(e) =>
                          setInlineEdit((s) => ({
                            ...s,
                            title: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (!inlineEdit.title.trim()) return;
                            addNote({
                              time: t,
                              title: inlineEdit.title.trim(),
                              priority: inlineEdit.priority,
                            });
                            setInlineEdit(null);
                          }
                          if (e.key === "Escape") setInlineEdit(null);
                        }}
                      />
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        value={inlineEdit.priority}
                        onChange={(e) =>
                          setInlineEdit((s) => ({
                            ...s,
                            priority: e.target.value,
                          }))
                        }
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {PRIORITY_META[p].label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded px-3 py-1 text-xs border bg-white hover:bg-gray-50"
                        onClick={() => {
                          if (!inlineEdit.title.trim()) return;
                          addNote({
                            time: t,
                            title: inlineEdit.title.trim(),
                            priority: inlineEdit.priority,
                          });
                          setInlineEdit(null);
                        }}
                      >
                        Add
                      </button>
                      <button
                        className="text-xs text-gray-500 hover:underline"
                        onClick={() => setInlineEdit(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Task Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Add Task</h2>
              <button
                className="text-sm text-gray-500 hover:underline"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Title</label>
                <input
                  className="rounded border px-3 py-2 text-sm w-full"
                  value={taskDraft.title}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Priority</label>
                <select
                  className="rounded border px-3 py-2 text-sm w-full"
                  value={taskDraft.priority}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, priority: e.target.value }))
                  }
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Start</label>
                <input
                  type="time"
                  step="1800"
                  className="rounded border px-3 py-2 text-sm w-full"
                  value={taskDraft.start}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, start: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">End</label>
                <input
                  type="time"
                  step="1800"
                  className="rounded border px-3 py-2 text-sm w-full"
                  value={taskDraft.end}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, end: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-600">Description</label>
                <textarea
                  rows={3}
                  className="rounded border px-3 py-2 text-sm w-full"
                  value={taskDraft.description}
                  onChange={(e) =>
                    setTaskDraft((s) => ({
                      ...s,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-600">Color</label>
                <input
                  type="color"
                  className="h-10 w-16 rounded"
                  value={taskDraft.color}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, color: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-2xl px-4 py-2 text-sm border"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-2xl px-4 py-2 text-sm border bg-gray-900 text-white"
                onClick={addTask}
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
