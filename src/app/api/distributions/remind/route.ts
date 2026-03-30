import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";

// POST /api/distributions/remind — 미응답자 리마인더 발송
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { distributionIds, surveyId } = body as {
    distributionIds?: number[];
    surveyId?: number;
  };

  const where: Record<string, unknown> = {
    status: { in: ["sent", "opened"] },
  };
  if (distributionIds?.length) {
    where.id = { in: distributionIds };
  } else if (surveyId) {
    where.surveyId = surveyId;
  } else {
    return NextResponse.json({ error: "distributionIds 또는 surveyId가 필요합니다" }, { status: 400 });
  }

  const distributions = await prisma.distribution.findMany({
    where,
    include: {
      customer: true,
      survey: { include: { serviceType: true } },
    },
  });

  if (distributions.length === 0) {
    return NextResponse.json({ sent: 0, message: "리마인더 대상이 없습니다" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  let sent = 0;
  let failed = 0;

  for (const dist of distributions) {
    if (!dist.customer.email) continue;

    try {
      await sendReminderEmail({
        to: dist.customer.email,
        customerName: dist.customer.companyName,
        contactName: dist.customer.contactName,
        surveyTitle: dist.survey.title,
        serviceType: dist.survey.serviceType.name,
        respondUrl: `${baseUrl}/respond/${dist.responseToken}`,
        reminderCount: dist.reminderCount + 1,
      });

      await prisma.distribution.update({
        where: { id: dist.id },
        data: {
          reminderCount: { increment: 1 },
          lastReminder: new Date(),
        },
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: distributions.length });
}
