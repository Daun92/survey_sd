"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface OrgTypeSlice {
  code: number | string;
  label: string;
  count: number;
}

const ORG_COLORS: Record<string, string> = {
  "1": "#0d9488", // 대기업 — teal-600
  "2": "#14b8a6", // 중기업 — teal-500
  "3": "#5eead4", // 소기업 — teal-300
  "4": "#6366f1", // 공공기관 — indigo-500
  "5": "#a78bfa", // 학교 — violet-400
};

const FALLBACK_COLORS = ["#a8a29e", "#78716c", "#57534e"];

interface Props {
  data: OrgTypeSlice[];
}

export function OrgTypeDonut({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-stone-400">
        데이터가 없습니다.
      </div>
    );
  }

  const chartData = data.map((d, idx) => ({
    name: d.label,
    value: d.count,
    fill:
      ORG_COLORS[String(d.code)] ??
      FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={1}
        >
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => {
            const v = Number(value) || 0;
            return [
              `${v}명 (${total > 0 ? Math.round((v / total) * 100) : 0}%)`,
              String(name),
            ];
          }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e7e5e4",
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: "#57534e" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
