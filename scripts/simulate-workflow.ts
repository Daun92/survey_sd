import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { v4 as uuidv4 } from "uuid";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const vocPositive = [
  "강사의 실무 경험이 풍부하여 도움이 되었습니다.",
  "교육 내용이 체계적이고 실무에 바로 적용할 수 있어 좋았습니다.",
  "교육 환경이 쾌적하고 운영이 매끄러웠습니다.",
  "다양한 사례를 통해 이해가 잘 되었습니다.",
  "전반적으로 만족스러운 교육이었습니다.",
  "강사분이 참여를 잘 이끌어 주셔서 집중할 수 있었습니다.",
  "동료들과 함께 팀 활동을 할 수 있어서 유익했습니다.",
];

const vocNegative = [
  "교육 시간이 다소 짧아 아쉬웠습니다.",
  "실습 시간이 더 있었으면 좋겠습니다.",
  "교재 내용이 좀 더 상세했으면 합니다.",
  "교육장 접근성이 개선되면 좋겠습니다.",
  "사후 학습 자료가 제공되면 좋겠습니다.",
  "점심 시간이 짧아 여유가 없었습니다.",
  "교육 일정이 너무 빡빡합니다.",
];

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const trainingMonth = month === 1 ? 12 : month - 1;
  const trainingYear = month === 1 ? year - 1 : year;

  console.log(`\n=== ${year}년 ${month}월 CS 조사 워크플로우 시뮬레이션 ===\n`);

  const serviceTypes = await prisma.serviceType.findMany();
  const stMap = new Map(serviceTypes.map((s) => [s.name, s.id]));
  const inPersonId = stMap.get("집체")!;
  const remoteId = stMap.get("원격교육")!;

  // ============================================
  // 집체 교육 시나리오
  // ============================================
  console.log("━━━ 시나리오 A: 집체 교육 ━━━\n");
  await runScenario({
    serviceTypeId: inPersonId,
    serviceTypeName: "집체",
    year,
    month,
    trainingYear,
    trainingMonth,
    targetCount: 10,
    responseCount: 7,
    interviewCount: 3,
  });

  // ============================================
  // 원격교육 시나리오
  // ============================================
  console.log("\n━━━ 시나리오 B: 원격교육 ━━━\n");
  await runScenario({
    serviceTypeId: remoteId,
    serviceTypeName: "원격교육",
    year,
    month,
    trainingYear,
    trainingMonth,
    targetCount: 5,
    responseCount: 4,
    interviewCount: 1,
  });

  // Step 6: 월간 보고서
  console.log("\n━━━ Step 6: 월간 보고서 레코드 ━━━");
  await prisma.monthlyReport.upsert({
    where: { reportYear_reportMonth: { reportYear: year, reportMonth: month } },
    update: { status: "draft", overallScore: 4.15 },
    create: {
      reportYear: year,
      reportMonth: month,
      title: `${year}년 ${month}월 고객관계개선회의 보고서`,
      status: "draft",
      overallScore: 4.15,
      vocSummary: "긍정: 강사 전문성, 체계적 커리큘럼 / 개선: 실습시간 확대, 교재 보강",
    },
  });
  console.log("  -> 보고서 레코드 생성 완료");

  // 최종 요약
  const surveys = await prisma.survey.findMany({
    where: { surveyYear: year, surveyMonth: month },
    include: { _count: { select: { distributions: true, responses: true } } },
  });

  console.log(`\n\n${"=".repeat(50)}`);
  console.log("시뮬레이션 완료!");
  console.log(`${"=".repeat(50)}`);
  console.log(`\n설문 ${surveys.length}건:`);
  for (const s of surveys) {
    console.log(`  - ${s.title} (배포: ${s._count.distributions}, 응답: ${s._count.responses})`);
  }
  console.log(`\n테스트 URL:`);
  console.log(`  대시보드:     http://localhost:3000`);
  console.log(`  고객사 관리:  http://localhost:3000/customers`);
  console.log(`  교육 확인:    http://localhost:3000/training`);
  console.log(`  설문 관리:    http://localhost:3000/surveys`);
  console.log(`  배포 관리:    http://localhost:3000/distribute`);
  for (const s of surveys) {
    console.log(`  배포 상세:    http://localhost:3000/distribute/${s.id}`);
    console.log(`  리포트 상세:  http://localhost:3000/reports/${s.id}`);
  }
  console.log(`  리포트 전체:  http://localhost:3000/reports`);
  console.log(`  연간 결산:    http://localhost:3000/reports/annual`);
  console.log(`  인터뷰 관리:  http://localhost:3000/interviews`);

  await prisma.$disconnect();
}

interface ScenarioParams {
  serviceTypeId: number;
  serviceTypeName: string;
  year: number;
  month: number;
  trainingYear: number;
  trainingMonth: number;
  targetCount: number;
  responseCount: number;
  interviewCount: number;
}

