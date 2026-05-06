"use client";

import { useState, useEffect, useRef } from "react";

const CATEGORIES = ["仕事", "個人", "買い物"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_STYLE: Record<Category, { badge: string; filter: string }> = {
  仕事: { badge: "bg-blue-100 text-blue-700", filter: "bg-blue-100 text-blue-700 border-blue-300" },
  個人: { badge: "bg-green-100 text-green-700", filter: "bg-green-100 text-green-700 border-green-300" },
  買い物: { badge: "bg-yellow-100 text-yellow-700", filter: "bg-yellow-100 text-yellow-700 border-yellow-300" },
};

type Task = {
  id: string;
  text: string;
  completed: boolean;
  deadline?: string;
  category?: Category;
};

type EditState = {
  text: string;
  deadline: string;
  category: Category | "";
};

function isOverdue(deadline?: string, completed?: boolean) {
  if (!deadline || completed) return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}

function formatDeadline(deadline: string) {
  const d = new Date(deadline);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [filter, setFilter] = useState<Category | "すべて">("すべて");
  const [sort, setSort] = useState<"none" | "asc" | "desc">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ text: "", deadline: "", category: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const enterCountRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("tasks");
    if (saved) setTasks(JSON.parse(saved));
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    setTasks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
        deadline: deadline || undefined,
        category: category || undefined,
      },
    ]);
    setInput("");
    setDeadline("");
    setCategory("");
    inputRef.current?.focus();
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditState({
      text: task.text,
      deadline: task.deadline ?? "",
      category: task.category ?? "",
    });
  };

  const saveEdit = () => {
    const text = editState.text.trim();
    if (!text) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === editingId
          ? {
              ...t,
              text,
              deadline: editState.deadline || undefined,
              category: editState.category || undefined,
            }
          : t
      )
    );
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const visibleTasks = (() => {
    const filtered = filter === "すべて" ? tasks : tasks.filter((t) => t.category === filter);
    if (sort === "none") return filtered;
    return [...filtered].sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return sort === "asc" ? da - db : db - da;
    });
  })();

  const completed = tasks.filter((t) => t.completed).length;
  const remaining = tasks.length - completed;

  if (!mounted) return null;

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="flex items-end justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">タスク管理</h1>
        {tasks.length > 0 && (
          <span className="text-sm text-gray-500">
            完了{" "}
            <span className="font-semibold text-green-600">{completed}</span>
            {" "}/ {tasks.length} 件
          </span>
        )}
      </div>

      {/* 入力欄 */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") { enterCountRef.current = 0; return; }
              enterCountRef.current += 1;
              if (enterCountRef.current >= 2) { enterCountRef.current = 0; addTask(); }
            }}
            placeholder="新しいタスクを入力..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={addTask}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            追加
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">カテゴリ：</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "")}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">なし</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">期限：</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* フィルター・並び替え */}
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(["すべて", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === c
                  ? c === "すべて"
                    ? "bg-gray-700 text-white border-gray-700"
                    : `${CATEGORY_STYLE[c as Category].filter} border`
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSort((s) => s === "asc" ? "desc" : s === "desc" ? "none" : "asc")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
            sort !== "none"
              ? "bg-gray-700 text-white border-gray-700"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
          }`}
        >
          {sort === "asc" ? "期限 昇順 ↑" : sort === "desc" ? "期限 降順 ↓" : "並び替え"}
        </button>
      </div>

      {/* タスク一覧 */}
      {visibleTasks.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">タスクがありません</p>
      ) : (
        <ul className="space-y-2">
          {visibleTasks.map((task) => {
            const overdue = isOverdue(task.deadline, task.completed);
            const isEditing = editingId === task.id;

            return (
              <li
                key={task.id}
                className={`rounded-lg px-4 py-3 shadow-sm border ${
                  isEditing
                    ? "bg-blue-50 border-blue-300"
                    : overdue
                    ? "bg-red-50 border-red-300"
                    : "bg-white border-gray-200"
                }`}
              >
                {isEditing ? (
                  /* 編集モード */
                  <div className="flex flex-col gap-2">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editState.text}
                      onChange={(e) => setEditState((s) => ({ ...s, text: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 whitespace-nowrap">カテゴリ：</label>
                        <select
                          value={editState.category}
                          onChange={(e) => setEditState((s) => ({ ...s, category: e.target.value as Category | "" }))}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="">なし</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 whitespace-nowrap">期限：</label>
                        <input
                          type="date"
                          value={editState.deadline}
                          onChange={(e) => setEditState((s) => ({ ...s, deadline: e.target.value }))}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-xs text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 通常表示モード */
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm ${
                            task.completed
                              ? "line-through text-gray-400"
                              : overdue
                              ? "text-red-700 font-medium"
                              : "text-gray-700"
                          }`}
                        >
                          {task.text}
                        </span>
                        {task.category && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[task.category].badge}`}>
                            {task.category}
                          </span>
                        )}
                      </div>
                      {task.deadline && (
                        <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                          {overdue ? "⚠ 期限切れ " : ""}期限：{formatDeadline(task.deadline)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(task)}
                      className="text-gray-300 hover:text-blue-400 transition-colors flex-shrink-0"
                      aria-label="編集"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* フッター */}
      {tasks.length > 0 && (
        <p className="text-right text-xs text-gray-400 mt-4">
          残り {remaining} / {tasks.length} 件
        </p>
      )}
    </main>
  );
}
