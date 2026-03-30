import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { addQuestionApiSchema, updateQuestionsApiSchema } from "@/lib/validations/survey";
import { questionRepository } from "@/lib/repositories";

// POST /api/surveys/:id/questions — 문항 추가
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();
  const data = addQuestionApiSchema.parse(body);

  const question = await questionRepository.create({
    surveyId: parseInt(id),
    ...data,
  });

  return NextResponse.json(question, { status: 201 });
});

// PUT /api/surveys/:id/questions — 문항 일괄 업데이트 (트랜잭션 사용)
export const PUT = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();
  const { questions } = updateQuestionsApiSchema.parse(body);

  await questionRepository.updateMany(questions);

  const updated = await questionRepository.findBySurveyId(parseInt(id));
  return NextResponse.json(updated);
});

// DELETE /api/surveys/:id/questions — 문항 삭제 (body에 questionId)
export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest) => {
  const body = await request.json();
  await questionRepository.delete(body.questionId);
  return NextResponse.json({ success: true });
});
