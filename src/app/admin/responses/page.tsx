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
  distribution_count: number;
  course_name: string | null;
  project_name: string | null;
  submission_count: number;
  avg_score: number | null;
}

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
        ),
        edu_submissions(count)
      `)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("edu_submissions")
      .select("survey_id, total_score")
      .eq("is_test", false),
    supabase
      .from("distributions")
      .select("survey_id"),
  ]);

  if (!surveys) return [];

  const statsMap: Record<string, { totalScore: number; scoreCount: number }> = {};
  (submissions ?? []).forEach((sub) => {
    if (!statsMap[sub.survey_id]) {
      statsMap[sub.survey_id] = { totalScore: 0, scoreCount: 0 };
    }
    if (sub.total_score != null) {
      statsMap[sub.survey_id].totalScore += sub.total_score;
      statsMap[sub.survey_id].scoreCount += 1;
    }
  });

  const distCountBySurvey: Record<string, number> = {};
  (dists ?? []).forEach((d) => {
    if (!d.survey_id) return;
    distCountBySurvey[d.survey_id] = (distCountBySurvey[d.survey_id] ?? 0) + 1;
  });

  return surveys
    .map((s) => {
      const session = s.sessions as any;
      const course = session?.courses as any;
      const project = course?.projects as any;
      const submissionCount =
        (s.edu_submissions as unknown as { count: number }[])?.[0]?.count ?? 0;
      const stats = statsMap[s.id];
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        session_name: session?.name ?? null,
        session_capacity: session?.capacity ?? null,
        distribution_count: distCountBySurvey[s.id] ?? 0,
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
