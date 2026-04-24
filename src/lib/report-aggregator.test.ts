import { describe, it, expect } from "vitest";
import {
  aggregateSurveyReport,
  REPORT_TARGET_SCORE,
  type ReportQuestion,
  type ReportSubmission,
} from "./report-aggregator";

// 이전에 `src/app/admin/reports/page.tsx` 내 250줄 인라인으로 존재하던 집계 로직을
// `src/lib/report-aggregator.ts` 로 추출한 뒤 처음 추가된 단위 테스트.
// 회귀 방지 + A-2-b 리팩터 등가성 증명 목적.

function mkQuestion(partial: Partial<ReportQuestion> & { id: string }): ReportQuestion {
  return {
    question_text: "문항",
    question_type: "likert_5",
    question_code: null,
    section: null,
    sort_order: 0,
    ...partial,
  };
}

function mkSubmission(partial: Partial<ReportSubmission> & { id: string }): ReportSubmission {
  return {
    total_score: null,
    answers: null,
    respondent_name: null,
    respondent_department: null,
    respondent_position: null,
    channel: null,
    created_at: "2026-04-01T00:00:00Z",
    ...partial,
  };
}

describe("aggregateSurveyReport", () => {
  it("응답이 없으면 0 집계, gap 은 -TARGET", () => {
    const r = aggregateSurveyReport([], []);
    expect(r.submissionCount).toBe(0);
    expect(r.avgScore100).toBe(0);
    expect(r.gap).toBe(-REPORT_TARGET_SCORE);
    expect(r.sectionScores).toEqual([]);
    expect(r.dailyResponses).toEqual([]);
    expect(r.channelCounts).toEqual({ online: 0, interview: 0 });
  });

  it("Likert/rating 문항만 점수 집계에 반영 (text 는 제외, VOC 만 수집)", () => {
    const q1 = mkQuestion({ id: "q1", question_type: "likert_5", section: "만족도", sort_order: 0 });
    const q2 = mkQuestion({ id: "q2", question_type: "text", question_text: "소감", sort_order: 1 });

    const s1 = mkSubmission({
      id: "s1",
      total_score: 5,
      answers: { q1: 5, q2: "좋았습니다" },
      channel: "online",
      respondent_name: "홍길동",
    });

    const r = aggregateSurveyReport([s1], [q1, q2]);

    // 1문항 5점 → 5/5 = 100점
    expect(r.likertQuestionCount).toBe(1);
    expect(r.avgScore100).toBe(100);
    expect(r.gap).toBe(10); // 100 - 90
    // 섹션은 만족도 1개
    expect(r.sectionScores).toEqual([{ name: "만족도", avg: 100, count: 1 }]);
    // VOC 는 text 1건
    expect(r.openResponses).toEqual([
      { name: "홍길동", department: "", questionText: "소감", answer: "좋았습니다" },
    ]);
    // 온라인 채널 1
    expect(r.channelCounts).toEqual({ online: 1, interview: 0 });
  });

  it("total_score 누락 시 문항별 평균에서 avgScore100 역산", () => {
    const qs = [
      mkQuestion({ id: "q1", question_type: "likert_5", sort_order: 0 }),
      mkQuestion({ id: "q2", question_type: "likert_5", sort_order: 1 }),
    ];
    const subs = [
      mkSubmission({ id: "s1", total_score: null, answers: { q1: 4, q2: 4 } }),
      mkSubmission({ id: "s2", total_score: null, answers: { q1: 5, q2: 3 } }),
    ];
    const r = aggregateSurveyReport(subs, qs);

    // 모든 답변 평균 = (4+4+5+3)/4 = 4.0 → *20 = 80
    expect(r.avgScore100).toBe(80);
  });

  it("interview 채널 카운트", () => {
    const subs = [
      mkSubmission({ id: "a", channel: "online" }),
      mkSubmission({ id: "b", channel: "interview" }),
      mkSubmission({ id: "c", channel: "interview" }),
      mkSubmission({ id: "d", channel: null }), // null → online 기본값
    ];
    const r = aggregateSurveyReport(subs, []);
    expect(r.channelCounts).toEqual({ online: 2, interview: 2 });
  });

  it("점수 분포 버킷 경계 (90/80/70/60)", () => {
    const q = mkQuestion({ id: "q1", question_type: "likert_5", sort_order: 0 });
    const subs = [
      mkSubmission({ id: "a", total_score: 5 }), // 100점 → 90~100
      mkSubmission({ id: "b", total_score: 4 }), // 80점 → 80~89
      mkSubmission({ id: "c", total_score: 4 }), // 80점 → 80~89
      mkSubmission({ id: "d", total_score: 3 }), // 60점 → 60~69
      mkSubmission({ id: "e", total_score: 2 }), // 40점 → ~59
    ];
    const r = aggregateSurveyReport(subs, [q]);
    const counts = r.scoreBuckets.map((b) => b.count);
    expect(counts).toEqual([1, 2, 0, 1, 1]);
  });

  it("일별 응답 추이는 날짜 오름차순", () => {
    const subs = [
      mkSubmission({ id: "a", created_at: "2026-04-03T10:00:00Z" }),
      mkSubmission({ id: "b", created_at: "2026-04-01T10:00:00Z" }),
      mkSubmission({ id: "c", created_at: "2026-04-03T12:00:00Z" }),
      mkSubmission({ id: "d", created_at: "2026-04-02T10:00:00Z" }),
    ];
    const r = aggregateSurveyReport(subs, []);
    expect(r.dailyResponses).toEqual([
      { date: "2026-04-01", count: 1 },
      { date: "2026-04-02", count: 1 },
      { date: "2026-04-03", count: 2 },
    ]);
  });

  it("1~5 범위 밖 답변은 무시", () => {
    const q = mkQuestion({ id: "q1", question_type: "likert_5", sort_order: 0 });
    const subs = [
      mkSubmission({ id: "a", answers: { q1: 0 }, total_score: null }),
      mkSubmission({ id: "b", answers: { q1: 6 }, total_score: null }),
      mkSubmission({ id: "c", answers: { q1: "bad" }, total_score: null }),
      mkSubmission({ id: "d", answers: { q1: 4 }, total_score: null }),
    ];
    const r = aggregateSurveyReport(subs, [q]);
    // 유효 응답 4점 1건 → avg 4 → 80점
    expect(r.avgScore100).toBe(80);
    expect(r.sectionScores[0].count).toBe(1);
  });

  it("상위 3 / 하위 3 문항 정렬", () => {
    const qs = [
      mkQuestion({ id: "q1", question_type: "likert_5", sort_order: 0, question_code: "Q1" }),
      mkQuestion({ id: "q2", question_type: "likert_5", sort_order: 1, question_code: "Q2" }),
      mkQuestion({ id: "q3", question_type: "likert_5", sort_order: 2, question_code: "Q3" }),
      mkQuestion({ id: "q4", question_type: "likert_5", sort_order: 3, question_code: "Q4" }),
    ];
    const subs = [
      mkSubmission({
        id: "s1",
        answers: { q1: 5, q2: 4, q3: 3, q4: 1 },
        total_score: null,
      }),
    ];
    const r = aggregateSurveyReport(subs, qs);
    expect(r.topQuestions.map((q) => q.code)).toEqual(["Q1", "Q2", "Q3"]);
    expect(r.bottomQuestions.map((q) => q.code)).toEqual(["Q4", "Q3", "Q2"]);
  });
});
