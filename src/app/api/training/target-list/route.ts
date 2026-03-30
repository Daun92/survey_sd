import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/training/target-list — 교육 실시한 고객사 = 설문/인터뷰 대상
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  const records = await prisma.trainingRecord.findMany({
    where: {
      trainingYear: year,
      trainingMonth: month,
      hasTraining: true,
    },
    include: {
      customer: { include: { serviceType: true } },
      serviceType: true,
    },
    orderBy: [{ serviceType: { name: "asc" } }, { customer: { companyName: "asc" } }],
  });

  return NextResponse.json({
    targets: records.map((r) => ({
      customerId: r.customerId,
      companyName: r.customer.companyName,
      contactName: r.customer.contactName,
      email: r.customer.email,
      phone: r.customer.phone,
      serviceType: r.serviceType.name,
      serviceTypeId: r.serviceTypeId,
      trainingName: r.trainingName,
      salesRep: r.customer.salesRep,
      salesTeam: r.customer.salesTeam,
    })),
    total: records.length,
  });
}
