"use client";

export interface MatrixQuestion {
  id: string;
  code: string;
  text: string;
}

export interface MatrixRow {
  name: string;
  department: string;
  channel: string;
  answers: Record<string, number | string>;
  totalScore100: number;
}

interface Props {
  questions: MatrixQuestion[];
  rows: MatrixRow[];
}

function scoreCellClass(score: number): string {
  if (score >= 5) return "bg-teal-100 text-teal-800";
  if (score >= 4) return "bg-emerald-50 text-emerald-800";
  if (score >= 3) return "bg-amber-50 text-amber-800";
  if (score >= 2) return "bg-orange-50 text-orange-800";
  return "bg-rose-100 text-rose-800";
}

function gradeLabel(score: number): { text: string; className: string } {
  if (score >= 90) return { text: "매우우수", className: "bg-teal-100 text-teal-800" };
  if (score >= 80) return { text: "우수", className: "bg-emerald-100 text-emerald-800" };
  if (score >= 70) return { text: "양호", className: "bg-amber-100 text-amber-800" };
  return { text: "개선필요", className: "bg-rose-100 text-rose-800" };
}

export function RespondentMatrix({ questions, rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="p-5 border-b border-stone-100">
        <h3 className="text-sm font-semibold text-stone-800">응답자별 상세 매트릭스</h3>
        <p className="text-[11px] text-stone-400 mt-0.5">고객사별 문항 점수 (5점 척도)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="sticky left-0 z-10 bg-stone-50 px-3 py-2 text-left font-medium text-stone-500 min-w-[40px]">#</th>
              <th className="sticky left-[40px] z-10 bg-stone-50 px-3 py-2 text-left font-medium text-stone-500 min-w-[140px]">응답자</th>
              <th className="sticky left-[180px] z-10 bg-stone-50 px-3 py-2 text-left font-medium text-stone-500 min-w-[160px]">소속</th>
              {questions.map((q) => (
                <th key={q.id} className="px-2 py-2 text-center font-medium text-stone-500 min-w-[36px]" title={q.text}>
                  {q.code}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-stone-600 min-w-[50px]">점수</th>
              <th className="px-3 py-2 text-center font-medium text-stone-500 min-w-[56px]">등급</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const grade = gradeLabel(row.totalScore100);
              return (
                <tr key={idx} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-stone-400">{idx + 1}</td>
                  <td className="sticky left-[40px] z-10 bg-white px-3 py-1.5 font-medium text-stone-800">
                    {row.name}
                    {row.channel === "interview" && (
                      <span className="ml-1 text-[9px] text-violet-600 bg-violet-50 px-1 py-0.5 rounded">인터뷰</span>
                    )}
                  </td>
                  <td className="sticky left-[180px] z-10 bg-white px-3 py-1.5 text-stone-500">{row.department}</td>
                  {questions.map((q) => {
                    const val = row.answers[q.id];
                    const num = typeof val === "number" ? val : Number(val);
                    if (isNaN(num) || num < 1 || num > 5) {
                      return <td key={q.id} className="px-2 py-1.5 text-center text-stone-300">-</td>;
                    }
                    return (
                      <td key={q.id} className={`px-2 py-1.5 text-center font-medium ${scoreCellClass(num)}`}>
                        {num}
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-center font-bold text-stone-800">{row.totalScore100}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${grade.className}`}>
                      {grade.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
