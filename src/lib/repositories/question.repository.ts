/**
 * Question Repository — 문항 데이터 접근 계층
 *
 * 배치 업데이트 안티패턴을 Prisma 트랜잭션으로 교체합니다.
 */
import { prisma } from "@/lib/db";

export interface CreateQuestionData {
  surveyId: number;
  questionOrder: number;
  questionText: string;
  questionType: string;
  category?: string | null;
  isRequired?: boolean;
  options?: string[] | null;
}

export interface UpdateQuestionData {
  id: number;
  questionOrder: number;
  questionText: string;
  questionType: string;
  category?: string | null;
  isRequired?: boolean;
  options?: string[] | null;
}

export interface ReorderItem {
  id: number;
  questionOrder: number;
}

export const questionRepository = {
  /** 설문의 문항 목록 조회 */
  async findBySurveyId(surveyId: number) {
    return prisma.surveyQuestion.findMany({
      where: { surveyId },
      orderBy: { questionOrder: "asc" },
    });
  },

  /** 문항 추가 */
  async create(data: CreateQuestionData) {
    return prisma.surveyQuestion.create({
      data: {
        surveyId: data.surveyId,
        questionOrder: data.questionOrder,
        questionText: data.questionText,
        questionType: data.questionType,
        category: data.category || null,
        isRequired: data.isRequired ?? true,
        optionsJson: data.options ? JSON.stringify(data.options) : null,
      },
    });
  },

  /**
   * 문항 일괄 업데이트 — Prisma 트랜잭션 사용
   *
   * 기존 Promise.all + 개별 update 패턴 대체
   */
  async updateMany(questions: UpdateQuestionData[]) {
    return prisma.$transaction(
      questions.map((q) =>
        prisma.surveyQuestion.update({
          where: { id: q.id },
          data: {
            questionOrder: q.questionOrder,
            questionText: q.questionText,
            questionType: q.questionType,
            category: q.category || null,
            isRequired: q.isRequired ?? true,
            optionsJson: q.options ? JSON.stringify(q.options) : null,
          },
        })
      )
    );
  },

  /**
   * 문항 순서 일괄 변경 — Prisma 트랜잭션 사용
   *
   * 기존 Promise.all + map 안티패턴 대체
   * 각 문항의 questionOrder만 업데이트
   */
  async reorder(items: ReorderItem[]) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.surveyQuestion.update({
          where: { id: item.id },
          data: { questionOrder: item.questionOrder },
        })
      )
    );
  },

  /** 문항 삭제 */
  async delete(questionId: number) {
    return prisma.surveyQuestion.delete({
      where: { id: questionId },
    });
  },
};
