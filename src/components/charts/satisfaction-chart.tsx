"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

interface CategoryStat {
  category: string;
  average: number;
  questionCount?: number;
}

interface QuestionStat {
  questionId: number;
  questionText: string;
  category: string | null;
  average: number;
  count: number;
  distribution: Record<number, number>;
}

// 카테고리별 만족도 바 차트
export function CategoryBarChart({ data }: { data: CategoryStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
        <XAxis type="number" domain={[0, 5]} tickCount={6} fontSize={12} />
        <YAxis type="category" dataKey="category" fontSize={12} width={75} />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(2)}점`, "평균"]}
          contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 13 }}
          labelStyle={{ color: "#a1a1aa" }}
        />
        <Bar dataKey="average" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 카테고리별 레이더 차트
export function CategoryRadarChart({ data }: { data: CategoryStat[] }) {
  if (data.length < 3) return null;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="category" fontSize={11} />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} fontSize={10} />
        <Radar
          dataKey="average"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.2}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(2)}점`, "평균"]}
          contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 13 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// 문항별 평균 바 차트
export function QuestionBarChart({ data }: { data: QuestionStat[] }) {
  const chartData = data.map((q, i) => ({
    name: `Q${i + 1}`,
    average: q.average,
    fullText: q.questionText,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
        <XAxis type="number" domain={[0, 5]} tickCount={6} fontSize={12} />
        <YAxis type="category" dataKey="name" fontSize={12} width={35} />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(2)}점`, "평균"]}
          labelFormatter={(label) => {
            const item = chartData.find((d) => d.name === String(label));
            return item?.fullText || String(label);
          }}
          contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 12, maxWidth: 300 }}
          wrapperStyle={{ maxWidth: 350 }}
        />
        <Bar dataKey="average" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 서비스유형별 비교 바 차트
export function ServiceTypeCompareChart({ data }: { data: Array<{ serviceType: string; average: number; totalResponses: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
        <XAxis dataKey="serviceType" fontSize={12} />
        <YAxis domain={[0, 5]} tickCount={6} fontSize={12} />
        <Tooltip
          formatter={(value, name) => [
            name === "average" ? `${Number(value).toFixed(2)}점` : `${value}건`,
            name === "average" ? "평균 만족도" : "응답 수",
          ]}
          contentStyle={{ background: "#18181b", border: "none", borderRadius: 8, fontSize: 13 }}
        />
        <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 점수 분포 차트 (하나의 문항)
export function DistributionChart({ distribution, maxScore = 5 }: { distribution: Record<number, number>; maxScore?: number }) {
  const data = Array.from({ length: maxScore }, (_, i) => ({
    score: String(i + 1),
    count: distribution[i + 1] || 0,
  }));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d) => {
        const pct = total > 0 ? (d.count / total) * 100 : 0;
        return (
          <div key={d.score} className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full bg-primary/80 rounded-t transition-all min-h-[2px]"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${d.score}점: ${d.count}건 (${pct.toFixed(0)}%)`}
            />
            <span className="text-[10px] text-muted-foreground">{d.score}</span>
          </div>
        );
      })}
    </div>
  );
}
