"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface DailyResponse {
  date: string; // YYYY-MM-DD
  count: number;
}

export function ResponseTrend({ data }: { data: DailyResponse[] }) {
  if (data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-stone-800">일별 응답 추이</h3>
        <span className="text-xs text-stone-400">
          총 <span className="font-semibold text-stone-600">{total}</span>건
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis
            dataKey="date"
            fontSize={11}
            tickLine={false}
            stroke="#a8a29e"
            tickFormatter={(val) => {
              const d = new Date(val);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
          />
          <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="#a8a29e" allowDecimals={false} />
          <Tooltip
            labelFormatter={(label) => {
              const d = new Date(String(label));
              return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
            }}
            formatter={(value: unknown) => [`${value}건`, "응답 수"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e7e5e4" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#0d9488"
            strokeWidth={2}
            fill="url(#tealGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
