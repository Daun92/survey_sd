import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/customers/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: parseInt(id) },
    include: { serviceType: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "고객사를 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(customer);
}

// PUT /api/customers/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const customer = await prisma.customer.update({
    where: { id: parseInt(id) },
    data: {
      companyName: body.companyName,
      contactName: body.contactName ?? undefined,
      contactTitle: body.contactTitle ?? undefined,
      email: body.email ?? undefined,
      phone: body.phone ?? undefined,
      serviceTypeId: body.serviceTypeId ?? undefined,
      salesRep: body.salesRep ?? undefined,
      salesTeam: body.salesTeam ?? undefined,
      ecoScore: body.ecoScore ?? undefined,
      notes: body.notes ?? undefined,
    },
    include: { serviceType: true },
  });

  return NextResponse.json(customer);
}

// DELETE /api/customers/:id (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.customer.update({
    where: { id: parseInt(id) },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
