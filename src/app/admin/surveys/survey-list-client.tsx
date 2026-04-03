"use client";

import { useState, useTransition, useRef } from "react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Eye,
  Send,
  ChartColumn,
  Copy,
  List,
  LayoutGrid,
  Calendar,
  MessageSquare,
  Play,
  Square,
  RotateCcw,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toggleSurveyStatus } from "./actions";
import { duplicateSurvey } from "./[id]/actions";

export function ViewToggle({
  view,
  onChange,
}: {
  view: "list" | "card";
  onChange: (v: "list" | "card") => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
      <button
        onClick={() => onChange("list")}
        className={`rounded-md p-1.5 transition-colors ${
          view === "list"
            ? "bg-stone-900 text-white"
            : "text-stone-400 hover:text-stone-600"
        }`}
        title="리스트 뷰"
      >
        <List size={15} />
      </button>
      <button
        onClick={() => onChange("card")}
        className={`rounded-md p-1.5 transition-colors ${
          view === "card"
            ? "bg-stone-900 text-white"
            : "text-stone-400 hover:text-stone-600"
        }`}
        title="카드 뷰"
      >
        <LayoutGrid size={15} />
      </button>
    </div>
  );
}

export interface SurveyItem {
  id: string;
  title: string;
  status: string;
  education_type: string | null;
  url_token: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  project_name: string | null;
  customer_name: string | null;
  session_name: string | null;
  submission_count: number;
}

const eduTypeConfig: Record<string, { label: string; className: string }> = {
  classroom: { label: "집합", className: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
  remote:    { label: "원격", className: "bg-violet-50 text-violet-700 border border-violet-200" },
  online:    { label: "온라인", className: "bg-cyan-50 text-cyan-700 border border-cyan-200" },
  blended:   { label: "블렌디드", className: "bg-teal-50 text-teal-700 border border-teal-200" },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: { label: "초안", className: "border border-stone-200 text-stone-700 bg-white" },
};

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function DateRange({ starts_at, ends_at }: { starts_at: string | null; ends_at: string | null }) {
  if (!starts_at && !ends_at) return <span className="text-stone-400">미정</span>;
  return (
    <span className="text-[13px] text-stone-600">
      {formatDate(starts_at)}
      <span className="text-stone-300 mx-0.5">~</span>
      {formatDateShort(ends_at)}
    </span>
  );
}

const statusTransitions: Record<string, { label: string; icon: typeof Play; next: "active" | "closed"; className: string }[]> = {
  draft: [
    { label: "오픈으로 전환", icon: Play, next: "active", className: "text-emerald-700 hover:bg-emerald-50" },
  ],
  active: [
    { label: "마감 처리", icon: Square, next: "closed", className: "text-rose-600 hover:bg-rose-50" },
  ],
  closed: [
    { label: "재오픈 (+7일 연장)", icon: RotateCcw, next: "active", className: "text-blue-600 hover:bg-blue-50" },
  ],
};

function StatusDropdown({ surveyId, status }: { surveyId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const badge = statusLabels[status] ?? statusLabels.draft;
  const transitions = statusTransitions[status] ?? [];

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 100);
    }
    setOpen(!open);
  }

  function handleTransition(next: "active" | "closed") {
    startTransition(async () => {
      await toggleSurveyStatus(surveyId, next);
      setOpen(false);
      setFlash(true);
      router.refresh();
      setTimeout(() => setFlash(false), 600);
    });
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-all ${badge.className} ${
          flash ? "ring-2 ring-teal-400 ring-offset-1 scale-105" : ""
        } ${isPending ? "opacity-50" : "hover:ring-1 hover:ring-stone-300"}`}
      >
        {isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        )}
        {badge.label}
      </button>

      {open && transitions.length > 0 && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] min-w-[140px] rounded-lg border border-stone-200 bg-white shadow-lg py-1"
            style={(() => {
              if (!buttonRef.current) return {};
              const rect = buttonRef.current.getBoundingClientRect();
              if (openUpward) {
                return { left: rect.left, bottom: window.innerHeight - rect.top + 4 };
              }
              return { left: rect.left, top: rect.bottom + 4 };
            })()}
          >
            {transitions.map((t) => (
              <button
                key={t.next}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTransition(t.next);
                }}
                disabled={isPending}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition-colors ${t.className} disabled:opacity-50`}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  surveys: SurveyItem[];
  query: string;
  view: "list" | "card";
}

export function SurveyListClient({ surveys, query, view }: Props) {

  if (surveys.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
            <ClipboardList size={24} />
          </div>
        </div>
        <h3 className="text-sm font-medium text-stone-800 mb-1">
          {query ? "검색 결과가 없습니다" : "등록된 설문이 없습니다"}
        </h3>
        <p className="text-sm text-stone-500">
          {query ? "다른 검색어를 시도해 보세요." : "새 설문을 만들어 보세요."}
        </p>
      </div>
    );
  }

  return (
    <div>
      {view === "list" ? (
        <ListView surveys={surveys} />
      ) : (
        <CardView surveys={surveys} />
      )}
    </div>
  );
}

