/**
 * /admin/hrd/dashboard — v22 정보구조 v2.
 *
 * 6 섹션:
 *  헤더 — 회차 정체성·진행 상태 + RoundSwitcher (?round=N)
 *  A   — 수집 KPI (4 카드)
 *  B   — 응답자 분포 (도넛/가로막대/일별 추세)
 *  C   — 응답 품질 (3 카드)
 *  D   — 22회 핵심 변화 잠정 분포 (AI 신규 항목 5건 distribution)
 *  E   — 21회 baseline 비교 (응답 >= 50 임계 활성)
 *  F   — 깊은 분석 진입점 (링크 카드)
 *
 * 합의 (docs/admin-hrd-dashboard-v22-plan.md §4):
 *  D-1 URL ?round=N + dropdown / D-2 likert_avg 신규 컬럼 / D-3 avg_minutes 포함
 *  D-4 30일 추세 / D-5 E섹션 50명 임계 / D-6 핵심 5개 / D-7 D섹션 일반 위치
 *  D-8 revalidate 60s / D-9 admin 단일 권한
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle,
  Clock,
  FileChartColumnIncreasing,
  Percent,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { OrgTypeDonut } from "@/components/charts/org-type-donut";
import { IndustryBar } from "@/components/charts/industry-bar";
import { DailyCompletedLine } from "@/components/charts/daily-completed-line";
import { DistributionCard } from "../statistics/distribution-card";
import { RoundSwitcher } from "./round-switcher";

export const revalidate = 60;

// ──────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────

// 22회 v0.2 patched codebook 의 AI 신규 항목 (round 22 전용).
const D_SECTION_ITEM_CODES = [
  "p5)R_4_multi",   // AI 도입 단계
  "p5)R_8_1_3",     // AI 교육 만족도
  "p5)R_8_2_3",     // AI 현업 활용도
  "p5)R_11_multi",  // 향후 AI 교육 내용
  "p1)R_11_multi",  // 교육비 중 AI 비율
] as const;

const E_THRESHOLD = 50; // D-5
const E_TOP_N = 5;       // D-6

const ROUND_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:      { label: "초안",     cls: "bg-stone-100 text-stone-600" },
  collecting: { label: "수집 중",  cls: "bg-emerald-50 text-emerald-700" },
  closed:     { label: "마감",     cls: "bg-blue-50 text-blue-700" },
  analyzing:  { label: "분석 중",  cls: "bg-amber-50 text-amber-700" },
  published:  { label: "공개",     cls: "bg-violet-50 text-violet-700" },
};

// ──────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────

type RoundRow = {
  id: string;
  round_number: number;
  year: number;
  title: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  target_count: number | null;
};

type CollectionKpi = {
  target_count: number;
  total_count: number;
  completed_count: number;
  in_progress_count: number;
  invited_count: number;
  completion_rate: number | null;
  avg_minutes: number | null;
};

type RespondentBreakdown = {
  org_type: { code: number | string; label: string; count: number }[];
  industry: { code: string; label: string; count: number }[];
};

type ResponseQuality = {
  items_n: number;
  completed_n: number;
  responses_n: number;
  avg_completion_rate: number | null;
  zero_response_items: number;
  invited_n: number;
};

type CompareRow = {
  item_code: string;
  question: string;
  a_mean: number | string | null;
  a_count: number | string;
  b_mean: number | string | null;
  b_count: number | string;
  delta: number | string | null;
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = end.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ──────────────────────────────────────────────
// Data fetching
// ──────────────────────────────────────────────

async function getData(roundParam: number | null) {
  const supabase = await createClient();

  const { data: roundsData } = await supabase
    .from("hrd_survey_rounds")
    .select("id, round_number, year, title, status, starts_at, ends_at, target_count")
    .order("round_number", { ascending: false });

  const rounds = (roundsData ?? []) as RoundRow[];
  if (rounds.length === 0) return { rounds: [], current: null } as const;

  // 우선순위: ?round=N > collecting > 최신 round_number
  const current =
    (roundParam !== null && rounds.find((r) => r.round_number === roundParam)) ||
    rounds.find((r) => r.status === "collecting") ||
    rounds[0];

  // 비교 대상 (이전 closed round). current 가 21회면 비교 대상 없음.
  const prev =
    rounds
      .filter((r) => r.round_number < current.round_number)
      .find((r) => ["closed", "analyzing", "published"].includes(r.status)) ?? null;

  // 1) 핵심 RPC 4종 + statistics
  const [kpiRes, breakdownRes, qualityRes, statsRes, dailyRes] = await Promise.all([
    supabase.rpc("get_hrd_collection_kpi", { p_round_id: current.id }),
    supabase.rpc("get_hrd_respondent_breakdown_v2", { p_round_id: current.id }),
    supabase.rpc("get_hrd_response_quality", { p_round_id: current.id }),
    supabase.rpc("get_hrd_round_statistics", { p_round_id: current.id }),
    supabase.rpc("get_hrd_daily_completed", { p_round_id: current.id, p_days: 30 }),
  ]);

  const kpi = (kpiRes.data ?? null) as CollectionKpi | null;
  const breakdown = (breakdownRes.data ?? null) as RespondentBreakdown | null;
  const quality = (qualityRes.data ?? null) as ResponseQuality | null;
  const stats = ((statsRes.data ?? []) as unknown as {
    total_responses: number | string;
    likert_avg: number | string | null;
  }[])[0];
  const daily = (dailyRes.data ?? []) as { day: string; completed: number | string }[];

  // 2) D 섹션 — round 22 전용 + 응답 1+ 일 때만 fetch
  const showDSection =
    current.round_number === 22 && (kpi?.completed_count ?? 0) >= 1;
  let dItems: {
    item_code: string;
    label: string;
    item_id: string;
    distribution: unknown;
  }[] = [];

  if (showDSection) {
    const { data: items } = await supabase
      .from("hrd_survey_items")
      .select("id, item_code, question_text, sub_item_text")
      .eq("round_id", current.id)
      .in("item_code", [...D_SECTION_ITEM_CODES]);

    const itemRows = items ?? [];
    const distResults = await Promise.all(
      itemRows.map((it) =>
        supabase
          .rpc("get_hrd_item_distribution", {
            p_round_id: current.id,
            p_item_id: it.id,
          })
          .then((r) => ({ it, distribution: r.data }))
      )
    );

    // D_SECTION_ITEM_CODES 순서로 정렬
    dItems = D_SECTION_ITEM_CODES.map((code) => {
      const hit = distResults.find((d) => d.it.item_code === code);
      if (!hit) return null;
      return {
        item_code: hit.it.item_code,
        label: hit.it.sub_item_text || hit.it.question_text || hit.it.item_code,
        item_id: hit.it.id,
        distribution: hit.distribution,
      };
    }).filter(Boolean) as typeof dItems;
  }

  // 3) E 섹션 — current 가 22회 + prev (21회) 존재 + 응답 >= 50 일 때만
  const showESection =
    prev !== null && (kpi?.completed_count ?? 0) >= E_THRESHOLD;
  let compareRows: CompareRow[] = [];

  if (showESection && prev) {
    const { data: compareData } = await supabase.rpc("get_hrd_round_compare", {
      p_round_a: prev.id,
      p_round_b: current.id,
      p_item_codes: null,
    });
    const rows = (compareData ?? []) as CompareRow[];
    // 양쪽 응답 충분한 항목 상위 N
    compareRows = rows
      .filter((r) => Number(r.a_count) >= 30 && Number(r.b_count) >= 30)
      .slice(0, E_TOP_N);
  }

  return {
    rounds,
    current,
    prev,
    kpi,
    breakdown,
    quality,
    daily,
    likertAvg: stats?.likert_avg ? Number(stats.likert_avg) : null,
    showDSection,
    dItems,
    showESection,
    compareRows,
  } as const;
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const sp = await searchParams;
  const roundParam = sp.round ? Number(sp.round) : null;
  const data = await getData(Number.isFinite(roundParam) ? roundParam : null);

  if (!data.current) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <Activity size={40} className="mx-auto text-stone-300 mb-3" aria-hidden="true" />
          <p className="text-sm text-stone-500">등록된 실태조사 라운드가 없습니다.</p>
        </div>
      </div>
    );
  }

  const {
    rounds,
    current,
    prev,
    kpi,
    breakdown,
    quality,
    daily,
    likertAvg,
    showDSection,
    dItems,
    showESection,
    compareRows,
  } = data;

  return (
    <div>
      <PageHeader />

      {/* ── 헤더: 회차 카드 ── */}
      <RoundHeaderCard
        current={current}
        rounds={rounds}
        likertAvg={likertAvg}
      />

      {/* ── A 섹션 ── */}
      <SectionTitle title="A. 수집 KPI" hint="목표 대비 진행 현황" />
      <CollectionKpiCards kpi={kpi} />

      {/* ── B 섹션 ── */}
      <SectionTitle title="B. 응답자 분포" hint="조직 유형·업종·일별 완료" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <Panel title="조직 유형">
          <OrgTypeDonut data={breakdown?.org_type ?? []} />
        </Panel>
        <Panel title="업종 (상위 10)">
          <IndustryBar data={breakdown?.industry ?? []} topN={10} />
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="일별 완료 추세 (최근 30일)">
            <DailyCompletedLine
              data={daily.map((d) => ({
                day: d.day,
                completed: Number(d.completed) || 0,
              }))}
            />
          </Panel>
        </div>
      </div>

      {/* ── C 섹션 ── */}
      <SectionTitle title="C. 응답 품질" hint="평균 응답률·미응답 응답자" />
      <ResponseQualityCards quality={quality} />

      {/* ── D 섹션 ── */}
      <SectionTitle
        title="D. 22회 핵심 변화 (AI 신규)"
        hint="v0.2 신규 항목의 잠정 분포"
      />
      <DSectionPanel
        show={showDSection}
        roundNumber={current.round_number}
        completedCount={kpi?.completed_count ?? 0}
        items={dItems}
      />

      {/* ── E 섹션 ── */}
      <SectionTitle
        title="E. 회차 비교"
        hint={`핵심 likert 항목 ${E_TOP_N}건의 ${prev?.round_number ?? "이전"}회 vs ${current.round_number}회 평균 비교`}
      />
      <ESectionPanel
        show={showESection}
        threshold={E_THRESHOLD}
        currentCompleted={kpi?.completed_count ?? 0}
        rows={compareRows}
        prevLabel={prev ? `${prev.round_number}회` : "이전"}
        currLabel={`${current.round_number}회`}
      />

      {/* ── F 섹션 ── */}
      <SectionTitle title="F. 깊은 분석" hint="상세 화면으로 이동" />
      <AnalysisLinksGrid />
    </div>
  );

  // ────────────────────────────────────────────
  // 내부 컴포넌트 (file-local, server-render)
  // ────────────────────────────────────────────

  function PageHeader() {
    return (
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">실태조사 현황</h1>
          <p className="text-sm text-stone-500 mt-1">
            관리자 의사결정용 정보구조 v2 (응답 수집 시점 기준)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/hrd/design"
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50"
          >
            설계
          </Link>
          <Link
            href="/admin/hrd/statistics"
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50"
          >
            전체 통계
          </Link>
          <Link
            href="/admin/hrd/respondents"
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50"
          >
            응답자
          </Link>
        </div>
      </div>
    );
  }
}

