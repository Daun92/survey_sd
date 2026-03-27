import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import DistributeClient from "./distribute-client";

export const revalidate = 0;

async function getSurveyData() {
  const { data: surveys } = await supabase
    .from("edu_surveys")
    .select(`
      id, title, status, url_token, created_at,
      sessions ( id, name,
        class_groups ( id, name, survey_url_token )
      )
    `)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false });

  return (surveys ?? []).map((s: any) => ({
    id: s.id,
    title: s.title,
    token: s.url_token,
    status: s.status,
    classGroups: (s.sessions?.class_groups ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      token: g.survey_url_token,
    })),
  }));
}

async function getDistributionBatches() {
  const { data: batches } = await supabase
    .from("distribution_batches")
    .select(`
      id, survey_id, channel, total_count, sent_count, opened_count, completed_count, created_at,
      edu_surveys ( title, status )
    `)
    .eq("channel", "link")
    .order("created_at", { ascending: false });

  return (batches ?? []).map((b: any) => ({
    id: b.id,
    surveyId: b.survey_id,
    surveyTitle: b.edu_surveys?.title ?? "(삭제된 설문)",
    surveyStatus: b.edu_surveys?.status ?? "unknown",
    totalCount: b.total_count,
    sentCount: b.sent_count,
    openedCount: b.opened_count,
    completedCount: b.completed_count,
    createdAt: b.created_at,
  }));
}

export default async function DistributePage() {
  const [surveys, batches] = await Promise.all([
    getSurveyData(),
    getDistributionBatches(),
  ]);

  return (
    <div>
      <DistributeClient surveys={surveys} initialBatches={batches} />
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
