import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

export const PUT = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  const body = await request.json();

  const interview = await prisma.interview.update({
    where: { id: parseInt(id) },
    data: {
      interviewDate: body.interviewDate ? new Date(body.interviewDate) : undefined,
      interviewer: body.interviewer ?? undefined,
      interviewType: body.interviewType ?? undefined,
      satisfactionPct: body.satisfactionPct ?? undefined,
      summary: body.summary ?? undefined,
      vocPositive: body.vocPositive ?? undefined,
      vocNegative: body.vocNegative ?? undefined,
    },
    include: { customer: true, serviceType: true },
  });

  return NextResponse.json(interview);
});

export const DELETE = withAuth({ type: "role", minRole: "admin" }, async (request: NextRequest, ctx) => {
  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });

  await prisma.interview.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
});
