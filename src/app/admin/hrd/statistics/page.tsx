import { supabase } from "@/lib/supabase";
import {
  FileChartColumnIncreasing,
  BarChart3,
  Hash,
  TrendingUp,
} from "lucide-react";

export const revalidate = 60;

async function getData() {
  const { data: rounds } = await supabase
    .from("hrd_survey_rounds")
    .select("id, title, year, round_number")
    .order("created_at", { ascending: false })
    .limit(1);

  const currentRound = rounds?.[0] ?? null;
  if (!currentRound) return { currentRound: null, summary: null, parts: [] };

  const [{ data: responses }, { data: parts }, { data: items }] = await Promise.all([
    supabase
      .from("hrd_responses")
      .select("id, respondent_id, item_id, value_number")
      .eq("round_id", currentRound.id),
    supabase
      .from("hrd_survey_parts")
      .select("id, part_code, part_name, sort_order")
      .eq("round_id", currentRound.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("hrd_survey_items")
      .select("id, part_id")
      .eq("round_id", currentRound.id),
  ]);

  const responseList = responses ?? [];
  const partList = parts ?? [];
  const itemList = items ?? [];

  // Map item_id -> part_id
  const itemPartMap: Record<string, string> = {};
  itemList.forEach((item) => { itemPartMap[item.id] = item.part_id; });

  const totalResponses = responseList.length;
  const uniqueRespondents = new Set(responseList.map((r) => r.respondent_id)).size;
  const uniqueItems = new Set(responseList.map((r) => r.item_id)).size;

  const numericValues = responseList
    .map((r) => r.value_number)
    .filter((v): v is number => v !== null && !isNaN(v));
  const avgScore =
    numericValues.length > 0
      ? (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2)
      : "-";

  const partStats = partList.map((part) => {
    const partResponses = responseList.filter((r) => itemPartMap[r.item_id] === part.id);
    const partNumeric = partResponses
      .map((r) => r.value_number)
      .filter((v): v is number => v !== null && !isNaN(v));
    const partAvg =
      partNumeric.length > 0
        ? (partNumeric.reduce((a, b) => a + b, 0) / partNumeric.length).toFixed(2)
        : "-";
    return {
      ...part,
      responseCount: partResponses.length,
      avgScore: partAvg,
    };
  });

  return {
    currentRound,
    summary: {
      totalResponses,
      uniqueRespondents,
      uniqueItems,
      avgScore,
    },
    parts: partStats,
  };
}

export default async function StatisticsPage() {
  const { currentRound, summary, parts } = await getData();

  if (!currentRound || !summary) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800">전체 통계</h1>
          <p className="text-sm text-stone-500 mt-1">
            실태조사 결과를 분석하세요
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <FileChartColumnIncreasing
            size={40}
            className="mx-auto text-stone-300 mb-3"
            aria-hidden="true"
          />
          <p className="text-sm text-stone-500">
            분석할 실태조사 데이터가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "총 응답 수",
      value: summary.totalResponses.toLocaleString(),
      icon: BarChart3,
      color: "text-teal-600 bg-teal-50",
    },
    {
      label: "응답자 수",
      value: summary.uniqueRespondents.toLocaleString(),
      icon: Hash,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "문항 수",
      value: summary.uniqueItems.toLocaleString(),
      icon: FileChartColumnIncreasing,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "평균 점수",
      value: summary.avgScore,
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">전체 통계</h1>
        <p className="text-sm text-stone-500 mt-1">
          실태조사 결과를 분석하세요
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-stone-200 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-stone-900">
          {currentRound.title}
        </h2>
        <p className="text-sm text-stone-500 mt-0.5">
          {currentRound.year}년 {currentRound.round_number}차
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-stone-200 bg-white shadow-sm"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-medium text-stone-500">
                  {card.label}
                </p>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}
                >
                  <card.icon size={16} aria-hidden="true" />
                </div>
              </div>
              <p className="text-[28px] font-bold text-stone-800">
                {card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-base font-semibold text-stone-900">
            파트별 분석
          </h3>
          <p className="text-sm text-stone-500">각 파트별 응답 현황 요약</p>
        </div>
        {parts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-stone-500">파트 데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {parts.map((part) => (
              <div
                key={part.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-mono font-medium text-stone-600">
                    {part.part_code}
                  </span>
                  <span className="text-sm font-medium text-stone-800">
                    {part.part_name}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-stone-500">응답 수</p>
                    <p className="text-sm font-medium text-stone-800">
                      {part.responseCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500">평균 점수</p>
                    <p className="text-sm font-semibold text-teal-600">
                      {part.avgScore}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
