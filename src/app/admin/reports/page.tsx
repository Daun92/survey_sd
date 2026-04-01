import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart3,
  FileBarChart,
  ChevronLeft,
  Inbox,
  CalendarDays,
  Users,
  TrendingUp,
  Target,
  ArrowDownRight,
  ArrowUpRight,
  Download,
} from "lucide-react";
import dynamic from "next/dynamic";
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
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> }
);
const SectionScoreTable = dynamic(
  () => import("@/components/charts/section-score-table").then((m) => m.SectionScoreTable),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> }
);
const LikertDistribution = dynamic(
  () => import("@/components/charts/likert-distribution").then((m) => m.LikertDistribution),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> }
);
const ResponseTrend = dynamic(
  () => import("@/components/charts/response-trend").then((m) => m.ResponseTrend),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> }
);
const ScoreDistribution = dynamic(
  () => import("@/components/charts/score-distribution").then((m) => m.ScoreDistribution),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> }
);
const RespondentMatrix = dynamic(
  () => import("@/components/charts/respondent-matrix").then((m) => m.RespondentMatrix),
  { loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" /> }
);

export const revalidate = 60;

const TARGET_SCORE = 90;

function getGradeLabel100(score: number) {
  if (score >= 90) return "매우우수";
  if (score >= 80) return "우수";
  if (score >= 70) return "양호";
  return "개선필요";
}

function getGradeBadgeClass(score: number) {
  if (score >= 90) return "bg-teal-100 text-teal-800";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 70) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

async function getSurveyReport(surveyId: string) {
  const supabase = await createClient();
  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("id, title, status, created_at")
    .eq("id", surveyId)
    .single();

  if (!survey) return null;

  const [{ data: submissions }, { data: questions }] = await Promise.all([
    supabase
      .from("edu_submissions")
      .select("id, total_score, answers, respondent_name, respondent_department, respondent_position, created_at")
      .eq("survey_id", surveyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("edu_questions")
      .select("id, question_text, question_type, question_code, section, sort_order")
      .eq("survey_id", surveyId)
      .order("sort_order", { ascending: true }),
  ]);

  const submissionCount = submissions?.length ?? 0;

  // ── likert/rating 문항만 필터링 ──
  const likertQuestions = (questions ?? []).filter(
    (q) => q.question_type?.startsWith("likert") || q.question_type === "rating"
  );
  const maxPossible = likertQuestions.length * 5; // 100점 만점 기준

  // ── 집계 초기화 ──
  const sectionMap = new Map<string, { sum: number; count: number }>();
  const questionStatMap = new Map<string, { sum: number; count: number }>();
  const distMap = new Map<string, QuestionDistribution>();

  for (const q of likertQuestions) {
    const section = q.section || "일반";
    if (!sectionMap.has(section)) sectionMap.set(section, { sum: 0, count: 0 });
    questionStatMap.set(q.id, { sum: 0, count: 0 });
    distMap.set(q.id, {
      code: q.question_code || `Q${q.sort_order + 1}`,
      text: q.question_text,
      "1": 0, "2": 0, "3": 0, "4": 0, "5": 0,
      total: 0,
    });
  }

  // ── 단일 패스 집계 ──
  const dayMap = new Map<string, number>();
  let totalScoreSum = 0;
  let totalScoreCount = 0;

  if (submissions && submissionCount > 0) {
    for (const sub of submissions) {
      // 일별 응답 추이
      const day = sub.created_at.slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

      // total_score 기반 전체 평균
      if (sub.total_score != null) {
        totalScoreSum += sub.total_score;
        totalScoreCount += 1;
      }

      // 문항별 점수 집계
      const answers = sub.answers as Record<string, unknown> | null;
      if (!answers) continue;
      for (const q of likertQuestions) {
        const num = Number(answers[q.id]);
        if (isNaN(num) || num < 1 || num > 5) continue;

        const section = q.section || "일반";
        const sEntry = sectionMap.get(section)!;
        sEntry.sum += num;
        sEntry.count += 1;

        const qEntry = questionStatMap.get(q.id)!;
        qEntry.sum += num;
        qEntry.count += 1;

        const dist = distMap.get(q.id)!;
        dist[String(num) as "1" | "2" | "3" | "4" | "5"] += 1;
        dist.total += 1;
      }
    }
  }

  // ── 100점 기준 전체 평균 ──
  // total_score가 있으면 사용, 없으면 문항 평균에서 환산
  let avgScore100: number;
  if (totalScoreCount > 0 && maxPossible > 0) {
    avgScore100 = (totalScoreSum / totalScoreCount / maxPossible) * 100;
  } else {
    const allSum = Array.from(questionStatMap.values()).reduce((a, b) => a + b.sum, 0);
    const allCount = Array.from(questionStatMap.values()).reduce((a, b) => a + b.count, 0);
    avgScore100 = allCount > 0 ? (allSum / allCount) * 20 : 0;
  }

  // ── 섹션별 100점 환산 점수 ──
  const sectionScores: SectionScore[] = [];
  for (const [name, { sum, count }] of sectionMap) {
    if (count > 0) {
      sectionScores.push({
        name,
        avg: Math.round((sum / count) * 20 * 10) / 10, // 100점 환산
        count,
      });
    }
  }

  // ── 문항별 상세 (섹션 그룹) ──
  const sectionGroupMap = new Map<string, QuestionDetail[]>();
  for (const q of likertQuestions) {
    const section = q.section || "일반";
    if (!sectionGroupMap.has(section)) sectionGroupMap.set(section, []);
    const stat = questionStatMap.get(q.id)!;
    const avg5 = stat.count > 0 ? stat.sum / stat.count : 0;
    sectionGroupMap.get(section)!.push({
      code: q.question_code || `Q${q.sort_order + 1}`,
      text: q.question_text,
      section,
      avg5,
      avg100: avg5 * 20,
      count: stat.count,
    });
  }

  const sectionGroups: SectionGroup[] = [];
  for (const [section, questions] of sectionGroupMap) {
    const sScore = sectionScores.find((s) => s.name === section);
    sectionGroups.push({
      section,
      avg100: sScore?.avg ?? 0,
      questions,
    });
  }

  // ── Likert 분포 ──
  const questionDistributions: QuestionDistribution[] = [];
  for (const q of likertQuestions) {
    const dist = distMap.get(q.id)!;
    if (dist.total > 0) questionDistributions.push(dist);
  }

  // ── 일별 응답 추이 ──
  const dailyResponses: DailyResponse[] = Array.from(dayMap)
    .sort()
    .map(([date, count]) => ({ date, count }));

  // ── 최고/최저 만족 문항 (100점 기준) ──
  const allQuestionDetails = sectionGroups.flatMap((g) => g.questions);
  const sortedByScore = [...allQuestionDetails].sort((a, b) => b.avg100 - a.avg100);
  const topQuestions = sortedByScore.slice(0, 3);
  const bottomQuestions = sortedByScore.slice(-3).reverse();

  // ── 주관식 답변 수집 ──
  const textQuestions = (questions ?? []).filter((q) => q.question_type === "text");
  const openResponses: { name: string; department: string; questionText: string; answer: string }[] = [];
  if (textQuestions.length > 0 && submissions) {
    for (const sub of submissions) {
      const answers = sub.answers as Record<string, unknown> | null;
      if (!answers) continue;
      for (const tq of textQuestions) {
        const val = answers[tq.id];
        if (typeof val === "string" && val.trim()) {
          openResponses.push({
            name: (sub as any).respondent_name || "익명",
            department: (sub as any).respondent_department || "",
            questionText: tq.question_text,
            answer: val.trim(),
          });
        }
      }
    }
  }

  // ── 점수 분포 히스토그램 ──
  const buckets: ScoreBucket[] = [
    { range: "90~100", count: 0, color: "#14b8a6" },
    { range: "80~89", count: 0, color: "#10b981" },
    { range: "70~79", count: 0, color: "#f59e0b" },
    { range: "60~69", count: 0, color: "#f97316" },
    { range: "~59", count: 0, color: "#f43f5e" },
  ];
  if (submissions) {
    for (const sub of submissions) {
      const score = sub.total_score as number | null;
      const s100 = score != null && likertQuestions.length > 0
        ? Math.round((score / (likertQuestions.length * 5)) * 100)
        : null;
      if (s100 == null) continue;
      if (s100 >= 90) buckets[0].count++;
      else if (s100 >= 80) buckets[1].count++;
      else if (s100 >= 70) buckets[2].count++;
      else if (s100 >= 60) buckets[3].count++;
      else buckets[4].count++;
    }
  }

  // ── 응답자 매트릭스 데이터 ──
  const matrixQuestions: MatrixQuestion[] = likertQuestions.map((q) => ({
    id: q.id,
    code: q.question_code || `Q${q.sort_order + 1}`,
    text: q.question_text,
  }));

  const matrixRows: MatrixRow[] = (submissions ?? []).map((sub) => {
    const score = sub.total_score as number | null;
    const s100 = score != null && likertQuestions.length > 0
      ? Math.round((score / (likertQuestions.length * 5)) * 100)
      : 0;
    return {
      name: (sub as any).respondent_name || "익명",
      department: (sub as any).respondent_department || "",
      channel: (sub as any).channel || "online",
      answers: (sub.answers as Record<string, number | string>) ?? {},
      totalScore100: s100,
    };
  });

  // ── 채널별 응답 수 ──
  const channelCounts = { online: 0, interview: 0 };
  if (submissions) {
    for (const sub of submissions) {
      const ch = (sub as any).channel;
      if (ch === "interview") channelCounts.interview++;
      else channelCounts.online++;
    }
  }

  return {
    ...survey,
    submissionCount,
    avgScore100: Math.round(avgScore100 * 10) / 10,
    gap: Math.round((avgScore100 - TARGET_SCORE) * 10) / 10,
    submissions: submissions ?? [],
    sectionScores,
    sectionGroups,
    questionDistributions,
    dailyResponses,
    likertQuestionCount: likertQuestions.length,
    topQuestions,
    bottomQuestions,
    openResponses,
    scoreBuckets: buckets,
    matrixQuestions,
    matrixRows,
    channelCounts,
  };
}

async function getSurveyList() {
  const supabase = await createClient();
  const { data: surveys } = await supabase
    .from("edu_surveys")
    .select("id, title, status, created_at, edu_submissions(count)")
    .order("created_at", { ascending: false });

  if (!surveys || surveys.length === 0) return [];

  return surveys.map((sv) => ({
    ...sv,
    submissionCount: (sv.edu_submissions as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: { label: "초안", className: "border border-stone-200 text-stone-700" },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ survey?: string }>;
}) {
  const params = await searchParams;
  const surveyId = params.survey;

  if (surveyId) {
    const report = await getSurveyReport(surveyId);

    if (!report) {
      return (
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
            <p className="text-sm text-stone-500 mt-1">
              교육 설문 결과를 분석하세요
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
            <p className="text-sm text-stone-500">
              해당 설문을 찾을 수 없습니다.
            </p>
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 mt-4"
            >
              <ChevronLeft size={16} />
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      );
    }

    const status = statusLabels[report.status] ?? statusLabels.draft;
    const isGapPositive = report.gap >= 0;

    return (
      <div>
        {/* 헤더 */}
        <div className="mb-8">
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 mb-4"
          >
            <ChevronLeft size={16} />
            목록으로 돌아가기
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
              <p className="text-sm text-stone-500 mt-1">
                교육 설문 결과를 분석하세요
              </p>
            </div>
            <a
              href={`/api/surveys/${report.id}/export`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              CSV 내보내기
            </a>
          </div>
        </div>

        {/* 설문 정보 + 요약 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-6">
          <div className="p-5 border-b border-stone-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  {report.title}
                </h2>
                <p className="text-sm text-stone-500 mt-0.5">
                  {formatDate(report.created_at)} · {report.likertQuestionCount}개 문항 (100점 만점)
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
            <div className="p-5 text-center">
              <div className="flex justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Users size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {report.submissionCount}
              </p>
              <p className="text-xs text-stone-500 mt-1">총 응답 수</p>
            </div>
            <div className="p-5 text-center">
              <div className="flex justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {report.avgScore100}
                <span className="text-sm font-normal text-stone-400">점</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">만족도 (100점)</p>
            </div>
            <div className="p-5 text-center">
              <div className="flex justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                  <Target size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {TARGET_SCORE}
                <span className="text-sm font-normal text-stone-400">점</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">목표 점수</p>
            </div>
            <div className="p-5 text-center">
              <div className="flex justify-center mb-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isGapPositive ? "bg-teal-50 text-teal-600" : "bg-rose-50 text-rose-600"}`}>
                  {isGapPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                </div>
              </div>
              <p className={`text-[28px] font-bold ${isGapPositive ? "text-teal-600" : "text-rose-600"}`}>
                {isGapPositive ? "+" : ""}{report.gap}
                <span className="text-sm font-normal text-stone-400">점</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">목표 대비 GAP</p>
            </div>
          </div>
        </div>

        {/* 핵심 인사이트 */}
        {report.submissionCount > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
              <p className="text-[11px] font-medium text-teal-600 mb-2">최고 만족 항목</p>
              {report.topQuestions.map((q, i) => (
                <div key={i} className="flex items-center justify-between text-xs mb-1">
                  <span className="text-stone-700 truncate mr-2">{q.text}</span>
                  <span className="font-bold text-teal-700 shrink-0">{Math.round(q.avg100 * 10) / 10}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-[11px] font-medium text-rose-600 mb-2">최저 만족 항목</p>
              {report.bottomQuestions.map((q, i) => (
                <div key={i} className="flex items-center justify-between text-xs mb-1">
                  <span className="text-stone-700 truncate mr-2">{q.text}</span>
                  <span className="font-bold text-rose-700 shrink-0">{Math.round(q.avg100 * 10) / 10}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
              <p className="text-[11px] font-medium text-stone-600 mb-2">응답 채널</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-stone-800">{report.channelCounts.online}</p>
                  <p className="text-[11px] text-stone-500">온라인 설문</p>
                </div>
                <div className="h-8 w-px bg-stone-200" />
                <div className="text-center flex-1">
                  <p className="text-xl font-bold text-stone-800">{report.channelCounts.interview}</p>
                  <p className="text-[11px] text-stone-500">인터뷰</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 차트 영역 */}
        {report.submissionCount > 0 && (
          <div className="space-y-4 mb-6">
            {/* 섹션별 바 차트 + 점수 분포 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ScoreBarChart data={report.sectionScores} />
              <ScoreDistribution data={report.scoreBuckets} />
            </div>

            {/* Likert 분포 */}
            <LikertDistribution data={report.questionDistributions.slice(0, 20)} />

            {/* 섹션별 문항 상세 테이블 */}
            <SectionScoreTable data={report.sectionGroups} />

            {/* 응답 추이 */}
            <ResponseTrend data={report.dailyResponses} />
          </div>
        )}

        {/* AI 리포트 코멘트 */}
        <AIReportComment
          reportData={{
            courseName: report.title,
            sessionName: "",
            overallAvg: report.avgScore100,
            responseRate: 0,
            totalResponses: report.submissionCount,
            sectionScores: report.sectionScores.map((s) => ({ name: s.name, avg: s.avg })),
            questionScores: report.questionDistributions.map((q) => ({
              code: q.code,
              text: q.text,
              section: "",
              avg: q.total > 0
                ? ((q["1"] * 1 + q["2"] * 2 + q["3"] * 3 + q["4"] * 4 + q["5"] * 5) / q.total) * 20
                : 0,
            })),
          }}
        />

        {/* 응답자별 상세 매트릭스 */}
        {report.matrixRows.length > 0 && (
          <div className="mt-6">
            <RespondentMatrix questions={report.matrixQuestions} rows={report.matrixRows} />
          </div>
        )}

        {/* 주관식 답변 모음 */}
        {report.openResponses.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm mt-6">
            <div className="p-5 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-800">주관식 답변</h3>
              <p className="text-[11px] text-stone-400 mt-0.5">{report.openResponses.length}건의 자유 의견</p>
            </div>
            <div className="divide-y divide-stone-100">
              {report.openResponses.map((r, idx) => (
                <div key={idx} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium text-stone-800">{r.name}</span>
                    {r.department && <span className="text-[11px] text-stone-400">{r.department}</span>}
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Survey list view
  const surveys = await getSurveyList();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
        <p className="text-sm text-stone-500 mt-1">
          교육 설문 결과를 분석하세요
        </p>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <Inbox size={24} className="text-stone-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            설문이 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            리포트를 생성할 설문이 아직 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => {
            const status = statusLabels[survey.status] ?? statusLabels.draft;
            return (
              <div
                key={survey.id}
                className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <BarChart3 size={16} />
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-stone-800 mb-1 truncate">
                    {survey.title}
                  </h3>
                  <p className="text-xs text-stone-400 mb-4">
                    {formatDate(survey.created_at)}
                  </p>

                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <p className="text-lg font-bold text-stone-800">
                        {survey.submissionCount}
                      </p>
                      <p className="text-xs text-stone-500">응답 수</p>
                    </div>
                  </div>

                  <Link
                    href={`/admin/reports?survey=${survey.id}`}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
                  >
                    <FileBarChart size={14} />
                    보고서 생성
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
