import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { createCustomerSchema } from "@/lib/validations/customer";
import { customerRepository } from "@/lib/repositories";

// GET /api/customers — 고객사 목록 조회
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const serviceTypeId = searchParams.get("serviceTypeId");
  const salesTeam = searchParams.get("salesTeam");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const result = await customerRepository.findMany({
    search: search || undefined,
    serviceTypeId: serviceTypeId ? parseInt(serviceTypeId) : undefined,
    salesTeam: salesTeam || undefined,
    page,
    limit,
  });

  return NextResponse.json({
    customers: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

// POST /api/customers — 고객사 신규 등록
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const body = await request.json();
  const data = createCustomerSchema.parse(body);
  const customer = await customerRepository.create(data);
  return NextResponse.json(customer, { status: 201 });
});
