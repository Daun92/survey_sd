"use client";

import { useState } from "react";
import { Clock } from "lucide-react";

type ActivityKind = "opened" | "responded";
export type ActivityItem = { at: string; kind: ActivityKind; text: string };

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

const FILTERS: { key: "all" | ActivityKind; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "opened", label: "열람" },
  { key: "responded", label: "응답" },
];

const DISPLAY_LIMIT = 5;

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = useState<"all" | ActivityKind>("all");

  const filtered = (filter === "all" ? items : items.filter((i) => i.kind === filter)).slice(
    0,
    DISPLAY_LIMIT,
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="p-5 pb-0 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
          <Clock size={14} className="text-stone-500" />
          최근 활동
        </h3>
        <div className="flex items-center gap-0.5 rounded-lg bg-stone-100 p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors ${
                filter === f.key
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 pt-3">
        {filtered.length === 0 ? (
          <div className="py-2 text-xs text-stone-400">표시할 활동이 없습니다</div>
        ) : (
          <div className="space-y-0">
            {filtered.map((a, idx) => (
              <div
                key={`${a.kind}-${a.at}-${idx}`}
                className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0"
              >
                <span className="text-[11px] text-stone-400 w-16 flex-shrink-0">
                  {formatRelativeTime(a.at)}
                </span>
                <span className="text-sm text-stone-600">{a.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
