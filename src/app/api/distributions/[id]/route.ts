import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/distributions/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
}

// PUT /api/distributions/:id — 상태 변경
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const distribution = await prisma.distribution.update({
    where: { id: parseInt(id) },
    data: {
      status: body.status ?? undefined,
      channel: body.channel ?? undefined,
    },
  });

  return NextResponse.json(distribution);
}

// DELETE /api/distributions/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.distribution.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
