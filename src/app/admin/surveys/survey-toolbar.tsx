"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Group } from "lucide-react";
import { SurveyListClient, ViewToggle, type SurveyItem } from "./survey-list-client";

export type { SurveyItem };

type SortKey = "starts_at" | "title" | "submission_count" | "customer_name";
type GroupKey = "none" | "customer_name" | "status" | "month";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "starts_at", label: "배포일" },
  { key: "title", label: "설문명" },
  { key: "submission_count", label: "응답수" },
  { key: "customer_name", label: "고객사" },
];

const groupOptions: { key: GroupKey; label: string }[] = [
  { key: "none", label: "그룹 없음" },
  { key: "customer_name", label: "고객사" },
  { key: "status", label: "상태" },
  { key: "month", label: "배포월" },
];

const statusLabels: Record<string, string> = {
  active: "진행중",
  closed: "마감",
  draft: "초안",
};

function sortSurveys(surveys: SurveyItem[], key: SortKey, asc: boolean): SurveyItem[] {
  return [...surveys].sort((a, b) => {
    let cmp = 0;
    if (key === "starts_at") {
      cmp = (a.starts_at ?? "").localeCompare(b.starts_at ?? "");
    } else if (key === "title") {
      cmp = a.title.localeCompare(b.title, "ko");
    } else if (key === "submission_count") {
      cmp = a.submission_count - b.submission_count;
    } else if (key === "customer_name") {
      cmp = (a.customer_name ?? "").localeCompare(b.customer_name ?? "", "ko");
    }
    return asc ? cmp : -cmp;
  });
}

function groupSurveys(surveys: SurveyItem[], key: GroupKey): { label: string; items: SurveyItem[] }[] {
  if (key === "none") return [{ label: "", items: surveys }];

  const groups = new Map<string, SurveyItem[]>();

  for (const s of surveys) {
    let groupLabel: string;
    if (key === "customer_name") {
      groupLabel = s.customer_name || "고객사 미지정";
    } else if (key === "status") {
      groupLabel = statusLabels[s.status] || s.status;
    } else {
      // month
      if (s.starts_at) {
        const d = new Date(s.starts_at);
        groupLabel = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      } else {
        groupLabel = "날짜 미정";
      }
    }
    if (!groups.has(groupLabel)) groups.set(groupLabel, []);
    groups.get(groupLabel)!.push(s);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

interface Tab {
  key: string;
  label: string;
  count: number;
}

interface Props {
  surveys: SurveyItem[];
  query: string;
  tabs: Tab[];
  statusFilter: string;
}

export function SurveyToolbar({ surveys, query, tabs, statusFilter }: Props) {
  const [view, setView] = useState<"list" | "card">("list");
  const [sortKey, setSortKey] = useState<SortKey>("starts_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [groupKey, setGroupKey] = useState<GroupKey>("none");

  const sorted = useMemo(() => sortSurveys(surveys, sortKey, sortAsc), [surveys, sortKey, sortAsc]);
  const grouped = useMemo(() => groupSurveys(sorted, groupKey), [sorted, groupKey]);

  function handleSortChange(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <>
      {/* 상태 필터 탭 */}
      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = statusFilter === tab.key;
            const href =
              tab.key === "all"
                ? `/admin/surveys${query ? `?q=${query}` : ""}`
                : `/admin/surveys?status=${tab.key}${query ? `&q=${query}` : ""}`;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                }`}
              >
                {tab.label}
                <span className={`text-xs ${isActive ? "text-stone-400" : "text-stone-400"}`}>
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <form action="/admin/surveys" method="get" className="relative">
            {statusFilter !== "all" && (
              <input type="hidden" name="status" value={statusFilter} />
            )}
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="설문 검색..."
              className="w-56 rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2 text-sm text-stone-700 placeholder-stone-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </form>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* 정렬 + 그룹화 컨트롤 */}
      <div className="flex items-center gap-3 mb-4">
        {/* 정렬 섹션 */}
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1">
            <ArrowUpDown size={11} />
            정렬
          </span>
          <div className="w-px h-4 bg-stone-200" />
          <div className="flex items-center gap-0.5">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleSortChange(opt.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortKey === opt.key
                    ? "bg-teal-50 text-teal-700 border border-teal-200"
                    : "text-stone-500 hover:bg-stone-50"
                }`}
              >
                {opt.label}
                {sortKey === opt.key && (
                  <span className="ml-0.5 text-teal-400">{sortAsc ? "↑" : "↓"}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 그룹 섹션 */}
        <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1">
            <Group size={11} />
            그룹
          </span>
          <div className="w-px h-4 bg-stone-200" />
          <div className="flex items-center gap-0.5">
            {groupOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setGroupKey(opt.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  groupKey === opt.key
                    ? "bg-teal-50 text-teal-700 border border-teal-200"
                    : "text-stone-500 hover:bg-stone-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 그룹별 렌더링 */}
      <div className={groupKey !== "none" ? "space-y-8" : ""}>
        {grouped.map((group, idx) => (
          <div key={group.label || idx}>
            {group.label && (
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-stone-700">{group.label}</h3>
                <span className="text-xs text-stone-400">{group.items.length}건</span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>
            )}
            <SurveyListClient surveys={group.items} query={query} view={view} />
          </div>
        ))}
      </div>
    </>
  );
}