function ListView({ surveys }: { surveys: SurveyItem[] }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-100">
              <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                설문명
              </th>
              <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                구분
              </th>
              <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                고객사 / 프로젝트
              </th>
              <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                상태
              </th>
              <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                배포 기간
              </th>
              <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                응답
              </th>
              <th className="text-left px-5 h-9 text-xs font-medium text-stone-500">
                액션
              </th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((survey) => {
              const status = statusLabels[survey.status] ?? statusLabels.draft;
              return (
                <tr
                  key={survey.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors"
                >
                  <td className="px-5 h-12 max-w-[280px]">
                    <Link
                      href={`/admin/surveys/${survey.id}`}
                      className="text-sm font-medium text-stone-800 hover:text-teal-600 transition-colors line-clamp-1"
                    >
                      {survey.title}
                    </Link>
                  </td>
                  <td className="px-5 h-12 whitespace-nowrap">
                    {survey.education_type && eduTypeConfig[survey.education_type] ? (
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${eduTypeConfig[survey.education_type].className}`}>
                          {eduTypeConfig[survey.education_type].label}
                        </span>
                        {survey.session_name && (
                          <span className="text-[11px] text-stone-400 line-clamp-1">{survey.session_name}</span>
                        )}
                      </div>
                    ) : survey.session_name ? (
                      <span className="text-[11px] text-stone-400">{survey.session_name}</span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-5 h-12">
                    <div className="text-sm text-stone-700 line-clamp-1">
                      {survey.customer_name ?? "-"}
                    </div>
                    {survey.project_name && (
                      <div className="text-[11px] text-stone-400 line-clamp-1">
                        {survey.project_name}
                      </div>
                    )}
                  </td>
                  <td className="px-5 h-12">
                    <StatusDropdown surveyId={survey.id} status={survey.status} />
                  </td>
                  <td className="px-5 h-12 whitespace-nowrap">
                    <DateRange starts_at={survey.starts_at} ends_at={survey.ends_at} />
                  </td>
                  <td className="px-5 h-12">
                    <span className="text-sm font-medium text-stone-700">
                      {survey.submission_count}
                    </span>
                  </td>
                  <td className="px-5 h-12">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/surveys/${survey.id}`}
                        className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                        title="상세 보기"
                      >
                        <Eye size={15} />
                      </Link>
                      {survey.status === "active" && (
                        <Link
                          href="/admin/distribute"
                          className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          title="배포"
                        >
                          <Send size={15} />
                        </Link>
                      )}
                      <DuplicateButton surveyId={survey.id} />
                      {survey.submission_count > 0 && (
                        <Link
                          href={`/admin/responses?survey=${survey.id}`}
                          className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                          title="리포트"
                        >
                          <ChartColumn size={15} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardView({ surveys }: { surveys: SurveyItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {surveys.map((survey) => {
        const status = statusLabels[survey.status] ?? statusLabels.draft;
        return (
          <div
            key={survey.id}
            className="group rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:border-teal-200 transition-all p-5 flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <Link
                href={`/admin/surveys/${survey.id}`}
                className="text-sm font-semibold text-stone-800 group-hover:text-teal-700 transition-colors line-clamp-2 flex-1"
              >
                {survey.title}
              </Link>
              <div className="shrink-0">
                <StatusDropdown surveyId={survey.id} status={survey.status} />
              </div>
            </div>

            {(survey.education_type || survey.session_name) && (
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {survey.education_type && eduTypeConfig[survey.education_type] && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${eduTypeConfig[survey.education_type].className}`}>
                    {eduTypeConfig[survey.education_type].label}
                  </span>
                )}
                {survey.session_name && (
                  <span className="text-[11px] text-stone-500">{survey.session_name}</span>
                )}
              </div>
            )}

            {(survey.customer_name || survey.project_name) && (
              <p className="text-[13px] text-stone-500 mb-3 line-clamp-1">
                {survey.customer_name}
                {survey.project_name && (
                  <span className="text-stone-400"> · {survey.project_name}</span>
                )}
              </p>
            )}

            <div className="mt-auto pt-3 border-t border-stone-100 flex items-center justify-between text-[12px] text-stone-500">
              <div className="flex items-center gap-1">
                <Calendar size={12} className="text-stone-400" />
                <DateRange starts_at={survey.starts_at} ends_at={survey.ends_at} />
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare size={12} className="text-stone-400" />
                <span className="font-medium text-stone-700">{survey.submission_count}</span>
                <span>응답</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DuplicateButton({ surveyId }: { surveyId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          try {
            const newId = await duplicateSurvey(surveyId);
            router.push(`/admin/surveys/${newId}`);
          } catch (err) {
            alert(err instanceof Error ? err.message : "복제 실패");
          }
        });
      }}
      disabled={isPending}
      className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50"
      title="설문 복제"
    >
      {isPending ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
    </button>
  );
}
