/**
 * Dashboard aggregator — /admin 메인 대시보드 순수 집계 로직.
 *
 * Supabase 서버 컴포넌트에서 가져온 원시 데이터를 받아, 카드·퍼널·알림·
 * 설문별·고객사별·최근 활동 섹션이 소비하는 DashboardData 로 변환한다.
 * Supabase 클라이언트를 사용하지 않는 순수 함수 — 단위 테스트 가능.
 *
 * 모든 배포·응답 집계는 "최근 60일" 기준 (caller 가 since 를 지정).
 * 과거 funnel.responded 가 lifetime 숫자여서 % > 100 이 되던 버그(2026-04-24
 * PR #114) 를 예방하기 위해, funnel 3 값 모두 같은 소스·window 로 고정한다.
 */

export type ActivityKind = "opened" | "responded";
export interface ActivityItem {
  at: string;
  kind: ActivityKind;
  text: string;
}

export interface SubmissionCountRow {
  survey_id: string;
  cnt: number | string;
}

export interface DistAggregateRow {
  survey_id: string;
  total: number | string;
  pending: number | string;
  opened: number | string;
  started: number | string;
  completed: number | string;
}

export interface DistBuckets {
  total: number;
  pending: number;
  opened: number;
  started: number;
  completed: number;
}

