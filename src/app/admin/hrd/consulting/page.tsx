import { createClient } from "@/lib/supabase/server";
import { Building2, FileText } from "lucide-react";

export const revalidate = 60;

const statusLabels: Record<string, { label: string; className: string }> = {
  generated: {
    label: "생성완료",
    className: "bg-emerald-100 text-emerald-800",
  },
  reviewed: { label: "검토완료", className: "bg-blue-100 text-blue-800" },
  pending: {
    label: "대기중",
    className: "border border-stone-200 text-stone-700",
  },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getData() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("hrd_consulting_reports")
    .select(
      "id, respondent_id, round_id, status, generated_at, hrd_respondents(respondent_name, company_name)"
    )
    .order("generated_at", { ascending: false });

  return { reports: reports ?? [] };
}

export default async function ConsultingPage() {
  const { reports } = await getData();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">컨설팅 보고서</h1>
        <p className="text-sm text-stone-500 mt-1">
          기업별 HRD 컨설팅 보고서를 관리하세요
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <Building2
            size={40}
            className="mx-auto text-stone-300 mb-3"
            aria-hidden="true"
          />
          <p className="text-sm text-stone-500">
            생성된 컨설팅 보고서가 없습니다.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-100">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    회사명
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    응답자
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    상태
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    생성일
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const status =
                    statusLabels[report.status] ?? statusLabels.pending;
                  const respondent = report.hrd_respondents as unknown as {
                    respondent_name: string;
                    company_name: string;
                  } | null;
                  return (
                    <tr
                      key={report.id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                            <FileText size={14} aria-hidden="true" />
                          </div>
                          <span className="text-sm font-medium text-stone-800">
                            {respondent?.company_name ?? "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-stone-600">
                        {respondent?.respondent_name ?? "-"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-stone-500">
                        {formatDate(report.generated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
