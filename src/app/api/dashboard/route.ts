import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

// GET /api/dashboard — 대시보드 요약 통계
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [customerCount, surveyCount, distributionStats, responseStats] = await Promise.all([
    prisma.customer.count({ where: { isActive: true } }),
    prisma.survey.count({ where: { surveyYear: year, surveyMonth: month } }),
    prisma.distribution.groupBy({
      by: ["status"],
      where: { survey: { surveyYear: year, surveyMonth: month } },
      _count: true,
    }),
    prisma.response.count({
      where: { isComplete: true, survey: { surveyYear: year, surveyMonth: month } },
    }),
  ]);

  const totalDistributed = distributionStats.reduce((s, d) => s + d._count, 0);
  const totalResponded = distributionStats
    .filter((d) => d.status === "responded")
    .reduce((s, d) => s + d._count, 0);

  // 이번 달 평균 만족도
  const avgResult = await prisma.responseAnswer.aggregate({
    _avg: { answerNumeric: true },
    where: {
      answerNumeric: { not: null },
      question: { questionType: { startsWith: "rating" } },
      response: { isComplete: true, survey: { surveyYear: year, surveyMonth: month } },
    },
  });

  return NextResponse.json({
    customerCount,
    surveyCount,
    totalDistributed,
    totalResponded,
    responseRate: totalDistributed > 0 ? Math.round((totalResponded / totalDistributed) * 100) : 0,
    averageSatisfaction: avgResult._avg.answerNumeric
      ? Math.round(avgResult._avg.answerNumeric * 100) / 100
      : null,
    year,
    month,
  });
});
