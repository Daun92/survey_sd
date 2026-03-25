import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  Users,
  FolderOpen,
  ClipboardList,
  ChartColumn,
  Zap,
  Eye,
  Send,
  FileBarChart,
} from "lucide-react";

export const revalidate = 60;

async function getDashboardData() {
  const [
    { count: customerCount },
    { count: projectCount },
    { count: surveyCount },
    { count: submissionCount },
    { data: recentSurveys },
    { count: templateCount },
    { count: activeSurveyCount },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("edu_surveys").select("*", { count: "exact", head: true }),
    supabase.from("edu_submissions").select("*", { count: "exact", head: true }),
    supabase
      .from("edu_surveys")
      .select("id, title, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("edu_survey_templates").select("*", { count: "exact", head: true }),
    supabase
      .from("edu_surveys")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  return {
    customerCount: customerCount ?? 0,
    projectCount: projectCount ?? 0,
    surveyCount: surveyCount ?? 0,
    submissionCount: submissionCount ?? 0,
    recentSurveys: recentSurveys ?? [],
    templateCount: templateCount ?? 0,
    activeSurveyCount: activeSurveyCount ?? 0,
  };
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: { label: "초안", className: "border border-stone-200 text-stone-700" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  const statCards = [
    { label: "고객사", value: data.customerCount, icon: Users },
    { label: "프로젝트", value: data.projectCount, icon: FolderOpen },
    { label: "교육 설문", value: data.surveyCount, icon: ClipboardList },
    { label: "총 응답 수", value: data.submissionCount, icon: ChartColumn },
  ];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">대시보드</h1>
          <p className="text-sm text-stone-500 mt-1">
            교육 설문 현황을 한눈에 확인하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/quick-create"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Zap size={14} />
            간편 생성
          </Link>
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <FolderOpen size={14} />
            프로젝트
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-stone-200 bg-white shadow-sm"
          >
            <div className="px-5 pb-5 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-medium text-stone-500">
                  {card.label}
                </p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-teal-600 bg-teal-50">
                  <card.icon size={16} aria-hidden="true" />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {card.value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex flex-col space-y-1.5 p-5 flex flex-row items-center justify-between">
            <div>
              <h3 className="text-base font-semibold leading-none tracking-tight text-stone-900">
                최근 교육 설문
              </h3>
              <p className="text-sm text-stone-500">최근 생성된 설문 목록</p>
            </div>
            <Link
              href="/admin/surveys"
              className="text-[13px] font-medium text-teal-600 hover:text-teal-700"
            >
              전체 보기
            </Link>
          </div>
          <div className="px-5 pb-5 px-0 pb-0">
            <div>
              <div className="flex items-center px-5 h-9 bg-stone-50/80 border-b border-stone-100">
                <div className="flex-[3] text-xs font-medium text-stone-500">
                  설문명
                </div>
                <div className="flex-1 text-xs font-medium text-stone-500">
                  상태
                </div>
                <div className="flex-1 text-xs font-medium text-stone-500">
                  생성일
                </div>
                <div className="w-20 text-xs font-medium text-stone-500 text-right">
                  액션
                </div>
              </div>
              {data.recentSurveys.map((survey) => {
                const status = statusLabels[survey.status] ?? statusLabels.draft;
                return (
                  <div
                    key={survey.id}
                    className="flex items-center px-5 h-12 border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors"
                  >
                    <div className="flex-[3] text-sm font-medium text-stone-800 truncate pr-4">
                      <Link href={`/admin/surveys/${survey.id}`} className="hover:text-teal-600 transition-colors">
                        {survey.title}
                      </Link>
                    </div>
                    <div className="flex-1">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex-1 text-[13px] text-stone-500">
                      {formatDate(survey.created_at)}
                    </div>
                    <div className="w-20 flex items-center justify-end gap-0.5">
                      <Link href={`/admin/surveys/${survey.id}`} className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="보기">
                        <Eye size={14} />
                      </Link>
                      <Link href="/admin/distribute" className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="배포">
                        <Send size={14} />
                      </Link>
                      <Link href={`/admin/reports?survey=${survey.id}`} className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="리포트">
                        <FileBarChart size={14} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col space-y-1.5 p-5">
            <h3 className="text-base font-semibold leading-none tracking-tight text-stone-900">
              시스템 현황
            </h3>
            <p className="text-sm text-stone-500">서비스 상태 요약</p>
          </div>
          <div className="px-5 pb-5">
            <div className="space-y-0">
              <div className="flex items-center justify-between py-3 border-b border-stone-100">
                <span className="text-sm text-stone-600">데이터베이스</span>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  정상
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-stone-100">
                <span className="text-sm text-stone-600">설문 템플릿</span>
                <span className="text-sm font-medium text-stone-800">
                  {data.templateCount}종
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-stone-100">
                <span className="text-sm text-stone-600">활성 설문</span>
                <span className="text-sm font-medium text-teal-600">
                  {data.activeSurveyCount}개
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-stone-600">총 응답</span>
                <span className="text-sm font-medium text-stone-800">
                  {data.submissionCount}건
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
