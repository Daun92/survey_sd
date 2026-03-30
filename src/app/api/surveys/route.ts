import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { createSurveySchema } from "@/lib/validations/survey";
import { surveyRepository } from "@/lib/repositories";

// GET /api/surveys — 설문 목록
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const serviceTypeId = searchParams.get("serviceTypeId");
  const status = searchParams.get("status");

  const result = await surveyRepository.findMany({
    year: year ? parseInt(year) : undefined,
    month: month ? parseInt(month) : undefined,
    serviceTypeId: serviceTypeId ? parseInt(serviceTypeId) : undefined,
    status: status || undefined,
  });

  return NextResponse.json(result);
});

// POST /api/surveys — 설문 생성 (템플릿에서 복제 가능)
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const body = await request.json();
  const data = createSurveySchema.parse(body);

  const survey = await surveyRepository.create(data);

  // 템플릿에서 문항 복제
  if (data.templateId) {
    await surveyRepository.cloneQuestionsFromTemplate(survey.id, data.templateId);
  }

  // 이전 설문에서 복제
  if (data.cloneFromSurveyId) {
    await surveyRepository.cloneQuestionsFromSurvey(survey.id, data.cloneFromSurveyId);
  }

  const result = await surveyRepository.findById(survey.id);
  return NextResponse.json(result, { status: 201 });
});
