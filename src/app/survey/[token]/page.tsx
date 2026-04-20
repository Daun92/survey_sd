/**
 * @deprecated 공용 토큰으로 직접 공유하는 교육 설문 응답자 페이지. 실사용 대상은 admin/distribute
 * 에서 생성되는 `/s/[token]` (full-featured flow). 이 경로는 레거시 단일 응답자 뷰이며 신규
 * 기능은 `/s` 에 추가할 것. 참고: AGENTS.md 라우팅 지도.
 */

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SurveyForm } from "./SurveyForm";

export const dynamic = "force-dynamic";

async function getSurvey(token: string) {
  const supabase = await createClient();

  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("id, title, description, status")
    .eq("url_token", token)
    .maybeSingle();

  if (!survey) return null;

  const { data: questions } = await supabase
    .from("edu_survey_questions")
    .select("id, question_text, question_type, section, sort_order, is_required, options")
    .eq("survey_id", survey.id)
    .order("sort_order", { ascending: true });

  return {
    ...survey,
    questions: questions ?? [],
  };
}

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const survey = await getSurvey(token);

  if (!survey) {
    notFound();
  }

  if (survey.status === "closed") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl border border-stone-200 bg-white shadow-sm p-8 text-center">
          <h1 className="text-xl font-bold text-stone-800 mb-2">
            설문이 마감되었습니다
          </h1>
          <p className="text-sm text-stone-500">
            이 설문은 더 이상 응답을 받지 않습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-8 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white text-sm font-bold mb-4">
            E
          </div>
          <h1 className="text-2xl font-bold text-stone-800">{survey.title}</h1>
          {survey.description && (
            <p className="text-sm text-stone-500 mt-2">{survey.description}</p>
          )}
        </div>

        <SurveyForm surveyId={survey.id} surveyTitle={survey.title} questions={survey.questions} />
      </div>
    </div>
  );
}
