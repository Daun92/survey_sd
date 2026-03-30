import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { addQuestionApiSchema, updateQuestionsApiSchema } from "@/lib/validations/survey";

// POST /api/surveys/:id/questions — 문항 추가
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();
  const data = addQuestionApiSchema.parse(body);

  const question = await prisma.surveyQuestion.create({
    data: {
      surveyId: parseInt(id),
      questionOrder: data.questionOrder,
      questionText: data.questionText,
      questionType: data.questionType,
      category: data.category || null,
      isRequired: data.isRequired ?? true,
      optionsJson: data.options ? JSON.stringify(data.options) : null,
    },
  });

  return NextResponse.json(question, { status: 201 });
});

// PUT /api/surveys/:id/questions — 문항 일괄 업데이트 (순서 변경 등)
export const PUT = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();
  const { questions: updates } = updateQuestionsApiSchema.parse(body);

  await Promise.all(
    updates.map((q) =>
      prisma.surveyQuestion.update({
        where: { id: q.id },
        data: {
          questionOrder: q.questionOrder,
          questionText: q.questionText,
          questionType: q.questionType,
          category: q.category || null,
          isRequired: q.isRequired ?? true,
          optionsJson: q.options ? JSON.stringify(q.options) : null,
        },
      })
    )
  );

  const questions = await prisma.surveyQuestion.findMany({
    where: { surveyId: parseInt(id) },
    orderBy: { questionOrder: "asc" },
  });

  return NextResponse.json(questions);
});

// DELETE /api/surveys/:id/questions — 문항 삭제 (body에 questionId)
export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest, ctx) => {
  const body = await request.json();

  await prisma.surveyQuestion.delete({
    where: { id: body.questionId },
  });

  return NextResponse.json({ success: true });
});
