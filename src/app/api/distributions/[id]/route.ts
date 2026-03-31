import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

// GET /api/distributions/:id
export const GET = withAuth({ type: "auth" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const distribution = await prisma.distribution.findUnique({
    where: { id: parseInt(id) },
    include: {
      customer: { include: { serviceType: true } },
      survey: { include: { questions: { orderBy: { questionOrder: "asc" } } } },
      responses: { include: { answers: true } },
    },
  });

  if (!distribution) {
    return NextResponse.json({ error: "배포를 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(distribution);
});

// PUT /api/distributions/:id — 상태 변경
export const PUT = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();

  const distribution = await prisma.distribution.update({
    where: { id: parseInt(id) },
    data: {
      status: body.status ?? undefined,
      channel: body.channel ?? undefined,
    },
  });

  return NextResponse.json(distribution);
});

// DELETE /api/distributions/:id
export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  await prisma.distribution.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
});
