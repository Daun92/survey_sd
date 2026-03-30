import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

// GET /api/reports/annual — 연간 집계
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  // 해당 연도 전체 설문
  const surveys = await prisma.survey.findMany({
    where: { surveyYear: year },
    include: {
      serviceType: true,
      questions: true,
      responses: {
        where: { isComplete: true },
        include: { answers: true },
      },
      _count: { select: { distributions: true } },
    },
    orderBy: { surveyMonth: "asc" },
  });

  // 월별 통계
  const monthlyStats = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthSurveys = surveys.filter((s) => s.surveyMonth === m);
    const allAnswers = monthSurveys.flatMap((s) =>
      s.responses.flatMap((r) =>
        r.answers.filter((a) => a.answerNumeric !== null && s.questions.some((q) => q.id === a.questionId && q.questionType.startsWith("rating")))
      )
    );
    const avg = allAnswers.length > 0
      ? Math.round((allAnswers.reduce((sum, a) => sum + a.answerNumeric!, 0) / allAnswers.length) * 100) / 100
      : null;
    const totalDist = monthSurveys.reduce((s, sv) => s + sv._count.distributions, 0);
    const totalResp = monthSurveys.reduce((s, sv) => s + sv.responses.length, 0);

    return {
      month: m,
      average: avg,
      totalResponses: totalResp,
      totalDistributions: totalDist,
      responseRate: totalDist > 0 ? Math.round((totalResp / totalDist) * 100) : 0,
      surveyCount: monthSurveys.length,
    };
  });

  // 서비스유형별 연간 평균
  const byServiceType = new Map<string, { averages: number[]; responses: number }>();
  for (const s of surveys) {
    const ratingQuestions = s.questions.filter((q) => q.questionType.startsWith("rating"));
    const answers = s.responses.flatMap((r) =>
      r.answers.filter((a) => a.answerNumeric !== null && ratingQuestions.some((q) => q.id === a.questionId))
    );
    if (answers.length === 0) continue;
    const avg = answers.reduce((sum, a) => sum + a.answerNumeric!, 0) / answers.length;
    const cur = byServiceType.get(s.serviceType.name) || { averages: [], responses: 0 };
    cur.averages.push(avg);
    cur.responses += s.responses.length;
    byServiceType.set(s.serviceType.name, cur);
  }
  const serviceTypeStats = Array.from(byServiceType.entries()).map(([name, v]) => ({
    serviceType: name,
    average: Math.round((v.averages.reduce((s, a) => s + a, 0) / v.averages.length) * 100) / 100,
    totalResponses: v.responses,
  }));

  // 연간 요약
  const validMonths = monthlyStats.filter((m) => m.average !== null);
  const annualAvg = validMonths.length > 0
    ? Math.round((validMonths.reduce((s, m) => s + m.average!, 0) / validMonths.length) * 100) / 100
    : null;
  const bestMonth = validMonths.length > 0 ? validMonths.reduce((best, m) => m.average! > best.average! ? m : best) : null;
  const worstMonth = validMonths.length > 0 ? validMonths.reduce((worst, m) => m.average! < worst.average! ? m : worst) : null;

  // 전년 대비 (간단히 전년 평균)
  const prevYearSurveys = await prisma.survey.findMany({
    where: { surveyYear: year - 1 },
    include: {
      questions: true,
      responses: { where: { isComplete: true }, include: { answers: true } },
    },
  });
  let prevYearAvg: number | null = null;
  if (prevYearSurveys.length > 0) {
    const prevAnswers = prevYearSurveys.flatMap((s) =>
      s.responses.flatMap((r) =>
        r.answers.filter((a) => a.answerNumeric !== null && s.questions.some((q) => q.id === a.questionId && q.questionType.startsWith("rating")))
      )
    );
    if (prevAnswers.length > 0) {
      prevYearAvg = Math.round((prevAnswers.reduce((s, a) => s + a.answerNumeric!, 0) / prevAnswers.length) * 100) / 100;
    }
  }

  return NextResponse.json({
    year,
    annualAverage: annualAvg,
    prevYearAverage: prevYearAvg,
    yearOverYearChange: annualAvg && prevYearAvg ? Math.round((annualAvg - prevYearAvg) * 100) / 100 : null,
    totalSurveys: surveys.length,
    totalResponses: surveys.reduce((s, sv) => s + sv.responses.length, 0),
    totalDistributions: surveys.reduce((s, sv) => s + sv._count.distributions, 0),
    bestMonth: bestMonth ? { month: bestMonth.month, average: bestMonth.average } : null,
    worstMonth: worstMonth ? { month: worstMonth.month, average: worstMonth.average } : null,
    monthlyStats,
    serviceTypeStats,
  });
});
