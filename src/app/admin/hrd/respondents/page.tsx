import { supabase } from "@/lib/supabase";
import { Users } from "lucide-react";
import { RespondentActions } from "./respondent-actions";

export const revalidate = 60;

const statusLabels: Record<string, { label: string; className: string }> = {
  completed: { label: "완료", className: "bg-emerald-100 text-emerald-800" },
  invited: { label: "초대됨", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "진행중", className: "bg-amber-100 text-amber-800" },
  verified: { label: "검증됨", className: "bg-violet-100 text-violet-800" },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getData() {
  const [{ data: respondents }, { data: rounds }] = await Promise.all([
    supabase
      .from("hrd_respondents")
      .select(
        "id, round_id, respondent_name, respondent_position, respondent_email, company_name, org_type, status, completed_at, url_token"
      )
      .order("company_name", { ascending: true }),
    supabase
      .from("hrd_survey_rounds")
      .select("id, title, round_number")
      .order("created_at", { ascending: false }),
  ]);

  return { respondents: respondents ?? [], rounds: rounds ?? [] };
}

export default async function RespondentsPage() {
  const { respondents, rounds } = await getData();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">응답자 관리</h1>
          <p className="text-sm text-stone-500 mt-1">
            실태조사 응답자를 관리하세요
          </p>
        </div>
        <RespondentActions
          rounds={rounds}
          mode="header"
        />
      </div>

      {respondents.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <Users
            size={40}
            className="mx-auto text-stone-300 mb-3"
            aria-hidden="true"
          />
          <p className="text-sm text-stone-500">
            등록된 응답자가 없습니다.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50/80 border-b border-stone-100">
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    이름
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    직위
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    회사명
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    조직유형
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    상태
                  </th>
                  <th className="px-5 py-2.5 text-left text-xs font-medium text-stone-500">
                    완료일
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-stone-500">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {respondents.map((r) => {
                  const status =
                    statusLabels[r.status] ?? statusLabels.invited;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50"
                    >
                      <td className="px-5 py-3 text-sm font-medium text-stone-800">
                        {r.respondent_name || "-"}
                      </td>
                      <td className="px-5 py-3 text-sm text-stone-600">
                        {r.respondent_position ?? "-"}
                      </td>
                      <td className="px-5 py-3 text-sm text-stone-600">
                        {r.company_name}
                      </td>
                      <td className="px-5 py-3 text-sm text-stone-600">
                        {r.org_type ?? "-"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-stone-500">
                        {formatDate(r.completed_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <RespondentActions
                          respondentId={r.id}
                          urlToken={r.url_token}
                          mode="row"
                        />
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
