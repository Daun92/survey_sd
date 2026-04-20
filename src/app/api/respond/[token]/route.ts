/**
 * @deprecated Prisma 기반 응답자 API. `/respond/[token]` 페이지 전용. 실사용 경로는
 * Supabase edu_* 기반이며 `/s/[token]` → `/api/surveys/[token]/submit` (Supabase insert)
 * 또는 admin/distribute actions.ts 를 통해 처리됨. 신규 작업 금지.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

// GET /api/respond/:token — 설문 로드
export const GET = withAuth({ type: "public" }, async (request: NextRequest, ctx) => {
  const token = ctx.params?.token;
  if (!token) return NextResponse.json({ error: "Token이 필요합니다" }, { status: 400 });

  const distribution = await prisma.distribution.findUnique({
    where: { responseToken: token },
    include: {
      survey: {
        include: {
          serviceType: true,
          questions: { orderBy: { questionOrder: "asc" } },
        },
      },
      customer: { select: { companyName: true, contactName: true } },
      responses: { select: { id: true } },
    },
  });

  if (!distribution) {
    return NextResponse.json({ error: "invalid_token", message: "유효하지 않은 링크입니다" }, { status: 404 });
  }

  if (distribution.status === "responded" || distribution.responses.length > 0) {
    return NextResponse.json({ error: "already_responded", message: "이미 응답을 완료하셨습니다" }, { status: 410 });
  }

  if (distribution.survey.status === "closed" || distribution.survey.status === "reported") {
    return NextResponse.json({ error: "survey_closed", message: "설문이 마감되었습니다" }, { status: 410 });
  }

  // 열람 상태로 업데이트
  if (distribution.status === "pending" || distribution.status === "sent") {
    await prisma.distribution.update({
      where: { id: distribution.id },
      data: { status: "opened" },
    });
  }

  return NextResponse.json({
    survey: {
      id: distribution.survey.id,
      title: distribution.survey.title,
      description: distribution.survey.description ?? null,
      serviceType: distribution.survey.serviceType.name,
      surveyYear: distribution.survey.surveyYear,
      surveyMonth: distribution.survey.surveyMonth,
    },
    questions: distribution.survey.questions.map((q) => ({
      id: q.id,
      order: q.questionOrder,
      text: q.questionText,
      type: q.questionType,
      category: q.category,
      required: q.isRequired,
      options: q.optionsJson ? (() => { try { return JSON.parse(q.optionsJson); } catch { return null; } })() : null,
    })),
    customer: distribution.customer,
  });
});

// POST /api/respond/:token — 응답 제출
export const POST = withAuth({ type: "public" }, async (request: NextRequest, ctx) => {
  const token = ctx.params?.token;
  if (!token) return NextResponse.json({ error: "Token이 필요합니다" }, { status: 400 });
  const body = await request.json();
  const { answers } = body as { answers: Array<{ questionId: number; value: string }> };

  if (!answers?.length) {
    return NextResponse.json({ error: "응답 데이터가 없습니다" }, { status: 400 });
  }

  // 트랜잭션으로 이중 제출 방지 + 원자적 저장
  try {
    const result = await prisma.$transaction(async (tx) => {
      const distribution = await tx.distribution.findUnique({
        where: { responseToken: token },
        include: { responses: { select: { id: true } } },
      });

      if (!distribution) {
        throw new Error("NOT_FOUND");
      }

      if (distribution.status === "responded" || distribution.responses.length > 0) {
        throw new Error("ALREADY_RESPONDED");
      }

      const response = await tx.response.create({
        data: {
          distributionId: distribution.id,
          surveyId: distribution.surveyId,
          customerId: distribution.customerId,
          respondedAt: new Date(),
          isComplete: true,
          source: "web",
        },
      });

      await tx.responseAnswer.createMany({
        data: answers.map((a) => {
          const numeric = parseFloat(a.value);
          return {
            responseId: response.id,
            questionId: a.questionId,
            answerValue: String(a.value),
            answerNumeric: isNaN(numeric) ? null : numeric,
          };
        }),
      });

      await tx.distribution.update({
        where: { id: distribution.id },
        data: { status: "responded" },
      });

      return response.id;
    });

    return NextResponse.json({ success: true, responseId: result });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "유효하지 않은 링크입니다" }, { status: 404 });
    }
    if (msg === "ALREADY_RESPONDED") {
      return NextResponse.json({ error: "이미 응답을 완료하셨습니다" }, { status: 410 });
    }
    return NextResponse.json({ error: "제출 중 오류가 발생했습니다" }, { status: 500 });
  }
});
