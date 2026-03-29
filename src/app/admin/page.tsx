import { createClient } from "@/lib/supabase/server";
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
  Clock,
  MailOpen,
  MousePointerClick,
  Users,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { getUserProfile } from "@/lib/auth";

export const revalidate = 30;

// ─── 데이터 조회 ───

async function getDashboardData() {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    { data: activeSurveys },
    { count: totalSubmissions },
    { data: recentSubmissions },
    { data: prevWeekSubmissions },
    { data: distributions },
    { data: surveyDetails },
    { data: submissionCounts },
  ] = await Promise.all([
    // 진행중 설문
    supabase
      .from("edu_surveys")
      .select("id, title, status, created_at")
      .eq("status", "active"),
    // 총 응답 수
    supabase
      .from("edu_submissions")
      .select("*", { count: "exact", head: true }),
    // 이번 주 응답
    supabase
      .from("edu_submissions")
      .select("id, survey_id, submitted_at")
      .gte("submitted_at", weekAgo.toISOString()),
    // 지난주 응답 (비교용)
    supabase
      .from("edu_submissions")
      .select("id")
      .gte("submitted_at", twoWeeksAgo.toISOString())
      .lt("submitted_at", weekAgo.toISOString()),
    // 전체 배포 현황
    supabase
      .from("distributions")
      .select("id, survey_id, status, recipient_name, recipient_email, opened_at, created_at, batch_id"),
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
    // 설문별 응답 수 집계
    supabase
      .from("edu_submissions")
      .select("survey_id"),
  ]);

  const submissionBySurvey: Record<string, number> = {};
  (submissionCounts ?? []).forEach((s: any) => {
    submissionBySurvey[s.survey_id] = (submissionBySurvey[s.survey_id] || 0) + 1;
  });

  // 배포 집계
  const distList = distributions ?? [];
  const totalDistributed = distList.length;
  const distBySurvey: Record<string, { total: number; pending: number; opened: number; started: number; completed: number }> = {};
  distList.forEach((d: any) => {
    if (!distBySurvey[d.survey_id]) {
      distBySurvey[d.survey_id] = { total: 0, pending: 0, opened: 0, started: 0, completed: 0 };
    }
    distBySurvey[d.survey_id].total++;
    distBySurvey[d.survey_id][d.status as keyof typeof distBySurvey[string]]++;
  });

  const pendingCount = distList.filter((d: any) => d.status === "pending").length;
  const openedCount = distList.filter((d: any) => d.status === "opened").length;
  const startedCount = distList.filter((d: any) => d.status === "started").length;
  const completedCount = distList.filter((d: any) => d.status === "completed").length;
  const respondedCount = openedCount + startedCount + completedCount;
  const responseRate = totalDistributed > 0 ? Math.round((respondedCount / totalDistributed) * 100) : 0;

  // 이번 주 / 지난주 비교
  const thisWeekCount = (recentSubmissions ?? []).length;
  const prevWeekCount = (prevWeekSubmissions ?? []).length;
  const weekDiff = thisWeekCount - prevWeekCount;

  // 주의 필요 항목 (배포했는데 응답 없는 설문)
  const alerts: { level: "red" | "yellow" | "green"; title: string; detail: string; surveyId: string }[] = [];

  (surveyDetails ?? []).forEach((s: any) => {
    const dist = distBySurvey[s.id];
    const responses = submissionBySurvey[s.id] || 0;
    const session = s.sessions as any;
    const customerName = session?.courses?.projects?.customers?.company_name;
    const label = customerName ? `${customerName} — ${s.title}` : s.title;

    if (s.status === "active" && dist && dist.total > 0 && responses === 0) {
      const daysSince = Math.floor((now.getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        level: "red",
        title: label,
        detail: `${dist.total}건 배포, 0건 응답 (${daysSince}일 경과)`,
        surveyId: s.id,
      });
    } else if (s.status === "draft" && dist && dist.total > 0) {
      alerts.push({
        level: "yellow",
        title: label,
        detail: `draft 상태 — ${dist.total}건 배포됨 (설문 활성화 필요)`,
        surveyId: s.id,
      });
    } else if (s.status === "active" && dist && dist.total > 0 && dist.pending > dist.total * 0.8) {
      alerts.push({
        level: "yellow",
        title: label,
        detail: `${dist.total}건 배포 중 ${dist.pending}건 미열람 (${Math.round((dist.pending / dist.total) * 100)}%)`,
        surveyId: s.id,
      });
    }
  });

  // 설문별 현황 테이블 (active 설문)
  const surveyRows = (activeSurveys ?? []).map((s: any) => {
    const dist = distBySurvey[s.id] || { total: 0, pending: 0, opened: 0, started: 0, completed: 0 };
    const responses = submissionBySurvey[s.id] || 0;
    const detail = (surveyDetails ?? []).find((d: any) => d.id === s.id);
    const detailSession = detail?.sessions as any;
    const customerName = detailSession?.courses?.projects?.customers?.company_name;
    return {
      id: s.id,
      title: s.title,
      customerName: customerName || null,
      distributed: dist.total,
      opened: dist.opened + dist.started + dist.completed,
      responses,
      responseRate: dist.total > 0 ? Math.round((responses / dist.total) * 100) : null,
      createdAt: s.created_at,
    };
  });

  // 고객사별 현황
  const customerMap: Record<string, { surveys: number; responses: number }> = {};
  (surveyDetails ?? []).forEach((s: any) => {
    const sess = s.sessions as any;
    const customerName = sess?.courses?.projects?.customers?.company_name;
    if (!customerName) return;
    if (!customerMap[customerName]) customerMap[customerName] = { surveys: 0, responses: 0 };
    customerMap[customerName].surveys++;
    customerMap[customerName].responses += (submissionBySurvey[s.id] || 0);
  });
  const customerRows = Object.entries(customerMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.responses - a.responses)
    .slice(0, 8);

  // 최근 활동 (열람/응답 이벤트)
  const recentActivity: { time: string; text: string }[] = [];
  const recentOpened = distList
    .filter((d: any) => d.opened_at)
    .sort((a: any, b: any) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
    .slice(0, 3);
  recentOpened.forEach((d: any) => {
    recentActivity.push({
      time: formatRelativeTime(d.opened_at),
      text: `${d.recipient_name || '익명'} 열람`,
    });
  });
  const recentResponses = (recentSubmissions ?? [])
    .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .slice(0, 3);
  recentResponses.forEach((s: any) => {
    recentActivity.push({
      time: formatRelativeTime(s.submitted_at),
      text: '새 응답 제출',
    });
  });
  recentActivity.sort((a, b) => 0); // keep interleaved order

  return {
    stats: {
      activeSurveyCount: (activeSurveys ?? []).length,
      responseRate,
      pendingCount,
      thisWeekCount,
      weekDiff,
      totalDistributed,
      respondedCount,
      totalSubmissions: totalSubmissions ?? 0,
    },
    funnel: {
      distributed: totalDistributed,
      opened: openedCount + startedCount + completedCount,
      responded: totalSubmissions ?? 0,
    },
    alerts,
    surveyRows,
    customerRows,
    recentActivity: recentActivity.slice(0, 5),
  };
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
          <p className="text-sm text-stone-500 mt-0.5">교육 설문 운영 현황</p>
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
          <h3 className="text-sm font-semibold text-stone-700 mb-4">응답 퍼널</h3>
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
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="p-5 pb-0">
                <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
                  <Clock size={14} className="text-stone-500" />
                  최근 활동
                </h3>
              </div>
              <div className="p-5 pt-3">
                <div className="space-y-0">
                  {data.recentActivity.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                      <span className="text-[11px] text-stone-400 w-16 flex-shrink-0">{a.time}</span>
                      <span className="text-sm text-stone-600">{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
