"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface SectionScore {
  name: string;
  avg: number;
  count: number;
}

function getBarColor(score: number) {
  if (score >= 4.5) return "#0d9488"; // teal-600
  if (score >= 4.0) return "#059669"; // emerald-600
  if (score >= 3.5) return "#d97706"; // amber-600
  return "#e11d48"; // rose-600
}

function getGradeLabel(score: number) {
  if (score >= 4.5) return "매우우수";
  if (score >= 4.0) return "우수";
  if (score >= 3.5) return "양호";
  return "개선필요";
}

export function ScoreBarChart({ data }: { data: SectionScore[] }) {
  if (data.length === 0) return null;

  const overallAvg =
    data.reduce((sum, d) => sum + d.avg, 0) / data.length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-stone-800">섹션별 평균 점수</h3>
        <span className="text-xs text-stone-400">
          전체 평균: <span className="font-semibold text-stone-600">{overallAvg.toFixed(2)}</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
          <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} tickLine={false} stroke="#a8a29e" />
          <YAxis type="category" dataKey="name" width={100} fontSize={12} tickLine={false} axisLine={false} stroke="#78716c" />
          <Tooltip
            formatter={(value) => [
              `${Number(value).toFixed(2)} (${getGradeLabel(Number(value))})`,
              "평균",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }}
          />
          <ReferenceLine x={overallAvg} stroke="#a8a29e" strokeDasharray="4 4" label={{ value: "평균", position: "top", fontSize: 10, fill: "#a8a29e" }} />
          <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
