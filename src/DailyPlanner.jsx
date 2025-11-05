import React, { useEffect, useMemo, useState } from "react";

/*
  Daily Planner – 30-minute slots + priorities + sidebar list
  - 12h AM/PM display
  - Dhaka live clock
  - Sidebar shows today’s tasks (click to jump)
  - LocalStorage per-day persistence
*/

// ---------- Constants & helpers ----------
const DEFAULT_TZ = "Asia/Dhaka";

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
    label: "Important", // label shows as 'Important'
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

function to12hLabel(hhmm) {
  let [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
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

// ---------- Local storage by date ----------
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

  // UI state
  const [inlineEdit, setInlineEdit] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Task draft for modal
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    start: "09:00",
    end: "10:00",
    color: "#c7d2fe",
    priority: "normal",
  });

  // Dhaka clock
  const [timeZone] = useState(DEFAULT_TZ);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000); // tick every 30s
    return () => clearInterval(id);
  }, []);

  // Sidebar: sorted task list (by start)
  const tasksToday = useMemo(
    () =>
      [...data.tasks].sort((a, b) => {
        const toMin = (t) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };
        return toMin(a.start) - toMin(b.start);
      }),
    [data.tasks]
  );

  // Actions
  function addNote({ time, title, priority }) {
    if (!title?.trim()) return;
    const note = { id: makeId(), time, title: title.trim(), priority };
    setData((d) => ({ ...d, notes: [...d.notes, note] }));
  }

  function addTask() {
    if (!taskDraft.title?.trim()) return;
    const start = clampTimeToSlots(taskDraft.start);
    const end = clampTimeToSlots(taskDraft.end);
    const [s, e] = [toMinutes(start), toMinutes(end)].sort((a, b) => a - b);
    const normalized = {
      id: makeId(),
      title: taskDraft.title.trim(),
      description: taskDraft.description?.trim() || "",
      start: `${String(Math.floor(s / 60)).padStart(2, "0")}:${s % 60 === 30 ? "30" : "00"}`,
      end: `${String(Math.floor(e / 60)).padStart(2, "0")}:${e % 60 === 30 ? "30" : "00"}`,
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

  function scrollToSlot(hhmm) {
    const el = document.getElementById(`slot-${hhmm}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Daily Planner</h1>
          <span className="text-xs text-gray-500">30-minute slots</span>

          {/* Live Dhaka clock */}
          <span className="ml-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-white">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone,
            }).format(now)}{" "}
            ({timeZone})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Priority filter chips */}
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

      {/* Main grid: Sidebar | Time | Slots */}
      <div className="grid grid-cols-[260px_80px_1fr] rounded-2xl overflow-hidden border shadow-sm">
        {/* Sidebar: Task list */}
        <div className="bg-white border-r p-3 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Today’s Tasks</h3>
            <span className="text-xs text-gray-500">{tasksToday.length}</span>
          </div>

          {tasksToday.length === 0 ? (
            <p className="text-xs text-gray-500">No tasks yet. Add one →</p>
          ) : (
            <ol className="list-decimal list-inside space-y-1">
              {tasksToday.map((t) => (
                <li key={t.id} className="text-sm">
                  <button
                    className="text-left hover:underline"
                    onClick={() => scrollToSlot(t.start)}
                    title={`${t.start}–${t.end}`}
                  >
                    {t.title}{" "}
                    <span
                      className={`ml-1 inline-block text-[11px] px-1.5 py-0.5 rounded border ${PRIORITY_META[t.priority].badge}`}
                    >
                      {PRIORITY_META[t.priority].label}
                    </span>
                    <span className="ml-1 text-xs text-gray-500">
                      {to12hLabel(t.start)}–{to12hLabel(t.end)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Time column (12-hour display) */}
        <div className="bg-gray-50 border-r">
          {SLOT_TIMES.map((t) => (
            <div
              key={t}
              className="h-12 px-2 flex items-center justify-end text-xs text-gray-500"
              title={t} // tooltip shows 24h
            >
              {to12hLabel(t)}
            </div>
          ))}
        </div>

        {/* Slots column */}
        <div className="relative">
          {SLOT_TIMES.map((t) => {
            const tasksAtTime = coverage[t]
              .map((id) => data.tasks.find((x) => x.id === id))
              .filter(Boolean)
              .filter(taskVisible);

            const notesAtTime = data.notes.filter(
              (n) => n.time === t && noteVisible(n)
            );

            return (
              <div
                id={`slot-${t}`}
                key={t}
                className="h-12 px-3 py-2 border-b bg-white hover:bg-indigo-50/60 relative"
                onClick={() =>
                  setInlineEdit({ time: t, title: "", priority: "normal" })
                }
              >
                {/* Task coverage backgrounds */}
                {tasksAtTime.length > 0 && (
                  <div className="absolute inset-0 -z-0">
                    {tasksAtTime.map((task) => (
                      <div
                        key={task.id}
                        className="absolute inset-0 opacity-40"
                        style={{ background: task.color }}
                      />
                    ))}
                  </div>
                )}

                {/* Foreground content */}
                <div className="relative z-10 flex flex-col gap-1">
                  {/* Task labels (only on start slot) */}
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
                            ({to12hLabel(task.start)}–{to12hLabel(task.end)})
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

                  {/* Inline quick note */}
                  {inlineEdit?.time === t && (
                    <div className="mt-1 flex flex-col sm:flex-row gap-2 items-start">
                      <input
                        autoFocus
                        placeholder="Note title"
                        className="w-full sm:w-48 rounded border px-2 py-1 text-xs"
                        value={inlineEdit.title}
                        onChange={(e) =>
                          setInlineEdit((s) => ({ ...s, title: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (!inlineEdit.title.trim()) return;
                            addNote({
                              time: t,
                              title: inlineEdit.title.trim(),
                              priority: inlineEdit.priority || "normal",
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
                          if (!inlineEdit.title?.trim()) return;
                          addNote({
                            time: t,
                            title: inlineEdit.title.trim(),
                            priority: inlineEdit.priority || "normal",
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
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">Title</label>
                <input
                  className="rounded border px-3 py-2 text-sm"
                  value={taskDraft.title}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, title: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">Priority</label>
                <select
                  className="rounded border px-3 py-2 text-sm"
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
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">Start</label>
                <input
                  type="time"
                  step="1800"
                  className="rounded border px-3 py-2 text-sm"
                  value={taskDraft.start}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, start: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">End</label>
                <input
                  type="time"
                  step="1800"
                  className="rounded border px-3 py-2 text-sm"
                  value={taskDraft.end}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, end: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-gray-600">Description (optional)</label>
                <textarea
                  rows={3}
                  className="rounded border px-3 py-2 text-sm"
                  value={taskDraft.description}
                  onChange={(e) =>
                    setTaskDraft((s) => ({ ...s, description: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
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
