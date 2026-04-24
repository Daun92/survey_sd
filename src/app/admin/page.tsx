import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  ClipboardList,
  Zap,
  Eye,
  Send,
  FileBarChart,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  MailOpen,
  MousePointerClick,
  Users,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { getUserProfile } from "@/lib/auth";
import RecentActivity from "./recent-activity";
import {
  aggregateDashboard,
  type DistAggregateRow,
  type SubmissionCountRow,
  type ActiveSurvey,
  type RecentOpening,
  type RecentSubmission,
  type SurveyDetail,
} from "@/lib/dashboard-aggregator";

// ─── 데이터 조회 ───

async function getDashboardData() {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  // 최근 활동·배포 집계의 기준 기간 (알림/배포율은 "최근 60일" 기준)
  const ACTIVITY_WINDOW_DAYS = 60;
  const since = new Date(
    now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const [
    activeSurveysRes,
    totalSubmissionsRes,
    recentSubmissionsRes,
    prevWeekSubmissionsRes,
    distAggregatesRes,
    recentOpeningsRes,
    surveyDetailsRes,
    submissionCountsRes,
  ] = await Promise.all([
    // 진행중 설문
    supabase
      .from("edu_surveys")
      .select("id, title, status, created_at")
      .eq("status", "active"),
    // 총 응답 수
    supabase
      .from("edu_submissions")
      .select("*", { count: "exact", head: true })
      .eq("is_test", false),
    // 이번 주 응답
    supabase
      .from("edu_submissions")
      .select("id, survey_id, submitted_at")
      .gte("submitted_at", weekAgo.toISOString())
      .eq("is_test", false),
    // 지난주 응답 (비교용)
    supabase
      .from("edu_submissions")
      .select("id")
      .gte("submitted_at", twoWeeksAgo.toISOString())
      .lt("submitted_at", weekAgo.toISOString())
      .eq("is_test", false),
    // 설문별 배포 상태 집계 (최근 60일)
    supabase.rpc("distribution_aggregates_by_survey", {
      p_since: since.toISOString(),
    }),
    // 최근 열람 활동 (최근 60일 내 opened_at 있는 배포 20건)
    supabase
      .from("distributions")
      .select("recipient_name, opened_at")
      .not("opened_at", "is", null)
      .gte("created_at", since.toISOString())
      .order("opened_at", { ascending: false })
      .limit(20),
    // 설문별 상세 (응답수 포함)
    supabase
      .from("edu_surveys")
      .select(`
        id, title, status, created_at,
        sessions ( id, name,
          courses ( name,
            projects ( name, customers ( company_name ) )
          )
        )
      `)
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false }),
    // 설문별 응답 수 집계 (서버측 GROUP BY)
    supabase.rpc("edu_submission_counts_by_survey"),
  ]);

  return aggregateDashboard({
    now,
    activeSurveys: activeSurveysRes.data as ActiveSurvey[] | null,
    totalSubmissions: totalSubmissionsRes.count,
    recentSubmissions: recentSubmissionsRes.data as RecentSubmission[] | null,
    prevWeekSubmissions: prevWeekSubmissionsRes.data as RecentSubmission[] | null,
    distAggregates: (distAggregatesRes.data ??
      []) as unknown as DistAggregateRow[],
    recentOpenings: recentOpeningsRes.data as RecentOpening[] | null,
    surveyDetails: surveyDetailsRes.data as unknown as SurveyDetail[] | null,
    submissionCounts: (submissionCountsRes.data ??
      []) as unknown as SubmissionCountRow[],
  });
}

// ─── 페이지 렌더 ───

