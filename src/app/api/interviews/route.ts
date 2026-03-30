import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/interviews
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const surveyId = searchParams.get("surveyId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const where: Record<string, unknown> = {};
  if (surveyId) where.surveyId = parseInt(surveyId);
  if (year && month) {
    where.survey = { surveyYear: parseInt(year), surveyMonth: parseInt(month) };
  }

  const interviews = await prisma.interview.findMany({
    where,
    include: {
      customer: { select: { companyName: true, contactName: true } },
      serviceType: true,
      survey: { select: { title: true, surveyYear: true, surveyMonth: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(interviews);
}

// POST /api/interviews
export async function POST(request: NextRequest) {
  const body = await request.json();

  const interview = await prisma.interview.create({
    data: {
      surveyId: body.surveyId || null,
      customerId: body.customerId,
      interviewDate: body.interviewDate ? new Date(body.interviewDate) : null,
      interviewer: body.interviewer || null,
      interviewType: body.interviewType || null,
      serviceTypeId: body.serviceTypeId,
      satisfactionPct: body.satisfactionPct || null,
      summary: body.summary || null,
      vocPositive: body.vocPositive || null,
      vocNegative: body.vocNegative || null,
      audioFilePath: body.audioFilePath || null,
      documentPath: body.documentPath || null,
    },
    include: { customer: true, serviceType: true },
  });

  return NextResponse.json(interview, { status: 201 });
}
