import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Eye, MessageSquare, Inbox } from "lucide-react";

export const revalidate = 30;

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-stone-100 text-stone-800" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

interface SurveyWithResponses {
  id: string;
  title: string;
  status: string;
  session_id: string | null;
  session_name: string | null;
  session_capacity: number | null;
  submission_count: number;
  avg_score: number | null;
}

async function getSurveysWithResponses(): Promise<SurveyWithResponses[]> {
  // Fetch surveys with submission counts and session info in parallel
  const [{ data: surveys }, { data: submissions }] = await Promise.all([
    supabase
      .from("edu_surveys")
      .select("id, title, status, session_id, sessions(name, capacity)")
      .order("created_at", { ascending: false }),
    supabase
      .from("edu_submissions")
      .select("survey_id, answers"),
  ]);

  if (!surveys || !submissions || submissions.length === 0) return [];

  // Build submission stats per survey
  const statsMap: Record<
    string,
    { count: number; totalScore: number; scoreCount: number }
  > = {};
  submissions.forEach((sub) => {
    if (!statsMap[sub.survey_id]) {
      statsMap[sub.survey_id] = { count: 0, totalScore: 0, scoreCount: 0 };
    }
    statsMap[sub.survey_id].count += 1;

    if (sub.answers && typeof sub.answers === "object") {
      const answers = Object.values(sub.answers) as unknown[];
      answers.forEach((val) => {
        const num = Number(val);
        if (!isNaN(num) && num > 0) {
          statsMap[sub.survey_id].totalScore += num;
          statsMap[sub.survey_id].scoreCount += 1;
        }
      });
    }
  });

  return surveys
    .filter((s) => statsMap[s.id])
    .map((s) => {
      const stats = statsMap[s.id];
      const session = s.sessions as unknown as { name: string; capacity: number | null } | null;
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        session_id: s.session_id,
        session_name: session?.name ?? null,
        session_capacity: session?.capacity ?? null,
        submission_count: stats.count,
        avg_score:
          stats.scoreCount > 0
            ? Math.round((stats.totalScore / stats.scoreCount) * 10) / 10
            : null,
      };
    });
}

export default async function ResponsesPage() {
  const surveys = await getSurveysWithResponses();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">응답 관리</h1>
        <p className="text-sm text-stone-500 mt-1">
          수집된 설문 응답을 확인하고 분석하세요
        </p>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              <Inbox size={24} />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            수집된 응답이 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            설문이 배포되면 응답이 이곳에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {surveys.map((survey) => {
            const status =
              statusLabels[survey.status] ?? statusLabels.closed;
            const responseRate =
              survey.session_capacity && survey.session_capacity > 0
                ? Math.round(
                    (survey.submission_count / survey.session_capacity) *
                      100
                  )
                : null;

            return (
              <div
                key={survey.id}
                className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1 pr-2">
                      <h3 className="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">
                        {survey.title}
                      </h3>
                      {survey.session_name && (
                        <p className="text-[13px] text-stone-500 mt-0.5 truncate">
                          {survey.session_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">응답 수</p>
                      <p className="text-lg font-bold text-stone-800">
                        {survey.submission_count}
                        <span className="text-xs font-normal text-stone-400 ml-0.5">
                          건
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-0.5">
                        평균 점수
                      </p>
                      <p className="text-lg font-bold text-teal-600">
                        {survey.avg_score !== null
                          ? survey.avg_score.toFixed(1)
                          : "-"}
                      </p>
                    </div>
                  </div>

                  {/* Response Rate Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-stone-500">응답률</span>
                      <span className="text-xs font-medium text-stone-700">
                        {responseRate !== null ? `${responseRate}%` : "-"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{
                          width: `${responseRate !== null ? Math.min(responseRate, 100) : 0}%`,
                        }}
                      />
                    </div>
                    {survey.session_capacity && (
                      <p className="text-[11px] text-stone-400 mt-1">
                        {survey.submission_count} / {survey.session_capacity}명
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-stone-100">
                    <Link
                      href={`/admin/surveys/${survey.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[13px] font-medium text-stone-700 hover:bg-stone-50 transition-colors flex-1 justify-center"
                    >
                      <Eye size={14} />
                      상세
                    </Link>
                    <Link
                      href={`/admin/reports?survey=${survey.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-teal-700 transition-colors flex-1 justify-center"
                    >
                      <MessageSquare size={14} />
                      리포트
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
