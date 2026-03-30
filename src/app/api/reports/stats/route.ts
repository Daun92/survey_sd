import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/reports/stats — 만족도 집계 통계
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const surveyId = searchParams.get("surveyId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  // 대상 설문 결정
  const surveyWhere: Record<string, unknown> = {};
  if (surveyId) {
    surveyWhere.id = parseInt(surveyId);
  } else {
    if (year) surveyWhere.surveyYear = parseInt(year);
    if (month) surveyWhere.surveyMonth = parseInt(month);
  }

  const surveys = await prisma.survey.findMany({
    where: surveyWhere,
    include: {
      serviceType: true,
      questions: { orderBy: { questionOrder: "asc" } },
      responses: {
        where: { isComplete: true },
        include: { answers: true, customer: { select: { companyName: true } } },
      },
      _count: { select: { distributions: true } },
    },
  });

  if (surveys.length === 0) {
    return NextResponse.json({ surveys: [], overall: null });
  }

  const surveyStats = surveys.map((survey) => {
    const responses = survey.responses;
    const totalDistributions = survey._count.distributions;
    const totalResponses = responses.length;
    const responseRate = totalDistributions > 0
      ? Math.round((totalResponses / totalDistributions) * 100)
      : 0;

    // 문항별 통계
    const questionStats = survey.questions
      .filter((q) => q.questionType.startsWith("rating"))
      .map((q) => {
        const answers = responses.flatMap((r) =>
          r.answers.filter((a) => a.questionId === q.id && a.answerNumeric !== null)
        );
        const values = answers.map((a) => a.answerNumeric!);
        const avg = values.length > 0
          ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
          : 0;

        // 점수 분포
        const maxScore = q.questionType === "rating_5" ? 5 : 10;
        const distribution: Record<number, number> = {};
        for (let i = 1; i <= maxScore; i++) distribution[i] = 0;
        values.forEach((v) => { if (distribution[v] !== undefined) distribution[v]++; });

        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          category: q.category,
          questionOrder: q.questionOrder,
          average: avg,
          count: values.length,
          distribution,
        };
      });

    // 카테고리별 평균
    const categoryMap = new Map<string, number[]>();
    for (const qs of questionStats) {
      if (!qs.category || qs.count === 0) continue;
      const arr = categoryMap.get(qs.category) || [];
      arr.push(qs.average);
      categoryMap.set(qs.category, arr);
    }
    const categoryStats = Array.from(categoryMap.entries()).map(([category, avgs]) => ({
      category,
      average: Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 100) / 100,
      questionCount: avgs.length,
    }));

    // 전체 평균
    const allAvgs = questionStats.filter((q) => q.count > 0).map((q) => q.average);
    const overallAvg = allAvgs.length > 0
      ? Math.round((allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length) * 100) / 100
      : 0;

    return {
      surveyId: survey.id,
      title: survey.title,
      surveyYear: survey.surveyYear,
      surveyMonth: survey.surveyMonth,
      serviceType: survey.serviceType.name,
      serviceTypeId: survey.serviceTypeId,
      overallAverage: overallAvg,
      totalDistributions,
      totalResponses,
      responseRate,
      categoryStats,
      questionStats,
    };
  });

  // 서비스유형별 요약
  const byServiceType = new Map<string, { name: string; averages: number[]; responses: number }>();
  for (const s of surveyStats) {
    const cur = byServiceType.get(s.serviceType) || { name: s.serviceType, averages: [], responses: 0 };
    if (s.overallAverage > 0) cur.averages.push(s.overallAverage);
    cur.responses += s.totalResponses;
    byServiceType.set(s.serviceType, cur);
  }

  const serviceTypeStats = Array.from(byServiceType.values()).map((st) => ({
    serviceType: st.name,
    average: st.averages.length > 0
      ? Math.round((st.averages.reduce((s, v) => s + v, 0) / st.averages.length) * 100) / 100
      : 0,
    totalResponses: st.responses,
  }));

  // 전체 요약
  const allOveralls = surveyStats.filter((s) => s.overallAverage > 0).map((s) => s.overallAverage);
  const grandAverage = allOveralls.length > 0
    ? Math.round((allOveralls.reduce((s, v) => s + v, 0) / allOveralls.length) * 100) / 100
    : 0;

  return NextResponse.json({
    overall: {
      average: grandAverage,
      totalSurveys: surveys.length,
      totalResponses: surveyStats.reduce((s, v) => s + v.totalResponses, 0),
      totalDistributions: surveyStats.reduce((s, v) => s + v.totalDistributions, 0),
    },
    serviceTypeStats,
    surveys: surveyStats,
  });
}