export default async function DashboardPage() {
  const profile = await getUserProfile();
  const data = await getDashboardData();

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">대시보드</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            교육 설문 운영 현황
            <span className="ml-2 text-xs text-stone-400">(배포·응답 지표는 최근 60일 기준)</span>
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
        </div>
      </div>

      {/* ── 핵심 지표 카드 4개 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* 진행중 설문 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500">진행중 설문</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <ClipboardList size={14} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-800">{data.stats.activeSurveyCount}<span className="text-sm font-normal text-stone-400 ml-1">개</span></p>
        </div>

        {/* 응답률 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500">응답률</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <BarChart3 size={14} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-stone-800">{data.stats.responseRate}<span className="text-sm font-normal text-stone-400 ml-0.5">%</span></p>
            <span className="text-[11px] text-stone-400">{data.stats.respondedCount}/{data.stats.totalDistributed}</span>
          </div>
          {/* 미니 프로그레스바 */}
          <div className="mt-2 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.stats.responseRate >= 50 ? 'bg-emerald-500' : data.stats.responseRate >= 20 ? 'bg-amber-500' : 'bg-rose-400'}`}
              style={{ width: `${Math.min(data.stats.responseRate, 100)}%` }}
            />
          </div>
        </div>

        {/* 미응답 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500">미열람</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${data.stats.pendingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-stone-50 text-stone-400'}`}>
              <MailOpen size={14} />
            </div>
          </div>
          <p className="text-2xl font-bold text-stone-800">{data.stats.pendingCount}<span className="text-sm font-normal text-stone-400 ml-1">건</span></p>
          {data.stats.pendingCount > 0 && data.stats.totalDistributed > 0 && (
            <p className="text-[11px] text-amber-600 mt-0.5">
              전체 배포의 {Math.round((data.stats.pendingCount / data.stats.totalDistributed) * 100)}%
            </p>
          )}
        </div>

        {/* 이번 주 응답 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-stone-500">이번 주 응답</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-stone-800">{data.stats.thisWeekCount}<span className="text-sm font-normal text-stone-400 ml-1">건</span></p>
            {data.stats.weekDiff !== 0 && (
              <span className={`text-xs font-medium ${data.stats.weekDiff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {data.stats.weekDiff > 0 ? '+' : ''}{data.stats.weekDiff} 전주비
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 응답 퍼널 ── */}
      {data.funnel.distributed > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5 mb-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-stone-700">응답 퍼널</h3>
            <span className="text-[11px] text-stone-400">최근 60일 기준</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 배포 */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-stone-500">배포</span>
                <span className="text-sm font-bold text-stone-800">{data.funnel.distributed}</span>
              </div>
              <div className="h-8 bg-stone-200 rounded-lg" />
            </div>
            <ArrowRight size={16} className="text-stone-300 flex-shrink-0" />
            {/* 열람 */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-stone-500">열람</span>
                <span className="text-sm font-bold text-stone-800">{data.funnel.opened}</span>
              </div>
              <div className="h-8 bg-stone-100 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-lg"
                  style={{ width: `${data.funnel.distributed > 0 ? Math.max((data.funnel.opened / data.funnel.distributed) * 100, 2) : 0}%` }}
                />
              </div>
            </div>
            <ArrowRight size={16} className="text-stone-300 flex-shrink-0" />
            {/* 응답 완료 */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-stone-500">응답 완료</span>
                <span className="text-sm font-bold text-stone-800">{data.funnel.responded}</span>
              </div>
              <div className="h-8 bg-stone-100 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-lg"
                  style={{ width: `${data.funnel.distributed > 0 ? Math.max((data.funnel.responded / data.funnel.distributed) * 100, 2) : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-stone-400">
            <span>100%</span>
            <span>{data.funnel.distributed > 0 ? Math.round((data.funnel.opened / data.funnel.distributed) * 100) : 0}%</span>
            <span>{data.funnel.distributed > 0 ? Math.round((data.funnel.responded / data.funnel.distributed) * 100) : 0}%</span>
          </div>
        </div>
      )}

      {/* ── 주의 필요 항목 ── */}
      {data.alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm p-5 mb-6">
          <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={15} className="text-amber-500" />
            주의가 필요한 항목
          </h3>
          <div className="space-y-2">
            {data.alerts.map((alert, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className={`mt-1 flex-shrink-0 h-2 w-2 rounded-full ${
                  alert.level === 'red' ? 'bg-rose-500' : alert.level === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/surveys/${alert.surveyId}`} className="text-sm font-medium text-stone-800 hover:text-teal-600 transition-colors">
                    {alert.title}
                  </Link>
                  <p className="text-xs text-stone-500 mt-0.5">{alert.detail}</p>
                </div>
                <Link
                  href={`/admin/surveys/${alert.surveyId}`}
                  className="text-stone-400 hover:text-teal-600 transition-colors flex-shrink-0 p-1"
                >
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 하단 2열: 설문별 현황 + 사이드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 설문별 응답 현황 */}
        <div className="lg:col-span-2 rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between p-5 pb-0">
            <div>
              <h3 className="text-sm font-semibold text-stone-800">설문별 응답 현황</h3>
              <p className="text-xs text-stone-400 mt-0.5">진행중인 설문의 배포 및 응답 현황</p>
            </div>
            <Link href="/admin/surveys" className="text-xs font-medium text-teal-600 hover:text-teal-700">
              전체 보기
            </Link>
          </div>
          <div className="p-5 pt-3">
            {data.surveyRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-stone-400">
                진행중인 설문이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 text-xs font-medium text-stone-400 pr-4">설문</th>
                      <th className="text-center py-2 text-xs font-medium text-stone-400 w-16">배포</th>
                      <th className="text-center py-2 text-xs font-medium text-stone-400 w-16">열람</th>
                      <th className="text-center py-2 text-xs font-medium text-stone-400 w-16">응답</th>
                      <th className="text-center py-2 text-xs font-medium text-stone-400 w-20">응답률</th>
                      <th className="text-right py-2 text-xs font-medium text-stone-400 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.surveyRows.map((row) => (
                      <tr key={row.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                        <td className="py-2.5 pr-4">
                          <Link href={`/admin/surveys/${row.id}`} className="text-sm font-medium text-stone-700 hover:text-teal-600 transition-colors line-clamp-1">
                            {row.title}
                          </Link>
                          {row.customerName && (
                            <p className="text-[11px] text-stone-400 mt-0.5">{row.customerName}</p>
                          )}
                        </td>
                        <td className="text-center py-2.5 text-sm text-stone-600 tabular-nums">{row.distributed || '-'}</td>
                        <td className="text-center py-2.5 text-sm text-stone-600 tabular-nums">{row.opened || '-'}</td>
                        <td className="text-center py-2.5 text-sm font-medium text-stone-800 tabular-nums">{row.responses || '-'}</td>
                        <td className="text-center py-2.5">
                          {row.responseRate !== null ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              row.responseRate >= 50 ? 'bg-emerald-100 text-emerald-700'
                              : row.responseRate >= 20 ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                            }`}>
                              {row.responseRate}%
                            </span>
                          ) : (
                            <span className="text-xs text-stone-300">-</span>
                          )}
                        </td>
                        <td className="text-right py-2.5">
                          <div className="flex items-center justify-end gap-0.5">
                            <Link href={`/admin/surveys/${row.id}`} className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="보기">
                              <Eye size={13} />
                            </Link>
                            <Link href="/admin/distribute" className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="배포">
                              <Send size={13} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 사이드: 고객사별 + 최근 활동 */}
        <div className="space-y-4">
          {/* 고객사별 현황 */}
          {data.customerRows.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="p-5 pb-0">
                <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
                  <Users size={14} className="text-stone-500" />
                  고객사별 현황
                </h3>
              </div>
              <div className="p-5 pt-3">
                <div className="space-y-0">
                  {data.customerRows.map((c, idx) => (
                    <div key={c.name} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-stone-300 w-4 flex-shrink-0">{idx + 1}</span>
                        <span className="text-sm text-stone-700 truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-stone-400">{c.surveys}개 설문</span>
                        <span className="text-sm font-medium text-stone-800 tabular-nums w-10 text-right">{c.responses}건</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 최근 활동 */}
          {data.recentActivity.length > 0 && (
            <RecentActivity items={data.recentActivity} />
          )}

          {/* 바로가기 */}
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-3">바로가기</h3>
            <div className="space-y-1.5">
              <Link href="/admin/distribute" className="flex items-center gap-2 text-sm text-stone-600 hover:text-teal-600 transition-colors py-1.5">
                <Send size={14} /> 배부 관리
                <ArrowUpRight size={12} className="ml-auto text-stone-300" />
              </Link>
              <Link href="/admin/responses" className="flex items-center gap-2 text-sm text-stone-600 hover:text-teal-600 transition-colors py-1.5">
                <FileBarChart size={14} /> 응답 확인
                <ArrowUpRight size={12} className="ml-auto text-stone-300" />
              </Link>
              <Link href="/admin/projects" className="flex items-center gap-2 text-sm text-stone-600 hover:text-teal-600 transition-colors py-1.5">
                <FolderOpen size={14} /> 프로젝트 관리
                <ArrowUpRight size={12} className="ml-auto text-stone-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
