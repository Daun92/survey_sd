import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/surveys — 설문 목록
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const serviceTypeId = searchParams.get("serviceTypeId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (year) where.surveyYear = parseInt(year);
  if (month) where.surveyMonth = parseInt(month);
  if (serviceTypeId) where.serviceTypeId = parseInt(serviceTypeId);
  if (status) where.status = status;

  const surveys = await prisma.survey.findMany({
    where,
    include: {
      serviceType: true,
      _count: { select: { questions: true, distributions: true, responses: true } },
    },
    orderBy: [{ surveyYear: "desc" }, { surveyMonth: "desc" }],
  });

  return NextResponse.json(surveys);
}

// POST /api/surveys — 설문 생성 (템플릿에서 복제 가능)
export async function POST(request: NextRequest) {
  const body = await request.json();

  const survey = await prisma.survey.create({
    data: {
      title: body.title,
      serviceTypeId: body.serviceTypeId,
      surveyYear: body.surveyYear,
      surveyMonth: body.surveyMonth,
      trainingMonth: body.trainingMonth ?? null,
      status: "draft",
      description: body.description || null,
    },
  });

  // 템플릿에서 문항 복제
  if (body.templateId) {
    const template = await prisma.questionTemplate.findUnique({
      where: { id: body.templateId },
    });
    if (template) {
      let questions: Array<{
        questionOrder: number;
        questionText: string;
        questionType: string;
        category: string;
        isRequired?: boolean;
        options?: string[] | null;
      }> = [];
      try {
        questions = JSON.parse(template.questionsJson);
      } catch {
        // 잘못된 JSON은 빈 배열로 처리
      }
      await prisma.surveyQuestion.createMany({
        data: questions.map((q) => ({
          surveyId: survey.id,
          questionOrder: q.questionOrder,
          questionText: q.questionText,
          questionType: q.questionType,
          category: q.category || null,
          isRequired: q.isRequired ?? true,
          optionsJson: q.options ? JSON.stringify(q.options) : null,
        })),
      });
    }
  }

  // 이전 설문에서 복제
  if (body.cloneFromSurveyId) {
    const sourceQuestions = await prisma.surveyQuestion.findMany({
      where: { surveyId: body.cloneFromSurveyId },
      orderBy: { questionOrder: "asc" },
    });
    await prisma.surveyQuestion.createMany({
      data: sourceQuestions.map((q) => ({
        surveyId: survey.id,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        questionType: q.questionType,
        category: q.category,
        isRequired: q.isRequired,
        optionsJson: q.optionsJson,
      })),
    });
  }

  const result = await prisma.survey.findUnique({
    where: { id: survey.id },
    include: { serviceType: true, questions: { orderBy: { questionOrder: "asc" } } },
  });

  return NextResponse.json(result, { status: 201 });
}
