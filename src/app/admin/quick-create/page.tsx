import { supabase } from "@/lib/supabase";
import { Zap } from "lucide-react";
import { QuickCreateForm } from "./QuickCreateForm";

export const dynamic = "force-dynamic";

async function getFormData() {
  const [{ data: projects }, { data: customers }, { data: templates }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, customers(id, company_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("customers")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name"),
      supabase
        .from("cs_survey_templates")
        .select(
          "id, name, division, division_label, cs_survey_questions(id, question_no, question_text, question_type, page_type, response_options, section_label, sort_order)"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

  const projectList = (projects ?? []).map((p) => {
    const customer = Array.isArray(p.customers)
      ? p.customers[0]
      : p.customers;
    return {
      id: p.id as string,
      name: p.name as string,
      customerName: (customer as { company_name?: string } | null)?.company_name ?? null,
    };
  });

  const templateList = (templates ?? []).map((t: any) => {
    const questions = (t.cs_survey_questions ?? []).sort(
      (a: any, b: any) => a.sort_order - b.sort_order
    );
    return {
      id: t.id,
      name: t.name,
      division: t.division,
      division_label: t.division_label,
      questionCount: questions.length,
      questions: questions.map((q: any) => ({
        id: q.id,
        questionNo: q.question_no,
        questionText: q.question_text,
        questionType: q.question_type,
        pageType: q.page_type,
        responseOptions: q.response_options,
        sectionLabel: q.section_label,
      })),
    };
  });

  return {
    projects: projectList,
    customers: customers ?? [],
    templates: templateList,
  };
}

export default async function QuickCreatePage() {
  const { projects, customers, templates } = await getFormData();

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
            <Zap size={18} className="text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">간편 생성</h1>
        </div>
        <p className="text-sm text-stone-500 mt-1">
          새 설문을 빠르게 만들어 보세요
        </p>
      </div>

      <QuickCreateForm
        projects={projects}
        customers={customers}
        templates={templates}
      />
    </div>
  );
}
