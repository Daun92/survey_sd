import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { createSurveySchema } from "@/lib/validations/survey";

// GET /api/surveys — 설문 목록
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
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
      distributions: { select: { projectName: true }, where: { projectName: { not: null } } },
      _count: { select: { questions: true, distributions: true, responses: true } },
    },
    orderBy: [{ surveyYear: "desc" }, { surveyMonth: "desc" }],
  });

  // 프로젝트명 요약 추가
  const result = surveys.map((s) => {
    const projectNames = [...new Set(s.distributions.map((d) => d.projectName).filter(Boolean))];
    const { distributions: _d, ...rest } = s;
    return { ...rest, projectNames };
  });

  return NextResponse.json(result);
});

// POST /api/surveys — 설문 생성 (템플릿에서 복제 가능)
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const body = await request.json();
  const data = createSurveySchema.parse(body);

  const survey = await prisma.survey.create({
    data: {
      title: data.title,
      serviceTypeId: data.serviceTypeId,
      surveyYear: data.surveyYear,
      surveyMonth: data.surveyMonth,
      trainingMonth: data.trainingMonth ?? null,
      internalLabel: data.internalLabel || null,
      status: "draft",
      description: data.description || null,
    },
  });

  // 템플릿에서 문항 복제
  if (data.templateId) {
    const template = await prisma.questionTemplate.findUnique({
      where: { id: data.templateId },
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
  if (data.cloneFromSurveyId) {
    const sourceQuestions = await prisma.surveyQuestion.findMany({
      where: { surveyId: data.cloneFromSurveyId },
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
});
