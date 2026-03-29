import { createClient } from "@/lib/supabase/server";
import {
  FileSearch,
  Calendar,
  Users,
  Target,
  CheckCircle,
} from "lucide-react";
import { HrdRoundActions } from "./round-actions";

export const revalidate = 60;

const statusLabels: Record<string, { label: string; className: string }> = {
  collecting: { label: "수집 중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "수집 완료", className: "bg-rose-100 text-rose-800" },
  draft: {
    label: "준비중",
    className: "border border-stone-200 text-stone-700",
  },
  analyzing: { label: "분석 중", className: "bg-amber-100 text-amber-800" },
  published: { label: "발행 완료", className: "bg-blue-100 text-blue-800" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getData() {
  const supabase = await createClient();
  const { data: rounds } = await supabase
    .from("hrd_survey_rounds")
    .select(
      "id, round_number, title, description, year, status, starts_at, ends_at, target_count, created_at"
    )
    .order("created_at", { ascending: false });

  if (!rounds || rounds.length === 0) return { rounds: [] };

  const roundIds = rounds.map((r) => r.id);

  const { data: respondentsByRound } = await supabase
    .from("hrd_respondents")
    .select("round_id, status")
    .in("round_id", roundIds);

  const respondentMap: Record<
    string,
    { total: number; completed: number }
  > = {};
  (respondentsByRound ?? []).forEach((r) => {
    if (!respondentMap[r.round_id]) {
      respondentMap[r.round_id] = { total: 0, completed: 0 };
    }
    respondentMap[r.round_id].total++;
    if (r.status === "completed") {
      respondentMap[r.round_id].completed++;
    }
  });

  return {
    rounds: rounds.map((round) => ({
      ...round,
      respondentCount: respondentMap[round.id]?.total ?? 0,
      completedCount: respondentMap[round.id]?.completed ?? 0,
    })),
  };
}

export default async function HrdPage() {
  const { rounds } = await getData();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">실태조사 관리</h1>
          <p className="text-sm text-stone-500 mt-1">
            HRD 실태조사 라운드를 관리하세요
          </p>
        </div>
        <HrdRoundActions rounds={rounds} />
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <FileSearch
            size={40}
            className="mx-auto text-stone-300 mb-3"
            aria-hidden="true"
          />
          <p className="text-sm text-stone-500">
            등록된 실태조사 라운드가 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rounds.map((round) => {
            const status =
              statusLabels[round.status] ?? statusLabels.draft;
            const progressPct =
              round.target_count > 0
                ? Math.round(
                    (round.completedCount / round.target_count) * 100
                  )
                : 0;

            return (
              <div
                key={round.id}
                className="rounded-xl border border-stone-200 bg-white shadow-sm p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-stone-900">
                      {round.title}
                    </h3>
                    {round.description && (
                      <p className="text-sm text-stone-500 mt-0.5">
                        {round.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Calendar size={14} className="text-stone-400" />
                    <span>
                      {round.year}년 / {round.round_number}차
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Target size={14} className="text-stone-400" />
                    <span>
                      대상 {(round.target_count ?? 0).toLocaleString()}개사
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Users size={14} className="text-stone-400" />
                    <span>응답자 {round.respondentCount}명</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <CheckCircle size={14} className="text-stone-400" />
                    <span>완료 {round.completedCount}명</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-stone-500">응답 진행률</span>
                    <span className="text-xs font-medium text-stone-700">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                  <span>
                    {formatDate(round.starts_at)} ~{" "}
                    {formatDate(round.ends_at)}
                  </span>
                  <HrdRoundActions
                    roundId={round.id}
                    roundStatus={round.status}
                    roundTitle={round.title}
                    mode="row"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
