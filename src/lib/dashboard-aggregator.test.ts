import { describe, it, expect } from "vitest";
import {
  aggregateDashboard,
  type DashboardInputs,
} from "./dashboard-aggregator";

const emptyInputs = (over: Partial<DashboardInputs> = {}): DashboardInputs => ({
  now: new Date("2026-04-24T00:00:00Z"),
  activeSurveys: null,
  totalSubmissions: 0,
  recentSubmissions: null,
  prevWeekSubmissions: null,
  distAggregates: null,
  recentOpenings: null,
  surveyDetails: null,
  submissionCounts: null,
  ...over,
});

describe("aggregateDashboard — funnel guarantees", () => {
  it("returns zeros on all empty inputs", () => {
    const data = aggregateDashboard(emptyInputs());
    expect(data.stats).toMatchObject({
      activeSurveyCount: 0,
      responseRate: 0,
      pendingCount: 0,
      thisWeekCount: 0,
      weekDiff: 0,
      totalDistributed: 0,
      respondedCount: 0,
      totalSubmissions: 0,
    });
    expect(data.funnel).toEqual({ distributed: 0, opened: 0, responded: 0 });
    expect(data.alerts).toEqual([]);
    expect(data.surveyRows).toEqual([]);
    expect(data.customerRows).toEqual([]);
    expect(data.recentActivity).toEqual([]);
  });

  it("funnel.responded never exceeds funnel.distributed (PR #114 regression guard)", () => {
    // 과거 버그: funnel.responded 가 lifetime submissions 이었고
    // funnel.distributed 가 최근 60일 이면 비율이 134% 같은 값이 나왔음.
    // aggregateDashboard 는 이제 두 값 모두 distAggregates 한 소스에서 파생.
    const data = aggregateDashboard(
      emptyInputs({
        // lifetime 이 크게 찍혀도 상관없다 — funnel.responded 는 이걸 쓰지 않아야 함
        totalSubmissions: 500,
        distAggregates: [
          {
            survey_id: "s1",
            total: 100,
            pending: 40,
            opened: 20,
            started: 15,
            completed: 25,
          },
        ],
      })
    );
    // distributed = 100, opened = 20+15+25 = 60, responded = completed = 25
    expect(data.funnel.distributed).toBe(100);
    expect(data.funnel.opened).toBe(60);
    expect(data.funnel.responded).toBe(25);
    expect(data.funnel.responded).toBeLessThanOrEqual(data.funnel.distributed);
    // % 역산
    const rate =
      data.funnel.distributed > 0
        ? (data.funnel.responded / data.funnel.distributed) * 100
        : 0;
    expect(rate).toBeLessThanOrEqual(100);
    expect(rate).toBe(25);
  });

  it("funnel sums correctly across multiple surveys", () => {
    const data = aggregateDashboard(
      emptyInputs({
        distAggregates: [
          {
            survey_id: "s1",
            total: 10,
            pending: 4,
            opened: 2,
            started: 1,
            completed: 3,
          },
          {
            survey_id: "s2",
            total: 20,
            pending: 10,
            opened: 3,
            started: 2,
            completed: 5,
          },
        ],
      })
    );
    expect(data.stats.totalDistributed).toBe(30);
    expect(data.stats.pendingCount).toBe(14);
    expect(data.stats.respondedCount).toBe(2 + 1 + 3 + 3 + 2 + 5);
    expect(data.funnel.responded).toBe(3 + 5); // completed 합
  });

  it("responseRate rounds to nearest integer", () => {
    const data = aggregateDashboard(
      emptyInputs({
        distAggregates: [
          {
            survey_id: "s1",
            total: 3,
            pending: 0,
            opened: 1,
            started: 0,
            completed: 0,
          },
        ],
      })
    );
    // respondedCount = 1, totalDistributed = 3 → 33.333% → 33
    expect(data.stats.responseRate).toBe(33);
  });
});

