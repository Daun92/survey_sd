import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { updateCustomerSchema } from "@/lib/validations/customer";
import { customerRepository } from "@/lib/repositories";

// GET /api/customers/:id
export const GET = withAuth({ type: "auth" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const customer = await customerRepository.findById(parseInt(id));
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
  const customer = await customerRepository.update(parseInt(id), data);
  return NextResponse.json(customer);
});

// DELETE /api/customers/:id (soft delete)
export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  await customerRepository.softDelete(parseInt(id));
  return NextResponse.json({ success: true });
});
