/**
 * Survey Repository — 설문 데이터 접근 계층
 *
 * API Routes (Prisma) 전용. Server Actions는 Supabase 직접 사용 유지.
 */
import { prisma } from "@/lib/db";
import type { PaginatedResult } from "./types";

export interface SurveyListFilter {
  year?: number;
  month?: number;
  serviceTypeId?: number;
  status?: string;
}

export interface CreateSurveyData {
  title: string;
  serviceTypeId: number;
  surveyYear: number;
  surveyMonth: number;
  trainingMonth?: number | null;
  internalLabel?: string | null;
  description?: string | null;
}

export interface UpdateSurveyData {
  title?: string;
  status?: string;
  description?: string | null;
  trainingMonth?: number | null;
  internalLabel?: string | null;
  showProjectName?: boolean;
}

export const surveyRepository = {
  /** 설문 목록 조회 (프로젝트명 요약 포함) */
  async findMany(filter: SurveyListFilter = {}) {
    const where: Record<string, unknown> = {};
    if (filter.year) where.surveyYear = filter.year;
    if (filter.month) where.surveyMonth = filter.month;
    if (filter.serviceTypeId) where.serviceTypeId = filter.serviceTypeId;
    if (filter.status) where.status = filter.status;

    const surveys = await prisma.survey.findMany({
      where,
      include: {
        serviceType: true,
        distributions: {
          select: { projectName: true },
          where: { projectName: { not: null } },
        },
        _count: {
          select: { questions: true, distributions: true, responses: true },
        },
      },
      orderBy: [{ surveyYear: "desc" }, { surveyMonth: "desc" }],
    });

    return surveys.map((s) => {
      const projectNames = [
        ...new Set(s.distributions.map((d) => d.projectName).filter(Boolean)),
      ];
      const { distributions: _d, ...rest } = s;
      return { ...rest, projectNames };
    });
  },

  /** 설문 상세 조회 (문항 포함) */
  async findById(id: number) {
    return prisma.survey.findUnique({
      where: { id },
      include: {
        serviceType: true,
        questions: { orderBy: { questionOrder: "asc" } },
        _count: { select: { distributions: true, responses: true } },
      },
    });
  },

  /** 설문 생성 */
  async create(data: CreateSurveyData) {
    return prisma.survey.create({
      data: {
        title: data.title,
        serviceTypeId: data.serviceTypeId,
        surveyYear: data.surveyYear,
        surveyMonth: data.surveyMonth,
        trainingMonth: data.trainingMonth ?? null,
        internalLabel: data.internalLabel || null,
        status: "draft",
        description: data.description || null,
      },
    });
  },

  /** 설문 수정 */
  async update(id: number, data: UpdateSurveyData) {
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.trainingMonth !== undefined) updateData.trainingMonth = data.trainingMonth;
    if (data.internalLabel !== undefined)
      updateData.internalLabel = data.internalLabel || null;
    if (data.showProjectName !== undefined)
      updateData.showProjectName = data.showProjectName;

    return prisma.survey.update({
      where: { id },
      data: updateData,
      include: { serviceType: true },
    });
  },

  /** 설문 삭제 */
  async delete(id: number) {
    return prisma.survey.delete({ where: { id } });
  },

  /** 템플릿에서 문항 복제 */
  async cloneQuestionsFromTemplate(surveyId: number, templateId: number) {
    const template = await prisma.questionTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return 0;

    let questions: Array<{
      questionOrder: number;
      questionText: string;
      questionType: string;
      category: string;
      isRequired?: boolean;
      options?: string[] | null;
    }> = [];

    try {
      questions = JSON.parse(template.questionsJson);
    } catch {
      return 0;
    }

    const result = await prisma.surveyQuestion.createMany({
      data: questions.map((q) => ({
        surveyId,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        questionType: q.questionType,
        category: q.category || null,
        isRequired: q.isRequired ?? true,
        optionsJson: q.options ? JSON.stringify(q.options) : null,
      })),
    });

    return result.count;
  },

  /** 기존 설문에서 문항 복제 */
  async cloneQuestionsFromSurvey(targetSurveyId: number, sourceSurveyId: number) {
    const sourceQuestions = await prisma.surveyQuestion.findMany({
      where: { surveyId: sourceSurveyId },
      orderBy: { questionOrder: "asc" },
    });

    const result = await prisma.surveyQuestion.createMany({
      data: sourceQuestions.map((q) => ({
        surveyId: targetSurveyId,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        questionType: q.questionType,
        category: q.category,
        isRequired: q.isRequired,
        optionsJson: q.optionsJson,
      })),
    });

    return result.count;
  },
};
