import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generatePpt } from "@/lib/ppt-generator";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const surveyId = searchParams.get("surveyId");
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const surveyWhere: Record<string, unknown> = {};
  if (surveyId) surveyWhere.id = parseInt(surveyId);
  else { surveyWhere.surveyYear = year; surveyWhere.surveyMonth = month; }

  // 통계 데이터 수집 (stats API 로직 재사용)
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
    return NextResponse.json({ error: "데이터가 없습니다" }, { status: 404 });
  }

  // 설문별 통계 계산
  const surveyStats = surveys.map((survey) => {
    const questionStats = survey.questions
      .filter((q) => q.questionType.startsWith("rating"))
      .map((q) => {
        const values = survey.responses
          .flatMap((r) => r.answers.filter((a) => a.questionId === q.id && a.answerNumeric !== null))
          .map((a) => a.answerNumeric!);
        const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
        const distribution: Record<number, number> = {};
        for (let i = 1; i <= 5; i++) distribution[i] = 0;
        values.forEach((v) => { if (distribution[v] !== undefined) distribution[v]++; });
        return { questionText: q.questionText, category: q.category, average: Math.round(avg * 100) / 100, count: values.length, distribution };
      });

    const categoryMap = new Map<string, number[]>();
    questionStats.forEach((qs) => {
      if (!qs.category || qs.count === 0) return;
      const arr = categoryMap.get(qs.category) || [];
      arr.push(qs.average);
      categoryMap.set(qs.category, arr);
    });
    const categoryStats = Array.from(categoryMap.entries()).map(([category, avgs]) => ({
      category, average: Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 100) / 100,
    }));

    const allAvgs = questionStats.filter((q) => q.count > 0).map((q) => q.average);
    const overallAvg = allAvgs.length > 0 ? Math.round((allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length) * 100) / 100 : 0;

    return {
      surveyId: survey.id, title: survey.title, surveyYear: survey.surveyYear, surveyMonth: survey.surveyMonth,
      serviceType: survey.serviceType.name, overallAverage: overallAvg,
      totalDistributions: survey._count.distributions, totalResponses: survey.responses.length,
      responseRate: survey._count.distributions > 0 ? Math.round((survey.responses.length / survey._count.distributions) * 100) : 0,
      categoryStats, questionStats,
    };
  });

  // 서비스유형별 요약
  const byServiceType = new Map<string, { averages: number[]; responses: number }>();
  surveyStats.forEach((s) => {
    const cur = byServiceType.get(s.serviceType) || { averages: [], responses: 0 };
    if (s.overallAverage > 0) cur.averages.push(s.overallAverage);
    cur.responses += s.totalResponses;
    byServiceType.set(s.serviceType, cur);
  });
  const serviceTypeStats = Array.from(byServiceType.entries()).map(([st, v]) => ({
    serviceType: st,
    average: v.averages.length > 0 ? Math.round((v.averages.reduce((s, a) => s + a, 0) / v.averages.length) * 100) / 100 : 0,
    totalResponses: v.responses,
  }));

  // VOC 데이터
  const vocAnswers = await prisma.responseAnswer.findMany({
    where: {
      answerValue: { not: "" },
      question: { questionType: "text" },
      response: { isComplete: true, survey: surveyWhere },
    },
    include: {
      response: { include: { customer: { select: { companyName: true } } } },
      question: { select: { questionText: true, category: true } },
    },
  });
  const voc = vocAnswers
    .filter((a) => a.answerValue?.trim())
    .map((a) => ({ customer: a.response.customer.companyName, question: a.question.questionText, answer: a.answerValue!, category: a.question.category }));

  const allOveralls = surveyStats.filter((s) => s.overallAverage > 0).map((s) => s.overallAverage);
  const grandAvg = allOveralls.length > 0 ? Math.round((allOveralls.reduce((s, v) => s + v, 0) / allOveralls.length) * 100) / 100 : 0;

  // PPT 생성
  const pptx = generatePpt({
    year, month,
    overall: {
      average: grandAvg,
      totalSurveys: surveys.length,
      totalResponses: surveyStats.reduce((s, v) => s + v.totalResponses, 0),
      totalDistributions: surveyStats.reduce((s, v) => s + v.totalDistributions, 0),
    },
    serviceTypeStats,
    surveys: surveyStats,
    voc,
  });

  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  const uint8 = new Uint8Array(buffer);
  const fileName = `${year}년_${month}월_고객관계개선회의_보고서.pptx`;

  return new NextResponse(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
