import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Users, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

async function getResponseDetail(supabase: Awaited<ReturnType<typeof createClient>>, surveyId: string) {
  const [{ data: survey, error: surveyError }, { data: questions }, { data: submissions }] =
    await Promise.all([
      supabase
        .from("edu_surveys")
        .select("id, title, status, url_token")
        .eq("id", surveyId)
        .single(),
      supabase
        .from("edu_questions")
        .select("id, question_code, question_text, question_type, section, sort_order")
        .eq("survey_id", surveyId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("edu_submissions")
        .select("id, respondent_name, respondent_department, respondent_position, answers, submitted_at, total_score")
        .eq("survey_id", surveyId)
        .order("submitted_at", { ascending: false }),
    ]);

  if (surveyError || !survey) {
    console.error("[responses/[surveyId]] Supabase error:", surveyError);
    return null;
  }

  return {
    survey,
    questions: questions ?? [],
    submissions: submissions ?? [],
  };
}

export default async function ResponseDetailPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const supabase = await createClient();
  const { surveyId } = await params;
  const data = await getResponseDetail(supabase, surveyId);

  if (!data) return notFound();

  const { survey, questions, submissions } = data;

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <Link
          href="/admin/responses"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          응답 관리로 돌아가기
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">{survey.title}</h1>
            <p className="text-sm text-stone-500 mt-1">
              총 {submissions.length}건의 응답 · {questions.length}개 문항
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/api/surveys/${surveyId}/export`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              CSV 내보내기
            </a>
            <Link
              href={`/admin/reports?survey=${surveyId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              <FileText size={14} />
              리포트 보기
            </Link>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-stone-400" />
            <p className="text-[13px] font-medium text-stone-500">총 응답</p>
          </div>
          <p className="text-2xl font-bold text-stone-800">{submissions.length}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">평균 점수</p>
          <p className="text-2xl font-bold text-teal-600">
            {submissions.length > 0
              ? (submissions.reduce((sum, s) => sum + (s.total_score ?? 0), 0) / submissions.length).toFixed(1)
              : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">문항 수</p>
          <p className="text-2xl font-bold text-stone-800">{questions.length}</p>
        </div>
      </div>

      {/* 응답 테이블 */}
      {submissions.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <p className="text-sm text-stone-500">아직 응답이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-auto max-h-[calc(100vh-280px)] max-w-[calc(100vw-21rem)]">
            <table className="text-sm border-collapse w-max">
              <thead className="sticky top-0 z-20">
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="sticky left-0 z-30 bg-stone-50 text-left px-4 py-2.5 text-xs font-medium text-stone-500 whitespace-nowrap border-r border-stone-100">#</th>
                  <th className="sticky left-[40px] z-30 bg-stone-50 text-left px-4 py-2.5 text-xs font-medium text-stone-500 whitespace-nowrap border-r border-stone-100">응답일시</th>
                  <th className="sticky left-[180px] z-30 bg-stone-50 text-left px-4 py-2.5 text-xs font-medium text-stone-500 whitespace-nowrap border-r border-stone-100">응답자</th>
                  <th className="sticky left-[260px] z-30 bg-stone-50 text-left px-4 py-2.5 text-xs font-medium text-stone-500 whitespace-nowrap border-r border-stone-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">소속</th>
                  {questions.map((q) => (
                    <th
                      key={q.id}
                      className="bg-stone-50 text-center px-3 py-2.5 text-xs font-medium text-stone-500 min-w-[60px] whitespace-nowrap"
                      title={q.question_text}
                    >
                      {q.question_code || `Q${q.sort_order + 1}`}
                    </th>
                  ))}
                  <th className="bg-stone-50 text-right px-4 py-2.5 text-xs font-medium text-stone-500 whitespace-nowrap">총점</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, idx) => {
                  const answers = (sub.answers ?? {}) as Record<string, string | number>;
                  return (
                    <tr
                      key={sub.id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50"
                    >
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 text-stone-400 whitespace-nowrap border-r border-stone-100">{idx + 1}</td>
                      <td className="sticky left-[40px] z-10 bg-white px-4 py-3 text-stone-700 whitespace-nowrap border-r border-stone-100">
                        {sub.submitted_at ? formatDateTime(sub.submitted_at) : "-"}
                      </td>
                      <td className="sticky left-[180px] z-10 bg-white px-4 py-3 text-stone-800 font-medium whitespace-nowrap border-r border-stone-100">
                        {sub.respondent_name || "익명"}
                      </td>
                      <td className="sticky left-[260px] z-10 bg-white px-4 py-3 text-stone-500 whitespace-nowrap border-r border-stone-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                        {sub.respondent_department || "-"}
                      </td>
                      {questions.map((q) => (
                        <td key={q.id} className="text-center px-3 py-3 text-stone-700 whitespace-nowrap">
                          {answers[q.id] !== undefined ? String(answers[q.id]) : "-"}
                        </td>
                      ))}
                      <td className="text-right px-4 py-3 font-medium text-stone-800 whitespace-nowrap">
                        {sub.total_score != null ? sub.total_score : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
