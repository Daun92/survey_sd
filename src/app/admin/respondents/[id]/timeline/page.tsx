import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import {
  ChevronLeft,
  Send,
  MailOpen,
  PlayCircle,
  CheckCircle2,
  FileBarChart,
  Archive,
  User,
  Building2,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { notFound } from "next/navigation";

export const revalidate = 30;

type DistStatus = "pending" | "sent" | "opened" | "started" | "completed" | "failed";

type TimelineEvent =
  | {
      kind: "distribution";
      timestamp: string;
      status: DistStatus;
      batch_id: string | null;
      survey_id: string | null;
      survey_title: string | null;
      channel: string | null;
      recipient_email: string | null;
      recipient_phone: string | null;
      unique_token: string | null;
    }
  | {
      kind: "submission";
      timestamp: string;
      survey_id: string | null;
      survey_title: string | null;
      total_score: number | null;
      is_test: boolean;
    }
  | {
      kind: "history";
      timestamp: string;
      course_name: string | null;
      source: string;
      raw_company_name: string | null;
    };

async function getRespondent(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("respondents")
    .select(
      "id, name, email, phone, customer_id, customers:customer_id(company_name), created_at, last_cs_survey_sent_at"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function getTimeline(id: string): Promise<TimelineEvent[]> {
  // service_role 로 조회해 RLS 복잡도 우회 (관리자 페이지 한정)
  const admin = createAdminClient();

  const [{ data: dists }, { data: subs }, { data: hist }] = await Promise.all([
    admin
      .from("distributions")
      .select(
        `id, status, batch_id, survey_id, channel, recipient_email, recipient_phone, unique_token,
         created_at, sent_at, opened_at, started_at, completed_at,
         edu_surveys ( title )`
      )
      .eq("respondent_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("edu_submissions")
      .select(
        "survey_id, submitted_at, total_score, is_test, edu_surveys ( title )"
      )
      .eq("respondent_id", id)
      .order("submitted_at", { ascending: false }),
    admin
      .from("respondent_cs_history")
      .select("course_name, responded_month, source, raw_company_name")
      .eq("respondent_id", id)
      .order("responded_month", { ascending: false }),
  ]);

  const events: TimelineEvent[] = [];

  for (const d of dists ?? []) {
    // distribution 한 건에서도 상태 변화는 여러 시점에 찍히므로, 각 최종 타임스탬프 1건만 선택.
    // 우선순위: completed > started > opened > sent > created
    const ts =
      (d as { completed_at?: string | null }).completed_at ??
      (d as { started_at?: string | null }).started_at ??
      (d as { opened_at?: string | null }).opened_at ??
      (d as { sent_at?: string | null }).sent_at ??
      (d as { created_at?: string }).created_at;

    if (!ts) continue;

    events.push({
      kind: "distribution",
      timestamp: ts,
      status: (d.status as DistStatus) ?? "pending",
      batch_id: d.batch_id,
      survey_id: d.survey_id,
      survey_title:
        (d.edu_surveys as { title?: string } | null)?.title ?? null,
      channel: d.channel,
      recipient_email: d.recipient_email,
      recipient_phone: d.recipient_phone,
      unique_token: d.unique_token,
    });
  }

  for (const s of subs ?? []) {
    if (!s.submitted_at) continue;
    events.push({
      kind: "submission",
      timestamp: s.submitted_at,
      survey_id: s.survey_id,
      survey_title:
        (s.edu_surveys as { title?: string } | null)?.title ?? null,
      total_score: s.total_score,
      is_test: s.is_test ?? false,
    });
  }

  for (const h of hist ?? []) {
    if (!h.responded_month) continue;
    events.push({
      kind: "history",
      // responded_month 는 DATE 이므로 월초 자정 UTC 로 비교. 타임라인 내 정렬 목적.
      timestamp: h.responded_month,
      course_name: h.course_name,
      source: h.source,
      raw_company_name: h.raw_company_name,
    });
  }

  events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return events;
}

const DIST_STATUS_META: Record<
  "pending" | "sent" | "opened" | "started" | "completed" | "failed",
  { label: string; icon: typeof Send; className: string }
> = {
  pending: {
    label: "발송 대기",
    icon: Send,
    className: "text-stone-500 bg-stone-50",
  },
  sent: { label: "발송", icon: Send, className: "text-blue-600 bg-blue-50" },
  opened: {
    label: "열람",
    icon: MailOpen,
    className: "text-amber-600 bg-amber-50",
  },
  started: {
    label: "응답 시작",
    icon: PlayCircle,
    className: "text-teal-600 bg-teal-50",
  },
  completed: {
    label: "응답 완료",
    icon: CheckCircle2,
    className: "text-emerald-600 bg-emerald-50",
  },
  failed: {
    label: "실패",
    icon: Send,
    className: "text-rose-600 bg-rose-50",
  },
};

export default async function RespondentTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const respondent = await getRespondent(id);
  if (!respondent) notFound();

  const events = await getTimeline(id);
  const customer = respondent.customers as { company_name?: string } | null;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/respondents"
          className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 mb-3"
        >
          <ChevronLeft size={16} />
          주소록으로 돌아가기
        </Link>

        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600 shrink-0">
              <User size={20} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-stone-800">
                {respondent.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
                {customer?.company_name && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={13} className="text-stone-400" />
                    {customer.company_name}
                  </span>
                )}
                {respondent.email && <span>{respondent.email}</span>}
                {respondent.phone && <span>{respondent.phone}</span>}
              </div>
              <p className="mt-1 text-xs text-stone-400">
                등록: {formatDate(respondent.created_at)}
                {respondent.last_cs_survey_sent_at && (
                  <span className="ml-3">
                    최근 CS 발송: {formatDate(respondent.last_cs_survey_sent_at)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              발송·응답 타임라인
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              배포 이력 · 제출 이력 · 과거 응답이력 (CSV 임포트) 을 통합 시간순
            </p>
          </div>
          <span className="text-xs text-stone-400">{events.length}건</span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">
            이 대상자의 기록이 없습니다.
          </div>
        ) : (
          <ol className="divide-y divide-stone-100">
            {events.map((event, i) => (
              <li key={i} className="p-4 flex items-start gap-3">
                <TimelineIcon event={event} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TimelineBadge event={event} />
                    <p className="text-xs text-stone-400">
                      {formatDateTime(event.timestamp)}
                    </p>
                  </div>
                  <TimelineDetail event={event} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function TimelineIcon({ event }: { event: TimelineEvent }) {
  if (event.kind === "distribution") {
    const meta = DIST_STATUS_META[event.status];
    const Icon = meta.icon;
    return (
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${meta.className}`}
      >
        <Icon size={14} aria-hidden="true" />
      </div>
    );
  }
  if (event.kind === "submission") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shrink-0">
        <FileBarChart size={14} aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 shrink-0">
      <Archive size={14} aria-hidden="true" />
    </div>
  );
}

function TimelineBadge({ event }: { event: TimelineEvent }) {
  if (event.kind === "distribution") {
    const meta = DIST_STATUS_META[event.status];
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
      >
        {meta.label}
      </span>
    );
  }
  if (event.kind === "submission") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-medium">
        응답 제출
        {event.is_test && <span className="ml-1 text-[10px]">(테스트)</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-600 px-2 py-0.5 text-[11px] font-medium">
      과거 이력
      <span className="ml-1 text-[10px] text-stone-400">({event.source})</span>
    </span>
  );
}

function TimelineDetail({ event }: { event: TimelineEvent }) {
  if (event.kind === "distribution") {
    return (
      <p className="mt-1 text-sm text-stone-700">
        {event.survey_title ?? "(설문 정보 없음)"}
        {event.channel && (
          <span className="ml-2 text-xs text-stone-400">· {event.channel}</span>
        )}
        {event.recipient_email && (
          <span className="ml-2 text-xs text-stone-400">
            ✉ {event.recipient_email}
          </span>
        )}
        {event.recipient_phone && !event.recipient_email && (
          <span className="ml-2 text-xs text-stone-400">
            ☎ {event.recipient_phone}
          </span>
        )}
      </p>
    );
  }
  if (event.kind === "submission") {
    return (
      <p className="mt-1 text-sm text-stone-700">
        {event.survey_title ?? "(설문 정보 없음)"}
        {event.total_score !== null && (
          <span className="ml-2 text-xs text-stone-400">
            점수 {event.total_score}
          </span>
        )}
      </p>
    );
  }
  return (
    <p className="mt-1 text-sm text-stone-700">
      {event.course_name ?? "(과정명 없음)"}
      {event.raw_company_name && (
        <span className="ml-2 text-xs text-stone-400">
          · {event.raw_company_name}
        </span>
      )}
    </p>
  );
}
