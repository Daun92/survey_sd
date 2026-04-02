import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { getSmsSenderFromDB } from "@/lib/sms/sender";
import { getSmsMessageType } from "@/lib/sms/template-renderer";

// POST /api/distributions/send-sms — 설문 링크 SMS 발송
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const body = await request.json();
  const { distributionIds, surveyId, from } = body as {
    distributionIds?: number[];
    surveyId?: number;
    from?: string;  // 동적 발신번호
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

  const sender = await getSmsSenderFromDB();
  if (sender.isMock) {
    return NextResponse.json(
      { error: "SMS 발송 설정이 되어있지 않습니다. 환경변수 또는 DB 프로바이더를 확인하세요." },
      { status: 503 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  let sent = 0;
  let failed = 0;
  let noPhone = 0;
  const errors: string[] = [];

  for (const dist of distributions) {
    const phone = dist.customer.phone;
    if (!phone) {
      noPhone++;
      errors.push(`${dist.customer.companyName}: 전화번호 없음`);
      continue;
    }

    const respondUrl = `${baseUrl}/r/${dist.responseToken}`;
    const messageBody = `[${dist.survey.serviceType.name}] ${dist.customer.companyName} 고객님, 만족도 설문에 참여 부탁드립니다.\n${respondUrl}`;
    const messageType = getSmsMessageType(messageBody);

    try {
      const result = await sender.send({
        to: phone.replace(/-/g, ''),
        toName: dist.customer.contactName ?? undefined,
        from: from?.replace(/-/g, ''),
        body: messageBody,
        messageType,
      });

      if (result.success) {
        await prisma.distribution.update({
          where: { id: dist.id },
          data: { status: "sent", sentAt: new Date() },
        });
        sent++;
      } else {
        failed++;
        errors.push(`${dist.customer.companyName}: ${result.error}`);
      }
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

  return NextResponse.json({ sent, failed, noPhone, errors: errors.slice(0, 20) });
});
