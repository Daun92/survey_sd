import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.interview.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
