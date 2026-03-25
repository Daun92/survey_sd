"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface QuestionDistribution {
  code: string;
  text: string;
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
  total: number;
}

const LIKERT_COLORS = {
  "1": "#e11d48", // rose-600 매우불만족
  "2": "#f59e0b", // amber-500 불만족
  "3": "#a8a29e", // stone-400 보통
  "4": "#14b8a6", // teal-500 만족
  "5": "#0d9488", // teal-600 매우만족
};

const LIKERT_NAMES = {
  "1": "매우불만족",
  "2": "불만족",
  "3": "보통",
  "4": "만족",
  "5": "매우만족",
};

export function LikertDistribution({ data }: { data: QuestionDistribution[] }) {
  if (data.length === 0) return null;

  // 퍼센트로 변환
  const percentData = data.map((d) => ({
    code: d.code,
    text: d.text,
    "1": d.total > 0 ? Math.round((d["1"] / d.total) * 100) : 0,
    "2": d.total > 0 ? Math.round((d["2"] / d.total) * 100) : 0,
    "3": d.total > 0 ? Math.round((d["3"] / d.total) * 100) : 0,
    "4": d.total > 0 ? Math.round((d["4"] / d.total) * 100) : 0,
    "5": d.total > 0 ? Math.round((d["5"] / d.total) * 100) : 0,
  }));

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-semibold text-stone-800 mb-4">문항별 응답 분포</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40 + 40)}>
        <BarChart data={percentData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
          <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} tickLine={false} stroke="#a8a29e" />
          <YAxis type="category" dataKey="code" width={50} fontSize={11} tickLine={false} axisLine={false} stroke="#78716c" />
          <Tooltip
            formatter={(value, name) => [
              `${value}%`,
              LIKERT_NAMES[String(name) as keyof typeof LIKERT_NAMES] || name,
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }}
          />
          <Legend
            formatter={(value: string) => LIKERT_NAMES[value as keyof typeof LIKERT_NAMES] || value}
            wrapperStyle={{ fontSize: 11 }}
          />
          {(["1", "2", "3", "4", "5"] as const).map((key) => (
            <Bar key={key} dataKey={key} stackId="a" fill={LIKERT_COLORS[key]} barSize={20} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
