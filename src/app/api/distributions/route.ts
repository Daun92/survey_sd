import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { distributionRepository } from "@/lib/repositories";

// GET /api/distributions — 배포 목록 조회
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const surveyId = searchParams.get("surveyId");
  const status = searchParams.get("status");

  const result = await distributionRepository.findMany({
    surveyId: surveyId ? parseInt(surveyId) : undefined,
    status: status || undefined,
  });

  return NextResponse.json(result);
});

// POST /api/distributions — 대량 배포 생성
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const body = await request.json();
  const { surveyId, customerIds, channel = "email", projectNames } = body as {
    surveyId: number;
    customerIds: number[];
    channel: string;
    projectNames?: Record<number, string>;
  };

  if (!surveyId || !customerIds?.length) {
    return NextResponse.json(
      { error: "surveyId와 customerIds가 필요합니다" },
      { status: 400 }
    );
  }

  const result = await distributionRepository.createBatch({
    surveyId,
    customerIds,
    channel,
    projectNames,
  });

  if (result.created === 0) {
    return NextResponse.json(
      { error: "모든 고객사가 이미 배포되었습니다", created: 0 },
      { status: 400 }
    );
  }

  return NextResponse.json(result, { status: 201 });
});
