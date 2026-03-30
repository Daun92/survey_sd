import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { updateSurveyApiSchema } from "@/lib/validations/survey";

// GET /api/surveys/:id
export const GET = withAuth({ type: "auth" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const survey = await prisma.survey.findUnique({
    where: { id: parseInt(id) },
    include: {
      serviceType: true,
      questions: { orderBy: { questionOrder: "asc" } },
      _count: { select: { distributions: true, responses: true } },
    },
  });

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

  const survey = await prisma.survey.update({
    where: { id: parseInt(id) },
    data: {
      title: data.title ?? undefined,
      status: data.status ?? undefined,
      description: data.description ?? undefined,
      trainingMonth: data.trainingMonth ?? undefined,
      internalLabel: data.internalLabel !== undefined ? (data.internalLabel || null) : undefined,
      showProjectName: data.showProjectName !== undefined
        ? (data.showProjectName === true || data.showProjectName === "true")
        : undefined,
    },
    include: { serviceType: true },
  });

  return NextResponse.json(survey);
});

// DELETE /api/surveys/:id
export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  await prisma.survey.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
});
