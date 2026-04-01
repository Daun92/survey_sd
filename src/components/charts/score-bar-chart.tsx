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
  avg: number; // 100점 기준
  count: number;
}

const TARGET_SCORE = 90;

function getBarColor(score: number) {
  if (score >= 90) return "#0d9488"; // teal-600 매우우수
  if (score >= 80) return "#059669"; // emerald-600 우수
  if (score >= 70) return "#d97706"; // amber-600 양호
  return "#e11d48"; // rose-600 개선필요
}

export function getGradeLabel(score: number) {
  if (score >= 90) return "매우우수";
  if (score >= 80) return "우수";
  if (score >= 70) return "양호";
  return "개선필요";
}

export function getGradeColor(score: number) {
  if (score >= 90) return "text-teal-600";
  if (score >= 80) return "text-emerald-600";
  if (score >= 70) return "text-amber-600";
  return "text-rose-600";
}

export function getGradeBgColor(score: number) {
  if (score >= 90) return "bg-teal-50 text-teal-700";
  if (score >= 80) return "bg-emerald-50 text-emerald-700";
  if (score >= 70) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

export function ScoreBarChart({ data }: { data: SectionScore[] }) {
  if (data.length === 0) return null;

  const overallAvg =
    data.reduce((sum, d) => sum + d.avg, 0) / data.length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-stone-800">섹션별 만족도 (100점 기준)</h3>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span>
            전체 평균: <span className="font-semibold text-stone-600">{overallAvg.toFixed(1)}점</span>
          </span>
          <span>
            목표: <span className="font-semibold text-stone-600">{TARGET_SCORE}점</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} fontSize={11} tickLine={false} stroke="#a8a29e" />
          <YAxis type="category" dataKey="name" width={100} fontSize={12} tickLine={false} axisLine={false} stroke="#78716c" />
          <Tooltip
            formatter={(value) => [
              `${Number(value).toFixed(1)}점 (${getGradeLabel(Number(value))})`,
              "만족도",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }}
          />
          <ReferenceLine x={TARGET_SCORE} stroke="#e11d48" strokeDasharray="4 4" label={{ value: "목표", position: "top", fontSize: 10, fill: "#e11d48" }} />
          <ReferenceLine x={overallAvg} stroke="#a8a29e" strokeDasharray="4 4" label={{ value: "평균", position: "top", fontSize: 10, fill: "#a8a29e" }} />
          <Bar dataKey="avg" radius={[0, 4, 4, 0]} barSize={24} label={{ position: "right", fontSize: 11, fill: "#57534e", formatter: (v: unknown) => Number(v).toFixed(1) }}>
            {data.map((entry, index) => (
              <Cell key={index} fill={getBarColor(entry.avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
