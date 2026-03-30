import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/responses/manual — 수동 응답 입력
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { surveyId, customerId, answers } = body as {
    surveyId: number;
    customerId: number;
    answers: Array<{ questionId: number; value: string }>;
  };

  if (!surveyId || !customerId || !answers?.length) {
    return NextResponse.json({ error: "surveyId, customerId, answers가 필요합니다" }, { status: 400 });
  }

  // 기존 Distribution 연결 (있으면)
  const distribution = await prisma.distribution.findFirst({
    where: { surveyId, customerId },
  });

  const response = await prisma.response.create({
    data: {
      distributionId: distribution?.id ?? null,
      surveyId,
      customerId,
      respondedAt: new Date(),
      isComplete: true,
      source: "manual",
    },
  });

  await prisma.responseAnswer.createMany({
    data: answers.map((a) => {
      const numeric = parseFloat(a.value);
      return {
        responseId: response.id,
        questionId: a.questionId,
        answerValue: a.value,
        answerNumeric: isNaN(numeric) ? null : numeric,
      };
    }),
  });

  // Distribution 상태 업데이트
  if (distribution) {
    await prisma.distribution.update({
      where: { id: distribution.id },
      data: { status: "responded" },
    });
  }

  return NextResponse.json({ success: true, responseId: response.id }, { status: 201 });
}
