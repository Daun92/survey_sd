"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  Target,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Table as TableIcon,
  ExternalLink,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AIReportComment } from "./ai-comment";
import { AIOpenAnalysis } from "./ai-open-analysis";
import type { SectionScore } from "@/components/charts/score-bar-chart";
import type { QuestionDistribution } from "@/components/charts/likert-distribution";
import type { DailyResponse } from "@/components/charts/response-trend";
import type { SectionGroup, QuestionDetail } from "@/components/charts/section-score-table";
import type { ScoreBucket } from "@/components/charts/score-distribution";
import type { MatrixQuestion, MatrixRow } from "@/components/charts/respondent-matrix";

const ScoreBarChart = dynamic(
  () => import("@/components/charts/score-bar-chart").then((m) => m.ScoreBarChart),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> },
);
const SectionScoreTable = dynamic(
  () => import("@/components/charts/section-score-table").then((m) => m.SectionScoreTable),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> },
);
const LikertDistribution = dynamic(
  () => import("@/components/charts/likert-distribution").then((m) => m.LikertDistribution),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> },
);
const ResponseTrend = dynamic(
  () => import("@/components/charts/response-trend").then((m) => m.ResponseTrend),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> },
);
const ScoreDistribution = dynamic(
  () => import("@/components/charts/score-distribution").then((m) => m.ScoreDistribution),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> },
);
const RespondentMatrix = dynamic(
  () => import("@/components/charts/respondent-matrix").then((m) => m.RespondentMatrix),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> },
);

const TARGET_SCORE = 90;

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: { label: "초안", className: "border border-stone-200 text-stone-700" },
};

export interface SurveyReportData {
  id: string;
  title: string;
  status: string;
  created_at: string;
  submissionCount: number;
  avgScore100: number;
  gap: number;
  sectionScores: SectionScore[];
  sectionGroups: SectionGroup[];
  questionDistributions: QuestionDistribution[];
  dailyResponses: DailyResponse[];
  likertQuestionCount: number;
  topQuestions: QuestionDetail[];
  bottomQuestions: QuestionDetail[];
  openResponses: {
    name: string;
    department: string;
    questionText: string;
    answer: string;
  }[];
  scoreBuckets: ScoreBucket[];
  matrixQuestions: MatrixQuestion[];
  matrixRows: MatrixRow[];
  channelCounts: { online: number; interview: number };
}

interface ReportTabsProps {
  data: SurveyReportData;
}

