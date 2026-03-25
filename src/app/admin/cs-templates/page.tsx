import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  XCircle,
  ListChecks,
  Inbox,
} from "lucide-react";

export const revalidate = 300;

async function getTemplatesWithQuestionCounts() {
  const { data: templates } = await supabase
    .from("cs_survey_templates")
    .select("id, division, division_label, name, description, is_active, created_at, cs_survey_questions(count)")
    .order("created_at", { ascending: false });

  if (!templates || templates.length === 0) return [];

  return templates.map((t) => ({
    ...t,
    questionCount: (t.cs_survey_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CSTemplatesPage() {
  const templates = await getTemplatesWithQuestionCounts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">CS 문항 템플릿</h1>
        <p className="text-sm text-stone-500 mt-1">
          고객 만족도 설문 문항 템플릿을 관리하세요
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <Inbox size={24} className="text-stone-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            등록된 템플릿이 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            CS 설문 문항 템플릿을 추가해 주세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Link
              href={`/admin/cs-templates/${template.id}`}
              key={template.id}
              className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow block"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                    {template.division_label}
                  </span>
                  {template.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 size={14} />
                      활성
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-400">
                      <XCircle size={14} />
                      비활성
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-stone-800 mb-1.5 truncate">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-[13px] text-stone-500 mb-4 line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                  <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
                    <ListChecks size={14} className="text-teal-600" />
                    <span>
                      문항{" "}
                      <span className="font-medium text-stone-700">
                        {template.questionCount}
                      </span>
                      개
                    </span>
                  </div>
                  <span className="text-xs text-stone-400">
                    {formatDate(template.created_at)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
