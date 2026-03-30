import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/surveys/:id/questions — 문항 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const question = await prisma.surveyQuestion.create({
    data: {
      surveyId: parseInt(id),
      questionOrder: body.questionOrder,
      questionText: body.questionText,
      questionType: body.questionType,
      category: body.category || null,
      isRequired: body.isRequired ?? true,
      optionsJson: body.options ? JSON.stringify(body.options) : null,
    },
  });

  return NextResponse.json(question, { status: 201 });
}

// PUT /api/surveys/:id/questions — 문항 일괄 업데이트 (순서 변경 등)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // body.questions: Array<{ id, questionOrder, questionText, questionType, category, isRequired }>
  const updates = body.questions as Array<{
    id: number;
    questionOrder: number;
    questionText: string;
    questionType: string;
    category?: string;
    isRequired?: boolean;
    options?: string[];
  }>;

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
}

// DELETE /api/surveys/:id/questions — 문항 삭제 (body에 questionId)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // consume params
  const body = await request.json();

  await prisma.surveyQuestion.delete({
    where: { id: body.questionId },
  });

  return NextResponse.json({ success: true });
}
