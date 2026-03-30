import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type StepStatus = "pending" | "in_progress" | "completed";

interface WorkflowStep {
  step: number;
  title: string;
  status: StepStatus;
  detail: string;
  href: string;
}

// GET /api/workflow/status — 워크플로우 단계별 상태
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  // 이전 월 교육 (예: 3월 조사 = 2월 교육)
  const trainingMonth = month === 1 ? 12 : month - 1;
  const trainingYear = month === 1 ? year - 1 : year;

  // 1. 교육 실시 여부 확인
  const trainingCount = await prisma.trainingRecord.count({
    where: { trainingYear, trainingMonth },
  });

  // 2. 대상자 리스트 (교육 실시 = true)
  const targetCount = await prisma.trainingRecord.count({
    where: { trainingYear, trainingMonth, hasTraining: true },
  });

  // 3~4. 배포/응답 현황
  const surveys = await prisma.survey.findMany({
    where: { surveyYear: year, surveyMonth: month },
    select: { id: true },
  });
  const surveyIds = surveys.map((s) => s.id);

  const distributionCount = surveyIds.length > 0
    ? await prisma.distribution.count({ where: { surveyId: { in: surveyIds } } })
    : 0;

  const respondedCount = surveyIds.length > 0
    ? await prisma.distribution.count({ where: { surveyId: { in: surveyIds }, status: "responded" } })
    : 0;

  const responseRate = distributionCount > 0 ? Math.round((respondedCount / distributionCount) * 100) : 0;

  // 5. 응답 데이터 존재 여부
  const responseCount = surveyIds.length > 0
    ? await prisma.response.count({ where: { surveyId: { in: surveyIds }, isComplete: true } })
    : 0;

  // 6. 보고서 존재 여부
  const reportCount = await prisma.monthlyReport.count({
    where: { reportYear: year, reportMonth: month },
  });

  // 상태 결정
  function stepStatus(hasData: boolean, isComplete: boolean): StepStatus {
    if (isComplete) return "completed";
    if (hasData) return "in_progress";
    return "pending";
  }

  const steps: WorkflowStep[] = [
    {
      step: 1,
      title: "교육 실시 여부 확인",
      status: stepStatus(trainingCount > 0, trainingCount > 0),
      detail: trainingCount > 0 ? `${trainingCount}건 확인` : "미확인",
      href: "/training",
    },
    {
      step: 2,
      title: "CS 대상자 리스트 작성",
      status: stepStatus(targetCount > 0, targetCount > 0),
      detail: targetCount > 0 ? `${targetCount}건 대상` : "대상 없음",
      href: "/training/target-list",
    },
    {
      step: 3,
      title: "설문 배포",
      status: stepStatus(distributionCount > 0, distributionCount > 0 && respondedCount > 0),
      detail: distributionCount > 0 ? `${distributionCount}건 배포` : "미배포",
      href: "/distribute",
    },
    {
      step: 4,
      title: "응답 수집",
      status: stepStatus(respondedCount > 0, responseRate >= 80),
      detail: distributionCount > 0 ? `${respondedCount}/${distributionCount} (${responseRate}%)` : "-",
      href: "/distribute",
    },
    {
      step: 5,
      title: "데이터 집계",
      status: stepStatus(responseCount > 0, responseCount >= 3),
      detail: responseCount > 0 ? `${responseCount}건 응답` : "데이터 없음",
      href: "/reports",
    },
    {
      step: 6,
      title: "보고서 작성",
      status: stepStatus(reportCount > 0, reportCount > 0),
      detail: reportCount > 0 ? "작성 완료" : "미작성",
      href: "/reports",
    },
  ];

  return NextResponse.json({ year, month, steps });
}
