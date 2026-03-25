import { supabase } from "@/lib/supabase";
import { Zap } from "lucide-react";
import { QuickCreateForm } from "./QuickCreateForm";

export const dynamic = "force-dynamic";

async function getFormData() {
  const [{ data: customers }, { data: templates }, { data: serviceTypes }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name"),
      supabase
        .from("cs_survey_templates")
        .select("id, name, division_label, cs_survey_questions(count)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_types")
        .select("id, name")
        .eq("is_active", true)
        .order("id"),
    ]);

  const templatesWithCount = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    division_label: t.division_label,
    questionCount:
      (t.cs_survey_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return {
    customers: customers ?? [],
    templates: templatesWithCount,
    serviceTypes: serviceTypes ?? [],
  };
}

export default async function QuickCreatePage() {
  const { customers, templates, serviceTypes } = await getFormData();

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
          프로젝트부터 설문 배포까지 한 번에 완료합니다
        </p>
      </div>

      <QuickCreateForm
        customers={customers}
        templates={templates}
        serviceTypes={serviceTypes}
      />
    </div>
  );
}
