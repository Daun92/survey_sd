import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import DistributeClient from "./distribute-client";

export const dynamic = "force-dynamic";

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

async function getDistributionData() {
  const { data: distributions } = await supabase
    .from("distributions")
    .select("*, distribution_batches(title)")
    .order("created_at", { ascending: false });

  return distributions ?? [];
}

export default async function DistributePage() {
  const [surveys, distributions] = await Promise.all([
    getSurveyData(),
    getDistributionData(),
  ]);

  return (
    <div>
      <DistributeClient surveys={surveys} distributions={distributions} />
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
