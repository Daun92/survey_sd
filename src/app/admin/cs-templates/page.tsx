import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  ListChecks,
  Inbox,
  Lock,
  Plus,
} from "lucide-react";
import { TemplateActions } from "./template-actions";

async function getTemplatesWithQuestionCounts() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("cs_survey_templates")
    .select("id, division, division_label, name, description, is_active, is_system, created_at, cs_survey_questions(count)")
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: false });

  if (!templates || templates.length === 0) return [];

  return templates.map((t) => ({
    id: t.id as string,
    division: t.division as string,
    division_label: t.division_label as string,
    name: t.name as string,
    description: t.description as string | null,
    is_active: t.is_active as boolean,
    is_system: (t as Record<string, unknown>).is_system as boolean ?? false,
    created_at: t.created_at as string,
    questionCount: (t.cs_survey_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

async function getSurveys() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edu_surveys")
    .select("id, title, edu_questions(count)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((s: any) => ({
    id: s.id,
    title: s.title,
    questionCount: (s.edu_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

export default async function CSTemplatesPage() {
  const [templates, surveys] = await Promise.all([
    getTemplatesWithQuestionCounts(),
    getSurveys(),
  ]);

  const systemTemplates = templates.filter((t) => t.is_system);
  const userTemplates = templates.filter((t) => !t.is_system && t.is_active);
  const archivedTemplates = templates.filter((t) => !t.is_system && !t.is_active);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">문항 템플릿</h1>
          <p className="text-sm text-stone-500 mt-1">
            설문 문항 템플릿을 관리하세요
          </p>
        </div>
        <TemplateActions surveys={surveys} />
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <Inbox size={24} className="text-stone-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">등록된 템플릿이 없습니다</h3>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 기본 템플릿 */}
          {systemTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lock size={14} className="text-stone-400" />
                <h2 className="text-sm font-semibold text-stone-700">기본 템플릿</h2>
                <span className="text-xs text-stone-400">삭제 불가</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} formatDate={formatDate} />
                ))}
              </div>
            </div>
          )}

          {/* 내 템플릿 */}
          {userTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Plus size={14} className="text-teal-600" />
                <h2 className="text-sm font-semibold text-stone-700">내 템플릿</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} formatDate={formatDate} />
                ))}
              </div>
            </div>
          )}

          {/* 보관된 템플릿 */}
          {archivedTemplates.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-400 mb-3">보관된 템플릿</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {archivedTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} formatDate={formatDate} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, formatDate }: { template: ReturnType<typeof Object> & { id: string; name: string; division_label: string; description: string | null; is_active: boolean; is_system: boolean; questionCount: number; created_at: string }; formatDate: (s: string) => string }) {
  return (
    <Link
      href={`/admin/cs-templates/${template.id}`}
      className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow block"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
            {template.division_label}
          </span>
          <div className="flex items-center gap-1.5">
            {template.is_system && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-stone-400">
                <Lock size={10} /> 기본
              </span>
            )}
            {!template.is_active && (
              <span className="text-[10px] text-stone-400">보관됨</span>
            )}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-stone-800 mb-1.5 truncate">{template.name}</h3>
        {template.description && (
          <p className="text-[13px] text-stone-500 mb-4 line-clamp-2">{template.description}</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
          <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
            <ListChecks size={14} className="text-teal-600" />
            <span>문항 <span className="font-medium text-stone-700">{template.questionCount}</span>개</span>
          </div>
          <span className="text-xs text-stone-400">{formatDate(template.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
