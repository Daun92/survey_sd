import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

// GET /api/reports/voc — 주관식(텍스트) 응답 조회
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const surveyId = searchParams.get("surveyId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const surveyWhere: Record<string, unknown> = {};
  if (surveyId) surveyWhere.id = parseInt(surveyId);
  if (year) surveyWhere.surveyYear = parseInt(year);
  if (month) surveyWhere.surveyMonth = parseInt(month);

  // 텍스트 유형 문항의 응답만 조회
  const answers = await prisma.responseAnswer.findMany({
    where: {
      answerValue: { not: "" },
      question: { questionType: "text" },
      response: {
        isComplete: true,
        survey: Object.keys(surveyWhere).length > 0 ? surveyWhere : undefined,
      },
    },
    include: {
      response: {
        include: {
          customer: { select: { companyName: true } },
          survey: { select: { title: true, serviceType: { select: { name: true } } } },
        },
      },
      question: { select: { questionText: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const responses = answers
    .filter((a) => a.answerValue && a.answerValue.trim().length > 0)
    .map((a) => ({
      customer: a.response.customer.companyName,
      surveyTitle: a.response.survey.title,
      serviceType: a.response.survey.serviceType.name,
      question: a.question.questionText,
      category: a.question.category,
      answer: a.answerValue!,
    }));

  // 카테고리별 분류 (긍정 vs 개선)
  const positive = responses.filter((r) =>
    r.question.includes("만족") || r.question.includes("좋") || r.category === "주관식" && r.question.includes("만족")
  );
  const improvement = responses.filter((r) =>
    r.question.includes("개선") || r.question.includes("건의") || r.question.includes("불만")
  );

  return NextResponse.json({
    responses,
    summary: {
      total: responses.length,
      positive: positive.length,
      improvement: improvement.length,
    },
  });
});