async function runScenario(params: ScenarioParams) {
  const {
    serviceTypeId, serviceTypeName, year, month,
    trainingYear, trainingMonth, targetCount, responseCount, interviewCount,
  } = params;

  // Step 1: 교육 실시 여부
  console.log("Step 1: 교육 실시 여부 등록...");
  const customers = await prisma.customer.findMany({
    where: { serviceTypeId, isActive: true },
    take: targetCount,
  });

  for (const c of customers) {
    await prisma.trainingRecord.upsert({
      where: {
        customerId_trainingYear_trainingMonth: {
          customerId: c.id, trainingYear, trainingMonth,
        },
      },
      update: { hasTraining: true },
      create: {
        customerId: c.id,
        trainingYear,
        trainingMonth,
        serviceTypeId,
        hasTraining: true,
        trainingName: serviceTypeName + " 교육 과정",
        verifiedBy: c.salesRep || "테스트담당자",
        verifiedAt: new Date(),
      },
    });
  }
  console.log(`  -> ${customers.length}건 등록`);

  // Step 2: 설문 생성
  console.log("Step 2: 설문 생성...");
  const template = await prisma.questionTemplate.findFirst({
    where: { serviceTypeId, isDefault: true },
  });

  // 기존 삭제
  const existing = await prisma.survey.findFirst({
    where: { serviceTypeId, surveyYear: year, surveyMonth: month },
  });
  if (existing) {
    await prisma.responseAnswer.deleteMany({ where: { response: { surveyId: existing.id } } });
    await prisma.response.deleteMany({ where: { surveyId: existing.id } });
    await prisma.distribution.deleteMany({ where: { surveyId: existing.id } });
    await prisma.surveyQuestion.deleteMany({ where: { surveyId: existing.id } });
    await prisma.survey.delete({ where: { id: existing.id } });
  }

  const survey = await prisma.survey.create({
    data: {
      title: `${year}년 ${month}월 ${serviceTypeName} 만족도 설문`,
      serviceTypeId,
      surveyYear: year,
      surveyMonth: month,
      trainingMonth,
      status: "collecting",
    },
  });

  if (template) {
    const questions = JSON.parse(template.questionsJson);
    await prisma.surveyQuestion.createMany({
      data: questions.map((q: Record<string, unknown>) => ({
        surveyId: survey.id,
        questionOrder: q.questionOrder as number,
        questionText: q.questionText as string,
        questionType: q.questionType as string,
        category: (q.category as string) || null,
        isRequired: (q.isRequired as boolean) ?? true,
      })),
    });
  }

  const surveyQuestions = await prisma.surveyQuestion.findMany({
    where: { surveyId: survey.id },
    orderBy: { questionOrder: "asc" },
  });
  console.log(`  -> "${survey.title}" (문항 ${surveyQuestions.length}개)`);

  // Step 3: 배포
  console.log("Step 3: 배포 생성...");
  const distributions = [];
  for (const c of customers) {
    const dist = await prisma.distribution.create({
      data: {
        surveyId: survey.id,
        customerId: c.id,
        channel: "email",
        responseToken: uuidv4(),
        status: "sent",
        sentAt: new Date(),
      },
    });
    distributions.push(dist);
  }
  console.log(`  -> ${distributions.length}건 배포`);

  // Step 4: 응답
  console.log("Step 4: 응답 시뮬레이션...");
  const ratingQs = surveyQuestions.filter((q) => q.questionType.startsWith("rating"));
  const textQs = surveyQuestions.filter((q) => q.questionType === "text");

  for (let i = 0; i < responseCount; i++) {
    const dist = distributions[i];
    const customer = customers[i];

    const response = await prisma.response.create({
      data: {
        distributionId: dist.id,
        surveyId: survey.id,
        customerId: customer.id,
        respondedAt: new Date(Date.now() - Math.random() * 86400000 * 3),
        isComplete: true,
        source: "web",
      },
    });

    const answers = [];
    for (const q of ratingQs) {
      const score = Math.min(5, Math.max(1, Math.round(3.5 + Math.random() * 1.5)));
      answers.push({
        responseId: response.id,
        questionId: q.id,
        answerValue: String(score),
        answerNumeric: score,
      });
    }

    for (const q of textQs) {
      const isPositive = q.questionText.includes("만족");
      const pool = isPositive ? vocPositive : vocNegative;
      answers.push({
        responseId: response.id,
        questionId: q.id,
        answerValue: pool[i % pool.length],
        answerNumeric: null,
      });
    }

    await prisma.responseAnswer.createMany({ data: answers });
    await prisma.distribution.update({
      where: { id: dist.id },
      data: { status: "responded" },
    });
  }

  const rate = Math.round((responseCount / targetCount) * 100);
  console.log(`  -> ${responseCount}/${targetCount} 응답 (${rate}%)`);

  // 미응답 링크 출력
  if (responseCount < targetCount) {
    console.log("  미응답 링크:");
    for (let i = responseCount; i < targetCount; i++) {
      console.log(`    ${customers[i].companyName}: http://localhost:3000/respond/${distributions[i].responseToken}`);
    }
  }

  // Step 5: 인터뷰
  console.log("Step 5: 인터뷰 등록...");
  for (let i = 0; i < interviewCount; i++) {
    const c = customers[i];
    await prisma.interview.create({
      data: {
        surveyId: survey.id,
        customerId: c.id,
        interviewDate: new Date(),
        interviewer: "김담당",
        interviewType: ["phone", "visit", "online"][i % 3],
        serviceTypeId,
        satisfactionPct: 75 + i * 8,
        summary: `${c.companyName} 담당자 인터뷰. ${serviceTypeName} 서비스 전반 만족, 실습 확대 요청.`,
        vocPositive: vocPositive[i],
        vocNegative: vocNegative[i],
      },
    });
  }
  console.log(`  -> ${interviewCount}건 등록`);
}

main().catch((e) => {
  console.error("오류:", e);
  process.exit(1);
});
