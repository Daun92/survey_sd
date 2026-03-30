import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { updateCustomerSchema } from "@/lib/validations/customer";

// GET /api/customers/:id
export const GET = withAuth({ type: "auth" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const customer = await prisma.customer.findUnique({
    where: { id: parseInt(id) },
    include: { serviceType: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "고객사를 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(customer);
});

// PUT /api/customers/:id
export const PUT = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();
  const data = updateCustomerSchema.parse(body);

  const customer = await prisma.customer.update({
    where: { id: parseInt(id) },
    data: {
      companyName: data.companyName,
      contactName: data.contactName ?? undefined,
      contactTitle: data.contactTitle ?? undefined,
      email: data.email ?? undefined,
      phone: data.phone ?? undefined,
      serviceTypeId: data.serviceTypeId ?? undefined,
      salesRep: data.salesRep ?? undefined,
      salesTeam: data.salesTeam ?? undefined,
      ecoScore: data.ecoScore ?? undefined,
      notes: data.notes ?? undefined,
    },
    include: { serviceType: true },
  });

  return NextResponse.json(customer);
});

// DELETE /api/customers/:id (soft delete)
export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  await prisma.customer.update({
    where: { id: parseInt(id) },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
});
