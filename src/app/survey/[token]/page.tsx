import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SurveyForm } from "./SurveyForm";
import { RespondentErrorState } from "@/components/respond/respondent-error-state";

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
    return <RespondentErrorState variant="expired" />;
  }

  if (survey.status === "draft") {
    return <RespondentErrorState variant="not_started" />;
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
