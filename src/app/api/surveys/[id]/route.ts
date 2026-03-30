import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/surveys/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
}

// PUT /api/surveys/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const survey = await prisma.survey.update({
    where: { id: parseInt(id) },
    data: {
      title: body.title ?? undefined,
      status: body.status ?? undefined,
      description: body.description ?? undefined,
      trainingMonth: body.trainingMonth ?? undefined,
      showProjectName: body.showProjectName !== undefined
        ? (body.showProjectName === true || body.showProjectName === "true")
        : undefined,
    },
    include: { serviceType: true },
  });

  return NextResponse.json(survey);
}

// DELETE /api/surveys/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.survey.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
