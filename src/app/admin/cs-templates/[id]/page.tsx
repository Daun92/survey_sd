import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

const questionTypeLabels: Record<string, string> = {
  single_choice: "단일선택",
  multiple_choice: "복수선택",
  likert_5: "5점 척도",
  likert_7: "7점 척도",
  text: "주관식",
  rating: "평점",
  yes_no: "예/아니오",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getTemplateDetail(id: string) {
  const [{ data: template, error }, { data: questions }] = await Promise.all([
    supabase
      .from("cs_survey_templates")
      .select("id, division, division_label, name, description, is_active, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("cs_survey_questions")
      .select("id, question_no, question_text, question_type, page_type, response_options, section_label, sort_order")
      .eq("template_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (error || !template) return null;

  return { template, questions: questions ?? [] };
}

export default async function CSTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTemplateDetail(id);

  if (!data) {
    notFound();
  }

  const { template, questions } = data;

  // Group questions by page_type
  const pages: Record<string, typeof questions> = {};
  questions.forEach((q) => {
    const page = q.page_type || "기타";
    if (!pages[page]) pages[page] = [];
    pages[page].push(q);
  });

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/cs-templates"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft size={16} />
          템플릿 목록으로 돌아가기
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-start gap-3 mb-2">
          <h1 className="text-2xl font-bold text-stone-800">
            {template.name}
          </h1>
          <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 mt-1.5 shrink-0">
            {template.division_label}
          </span>
        </div>
        {template.description && (
          <p className="text-sm text-stone-500 mt-1">{template.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
            <ListChecks size={14} className="text-teal-600" />
            문항 {questions.length}개
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
            <Calendar size={14} className="text-stone-400" />
            {formatDate(template.created_at)}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">총 문항 수</p>
          <p className="text-2xl font-bold text-stone-800">{questions.length}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">페이지 수</p>
          <p className="text-2xl font-bold text-teal-600">{Object.keys(pages).length}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">상태</p>
          <p className="text-2xl font-bold text-stone-800">
            {template.is_active ? "활성" : "비활성"}
          </p>
        </div>
      </div>

      {/* Questions List */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">문항 목록</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            총 {questions.length}개 문항
          </p>
        </div>

        {questions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                <ListChecks size={24} />
              </div>
            </div>
            <h3 className="text-sm font-medium text-stone-800 mb-1">
              등록된 문항이 없습니다
            </h3>
            <p className="text-sm text-stone-500">
              이 템플릿에 문항을 추가해 주세요.
            </p>
          </div>
        ) : (
          <div>
            {Object.entries(pages).map(([pageName, pageQuestions]) => (
              <div key={pageName}>
                <div className="px-5 py-2.5 bg-stone-50/80 border-b border-stone-100">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    {pageName}
                  </span>
                  <span className="text-xs text-stone-400 ml-2">
                    ({pageQuestions.length}문항)
                  </span>
                </div>
                {pageQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="flex items-start gap-4 px-5 py-3.5 border-b border-stone-100 last:border-0"
                  >
                    <span className="text-xs font-mono text-stone-400 mt-0.5 shrink-0 w-12">
                      {question.question_no}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800 leading-relaxed">
                        {question.question_text}
                      </p>
                      {question.response_options && (
                        <p className="text-xs text-stone-400 mt-1">
                          {question.response_options}
                        </p>
                      )}
                    </div>
                    <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 shrink-0">
                      {questionTypeLabels[question.question_type] ?? question.question_type}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
