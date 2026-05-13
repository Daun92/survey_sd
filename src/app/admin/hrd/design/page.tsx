import { createClient } from "@/lib/supabase/server";
import { PenTool, Layers, Hash, CheckCircle, XCircle } from "lucide-react";
import { DesignActions } from "./design-actions";
import { PartItemsPanel } from "./part-items-panel";

async function getData() {
  const supabase = await createClient();
  const [{ data: parts }, { data: rounds }] = await Promise.all([
    supabase
      .from("hrd_survey_parts")
      .select(
        "id, round_id, part_code, part_name, sort_order, description, is_active"
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("hrd_survey_rounds")
      .select("id, title, round_number")
      .order("created_at", { ascending: false }),
  ]);

  if (!parts || parts.length === 0) return { parts: [], rounds: rounds ?? [] };

  const partIds = parts.map((p) => p.id);

  const { data: items } = await supabase
    .from("hrd_survey_items")
    .select(
      "id, part_id, item_code, question_text, sub_item_text, question_group, answer_type, answer_options, unit, placeholder, help_text, is_required, is_benchmark_item, sort_order, conditional_logic"
    )
    .in("part_id", partIds)
    .order("sort_order", { ascending: true });

  const itemsByPart: Record<string, typeof items> = {};
  (items ?? []).forEach((item) => {
    if (!itemsByPart[item.part_id]) itemsByPart[item.part_id] = [];
    itemsByPart[item.part_id]!.push(item);
  });

  return {
    parts: parts.map((part) => ({
      ...part,
      items: itemsByPart[part.id] ?? [],
      itemCount: (itemsByPart[part.id] ?? []).length,
    })),
    rounds: rounds ?? [],
  };
}

export default async function DesignPage() {
  const { parts, rounds } = await getData();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">설문 설계</h1>
          <p className="text-sm text-stone-500 mt-1">
            HRD 실태조사 문항을 설계하세요
          </p>
        </div>
        <DesignActions rounds={rounds} mode="header" />
      </div>

      {parts.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <PenTool
            size={40}
            className="mx-auto text-stone-300 mb-3"
            aria-hidden="true"
          />
          <p className="text-sm text-stone-500">
            등록된 설문 파트가 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {parts.map((part) => (
            <div
              key={part.id}
              className="rounded-xl border border-stone-200 bg-white shadow-sm p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
                    <Layers size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-mono font-medium text-stone-600">
                        {part.part_code}
                      </span>
                      <h3 className="text-base font-semibold text-stone-900">
                        {part.part_name}
                      </h3>
                    </div>
                    {part.description && (
                      <p className="text-sm text-stone-500">
                        {part.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {part.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      <CheckCircle size={12} />
                      활성
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
                      <XCircle size={12} />
                      비활성
                    </span>
                  )}
                  <DesignActions part={part} mode="part" />
                </div>
              </div>

              {/* 문항 목록 — 인벤토리 + 응답자 시점 미리보기 */}
              <PartItemsPanel items={part.items} />

              <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm text-stone-600">
                    <Hash size={14} className="text-stone-400" />
                    <span>
                      문항 수:{" "}
                      <span className="font-medium text-stone-800">
                        {part.itemCount}개
                      </span>
                    </span>
                  </div>
                </div>
                <DesignActions
                  partId={part.id}
                  roundId={part.round_id}
                  allItems={part.items}
                  mode="add-item"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
