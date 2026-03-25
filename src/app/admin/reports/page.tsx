import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  BarChart3,
  FileBarChart,
  ChevronLeft,
  Inbox,
  CalendarDays,
  Users,
  TrendingUp,
  Download,
} from "lucide-react";
import { AIReportComment } from "./ai-comment";
import { AIOpenAnalysis } from "./ai-open-analysis";

export const revalidate = 60;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getSurveyReport(surveyId: string) {
  const { data: survey } = await supabase
    .from("edu_surveys")
    .select("id, title, status, created_at")
    .eq("id", surveyId)
    .single();

  if (!survey) return null;

  const { data: submissions } = await supabase
    .from("edu_submissions")
    .select("id, total_score, created_at")
    .eq("survey_id", surveyId);

  const submissionCount = submissions?.length ?? 0;
  const avgScore =
    submissionCount > 0
      ? (submissions!.reduce((sum, s) => sum + (s.total_score ?? 0), 0) /
          submissionCount)
      : 0;

  return {
    ...survey,
    submissionCount,
    avgScore: Math.round(avgScore * 10) / 10,
    submissions: submissions ?? [],
  };
}

async function getSurveyList() {
  const { data: surveys } = await supabase
    .from("edu_surveys")
    .select("id, title, status, created_at, edu_submissions(count)")
    .order("created_at", { ascending: false });

  if (!surveys || surveys.length === 0) return [];

  return surveys.map((sv) => ({
    ...sv,
    submissionCount: (sv.edu_submissions as unknown as { count: number }[])?.[0]?.count ?? 0,
    avgScore: 0,
  }));
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-rose-100 text-rose-800" },
  draft: { label: "초안", className: "border border-stone-200 text-stone-700" },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ survey?: string }>;
}) {
  const params = await searchParams;
  const surveyId = params.survey;

  if (surveyId) {
    const report = await getSurveyReport(surveyId);

    if (!report) {
      return (
        <div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
            <p className="text-sm text-stone-500 mt-1">
              교육 설문 결과를 분석하세요
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
            <p className="text-sm text-stone-500">
              해당 설문을 찾을 수 없습니다.
            </p>
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 mt-4"
            >
              <ChevronLeft size={16} />
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      );
    }

    const status = statusLabels[report.status] ?? statusLabels.draft;

    return (
      <div>
        <div className="mb-8">
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 mb-4"
          >
            <ChevronLeft size={16} />
            목록으로 돌아가기
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
              <p className="text-sm text-stone-500 mt-1">
                교육 설문 결과를 분석하세요
              </p>
            </div>
            <a
              href={`/api/surveys/${report.id}/export`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              CSV 내보내기
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-6">
          <div className="p-5 border-b border-stone-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  {report.title}
                </h2>
                <p className="text-sm text-stone-500 mt-0.5">
                  {formatDate(report.created_at)}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
            <div className="p-5 text-center">
              <div className="flex justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Users size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {report.submissionCount}
              </p>
              <p className="text-xs text-stone-500 mt-1">총 응답 수</p>
            </div>
            <div className="p-5 text-center">
              <div className="flex justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {report.avgScore}
              </p>
              <p className="text-xs text-stone-500 mt-1">평균 점수</p>
            </div>
            <div className="p-5 text-center">
              <div className="flex justify-center mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <CalendarDays size={16} />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {formatDate(report.created_at)}
              </p>
              <p className="text-xs text-stone-500 mt-1">설문 생성일</p>
            </div>
          </div>
        </div>

        {/* AI 리포트 코멘트 */}
        <AIReportComment
          reportData={{
            courseName: report.title,
            sessionName: "",
            overallAvg: report.avgScore,
            responseRate: 0,
            totalResponses: report.submissionCount,
            sectionScores: [],
            questionScores: [],
          }}
        />

        {report.submissions.length > 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="p-5 border-b border-stone-100">
              <h3 className="text-base font-semibold text-stone-900">
                응답 내역
              </h3>
            </div>
            <div>
              <div className="flex items-center px-5 h-9 bg-stone-50/80 border-b border-stone-100">
                <div className="flex-1 text-xs font-medium text-stone-500">
                  #
                </div>
                <div className="flex-[2] text-xs font-medium text-stone-500">
                  응답일
                </div>
                <div className="flex-1 text-xs font-medium text-stone-500 text-right">
                  점수
                </div>
              </div>
              {report.submissions.map((sub, idx) => (
                <div
                  key={sub.id}
                  className="flex items-center px-5 h-12 border-b border-stone-100 last:border-0"
                >
                  <div className="flex-1 text-sm text-stone-500">{idx + 1}</div>
                  <div className="flex-[2] text-sm text-stone-700">
                    {formatDate(sub.created_at)}
                  </div>
                  <div className="flex-1 text-sm font-medium text-stone-800 text-right">
                    {sub.total_score ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
            <p className="text-sm text-stone-500">
              아직 응답 데이터가 없습니다.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Survey list view
  const surveys = await getSurveyList();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">리포트</h1>
        <p className="text-sm text-stone-500 mt-1">
          교육 설문 결과를 분석하세요
        </p>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <Inbox size={24} className="text-stone-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            설문이 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            리포트를 생성할 설문이 아직 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map((survey) => {
            const status = statusLabels[survey.status] ?? statusLabels.draft;
            return (
              <div
                key={survey.id}
                className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <BarChart3 size={16} />
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-stone-800 mb-1 truncate">
                    {survey.title}
                  </h3>
                  <p className="text-xs text-stone-400 mb-4">
                    {formatDate(survey.created_at)}
                  </p>

                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <p className="text-lg font-bold text-stone-800">
                        {survey.submissionCount}
                      </p>
                      <p className="text-xs text-stone-500">응답 수</p>
                    </div>
                    <div className="h-8 w-px bg-stone-100" />
                    <div>
                      <p className="text-lg font-bold text-stone-800">
                        {survey.avgScore}
                      </p>
                      <p className="text-xs text-stone-500">평균 점수</p>
                    </div>
                  </div>

                  <Link
                    href={`/admin/reports?survey=${survey.id}`}
                    className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
                  >
                    <FileBarChart size={14} />
                    보고서 생성
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
