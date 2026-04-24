/**
 * Report aggregator — 교육 설문 응답 단일-패스 집계.
 *
 * `/admin/reports?survey=<id>` 서버 컴포넌트에서 Supabase 로 가져온
 * submissions + questions 를 받아, 리포트 5탭이 소비하는
 * `SurveyReportAggregation` 으로 변환한다. 이 모듈은 Supabase 클라이언트를
 * 사용하지 않으며 순수 함수이므로 단위 테스트가 가능하다.
 */

import type { SectionScore } from "@/components/charts/score-bar-chart";
import type { QuestionDistribution } from "@/components/charts/likert-distribution";
import type { DailyResponse } from "@/components/charts/response-trend";
import type { SectionGroup, QuestionDetail } from "@/components/charts/section-score-table";
import type { ScoreBucket } from "@/components/charts/score-distribution";
import type { MatrixQuestion, MatrixRow } from "@/components/charts/respondent-matrix";

export const REPORT_TARGET_SCORE = 90;

export interface ReportSubmission {
  id: string;
  total_score: number | null;
  answers: Record<string, unknown> | null;
  respondent_name: string | null;
  respondent_department: string | null;
  respondent_position: string | null;
  channel: string | null;
  created_at: string;
}

export interface ReportQuestion {
  id: string;
  question_text: string;
  question_type: string | null;
  question_code: string | null;
  section: string | null;
  sort_order: number;
}

export interface SurveyReportAggregation {
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

/**
 * Submissions·questions 로부터 리포트 집계본을 생성.
 *
 * - Likert/rating 타입 문항만 점수 집계에 사용.
 * - total_score 누락 시 문항별 평균에서 역산 (레거시 데이터 호환).
 * - 단일 for-loop 으로 section·question·day·bucket·matrix 를 한꺼번에 누적.
 */
export function aggregateSurveyReport(
  submissions: ReportSubmission[],
  questions: ReportQuestion[],
): SurveyReportAggregation {
  const submissionCount = submissions.length;

  const likertQuestions = questions.filter(
    (q) => q.question_type?.startsWith("likert") || q.question_type === "rating",
  );
  const maxPossible = likertQuestions.length * 5;

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
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      total: 0,
    });
  }

  const dayMap = new Map<string, number>();
  let totalScoreSum = 0;
  let totalScoreCount = 0;

  for (const sub of submissions) {
    const day = sub.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

    if (sub.total_score != null) {
      totalScoreSum += sub.total_score;
      totalScoreCount += 1;
    }

    const answers = sub.answers;
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

  let avgScore100: number;
  if (totalScoreCount > 0 && maxPossible > 0) {
    avgScore100 = (totalScoreSum / totalScoreCount / maxPossible) * 100;
  } else {
    const allSum = Array.from(questionStatMap.values()).reduce((a, b) => a + b.sum, 0);
    const allCount = Array.from(questionStatMap.values()).reduce((a, b) => a + b.count, 0);
    avgScore100 = allCount > 0 ? (allSum / allCount) * 20 : 0;
  }

  const sectionScores: SectionScore[] = [];
  for (const [name, { sum, count }] of sectionMap) {
    if (count > 0) {
      sectionScores.push({
        name,
        avg: Math.round((sum / count) * 20 * 10) / 10,
        count,
      });
    }
  }

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
  for (const [section, qs] of sectionGroupMap) {
    const sScore = sectionScores.find((s) => s.name === section);
    sectionGroups.push({
      section,
      avg100: sScore?.avg ?? 0,
      questions: qs,
    });
  }

  const questionDistributions: QuestionDistribution[] = [];
  for (const q of likertQuestions) {
    const dist = distMap.get(q.id)!;
    if (dist.total > 0) questionDistributions.push(dist);
  }

  const dailyResponses: DailyResponse[] = Array.from(dayMap)
    .sort()
    .map(([date, count]) => ({ date, count }));

  const allQuestionDetails = sectionGroups.flatMap((g) => g.questions);
  const sortedByScore = [...allQuestionDetails].sort((a, b) => b.avg100 - a.avg100);
  const topQuestions = sortedByScore.slice(0, 3);
  const bottomQuestions = sortedByScore.slice(-3).reverse();

  const textQuestions = questions.filter((q) => q.question_type === "text");
  const openResponses: SurveyReportAggregation["openResponses"] = [];
  if (textQuestions.length > 0) {
    for (const sub of submissions) {
      const answers = sub.answers;
      if (!answers) continue;
      for (const tq of textQuestions) {
        const val = answers[tq.id];
        if (typeof val === "string" && val.trim()) {
          openResponses.push({
            name: sub.respondent_name || "익명",
            department: sub.respondent_department || "",
            questionText: tq.question_text,
            answer: val.trim(),
          });
        }
      }
    }
  }

  const buckets: ScoreBucket[] = [
    { range: "90~100", count: 0, color: "#14b8a6" },
    { range: "80~89", count: 0, color: "#10b981" },
    { range: "70~79", count: 0, color: "#f59e0b" },
    { range: "60~69", count: 0, color: "#f97316" },
    { range: "~59", count: 0, color: "#f43f5e" },
  ];
  for (const sub of submissions) {
    const score = sub.total_score;
    const s100 =
      score != null && likertQuestions.length > 0
        ? Math.round((score / (likertQuestions.length * 5)) * 100)
        : null;
    if (s100 == null) continue;
    if (s100 >= 90) buckets[0].count++;
    else if (s100 >= 80) buckets[1].count++;
    else if (s100 >= 70) buckets[2].count++;
    else if (s100 >= 60) buckets[3].count++;
    else buckets[4].count++;
  }

  const matrixQuestions: MatrixQuestion[] = likertQuestions.map((q) => ({
    id: q.id,
    code: q.question_code || `Q${q.sort_order + 1}`,
    text: q.question_text,
  }));

  const matrixRows: MatrixRow[] = submissions.map((sub) => {
    const score = sub.total_score;
    const s100 =
      score != null && likertQuestions.length > 0
        ? Math.round((score / (likertQuestions.length * 5)) * 100)
        : 0;
    return {
      name: sub.respondent_name || "익명",
      department: sub.respondent_department || "",
      channel: sub.channel || "online",
      answers: (sub.answers as Record<string, number | string>) ?? {},
      totalScore100: s100,
    };
  });

  const channelCounts = { online: 0, interview: 0 };
  for (const sub of submissions) {
    if (sub.channel === "interview") channelCounts.interview++;
    else channelCounts.online++;
  }

  return {
    submissionCount,
    avgScore100: Math.round(avgScore100 * 10) / 10,
    gap: Math.round((avgScore100 - REPORT_TARGET_SCORE) * 10) / 10,
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
