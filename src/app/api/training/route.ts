import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/training — 월별 교육실시여부 조회
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const records = await prisma.trainingRecord.findMany({
    where: { trainingYear: year, trainingMonth: month },
    include: {
      customer: { include: { serviceType: true } },
      serviceType: true,
    },
    orderBy: [{ serviceType: { name: "asc" } }, { customer: { companyName: "asc" } }],
  });

  // 영업담당자별 회신 현황 집계
  const byVerifier = new Map<string, { total: number; verified: number }>();
  for (const r of records) {
    const key = r.verifiedBy || "미지정";
    const cur = byVerifier.get(key) || { total: 0, verified: 0 };
    cur.total++;
    if (r.verifiedAt) cur.verified++;
    byVerifier.set(key, cur);
  }

  return NextResponse.json({
    records,
    summary: {
      total: records.length,
      hasTraining: records.filter((r) => r.hasTraining).length,
      noTraining: records.filter((r) => !r.hasTraining).length,
      byVerifier: Object.fromEntries(byVerifier),
    },
  });
}

// POST /api/training — 수동 등록
export async function POST(request: NextRequest) {
  const body = await request.json();

  const record = await prisma.trainingRecord.upsert({
    where: {
      customerId_trainingYear_trainingMonth: {
        customerId: body.customerId,
        trainingYear: body.trainingYear,
        trainingMonth: body.trainingMonth,
      },
    },
    update: {
      hasTraining: body.hasTraining,
      trainingName: body.trainingName || null,
      verifiedBy: body.verifiedBy || null,
      verifiedAt: new Date(),
      notes: body.notes || null,
    },
    create: {
      customerId: body.customerId,
      trainingYear: body.trainingYear,
      trainingMonth: body.trainingMonth,
      serviceTypeId: body.serviceTypeId,
      hasTraining: body.hasTraining,
      trainingName: body.trainingName || null,
      verifiedBy: body.verifiedBy || null,
      verifiedAt: new Date(),
      notes: body.notes || null,
    },
    include: { customer: true, serviceType: true },
  });

  return NextResponse.json(record, { status: 201 });
}
