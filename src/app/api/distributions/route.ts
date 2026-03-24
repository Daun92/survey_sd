import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// GET /api/distributions — 배포 목록 조회
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const surveyId = searchParams.get("surveyId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (surveyId) where.surveyId = parseInt(surveyId);
  if (status) where.status = status;

  const distributions = await prisma.distribution.findMany({
    where,
    include: {
      customer: { include: { serviceType: true } },
      survey: true,
      responses: { select: { id: true, respondedAt: true, isComplete: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 요약 집계
  const total = distributions.length;
  const sent = distributions.filter((d) => d.status !== "pending").length;
  const responded = distributions.filter((d) => d.status === "responded").length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  return NextResponse.json({
    distributions,
    summary: { total, sent, responded, responseRate },
  });
}

// POST /api/distributions — 대량 배포 생성
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { surveyId, customerIds, channel = "email" } = body as {
    surveyId: number;
    customerIds: number[];
    channel: string;
  };

  if (!surveyId || !customerIds?.length) {
    return NextResponse.json(
      { error: "surveyId와 customerIds가 필요합니다" },
      { status: 400 }
    );
  }

  // 이미 배포된 고객사 제외
  const existing = await prisma.distribution.findMany({
    where: { surveyId },
    select: { customerId: true },
  });
  const existingIds = new Set(existing.map((d) => d.customerId));
  const newCustomerIds = customerIds.filter((id) => !existingIds.has(id));

  if (newCustomerIds.length === 0) {
    return NextResponse.json(
      { error: "모든 고객사가 이미 배포되었습니다", created: 0 },
      { status: 400 }
    );
  }

  // 대량 생성
  const created = await prisma.distribution.createMany({
    data: newCustomerIds.map((customerId) => ({
      surveyId,
      customerId,
      channel,
      responseToken: uuidv4(),
      status: "pending",
    })),
  });

  // 설문 상태 업데이트
  await prisma.survey.update({
    where: { id: surveyId },
    data: { status: "distributing" },
  });

  // 생성된 배포 목록 반환
  const distributions = await prisma.distribution.findMany({
    where: { surveyId, customerId: { in: newCustomerIds } },
    include: { customer: true },
    orderBy: { customer: { companyName: "asc" } },
  });

  return NextResponse.json(
    { created: created.count, distributions, skipped: customerIds.length - newCustomerIds.length },
    { status: 201 }
  );
}