export function ReportTabs({ data }: ReportTabsProps) {
  const status = statusLabels[data.status] ?? statusLabels.draft;
  const isGapPositive = data.gap >= 0;

  return (
    <div>
      {/* 설문 정보 헤더 */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-4">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-900">{data.title}</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                {formatDate(data.created_at)} · {data.likertQuestionCount}개 문항 (100점 만점)
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>
        </div>

        {/* 4칸 요약 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
          <KpiTile icon={<Users size={16} />} label="총 응답 수" value={data.submissionCount} />
          <KpiTile
            icon={<TrendingUp size={16} />}
            label="만족도 (100점)"
            value={data.avgScore100}
            suffix="점"
          />
          <KpiTile
            icon={<Target size={16} />}
            label="목표 점수"
            value={TARGET_SCORE}
            suffix="점"
            muted
          />
          <KpiTile
            icon={isGapPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            label="목표 대비 GAP"
            value={`${isGapPositive ? "+" : ""}${data.gap}`}
            suffix="점"
            tone={isGapPositive ? "positive" : "negative"}
          />
        </div>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="summary" className="space-y-4">
        <div className="border-b border-stone-200 bg-white rounded-t-xl px-2">
          <TabsList className="h-11 bg-transparent p-0 gap-1">
            <AdminTab value="summary">요약</AdminTab>
            <AdminTab value="individual">개별 응답</AdminTab>
            <AdminTab value="segments">세그먼트</AdminTab>
            <AdminTab value="verbatims">VOC</AdminTab>
            <AdminTab value="heatmap">히트맵</AdminTab>
          </TabsList>
        </div>

        <TabsContent value="summary" className="mt-0 space-y-4">
          <SummaryPanel data={data} />
        </TabsContent>

        <TabsContent value="individual" className="mt-0">
          <IndividualPanel data={data} />
        </TabsContent>

        <TabsContent value="segments" className="mt-0">
          <SegmentsPanel data={data} />
        </TabsContent>

        <TabsContent value="verbatims" className="mt-0">
          <VerbatimsPanel data={data} />
        </TabsContent>

        <TabsContent value="heatmap" className="mt-0">
          <HeatmapPanel data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================
// Tab trigger — admin styling (underline accent)
// =============================================================
function AdminTab({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="h-11 rounded-none border-b-2 border-transparent px-3 text-sm text-stone-500 data-[state=active]:border-teal-500 data-[state=active]:bg-transparent data-[state=active]:text-stone-900 data-[state=active]:shadow-none"
    >
      {children}
    </TabsTrigger>
  );
}

// =============================================================
// KPI Tile
// =============================================================
function KpiTile({
  icon,
  label,
  value,
  suffix,
  muted,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  muted?: boolean;
  tone?: "positive" | "negative";
}) {
  const iconCls = muted
    ? "bg-stone-100 text-stone-500"
    : tone === "negative"
      ? "bg-rose-50 text-rose-600"
      : "bg-teal-50 text-teal-600";
  const valueCls =
    tone === "positive"
      ? "text-teal-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-stone-800";
  return (
    <div className="p-5 text-center">
      <div className="flex justify-center mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconCls}`}>
          {icon}
        </div>
      </div>
      <p className={`text-[28px] font-bold ${valueCls}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-stone-400">{suffix}</span>}
      </p>
      <p className="text-xs text-stone-500 mt-1">{label}</p>
    </div>
  );
}

// =============================================================
// Summary 탭
// =============================================================
function SummaryPanel({ data }: { data: SurveyReportData }) {
  if (data.submissionCount === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <p className="text-sm text-stone-500">아직 응답이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      {/* 핵심 인사이트 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
          <p className="text-[11px] font-medium text-teal-600 mb-2">최고 만족 항목</p>
          {data.topQuestions.map((q, i) => (
            <div key={i} className="flex items-center justify-between text-xs mb-1">
              <span className="text-stone-700 truncate mr-2">{q.text}</span>
              <span className="font-bold text-teal-700 shrink-0">
                {Math.round(q.avg100 * 10) / 10}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <p className="text-[11px] font-medium text-rose-600 mb-2">최저 만족 항목</p>
          {data.bottomQuestions.map((q, i) => (
            <div key={i} className="flex items-center justify-between text-xs mb-1">
              <span className="text-stone-700 truncate mr-2">{q.text}</span>
              <span className="font-bold text-rose-700 shrink-0">
                {Math.round(q.avg100 * 10) / 10}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
          <p className="text-[11px] font-medium text-stone-600 mb-2">응답 채널</p>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-stone-800">{data.channelCounts.online}</p>
              <p className="text-[11px] text-stone-500">온라인 설문</p>
            </div>
            <div className="h-8 w-px bg-stone-200" />
            <div className="text-center flex-1">
              <p className="text-xl font-bold text-stone-800">{data.channelCounts.interview}</p>
              <p className="text-[11px] text-stone-500">인터뷰</p>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScoreBarChart data={data.sectionScores} />
        <ScoreDistribution data={data.scoreBuckets} />
      </div>
      <LikertDistribution data={data.questionDistributions.slice(0, 20)} />
      <SectionScoreTable data={data.sectionGroups} />
      <ResponseTrend data={data.dailyResponses} />

      {/* AI 리포트 코멘트 */}
      <AIReportComment
        reportData={{
          courseName: data.title,
          sessionName: "",
          overallAvg: data.avgScore100,
          responseRate: 0,
          totalResponses: data.submissionCount,
          sectionScores: data.sectionScores.map((s) => ({ name: s.name, avg: s.avg })),
          questionScores: data.questionDistributions.map((q) => ({
            code: q.code,
            text: q.text,
            section: "",
            avg:
              q.total > 0
                ? ((q["1"] * 1 + q["2"] * 2 + q["3"] * 3 + q["4"] * 4 + q["5"] * 5) / q.total) * 20
                : 0,
          })),
        }}
      />
    </>
  );
}

// =============================================================
// Individual 탭
// =============================================================
function IndividualPanel({ data }: { data: SurveyReportData }) {
  if (data.matrixRows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <p className="text-sm text-stone-500">응답자 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">응답자별 매트릭스</h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {data.matrixRows.length}명의 응답 · 응답자 × 문항 교차표
          </p>
        </div>
        <Link
          href={`/admin/responses/${data.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <TableIcon size={12} />
          전체 응답 테이블
          <ExternalLink size={10} />
        </Link>
      </div>

      <RespondentMatrix questions={data.matrixQuestions} rows={data.matrixRows} />
    </div>
  );
}

// =============================================================
// Segments 탭 — 채널/부서/직급별 그룹핑
// =============================================================
type SegmentDim = "channel" | "department" | "position";

const SEGMENT_OPTIONS: { value: SegmentDim; label: string }[] = [
  { value: "channel", label: "응답 채널" },
  { value: "department", label: "부서" },
  { value: "position", label: "직급" },
];

const LOW_N_THRESHOLD = 5;

interface SegmentStat {
  key: string;
  label: string;
  count: number;
  avg100: number | null;
  delta: number | null;
  low: boolean;
}

function computeSegments(
  rows: MatrixRow[],
  overall: number,
  dim: SegmentDim,
): SegmentStat[] {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const raw = (r as unknown as Record<string, unknown>)[dim];
    const key = typeof raw === "string" && raw.trim() !== "" ? raw : "__unknown__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r.totalScore100);
  }
  const segs: SegmentStat[] = Array.from(groups.entries()).map(([key, scores]) => {
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const rounded = avg !== null ? Math.round(avg * 10) / 10 : null;
    return {
      key,
      label: key === "__unknown__" ? "(미지정)" : key,
      count: scores.length,
      avg100: rounded,
      delta: rounded !== null ? Math.round((rounded - overall) * 10) / 10 : null,
      low: scores.length < LOW_N_THRESHOLD,
    };
  });
  segs.sort((a, b) => b.count - a.count);
  return segs;
}

function SegmentsPanel({ data }: { data: SurveyReportData }) {
  const [dim, setDim] = useState<SegmentDim>("channel");
  const segments = useMemo(
    () => computeSegments(data.matrixRows, data.avgScore100, dim),
    [data.matrixRows, data.avgScore100, dim],
  );

  if (data.matrixRows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <p className="text-sm text-stone-500">응답자 데이터가 없습니다.</p>
      </div>
    );
  }

  const maxCount = Math.max(...segments.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">세그먼트 비교</h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            전체 평균: <b className="text-stone-700">{data.avgScore100}</b> · 세그먼트 {segments.length}개
          </p>
        </div>
        <select
          value={dim}
          onChange={(e) => setDim(e.target.value as SegmentDim)}
          className="h-8 rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
        >
          {SEGMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">세그먼트</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-stone-500 w-24">응답자</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-stone-500 w-24">평균(100점)</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-stone-500 w-24">전체 대비</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">분포</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => {
              const widthPct = (s.count / maxCount) * 100;
              return (
                <tr
                  key={s.key}
                  className={`border-b border-stone-100 last:border-0 ${s.low ? "text-stone-400" : "text-stone-700"}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{s.label}</span>
                      {s.low && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="N<5" />
                      )}
                    </div>
                  </td>
                  <td className="text-center px-4 py-2.5 tabular-nums">{s.count}</td>
                  <td className="text-center px-4 py-2.5 font-semibold tabular-nums">
                    {s.avg100 !== null ? s.avg100.toFixed(1) : "—"}
                  </td>
                  <td className="text-center px-4 py-2.5">
                    {s.delta === null ? (
                      "—"
                    ) : s.delta > 0 ? (
                      <span className="inline-flex rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-bold text-teal-700 tabular-nums">
                        +{s.delta.toFixed(1)}
                      </span>
                    ) : s.delta < 0 ? (
                      <span className="inline-flex rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 tabular-nums">
                        {s.delta.toFixed(1)}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] font-medium text-stone-500 tabular-nums">
                        ±0
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.low ? "bg-stone-300" : "bg-teal-500"}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {segments.some((s) => s.low) && (
        <p className="flex items-center gap-1.5 text-[11px] text-stone-500">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          응답자 수가 적은(N &lt; {LOW_N_THRESHOLD}) 세그먼트는 통계적 해석에 주의하세요.
        </p>
      )}
    </div>
  );
}

// =============================================================
// Verbatims 탭 — 주관식 답변 + 감정 필터 + AI 분석
// =============================================================
type FilterTone = "all" | "positive" | "improvement" | "neutral";

function detectTone(text: string): FilterTone {
  if (/만족|좋|훌륭|우수|감사/i.test(text)) return "positive";
  if (/개선|건의|불만|미흡|부족|불편/i.test(text)) return "improvement";
  return "neutral";
}

function VerbatimsPanel({ data }: { data: SurveyReportData }) {
  const [filter, setFilter] = useState<FilterTone>("all");

  const { tagged, counts } = useMemo(() => {
    const c = { all: data.openResponses.length, positive: 0, improvement: 0, neutral: 0 };
    const t = data.openResponses.map((r) => {
      const tone = detectTone(r.answer);
      c[tone] += 1;
      return { ...r, tone };
    });
    return { tagged: t, counts: c };
  }, [data.openResponses]);

  const filtered = filter === "all" ? tagged : tagged.filter((t) => t.tone === filter);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const r of filtered) {
      const key = r.questionText || "(문항 정보 없음)";
      if (!map.has(key)) map.set(key, [] as unknown as typeof filtered);
      map.get(key)!.push(r);
    }
    return map;
  }, [filtered]);

  if (data.openResponses.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <p className="text-sm text-stone-500">주관식 응답이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">주관식 답변 (VOC)</h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            전체 {data.openResponses.length}건 · 감정 분류는 키워드 기반 추정입니다.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-0.5">
          <ToneButton active={filter === "all"} onClick={() => setFilter("all")} label={`전체 ${counts.all}`} />
          <ToneButton
            active={filter === "positive"}
            onClick={() => setFilter("positive")}
            label={`긍정 ${counts.positive}`}
            tone="positive"
          />
          <ToneButton
            active={filter === "improvement"}
            onClick={() => setFilter("improvement")}
            label={`개선 ${counts.improvement}`}
            tone="improvement"
          />
          <ToneButton
            active={filter === "neutral"}
            onClick={() => setFilter("neutral")}
            label={`중립 ${counts.neutral}`}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
          해당 분류의 응답이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([question, items]) => (
            <VerbatimQuestionSection
              key={question}
              questionText={question}
              items={items}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ToneButton({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "positive" | "improvement";
}) {
  const activeCls =
    tone === "positive"
      ? "bg-teal-100 text-teal-800"
      : tone === "improvement"
        ? "bg-amber-100 text-amber-800"
        : "bg-stone-100 text-stone-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 rounded-md px-2.5 text-[11px] font-medium transition-colors ${
        active ? activeCls : "text-stone-500 hover:text-stone-700"
      }`}
    >
      {label}
    </button>
  );
}

function VerbatimQuestionSection({
  questionText,
  items,
}: {
  questionText: string;
  items: {
    name: string;
    department: string;
    answer: string;
    tone: FilterTone;
  }[];
}) {
  const answers = items.map((x) => x.answer);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-stone-800 leading-snug">{questionText}</h4>
          <p className="text-[11px] text-stone-400 mt-0.5">응답 {items.length}건</p>
        </div>
      </div>
      <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r, i) => (
          <article
            key={i}
            className="relative overflow-hidden rounded-lg border border-stone-200 bg-stone-50/40 p-3"
          >
            <span
              className={`absolute left-0 top-0 h-full w-1 ${
                r.tone === "positive"
                  ? "bg-teal-500"
                  : r.tone === "improvement"
                    ? "bg-amber-500"
                    : "bg-stone-300"
              }`}
              aria-hidden
            />
            <header className="pl-2 mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-medium text-stone-700">{r.name}</span>
              {r.department && (
                <span className="text-[10px] text-stone-400">{r.department}</span>
              )}
            </header>
            <p className="pl-2 text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
              {r.answer}
            </p>
          </article>
        ))}
      </div>
      <div className="px-4 pb-4">
        <AIOpenAnalysis responses={answers} />
      </div>
    </div>
  );
}

// =============================================================
// Heatmap 탭 — 응답자 × 문항 색상 매트릭스
// =============================================================
const HEATMAP_PALETTE = [
  { bg: "#fecaca", fg: "#7f1d1d" },
  { bg: "#fed7aa", fg: "#7c2d12" },
  { bg: "#fde68a", fg: "#78350f" },
  { bg: "#bef264", fg: "#365314" },
  { bg: "#5eead4", fg: "#134e4a" },
];

function scoreToColor(score: number, max: number) {
  if (max <= 0) return { bg: "#f5f5f4", fg: "#78716c" };
  const normalized = score / max;
  const bucket = Math.min(4, Math.max(0, Math.floor(normalized * 5 - 0.0001)));
  return HEATMAP_PALETTE[bucket];
}

function HeatmapPanel({ data }: { data: SurveyReportData }) {
  const sorted = useMemo(
    () => [...data.matrixRows].sort((a, b) => b.totalScore100 - a.totalScore100),
    [data.matrixRows],
  );

  if (sorted.length === 0 || data.matrixQuestions.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
        <p className="text-sm text-stone-500">응답자 또는 문항 데이터가 없습니다.</p>
      </div>
    );
  }

  const cols = data.matrixQuestions.length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">응답자 × 문항 히트맵</h3>
        <p className="text-[11px] text-stone-400 mt-0.5">
          응답자 {sorted.length}명 · 문항 {cols}개 · 점수 기반 색상
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="text-stone-500">범례:</span>
          {HEATMAP_PALETTE.map((p, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3.5 w-6 rounded-sm border border-stone-200/60"
                style={{ backgroundColor: p.bg }}
              />
              <span className="text-stone-500">
                {["매우 낮음", "낮음", "중간", "높음", "매우 높음"][i]}
              </span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-6 rounded-sm bg-stone-100" />
            <span className="text-stone-500">무응답</span>
          </span>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <div
          className="grid text-xs"
          style={{
            gridTemplateColumns: `200px repeat(${cols}, 40px) 64px`,
          }}
        >
          {/* Header row */}
          <div className="sticky left-0 top-0 z-20 flex items-center border-b border-r border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-600">
            응답자
          </div>
          {data.matrixQuestions.map((q, i) => (
            <div
              key={q.id}
              className="sticky top-0 z-10 flex h-10 items-end justify-center border-b border-stone-200 bg-stone-50 pb-1 font-mono text-[10px] text-stone-500"
              title={q.text}
            >
              {q.code || `Q${i + 1}`}
            </div>
          ))}
          <div className="sticky top-0 z-10 flex items-end justify-center border-b border-l border-stone-200 bg-stone-50 pb-1 text-[10px] font-semibold text-stone-600">
            평균
          </div>

          {sorted.map((r, rowIdx) => (
            <div key={rowIdx} className="contents">
              <div
                className="sticky left-0 z-10 flex flex-col items-start justify-center gap-0.5 border-b border-r border-stone-100 bg-white px-3 py-1.5"
                title={`${r.name} · ${r.department ?? ""}`}
              >
                <span className="truncate text-xs font-medium text-stone-700">{r.name}</span>
                {r.department && (
                  <span className="truncate text-[10px] text-stone-400">{r.department}</span>
                )}
              </div>

              {data.matrixQuestions.map((q) => {
                const raw = r.answers?.[q.id];
                const num = typeof raw === "number" ? raw : Number(raw);
                if (!Number.isFinite(num) || num <= 0) {
                  return (
                    <div
                      key={q.id}
                      className="border-b border-stone-100 bg-stone-50/60"
                      title="무응답"
                    />
                  );
                }
                const { bg, fg } = scoreToColor(num, 5);
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-center border-b border-stone-100 font-mono tabular-nums"
                    style={{ backgroundColor: bg, color: fg }}
                    title={`${q.code || q.text}: ${num} / 5`}
                  >
                    {num}
                  </div>
                );
              })}

              <div className="flex items-center justify-center border-b border-l border-stone-100 bg-stone-50/40 text-[11px] font-semibold text-stone-700 tabular-nums">
                {r.totalScore100}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
