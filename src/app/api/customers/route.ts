import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { createCustomerSchema } from "@/lib/validations/customer";

// GET /api/customers — 고객사 목록 조회
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const serviceTypeId = searchParams.get("serviceTypeId");
  const salesTeam = searchParams.get("salesTeam");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { isActive: true };

  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { salesRep: { contains: search, mode: "insensitive" } },
    ];
  }
  if (serviceTypeId) {
    where.serviceTypeId = parseInt(serviceTypeId);
  }
  if (salesTeam) {
    where.salesTeam = { contains: salesTeam, mode: "insensitive" };
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { serviceType: true },
      orderBy: { companyName: "asc" },
      skip,
      take: limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({ customers, total, page, limit });
});

// POST /api/customers — 고객사 신규 등록
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const body = await request.json();
  const data = createCustomerSchema.parse(body);

  const customer = await prisma.customer.create({
    data: {
      companyName: data.companyName,
      contactName: data.contactName || null,
      contactTitle: data.contactTitle || null,
      email: data.email || null,
      phone: data.phone || null,
      serviceTypeId: data.serviceTypeId,
      salesRep: data.salesRep || null,
      salesTeam: data.salesTeam || null,
      ecoScore: data.ecoScore || null,
      notes: data.notes || null,
    },
    include: { serviceType: true },
  });

  return NextResponse.json(customer, { status: 201 });
});
