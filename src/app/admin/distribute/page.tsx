import { supabase } from "@/lib/supabase";
import {
  QrCode,
  Link2,
  Copy,
  ExternalLink,
  Inbox,
  CheckCircle2,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getActiveSurveys() {
  const { data: surveys } = await supabase
    .from("edu_surveys")
    .select("id, title, status, url_token, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return surveys ?? [];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function getSurveyUrl(urlToken: string) {
  return `/survey/${urlToken}`;
}

export default async function DistributePage() {
  const surveys = await getActiveSurveys();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">QR 배포</h1>
        <p className="text-sm text-stone-500 mt-1">
          설문 링크를 QR 코드로 배포하세요
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
            활성 설문이 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            QR 코드를 배포하려면 먼저 설문을 활성화해 주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {surveys.map((survey) => {
            const surveyUrl = getSurveyUrl(survey.url_token);
            return (
              <div
                key={survey.id}
                className="rounded-xl border border-stone-200 bg-white shadow-sm"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-5">
                  {/* Survey info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-stone-800 truncate">
                        {survey.title}
                      </h3>
                      <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        <CheckCircle2 size={12} />
                        활성
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mb-3">
                      생성일: {formatDate(survey.created_at)}
                    </p>

                    <div className="flex items-center gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
                      <Link2 size={14} className="text-stone-400 shrink-0" />
                      <span className="text-sm text-stone-600 truncate font-mono">
                        {surveyUrl}
                      </span>
                      <button
                        type="button"
                        className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                        title="URL 복사"
                      >
                        <Copy size={12} />
                        복사
                      </button>
                      <a
                        href={surveyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                        title="새 탭에서 열기"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {/* QR Code placeholder */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="flex items-center justify-center w-32 h-32 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50">
                      <div className="text-center">
                        <QrCode
                          size={32}
                          className="text-stone-300 mx-auto mb-1"
                        />
                        <span className="text-xs text-stone-400">QR Code</span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-400 mt-2">
                      {survey.url_token}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
