"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface ScoreBucket {
  range: string;
  count: number;
  color: string;
}

interface Props {
  data: ScoreBucket[];
}

export function ScoreDistribution({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
      <h3 className="text-sm font-semibold text-stone-800 mb-1">점수 분포</h3>
      <p className="text-[11px] text-stone-400 mb-4">응답자 만족도 점수 구간별 분포</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#78716c" }} />
          <YAxis type="category" dataKey="range" width={70} tick={{ fontSize: 11, fill: "#78716c" }} />
          <Tooltip
            formatter={(value) => [`${value}건`, "응답 수"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
