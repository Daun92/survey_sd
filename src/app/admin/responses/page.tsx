import { createClient } from "@/lib/supabase/server";
import { Inbox } from "lucide-react";
import ResponsesView from "./responses-view";

export const revalidate = 30;

interface SurveyWithResponses {
  id: string;
  title: string;
  status: string;
  session_name: string | null;
  session_capacity: number | null;
  /** 전체 distributions 건수 — 배포 대상 수의 상한 (pending 포함) */
  distribution_count: number;
  /** 열람 이상 (opened/started/completed) — 링크 클릭한 대상자 수 */
  engaged_count: number;
  course_name: string | null;
  project_name: string | null;
  submission_count: number;
  avg_score: number | null;
}

const ENGAGED_STATUSES = ["opened", "started", "completed"] as const;

async function getSurveysWithResponses(supabase: Awaited<ReturnType<typeof createClient>>): Promise<SurveyWithResponses[]> {
  const [{ data: surveys }, { data: submissions }, { data: dists }] = await Promise.all([
    supabase
      .from("edu_surveys")
      .select(`
        id, title, status, session_id,
        sessions(name, capacity,
          courses(name,
            projects(name)
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(500),
    // 분자: 테스트 제외한 실제 응답만 집계 (count + total_score 동시 수집)
    supabase
      .from("edu_submissions")
      .select("survey_id, total_score")
      .eq("is_test", false),
    // 배포/열람 구분을 위해 status 까지 가져와 전수 집계
    supabase
      .from("distributions")
      .select("survey_id, status"),
  ]);

  if (!surveys) return [];

  const statsMap: Record<string, { submissionCount: number; totalScore: number; scoreCount: number }> = {};
  (submissions ?? []).forEach((sub) => {
    if (!statsMap[sub.survey_id]) {
      statsMap[sub.survey_id] = { submissionCount: 0, totalScore: 0, scoreCount: 0 };
    }
    statsMap[sub.survey_id].submissionCount += 1;
    if (sub.total_score != null) {
      statsMap[sub.survey_id].totalScore += sub.total_score;
      statsMap[sub.survey_id].scoreCount += 1;
    }
  });

  const distTotal: Record<string, number> = {};
  const distEngaged: Record<string, number> = {};
  (dists ?? []).forEach((d) => {
    if (!d.survey_id) return;
    distTotal[d.survey_id] = (distTotal[d.survey_id] ?? 0) + 1;
    if ((ENGAGED_STATUSES as readonly string[]).includes(d.status)) {
      distEngaged[d.survey_id] = (distEngaged[d.survey_id] ?? 0) + 1;
    }
  });

  return surveys
    .map((s) => {
      const session = s.sessions as any;
      const course = session?.courses as any;
      const project = course?.projects as any;
      const stats = statsMap[s.id];
      const submissionCount = stats?.submissionCount ?? 0;
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        session_name: session?.name ?? null,
        session_capacity: session?.capacity ?? null,
        distribution_count: distTotal[s.id] ?? 0,
        engaged_count: distEngaged[s.id] ?? 0,
        course_name: course?.name ?? null,
        project_name: project?.name ?? null,
        submission_count: submissionCount,
        avg_score:
          stats && stats.scoreCount > 0
            ? Math.round((stats.totalScore / stats.scoreCount) * 10) / 10
            : null,
      };
    })
    .filter((s) => s.submission_count > 0);
}

export default async function ResponsesPage() {
  const supabase = await createClient();
  const surveys = await getSurveysWithResponses(supabase);

  if (surveys.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800">응답 및 리포트</h1>
          <p className="text-sm text-stone-500 mt-1">수집된 설문 응답을 확인하고 분석하세요</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              <Inbox size={24} />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">수집된 응답이 없습니다</h3>
          <p className="text-sm text-stone-500">설문이 배포되면 응답이 이곳에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  return <ResponsesView surveys={surveys} />;
}