export interface ActiveSurvey {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

export interface RecentOpening {
  recipient_name: string | null;
  opened_at: string | null;
}

export interface RecentSubmission {
  id?: string;
  survey_id?: string;
  submitted_at: string;
}

/** `/admin` 의 edu_surveys 중첩 select — 고객사·프로젝트 이름 포함 */
export interface SurveyDetail {
  id: string;
  title: string;
  status: string;
  created_at: string;
  sessions?: {
    courses?: {
      projects?: {
        customers?: { company_name?: string | null } | null;
      } | null;
    } | null;
  } | null;
}

export interface DashboardInputs {
  /** 현재 시각 — 알림 "N일 경과" 계산과 주간 집계 기준 */
  now: Date;
  activeSurveys: ActiveSurvey[] | null | undefined;
  /** edu_submissions 의 is_test=false 전체 count (lifetime — stats 카드용) */
  totalSubmissions: number | null | undefined;
  recentSubmissions: RecentSubmission[] | null | undefined;
  prevWeekSubmissions: RecentSubmission[] | null | undefined;
  distAggregates: DistAggregateRow[] | null | undefined;
  recentOpenings: RecentOpening[] | null | undefined;
  surveyDetails: SurveyDetail[] | null | undefined;
  submissionCounts: SubmissionCountRow[] | null | undefined;
}

export interface DashboardAlert {
  level: "red" | "yellow" | "green";
  title: string;
  detail: string;
  surveyId: string;
}

export interface SurveyRow {
  id: string;
  title: string;
  customerName: string | null;
  distributed: number;
  opened: number;
  responses: number;
  responseRate: number | null;
  createdAt: string;
}

export interface CustomerRow {
  name: string;
  surveys: number;
  responses: number;
}

export interface DashboardData {
  stats: {
    activeSurveyCount: number;
    responseRate: number;
    pendingCount: number;
    thisWeekCount: number;
    weekDiff: number;
    totalDistributed: number;
    respondedCount: number;
    totalSubmissions: number;
  };
  funnel: {
    distributed: number;
    opened: number;
    responded: number;
  };
  alerts: DashboardAlert[];
  surveyRows: SurveyRow[];
  customerRows: CustomerRow[];
  recentActivity: ActivityItem[];
}

export function aggregateDashboard(inputs: DashboardInputs): DashboardData {
  const {
    now,
    activeSurveys,
    totalSubmissions,
    recentSubmissions,
    prevWeekSubmissions,
    distAggregates,
    recentOpenings,
    surveyDetails,
    submissionCounts,
  } = inputs;

  const submissionBySurvey: Record<string, number> = {};
  (submissionCounts ?? []).forEach((row) => {
    submissionBySurvey[row.survey_id] = Number(row.cnt) || 0;
  });

  const distBySurvey: Record<string, DistBuckets> = {};
  let totalDistributed = 0;
  let pendingCount = 0;
  let openedCount = 0;
  let startedCount = 0;
  let completedCount = 0;
  (distAggregates ?? []).forEach((row) => {
    const buckets: DistBuckets = {
      total: Number(row.total) || 0,
      pending: Number(row.pending) || 0,
      opened: Number(row.opened) || 0,
      started: Number(row.started) || 0,
      completed: Number(row.completed) || 0,
    };
    distBySurvey[row.survey_id] = buckets;
    totalDistributed += buckets.total;
    pendingCount += buckets.pending;
    openedCount += buckets.opened;
    startedCount += buckets.started;
    completedCount += buckets.completed;
  });
  const respondedCount = openedCount + startedCount + completedCount;
  const responseRate =
    totalDistributed > 0
      ? Math.round((respondedCount / totalDistributed) * 100)
      : 0;

  const thisWeekCount = (recentSubmissions ?? []).length;
  const prevWeekCount = (prevWeekSubmissions ?? []).length;
  const weekDiff = thisWeekCount - prevWeekCount;

  const alerts: DashboardAlert[] = [];
  (surveyDetails ?? []).forEach((s) => {
    const dist = distBySurvey[s.id];
    const responses = submissionBySurvey[s.id] || 0;
    const customerName = s.sessions?.courses?.projects?.customers?.company_name;
    const label = customerName ? `${customerName} — ${s.title}` : s.title;

    if (s.status === "active" && dist && dist.total > 0 && responses === 0) {
      const daysSince = Math.floor(
        (now.getTime() - new Date(s.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      alerts.push({
        level: "red",
        title: label,
        detail: `${dist.total}건 배포, 0건 응답 (${daysSince}일 경과)`,
        surveyId: s.id,
      });
    } else if (s.status === "draft" && dist && dist.total > 0) {
      alerts.push({
        level: "yellow",
        title: label,
        detail: `draft 상태 — ${dist.total}건 배포됨 (설문 활성화 필요)`,
        surveyId: s.id,
      });
    } else if (
      s.status === "active" &&
      dist &&
      dist.total > 0 &&
      dist.pending > dist.total * 0.8
    ) {
      alerts.push({
        level: "yellow",
        title: label,
        detail: `${dist.total}건 배포 중 ${dist.pending}건 미열람 (${Math.round(
          (dist.pending / dist.total) * 100
        )}%)`,
        surveyId: s.id,
      });
    }
  });

  const surveyRows: SurveyRow[] = (activeSurveys ?? []).map((s) => {
    const dist = distBySurvey[s.id] ?? {
      total: 0,
      pending: 0,
      opened: 0,
      started: 0,
      completed: 0,
    };
    const responses = submissionBySurvey[s.id] || 0;
    const detail = (surveyDetails ?? []).find((d) => d.id === s.id);
    const customerName =
      detail?.sessions?.courses?.projects?.customers?.company_name ?? null;
    return {
      id: s.id,
      title: s.title,
      customerName: customerName || null,
      distributed: dist.total,
      opened: dist.opened + dist.started + dist.completed,
      responses,
      responseRate:
        dist.total > 0 ? Math.round((responses / dist.total) * 100) : null,
      createdAt: s.created_at,
    };
  });

  const customerMap: Record<string, { surveys: number; responses: number }> =
    {};
  (surveyDetails ?? []).forEach((s) => {
    const customerName = s.sessions?.courses?.projects?.customers?.company_name;
    if (!customerName) return;
    if (!customerMap[customerName]) {
      customerMap[customerName] = { surveys: 0, responses: 0 };
    }
    customerMap[customerName].surveys++;
    customerMap[customerName].responses += submissionBySurvey[s.id] || 0;
  });
  const customerRows: CustomerRow[] = Object.entries(customerMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.responses - a.responses)
    .slice(0, 8);

  const activityItems: ActivityItem[] = [];
  (recentOpenings ?? []).forEach((d) => {
    if (!d.opened_at) return;
    activityItems.push({
      at: d.opened_at,
      kind: "opened",
      text: `${d.recipient_name || "익명"} 열람`,
    });
  });
  (recentSubmissions ?? []).forEach((s) => {
    activityItems.push({
      at: s.submitted_at,
      kind: "responded",
      text: "새 응답 제출",
    });
  });
  activityItems.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return {
    stats: {
      activeSurveyCount: (activeSurveys ?? []).length,
      responseRate,
      pendingCount,
      thisWeekCount,
      weekDiff,
      totalDistributed,
      respondedCount,
      totalSubmissions: totalSubmissions ?? 0,
    },
    funnel: {
      // distributed/opened/responded 모두 같은 distributions 60일 집계에서 파생 —
      // 이전 버그 (responded=lifetime submissions → % > 100) 회귀 방지
      distributed: totalDistributed,
      opened: openedCount + startedCount + completedCount,
      responded: completedCount,
    },
    alerts,
    surveyRows,
    customerRows,
    recentActivity: activityItems.slice(0, 20),
  };
}
