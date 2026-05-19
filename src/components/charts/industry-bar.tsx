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

export interface IndustrySlice {
  code: string | number;
  label: string;
  count: number;
}

interface Props {
  data: IndustrySlice[];
  /** 상위 N 개만 표시. 나머지는 "기타"로 묶음. 기본 10. */
  topN?: number;
}

export function IndustryBar({ data, topN = 10 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-stone-400">
        데이터가 없습니다.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, topN);
  const restSum = sorted.slice(topN).reduce((s, d) => s + d.count, 0);
  const chartData = restSum > 0
    ? [...top, { label: "기타", count: restSum }]
    : top;

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 26 + 40)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#78716c" }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 11, fill: "#57534e" }}
          interval={0}
        />
        <Tooltip
          formatter={(value) => [`${value}명`, "응답자"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e7e5e4",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {chartData.map((entry, idx) => (
            <Cell
              key={idx}
              fill={entry.label === "기타" ? "#a8a29e" : "#0d9488"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