describe("aggregateDashboard — alerts", () => {
  it("flags active survey with distribution but zero responses (red)", () => {
    const data = aggregateDashboard(
      emptyInputs({
        now: new Date("2026-04-24T00:00:00Z"),
        surveyDetails: [
          {
            id: "s1",
            title: "만족도 설문",
            status: "active",
            created_at: "2026-04-10T00:00:00Z", // 14일 전
            sessions: {
              courses: {
                projects: { customers: { company_name: "A교육원" } },
              },
            },
          },
        ],
        distAggregates: [
          {
            survey_id: "s1",
            total: 50,
            pending: 50,
            opened: 0,
            started: 0,
            completed: 0,
          },
        ],
        submissionCounts: [], // 응답 0
      })
    );
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0]).toMatchObject({
      level: "red",
      surveyId: "s1",
    });
    expect(data.alerts[0].title).toContain("A교육원");
    expect(data.alerts[0].detail).toContain("14일 경과");
  });

  it("flags draft with distribution (yellow)", () => {
    const data = aggregateDashboard(
      emptyInputs({
        surveyDetails: [
          {
            id: "s1",
            title: "초안",
            status: "draft",
            created_at: "2026-04-23T00:00:00Z",
            sessions: null,
          },
        ],
        distAggregates: [
          {
            survey_id: "s1",
            total: 5,
            pending: 5,
            opened: 0,
            started: 0,
            completed: 0,
          },
        ],
      })
    );
    expect(data.alerts[0].level).toBe("yellow");
    expect(data.alerts[0].detail).toContain("draft");
  });

  it("flags high-pending active survey (yellow)", () => {
    const data = aggregateDashboard(
      emptyInputs({
        surveyDetails: [
          {
            id: "s1",
            title: "낮은 열람률",
            status: "active",
            created_at: "2026-04-20T00:00:00Z",
            sessions: null,
          },
        ],
        distAggregates: [
          {
            survey_id: "s1",
            total: 100,
            pending: 90,
            opened: 5,
            started: 2,
            completed: 3,
          },
        ],
        submissionCounts: [{ survey_id: "s1", cnt: 3 }],
      })
    );
    // pending 90 > total 100 * 0.8 = 80 → yellow
    expect(data.alerts[0].level).toBe("yellow");
    expect(data.alerts[0].detail).toContain("90건 미열람");
  });
});

describe("aggregateDashboard — customers / activity", () => {
  it("rolls up customer counts across surveys", () => {
    const data = aggregateDashboard(
      emptyInputs({
        surveyDetails: [
          {
            id: "s1",
            title: "A-1",
            status: "active",
            created_at: "2026-04-20T00:00:00Z",
            sessions: {
              courses: { projects: { customers: { company_name: "A" } } },
            },
          },
          {
            id: "s2",
            title: "A-2",
            status: "active",
            created_at: "2026-04-21T00:00:00Z",
            sessions: {
              courses: { projects: { customers: { company_name: "A" } } },
            },
          },
          {
            id: "s3",
            title: "B-1",
            status: "active",
            created_at: "2026-04-22T00:00:00Z",
            sessions: {
              courses: { projects: { customers: { company_name: "B" } } },
            },
          },
        ],
        submissionCounts: [
          { survey_id: "s1", cnt: 10 },
          { survey_id: "s2", cnt: 5 },
          { survey_id: "s3", cnt: 20 },
        ],
      })
    );
    // B (20) sorts before A (15)
    expect(data.customerRows[0]).toEqual({
      name: "B",
      surveys: 1,
      responses: 20,
    });
    expect(data.customerRows[1]).toEqual({
      name: "A",
      surveys: 2,
      responses: 15,
    });
  });

  it("sorts recent activity by timestamp desc and caps at 20", () => {
    const openings = Array.from({ length: 15 }, (_, i) => ({
      recipient_name: `U${i}`,
      opened_at: `2026-04-${String(10 + i).padStart(2, "0")}T00:00:00Z`,
    }));
    const submissions = Array.from({ length: 10 }, (_, i) => ({
      submitted_at: `2026-04-${String(15 + i).padStart(2, "0")}T12:00:00Z`,
    }));
    const data = aggregateDashboard(
      emptyInputs({
        recentOpenings: openings,
        recentSubmissions: submissions,
      })
    );
    expect(data.recentActivity.length).toBe(20);
    // 가장 최근이 첫 번째 — submission 2026-04-24 12:00Z
    expect(data.recentActivity[0].at).toBe("2026-04-24T12:00:00Z");
    expect(data.recentActivity[0].kind).toBe("responded");
  });

  it("week diff handles negative (이번 주 < 지난 주)", () => {
    const data = aggregateDashboard(
      emptyInputs({
        recentSubmissions: [
          { submitted_at: "2026-04-22" },
          { submitted_at: "2026-04-23" },
        ],
        prevWeekSubmissions: [
          { submitted_at: "2026-04-15" },
          { submitted_at: "2026-04-16" },
          { submitted_at: "2026-04-17" },
          { submitted_at: "2026-04-18" },
          { submitted_at: "2026-04-19" },
        ],
      })
    );
    expect(data.stats.thisWeekCount).toBe(2);
    expect(data.stats.weekDiff).toBe(-3);
  });
});
