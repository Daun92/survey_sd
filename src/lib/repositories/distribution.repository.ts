/**
 * Distribution Repository — 배포 데이터 접근 계층
 */
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export interface DistributionListFilter {
  surveyId?: number;
  status?: string;
}

export interface CreateBatchData {
  surveyId: number;
  customerIds: number[];
  channel?: string;
  projectNames?: Record<number, string>;
}

export const distributionRepository = {
  /** 배포 목록 조회 (요약 집계 포함) */
  async findMany(filter: DistributionListFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.surveyId) where.surveyId = filter.surveyId;
    if (filter.status) where.status = filter.status;

    const distributions = await prisma.distribution.findMany({
      where,
      include: {
        customer: { include: { serviceType: true } },
        survey: true,
        responses: {
          select: { id: true, respondedAt: true, isComplete: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const total = distributions.length;
    const sent = distributions.filter((d) => d.status !== "pending").length;
    const responded = distributions.filter(
      (d) => d.status === "responded"
    ).length;
    const responseRate =
      total > 0 ? Math.round((responded / total) * 100) : 0;

    return {
      distributions,
      summary: { total, sent, responded, responseRate },
    };
  },

  /** 대량 배포 생성 (중복 제외 + 자동 프로젝트명 매핑) */
  async createBatch(data: CreateBatchData) {
    const { surveyId, customerIds, channel = "email", projectNames } = data;

    // 이미 배포된 고객사 제외
    const existing = await prisma.distribution.findMany({
      where: { surveyId },
      select: { customerId: true },
    });
    const existingIds = new Set(existing.map((d) => d.customerId));
    const newCustomerIds = customerIds.filter((id) => !existingIds.has(id));

    if (newCustomerIds.length === 0) {
      return { created: 0, distributions: [], skipped: customerIds.length };
    }

    // 프로젝트명 자동 매핑
    let resolvedProjectNames: Record<number, string> = projectNames || {};
    if (!projectNames) {
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
      });
      if (survey) {
        const trainingMonth =
          survey.trainingMonth ??
          (survey.surveyMonth === 1 ? 12 : survey.surveyMonth - 1);
        const trainingYear =
          survey.surveyMonth === 1
            ? survey.surveyYear - 1
            : survey.surveyYear;
        const records = await prisma.trainingRecord.findMany({
          where: {
            customerId: { in: newCustomerIds },
            trainingYear,
            trainingMonth,
            hasTraining: true,
          },
          select: { customerId: true, trainingName: true },
        });
        resolvedProjectNames = {};
        for (const r of records) {
          if (r.trainingName)
            resolvedProjectNames[r.customerId] = r.trainingName;
        }
      }
    }

    // 대량 생성
    const created = await prisma.distribution.createMany({
      data: newCustomerIds.map((customerId) => ({
        surveyId,
        customerId,
        channel,
        projectName: resolvedProjectNames[customerId] || null,
        responseToken: uuidv4(),
        status: "pending",
      })),
    });

    // 설문 상태 업데이트
    await prisma.survey.update({
      where: { id: surveyId },
      data: { status: "distributing" },
    });

    // 생성된 배포 목록 반환
    const distributions = await prisma.distribution.findMany({
      where: { surveyId, customerId: { in: newCustomerIds } },
      include: { customer: true },
      orderBy: { customer: { companyName: "asc" } },
    });

    return {
      created: created.count,
      distributions,
      skipped: customerIds.length - newCustomerIds.length,
    };
  },
};
