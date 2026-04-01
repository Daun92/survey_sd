"use client";

import { getGradeBgColor, getGradeLabel } from "./score-bar-chart";

export interface QuestionDetail {
  code: string;
  text: string;
  section: string;
  avg5: number;    // 5점 기준 평균
  avg100: number;  // 100점 환산
  count: number;
}

export interface SectionGroup {
  section: string;
  avg100: number;
  questions: QuestionDetail[];
}

function getScoreCellColor(score: number) {
  if (score >= 90) return "bg-teal-50 text-teal-700 font-semibold";
  if (score >= 80) return "text-stone-800";
  if (score >= 70) return "text-amber-700";
  return "bg-rose-50 text-rose-700 font-semibold";
}

export function SectionScoreTable({ data }: { data: SectionGroup[] }) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="p-5 border-b border-stone-100">
        <h3 className="text-sm font-semibold text-stone-800">섹션별 문항 상세 분석</h3>
        <p className="text-xs text-stone-400 mt-0.5">각 문항의 5점 척도 평균 및 100점 환산 점수</p>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50/80 border-b border-stone-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500 w-16">코드</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">문항 내용</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-stone-500 w-20">평균(5점)</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-stone-500 w-24">100점 환산</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-stone-500 w-16">응답</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-stone-500 w-20">등급</th>
            </tr>
          </thead>
          <tbody>
            {data.map((group) => (
              <>
                {/* 섹션 헤더 */}
                <tr key={`section-${group.section}`} className="bg-stone-50 border-b border-stone-100">
                  <td colSpan={3} className="px-4 py-2.5">
                    <span className="text-[13px] font-semibold text-stone-800">
                      {group.section}
                    </span>
                  </td>
                  <td className="text-center px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${getScoreCellColor(group.avg100)}`}>
                      {group.avg100.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center px-4 py-2.5 text-xs text-stone-400">
                    {group.questions[0]?.count ?? "-"}
                  </td>
                  <td className="text-center px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getGradeBgColor(group.avg100)}`}>
                      {getGradeLabel(group.avg100)}
                    </span>
                  </td>
                </tr>
                {/* 문항 행 */}
                {group.questions.map((q) => (
                  <tr key={q.code} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                    <td className="px-4 py-2.5 text-xs text-stone-400 font-mono">{q.code}</td>
                    <td className="px-4 py-2.5 text-stone-700 leading-snug">{q.text}</td>
                    <td className="text-center px-4 py-2.5 text-stone-600">{q.avg5.toFixed(2)}</td>
                    <td className={`text-center px-4 py-2.5 ${getScoreCellColor(q.avg100)}`}>
                      {q.avg100.toFixed(1)}
                    </td>
                    <td className="text-center px-4 py-2.5 text-stone-400">{q.count}</td>
                    <td className="text-center px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${getGradeBgColor(q.avg100)}`}>
                        {getGradeLabel(q.avg100)}
                      </span>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
