import { createClient } from "@/lib/supabase/server";
import {
  FileChartColumnIncreasing,
  BarChart3,
  Hash,
  TrendingUp,
} from "lucide-react";
import { ItemPicker } from "./item-picker";
import { DistributionCard } from "./distribution-card";

type RoundSummaryRow = {
  total_responses: number | string;
  unique_respondents: number | string;
  unique_items: number | string;
  avg_score: number | string | null;
};

type PartStatRow = {
  part_id: string;
  part_code: string;
  part_name: string;
  sort_order: number;
  response_count: number | string;
  avg_score: number | string | null;
};

type PickerItemRow = {
  id: string;
  part_id: string;
  item_code: string;
  sub_item_text: string | null;
  question_text: string;
  question_group: string | null;
  answer_type: string;
  sort_order: number;
};

type PickerPartRow = {
  id: string;
  part_code: string;
  part_name: string;
  sort_order: number;
};

const formatScore = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "-" : Number(v).toFixed(2);

async function getData(selectedItemId: string | null) {
  const supabase = await createClient();
  const { data: rounds } = await supabase
    .from("hrd_survey_rounds")
    .select("id, title, year, round_number")
    .order("created_at", { ascending: false })
    .limit(1);

  const currentRound = rounds?.[0] ?? null;
  if (!currentRound)
    return { currentRound: null, summary: null, parts: [], picker: [], distribution: null };

  // 기존 요약 RPC
  const [summaryRes, partsRes, pickerPartsRes, pickerItemsRes] = await Promise.all([
    supabase.rpc("get_hrd_round_statistics", { p_round_id: currentRound.id }),
    supabase.rpc("get_hrd_part_statistics", { p_round_id: currentRound.id }),
    supabase
      .from("hrd_survey_parts")
      .select("id, part_code, part_name, sort_order")
      .eq("round_id", currentRound.id)
      .order("sort_order"),
    supabase
      .from("hrd_survey_items")
      .select(
        "id, part_id, item_code, sub_item_text, question_text, question_group, answer_type, sort_order"
      )
      .eq("round_id", currentRound.id)
      .order("sort_order"),
  ]);

  const summaryRows = (summaryRes.data ?? []) as unknown as RoundSummaryRow[];
  const partRows = (partsRes.data ?? []) as unknown as PartStatRow[];
  const summaryRow = summaryRows[0];

  const summary = summaryRow
    ? {
        totalResponses: Number(summaryRow.total_responses) || 0,
        uniqueRespondents: Number(summaryRow.unique_respondents) || 0,
        uniqueItems: Number(summaryRow.unique_items) || 0,
        avgScore: formatScore(summaryRow.avg_score),
      }
    : { totalResponses: 0, uniqueRespondents: 0, uniqueItems: 0, avgScore: "-" };

  const parts = partRows.map((row) => ({
    id: row.part_id,
    part_code: row.part_code,
    part_name: row.part_name,
    sort_order: row.sort_order,
    responseCount: Number(row.response_count) || 0,
    avgScore: formatScore(row.avg_score),
  }));

  // picker (좌측 트리): part > items 그룹화
  const pickerPartRows = (pickerPartsRes.data ?? []) as PickerPartRow[];
  const pickerItemRows = (pickerItemsRes.data ?? []) as PickerItemRow[];
  const itemsByPart = new Map<string, PickerItemRow[]>();
  for (const it of pickerItemRows) {
    const arr = itemsByPart.get(it.part_id) ?? [];
    arr.push(it);
    itemsByPart.set(it.part_id, arr);
  }
  const picker = pickerPartRows.map((p) => ({
    id: p.id,
    part_code: p.part_code,
    part_name: p.part_name,
    sort_order: p.sort_order,
    items: itemsByPart.get(p.id) ?? [],
  }));

  // 선택된 item 의 distribution + 라벨
  let distribution: {
    label: string;
    code: string;
    result: unknown;
  } | null = null;
  if (selectedItemId) {
    const selected = pickerItemRows.find((i) => i.id === selectedItemId);
    if (selected) {
      const { data: distData, error } = await supabase.rpc(
        "get_hrd_item_distribution",
        { p_round_id: currentRound.id, p_item_id: selectedItemId }
      );
      if (!error && distData) {
        distribution = {
          label: selected.sub_item_text || selected.question_text || selected.item_code,
          code: selected.item_code,
          result: distData,
        };
      }
    }
  }

  return { currentRound, summary, parts, picker, distribution };
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const sp = await searchParams;
  const selectedItemId = sp.item ?? null;
  const { currentRound, summary, parts, picker, distribution } = await getData(
    selectedItemId
  );

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

      {/* 항목별 응답 분포 — 좌측 트리 + 우측 distribution */}
      <div className="mt-8 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-stone-100">
          <h3 className="text-base font-semibold text-stone-900">
            항목별 응답 분포
          </h3>
          <p className="text-sm text-stone-500">
            좌측에서 문항을 선택하면 우측에 분포가 표시됩니다. (완료 응답자 기준)
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[400px]">
          <div className="border-b md:border-b-0 md:border-r border-stone-100 bg-stone-50/30 py-3">
            <ItemPicker parts={picker} selectedItemId={selectedItemId} />
          </div>
          <div className="p-5">
            {distribution ? (
              <DistributionCard
                result={
                  distribution.result as Parameters<typeof DistributionCard>[0]["result"]
                }
                itemLabel={distribution.label}
                itemCode={distribution.code}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-stone-400">
                좌측에서 문항을 선택하세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
