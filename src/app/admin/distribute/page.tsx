import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import DistributeTabs from "./distribute-tabs";

export const revalidate = 0;

async function getSurveyData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: surveys } = await supabase
    .from("edu_surveys")
    .select(`
      id, title, status, url_token, created_at, education_type, survey_type,
      sessions ( id, name, session_number,
        class_groups ( id, name, survey_url_token ),
        courses ( name,
          projects ( name,
            customers ( company_name )
          )
        )
      )
    `)
    .in("status", ["active", "draft", "closed"])
    .order("created_at", { ascending: false });

  return (surveys ?? []).map((s: any) => {
    const session = s.sessions;
    const course = session?.courses;
    const project = course?.projects;
    const customer = project?.customers;
    return {
      id: s.id,
      title: s.title,
      token: s.url_token,
      status: s.status,
      createdAt: s.created_at ?? null,
      educationType: s.education_type ?? null,
      surveyType: s.survey_type ?? null,
      sessionName: session?.name ?? null,
      sessionNumber: session?.session_number ?? null,
      courseName: course?.name ?? null,
      projectName: project?.name ?? null,
      customerName: customer?.company_name ?? null,
      classGroups: (session?.class_groups ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        token: g.survey_url_token,
      })),
    };
  });
}

async function getPersonalLinkBatches(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: batches } = await supabase
    .from("distribution_batches")
    .select(`
      id, survey_id, channel, is_test, label, total_count, sent_count, opened_count, completed_count, created_at,
      edu_surveys (
        title, status, education_type,
        sessions ( name, session_number,
          courses ( name,
            projects ( name )
          )
        )
      )
    `)
    .eq("channel", "personal_link")
    .order("created_at", { ascending: false });

  return (batches ?? []).map((b: any) => {
    const survey = b.edu_surveys;
    const session = survey?.sessions;
    const course = session?.courses;
    const project = course?.projects;
    return {
      id: b.id,
      surveyId: b.survey_id,
      surveyTitle: survey?.title ?? "(삭제된 설문)",
      surveyStatus: survey?.status ?? "unknown",
      educationType: survey?.education_type ?? null,
      sessionName: session?.name ?? null,
      sessionNumber: session?.session_number ?? null,
      courseName: course?.name ?? null,
      projectName: project?.name ?? null,
      isTest: b.is_test ?? false,
      channel: b.channel,
      label: b.label ?? null,
      totalCount: b.total_count,
      sentCount: b.sent_count,
      openedCount: b.opened_count,
      completedCount: b.completed_count,
      createdAt: b.created_at,
    };
  });
}

async function getRespondentPickerList(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("respondents")
    .select("id, name, email, phone, department, position, last_cs_survey_sent_at, customer_id, customers:customer_id(id, company_name)")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(500);
  type RespondentRow = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    position: string | null;
    customer_id: number | null;
    last_cs_survey_sent_at: string | null;
    customers: { id: number; company_name: string } | { id: number; company_name: string }[] | null;
  };
  return (data as RespondentRow[] | null ?? []).map((r) => {
    const customer = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    return {
      id: r.id,
      name: r.name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      department: r.department ?? null,
      position: r.position ?? null,
      customerId: r.customer_id ?? null,
      companyName: customer?.company_name ?? null,
      lastSentAt: r.last_cs_survey_sent_at ?? null,
    };
  });
}

export default async function DistributePage() {
  const supabase = await createClient();
  const [surveys, batches, respondents] = await Promise.all([
    getSurveyData(supabase),
    getPersonalLinkBatches(supabase),
    getRespondentPickerList(supabase),
  ]);

  return (
    <div>
      <DistributeTabs surveys={surveys} batches={batches} respondents={respondents} />
      {/* 워크플로우 다음 단계 */}
      <div className="mt-6 rounded-xl border border-stone-200 bg-white shadow-sm p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-800">배포 후 응답을 확인하세요</p>
          <p className="text-[13px] text-stone-500 mt-0.5">수집된 응답 현황과 통계를 확인할 수 있습니다</p>
        </div>
        <Link
          href="/admin/responses"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
        >
          <MessageSquare size={14} />
          응답 확인하기
        </Link>
      </div>
    </div>
  );
}
