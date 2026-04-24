import { createClient } from "@/lib/supabase/server";
import {
  Target,
  CheckCircle,
  Percent,
  AlertCircle,
  Activity,
} from "lucide-react";

const respondentStatusLabels: Record<
  string,
  { label: string; className: string }
> = {
  completed: { label: "완료", className: "bg-emerald-100 text-emerald-800" },
  invited: { label: "초대됨", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "진행중", className: "bg-amber-100 text-amber-800" },
};

// hrd_survey_rounds.status CHECK: 'draft' | 'collecting' | 'closed' | 'analyzing' | 'published'
// '현재 진행 중' 은 collecting. 이전 코드는 존재하지 않는 'active' 를 필터해 항상 0건 반환.
// 진행중 라운드가 없으면 가장 최근 closed/analyzing/published 라운드를 fallback 으로 노출.
const DASHBOARD_PRIMARY_STATUS = "collecting" as const;
const DASHBOARD_FALLBACK_STATUSES = ["closed", "analyzing", "published"] as const;

type SummaryRow = {
  target_count: number;
  total_count: number;
  completed_count: number;
  in_progress_count: number;
  invited_count: number;
};

type BreakdownRow = { status: string; cnt: number | string };

async function getData() {
  const supabase = await createClient();
  const { data: collectingRound } = await supabase
    .from("hrd_survey_rounds")
    .select("id, title, year, round_number, status, target_count")
    .eq("status", DASHBOARD_PRIMARY_STATUS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentRound =
    collectingRound ??
    (
      await supabase
        .from("hrd_survey_rounds")
        .select("id, title, year, round_number, status, target_count")
        .in("status", [...DASHBOARD_FALLBACK_STATUSES])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data;

  if (!currentRound) return { currentRound: null, stats: null, breakdown: [] };

  const [summaryRes, breakdownRes] = await Promise.all([
    supabase.rpc("get_hrd_respondent_summary", { p_round_id: currentRound.id }),
    supabase.rpc("get_hrd_respondent_breakdown", {
      p_round_id: currentRound.id,
    }),
  ]);

  const summaryRow =
    ((summaryRes.data ?? []) as unknown as SummaryRow[])[0] ?? null;
  const breakdownRows =
    (breakdownRes.data ?? []) as unknown as BreakdownRow[];

  // target_count 는 라운드에 설정된 값을 우선, 없으면 총 대상자 수로 대체
  const respondentTotal = summaryRow?.total_count ?? 0;
  const totalCount =
    (summaryRow?.target_count ?? 0) > 0
      ? summaryRow!.target_count
      : respondentTotal;
  const completedCount = summaryRow?.completed_count ?? 0;
  const responseRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const noResponseCount = Math.max(totalCount - completedCount, 0);

  return {
    currentRound,
    stats: {
      totalCount,
      completedCount,
      responseRate,
      noResponseCount,
    },
    breakdown: breakdownRows.map((row) => ({
      status: row.status,
      count: Number(row.cnt) || 0,
    })),
  };
}

export default async function DashboardPage() {
  const { currentRound, stats, breakdown } = await getData();

  if (!currentRound || !stats) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800">실시간 현황</h1>
          <p className="text-sm text-stone-500 mt-1">
            실태조사 응답 현황을 실시간으로 확인하세요
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <Activity
            size={40}
            className="mx-auto text-stone-300 mb-3"
            aria-hidden="true"
          />
          <p className="text-sm text-stone-500">
            현재 진행 중인 실태조사 라운드가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "총 대상자",
      value: stats.totalCount.toLocaleString(),
      icon: Target,
      color: "text-teal-600 bg-teal-50",
    },
    {
      label: "응답 완료",
      value: stats.completedCount.toLocaleString(),
      icon: CheckCircle,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "응답률",
      value: `${stats.responseRate}%`,
      icon: Percent,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "미응답",
      value: stats.noResponseCount.toLocaleString(),
      icon: AlertCircle,
      color: "text-stone-600 bg-stone-100",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">실시간 현황</h1>
        <p className="text-sm text-stone-500 mt-1">
          실태조사 응답 현황을 실시간으로 확인하세요
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-stone-200 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-stone-900">
          {currentRound.title}
        </h2>
        <p className="text-sm text-stone-500 mt-0.5">
          {currentRound.year}년 {currentRound.round_number}차
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-stone-200 bg-white shadow-sm"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-medium text-stone-500">
                  {card.label}
                </p>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}
                >
                  <card.icon size={16} aria-hidden="true" />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-base font-semibold text-stone-900">
            응답자 상태 분포
          </h3>
          <p className="text-sm text-stone-500">상태별 응답자 현황</p>
        </div>
        <div className="p-5">
          {breakdown.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-4">
              데이터가 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {breakdown.map(({ status, count }) => {
                const info =
                  respondentStatusLabels[status] ??
                  respondentStatusLabels.invited;
                const pct =
                  stats.totalCount > 0
                    ? Math.round((count / stats.totalCount) * 100)
                    : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${info.className}`}
                      >
                        {info.label}
                      </span>
                      <span className="text-sm font-medium text-stone-700">
                        {count}명 ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