// ──────────────────────────────────────────────
// 헤더 카드
// ──────────────────────────────────────────────

function RoundHeaderCard({
  current,
  rounds,
  likertAvg,
}: {
  current: RoundRow;
  rounds: RoundRow[];
  likertAvg: number | null;
}) {
  const badge = ROUND_STATUS_BADGE[current.status] ?? ROUND_STATUS_BADGE.draft;
  const dleft = daysLeft(current.ends_at);

  return (
    <div className="mb-6 rounded-xl border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-stone-900">{current.title}</h2>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        <RoundSwitcher
          rounds={rounds.map((r) => ({
            id: r.id,
            round_number: r.round_number,
            year: r.year,
            status: r.status,
          }))}
          selectedRoundNumber={current.round_number}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <KvBlock icon={CalendarDays} label="기간">
          {formatDate(current.starts_at)} ~ {formatDate(current.ends_at)}
        </KvBlock>
        <KvBlock icon={Clock} label="잔여">
          {dleft === null
            ? "—"
            : dleft < 0
            ? `${Math.abs(dleft)}일 경과`
            : `D-${dleft}`}
        </KvBlock>
        <KvBlock icon={Users} label="목표">
          {current.target_count ?? "—"}명
        </KvBlock>
        <KvBlock icon={TrendingUp} label="Likert 평균">
          {likertAvg !== null ? likertAvg.toFixed(2) : "—"}
        </KvBlock>
      </div>
    </div>
  );
}

function KvBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} aria-hidden="true" className="mt-0.5 text-stone-400" />
      <div>
        <p className="text-[11px] text-stone-500">{label}</p>
        <p className="font-medium text-stone-800">{children}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 섹션 타이틀 / 패널
// ──────────────────────────────────────────────

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3 mt-2 flex items-baseline gap-2">
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      <span className="text-xs text-stone-400">{hint}</span>
    </div>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
        <h4 className="text-sm font-semibold text-stone-800">{title}</h4>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ──────────────────────────────────────────────
// A 섹션 — 수집 KPI
// ──────────────────────────────────────────────

function CollectionKpiCards({ kpi }: { kpi: CollectionKpi | null }) {
  const completionRate = kpi?.completion_rate ?? 0;
  const cards = [
    {
      label: "목표 대비 응답률",
      value: kpi?.completion_rate !== null && kpi?.completion_rate !== undefined
        ? `${kpi.completion_rate}%`
        : "—",
      sub: kpi
        ? `${kpi.completed_count.toLocaleString()} / ${kpi.target_count.toLocaleString()}명`
        : "—",
      icon: Percent,
      bar: Math.min(Math.max(Number(completionRate) || 0, 0), 100),
      color: "text-teal-600 bg-teal-50",
    },
    {
      label: "완료자",
      value: (kpi?.completed_count ?? 0).toLocaleString(),
      sub: "응답 완료",
      icon: CheckCircle,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "진행 중 / 초대됨",
      value: `${(kpi?.in_progress_count ?? 0).toLocaleString()} / ${(
        kpi?.invited_count ?? 0
      ).toLocaleString()}`,
      sub: "재독려 대상 포함",
      icon: Activity,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "평균 응답 소요시간",
      value: kpi?.avg_minutes !== null && kpi?.avg_minutes !== undefined
        ? `${kpi.avg_minutes}분`
        : "—",
      sub: "완료자 평균",
      icon: Clock,
      color: "text-blue-600 bg-blue-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-stone-200 bg-white shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-medium text-stone-500">{c.label}</p>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.color}`}
            >
              <c.icon size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-stone-800 leading-tight">{c.value}</p>
          <p className="text-xs text-stone-500 mt-1">{c.sub}</p>
          {c.bar !== undefined && (
            <div className="mt-3 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${c.bar}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// C 섹션 — 응답 품질
// ──────────────────────────────────────────────

function ResponseQualityCards({ quality }: { quality: ResponseQuality | null }) {
  const cards = [
    {
      label: "평균 응답률 (문항)",
      value: quality?.avg_completion_rate !== null && quality?.avg_completion_rate !== undefined
        ? `${quality.avg_completion_rate}%`
        : "—",
      sub: quality
        ? `완료자 1명 평균 ${
            quality.completed_n > 0
              ? Math.round(quality.responses_n / quality.completed_n)
              : 0
          } 문항 / ${quality.items_n}문항`
        : "—",
      icon: BarChart3,
      color: "text-teal-600 bg-teal-50",
    },
    {
      label: "응답 0건 문항",
      value: (quality?.zero_response_items ?? 0).toLocaleString(),
      sub: `전체 ${(quality?.items_n ?? 0).toLocaleString()}문항`,
      icon: AlertCircle,
      color:
        (quality?.zero_response_items ?? 0) > 0
          ? "text-amber-600 bg-amber-50"
          : "text-stone-600 bg-stone-100",
    },
    {
      label: "미응답 응답자",
      value: (quality?.invited_n ?? 0).toLocaleString(),
      sub: "초대 후 미시작 — 재독려 대상",
      icon: Users,
      color: "text-blue-600 bg-blue-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-stone-200 bg-white shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-medium text-stone-500">{c.label}</p>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.color}`}
            >
              <c.icon size={16} aria-hidden="true" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-stone-800 leading-tight">{c.value}</p>
          <p className="text-xs text-stone-500 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// D 섹션 — AI 신규 항목
// ──────────────────────────────────────────────

function DSectionPanel({
  show,
  roundNumber,
  completedCount,
  items,
}: {
  show: boolean;
  roundNumber: number;
  completedCount: number;
  items: {
    item_code: string;
    label: string;
    item_id: string;
    distribution: unknown;
  }[];
}) {
  if (roundNumber !== 22) {
    return (
      <EmptyPanel>
        AI 신규 항목 (v0.2) 은 22회에서만 표시됩니다.
      </EmptyPanel>
    );
  }
  if (!show || items.length === 0) {
    return (
      <EmptyPanel>
        완료 응답이 1건 이상 모이면 AI 신규 항목 분포가 표시됩니다.
        <br />
        <span className="text-stone-400 text-xs mt-1 inline-block">
          현재 완료자: {completedCount}명
        </span>
      </EmptyPanel>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      {items.map((it) => (
        <div
          key={it.item_id}
          className="rounded-xl border border-stone-200 bg-white shadow-sm p-4"
        >
          <DistributionCard
            result={it.distribution as Parameters<typeof DistributionCard>[0]["result"]}
            itemLabel={it.label}
            itemCode={it.item_code}
          />
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// E 섹션 — 회차 비교
// ──────────────────────────────────────────────

function ESectionPanel({
  show,
  threshold,
  currentCompleted,
  rows,
  prevLabel,
  currLabel,
}: {
  show: boolean;
  threshold: number;
  currentCompleted: number;
  rows: CompareRow[];
  prevLabel: string;
  currLabel: string;
}) {
  if (!show) {
    return (
      <EmptyPanel>
        22회 응답이 {threshold}명 이상 모이면 {prevLabel} 대비 비교가 활성됩니다.
        <br />
        <span className="text-stone-400 text-xs mt-1 inline-block">
          현재 완료자: {currentCompleted}명
        </span>
      </EmptyPanel>
    );
  }

  if (rows.length === 0) {
    return <EmptyPanel>양쪽 라운드에 충분한 응답이 모인 likert 항목이 없습니다.</EmptyPanel>;
  }

  return (
    <div className="mb-8 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-stone-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">문항</th>
            <th className="px-4 py-2 text-right font-medium">{prevLabel} 평균</th>
            <th className="px-4 py-2 text-right font-medium">{currLabel} 평균</th>
            <th className="px-4 py-2 text-right font-medium">변화</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r) => {
            const delta = r.delta !== null ? Number(r.delta) : null;
            const arrow =
              delta === null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null;
            const cls =
              delta === null
                ? "text-stone-400"
                : delta > 0
                ? "text-emerald-600"
                : delta < 0
                ? "text-rose-600"
                : "text-stone-500";
            return (
              <tr key={r.item_code}>
                <td className="px-4 py-2.5 text-stone-800">
                  <span className="block max-w-md truncate" title={r.question}>
                    {r.question}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">{r.item_code}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                  {r.a_mean !== null ? Number(r.a_mean).toFixed(2) : "—"}
                  <span className="ml-1 text-[11px] text-stone-400">
                    ({Number(r.a_count).toLocaleString()})
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">
                  {r.b_mean !== null ? Number(r.b_mean).toFixed(2) : "—"}
                  <span className="ml-1 text-[11px] text-stone-400">
                    ({Number(r.b_count).toLocaleString()})
                  </span>
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${cls}`}>
                  <span className="inline-flex items-center gap-1">
                    {arrow ? (() => {
                      const A = arrow;
                      return <A size={14} aria-hidden="true" />;
                    })() : null}
                    {delta === null
                      ? "—"
                      : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────
// F 섹션 — 진입 링크
// ──────────────────────────────────────────────

function AnalysisLinksGrid() {
  const links = [
    {
      title: "항목별 분포",
      desc: "224 items 의 답분포·통계요약",
      href: "/admin/hrd/statistics",
      icon: FileChartColumnIncreasing,
    },
    {
      title: "응답자 관리",
      desc: "개별 응답자 응답 보기 / 초대 / 재독려",
      href: "/admin/hrd/respondents",
      icon: Users,
    },
    {
      title: "컨설팅 리포트",
      desc: "AI 기반 개별 보고서 (후속)",
      href: "/admin/hrd/consulting",
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="group rounded-xl border border-stone-200 bg-white shadow-sm p-5 hover:border-teal-300 hover:shadow transition"
        >
          <div className="flex items-center justify-between mb-2">
            <l.icon size={18} aria-hidden="true" className="text-teal-600" />
            <ArrowRight
              size={14}
              aria-hidden="true"
              className="text-stone-400 group-hover:text-teal-600"
            />
          </div>
          <p className="text-sm font-semibold text-stone-800">{l.title}</p>
          <p className="text-xs text-stone-500 mt-0.5">{l.desc}</p>
        </Link>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// 공용 비어있음 패널
// ──────────────────────────────────────────────

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-8 text-center text-sm text-stone-500">
      {children}
    </div>
  );
}
