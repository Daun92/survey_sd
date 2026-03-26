"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { SurveyListClient, ViewToggle, type SurveyItem } from "./survey-list-client";

export type { SurveyItem };

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

  return (
    <>
      {/* 필터 탭 + 검색 + 뷰 토글 — 한 줄 */}
      <div className="flex items-center justify-between mb-4 gap-4">
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

      <SurveyListClient surveys={surveys} query={query} view={view} />
    </>
  );
}
