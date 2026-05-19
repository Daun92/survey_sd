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

export interface DailyCompletedPoint {
  day: string; // YYYY-MM-DD
  completed: number;
}

interface Props {
  data: DailyCompletedPoint[];
}

export function DailyCompletedLine({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-stone-400">
        데이터가 없습니다.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="dailyTealGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
        <XAxis
          dataKey="day"
          fontSize={11}
          tickLine={false}
          stroke="#a8a29e"
          tickFormatter={(val) => {
            const d = new Date(val);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
          minTickGap={20}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          stroke="#a8a29e"
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={(label) => {
            const d = new Date(String(label));
            return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
          }}
          formatter={(value: unknown) => [`${value}건`, "완료"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e7e5e4",
          }}
        />
        <Area
          type="monotone"
          dataKey="completed"
          stroke="#0d9488"
          strokeWidth={2}
          fill="url(#dailyTealGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
