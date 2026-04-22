"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, MessageSquare, LayoutGrid, List } from "lucide-react";

interface SurveyWithResponses {
  id: string;
  title: string;
  status: string;
  session_name: string | null;
  session_capacity: number | null;
  /** 배포 대상 전체 수 (pending 포함) — "응답률" 의 분모 */
  distribution_count: number;
  /** 열람(= opened/started/completed) 한 대상자 수 — 응답률과 분리된 참고 지표 */
  engaged_count: number;
  course_name: string | null;
  project_name: string | null;
  submission_count: number;
  avg_score: number | null;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
};

/**
 * 응답률 = 응답 / 배포(전체 distributions).
 * 배포가 없으면 세션 정원 fallback. 둘 다 없으면 null.
 * "열람 대비 응답률" 은 별도 지표로 카드 보조 영역에 표시.
 */
function computeResponseStats(s: SurveyWithResponses): {
  rate: number | null;
  denom: number | null;
  denomSource: "distributions" | "capacity";
} {
  if (s.distribution_count > 0) {
    return {
      rate: Math.round((s.submission_count / s.distribution_count) * 100),
      denom: s.distribution_count,
      denomSource: "distributions",
    };
  }
  if (s.session_capacity && s.session_capacity > 0) {
    return {
      rate: Math.round((s.submission_count / s.session_capacity) * 100),
      denom: s.session_capacity,
      denomSource: "capacity",
    };
  }
  return { rate: null, denom: null, denomSource: "capacity" };
}

function SurveyTags({ survey }: { survey: SurveyWithResponses }) {
  const tags: { label: string; className: string }[] = [];
  if (survey.project_name) tags.push({ label: survey.project_name, className: "bg-stone-100 text-stone-600" });
  if (survey.course_name) tags.push({ label: survey.course_name, className: "bg-indigo-50 text-indigo-600" });
  if (survey.session_name) tags.push({ label: survey.session_name, className: "bg-teal-50 text-teal-600" });
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((t, i) => (
        <span key={i} className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${t.className}`}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

export default function ResponsesView({ surveys }: { surveys: SurveyWithResponses[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">응답 및 리포트</h1>
          <p className="text-sm text-stone-500 mt-1">수집된 설문 응답을 확인하고 분석하세요</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
            title="그리드 보기"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
            title="리스트 보기"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {surveys.map((survey) => {
            const status = statusLabels[survey.status] ?? statusLabels.closed;
            const { rate: responseRate, denom, denomSource } = computeResponseStats(survey);

            return (
              <div key={survey.id} className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-1">
                    <div className="min-w-0 flex-1 pr-2">
                      <h3 className="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">
                        {survey.title}
                      </h3>
                      <SurveyTags survey={survey} />
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">응답 수</p>
                      <p className="text-lg font-bold text-stone-800">
                        {survey.submission_count}<span className="text-xs font-normal text-stone-400 ml-0.5">건</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">평균 점수</p>
                      <p className="text-lg font-bold text-teal-600">
                        {survey.avg_score !== null ? survey.avg_score.toFixed(1) : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-stone-500">응답률 (응답 / 배포)</span>
                      <span className="text-xs font-medium text-stone-700">
                        {responseRate !== null ? `${responseRate}%` : "-"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{ width: `${responseRate !== null ? Math.min(responseRate, 100) : 0}%` }}
                      />
                    </div>
                    {denomSource === "distributions" ? (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-stone-500">
                        <span>
                          배포 <span className="font-medium text-stone-700">{survey.distribution_count}</span>
                        </span>
                        <span className="text-stone-300">·</span>
                        <span>
                          열람 <span className="font-medium text-stone-700">{survey.engaged_count}</span>
                        </span>
                        <span className="text-stone-300">·</span>
                        <span>
                          응답 <span className="font-medium text-stone-700">{survey.submission_count}</span>
                        </span>
                      </div>
                    ) : (
                      denom !== null && (
                        <p className="text-[11px] text-stone-400 mt-1">
                          {survey.submission_count} / {denom}명 정원
                        </p>
                      )
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-stone-100">
                    <Link
                      href={`/admin/responses/${survey.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-50 transition-colors flex-1 justify-center"
                    >
                      <Eye size={14} /> 응답 보기
                    </Link>
                    <Link
                      href={`/admin/reports?survey=${survey.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-teal-700 transition-colors flex-1 justify-center"
                    >
                      <MessageSquare size={14} /> 리포트
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 text-stone-500 font-medium">설문</th>
                <th className="text-left px-4 py-3 text-stone-500 font-medium w-24">상태</th>
                <th className="text-right px-4 py-3 text-stone-500 font-medium w-20">응답</th>
                <th className="text-right px-4 py-3 text-stone-500 font-medium w-20">평균</th>
                <th className="text-right px-4 py-3 text-stone-500 font-medium w-24">응답률</th>
                <th className="text-center px-4 py-3 text-stone-500 font-medium w-28"></th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((survey) => {
                const status = statusLabels[survey.status] ?? statusLabels.closed;
                const { rate: responseRate, denom, denomSource } = computeResponseStats(survey);

                return (
                  <tr key={survey.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-stone-800">{survey.title}</p>
                      <SurveyTags survey={survey} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">
                      {survey.submission_count}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-teal-600">
                      {survey.avg_score !== null ? survey.avg_score.toFixed(1) : "-"}
                    </td>
                    <td
                      className="px-4 py-3 text-right text-stone-600"
                      title={
                        denomSource === "distributions"
                          ? `배포 ${survey.distribution_count} · 열람 ${survey.engaged_count} · 응답 ${survey.submission_count}`
                          : denom !== null
                            ? `${survey.submission_count} / ${denom}명 정원`
                            : undefined
                      }
                    >
                      {responseRate !== null ? `${responseRate}%` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/admin/responses/${survey.id}`}
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                          title="응답 보기"
                        >
                          <Eye size={15} />
                        </Link>
                        <Link
                          href={`/admin/reports?survey=${survey.id}`}
                          className="p-1.5 text-teal-500 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"
                          title="리포트"
                        >
                          <MessageSquare size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
