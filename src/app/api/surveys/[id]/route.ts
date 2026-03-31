import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { updateSurveyApiSchema } from "@/lib/validations/survey";
import { surveyRepository } from "@/lib/repositories";

// GET /api/surveys/:id
export const GET = withAuth({ type: "auth" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const survey = await surveyRepository.findById(parseInt(id));
  if (!survey) {
    return NextResponse.json({ error: "설문을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(survey);
});

// PUT /api/surveys/:id
export const PUT = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();
  const data = updateSurveyApiSchema.parse(body);

  const survey = await surveyRepository.update(parseInt(id), {
    title: data.title,
    status: data.status,
    description: data.description,
    trainingMonth: data.trainingMonth,
    internalLabel: data.internalLabel,
    showProjectName: data.showProjectName !== undefined
      ? (data.showProjectName === true || data.showProjectName === "true")
      : undefined,
  });

  return NextResponse.json(survey);
});

// DELETE /api/surveys/:id
export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  await surveyRepository.delete(parseInt(id));
  return NextResponse.json({ success: true });
});
