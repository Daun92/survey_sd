import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { sendSurveyEmail } from "@/lib/email";

// POST /api/distributions/send — 이메일 발송
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const body = await request.json();
  const { distributionIds, surveyId } = body as {
    distributionIds?: number[];
    surveyId?: number;
  };

  // 발송 대상 조회
  const where: Record<string, unknown> = { status: "pending" };
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
    return NextResponse.json({ error: "발송 대기 중인 배포가 없습니다", sent: 0, failed: 0 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  let sent = 0;
  let failed = 0;
  let noEmail = 0;
  const errors: string[] = [];

  for (const dist of distributions) {
    if (!dist.customer.email) {
      noEmail++;
      errors.push(`${dist.customer.companyName}: 이메일 없음`);
      continue;
    }

    try {
      await sendSurveyEmail({
        to: dist.customer.email,
        customerName: dist.customer.companyName,
        contactName: dist.customer.contactName,
        surveyTitle: dist.survey.title,
        serviceType: dist.survey.serviceType.name,
        projectName: dist.survey.showProjectName ? dist.projectName : null,
        respondUrl: `${baseUrl}/r/${dist.responseToken}`,
      });

      await prisma.distribution.update({
        where: { id: dist.id },
        data: { status: "sent", sentAt: new Date() },
      });
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${dist.customer.companyName}: ${(e as Error).message}`);
    }
  }

  // 설문 상태 업데이트
  if (sent > 0 && distributions[0]) {
    await prisma.survey.update({
      where: { id: distributions[0].surveyId },
      data: { status: "collecting" },
    });
  }

  return NextResponse.json({ sent, failed, noEmail, errors: errors.slice(0, 20) });
});
