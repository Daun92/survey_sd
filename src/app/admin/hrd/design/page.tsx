import { supabase } from "@/lib/supabase";
import { PenTool, Layers, Hash, CheckCircle, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

async function getData() {
  const { data: parts } = await supabase
    .from("hrd_survey_parts")
    .select(
      "id, round_id, part_code, part_name, sort_order, description, is_active"
    )
    .order("sort_order", { ascending: true });

  if (!parts || parts.length === 0) return { parts: [] };

  const partIds = parts.map((p) => p.id);

  const { data: itemCounts } = await supabase
    .from("hrd_survey_items")
    .select("part_id")
    .in("part_id", partIds);

  const countMap: Record<string, number> = {};
  (itemCounts ?? []).forEach((item) => {
    countMap[item.part_id] = (countMap[item.part_id] ?? 0) + 1;
  });

  return {
    parts: parts.map((part) => ({
      ...part,
      itemCount: countMap[part.id] ?? 0,
    })),
  };
}

export default async function DesignPage() {
  const { parts } = await getData();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">설문 설계</h1>
        <p className="text-sm text-stone-500 mt-1">
          HRD 실태조사 문항을 설계하세요
        </p>
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
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm text-stone-600">
                  <Hash size={14} className="text-stone-400" />
                  <span>
                    문항 수:{" "}
                    <span className="font-medium text-stone-800">
                      {part.itemCount}개
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-stone-600">
                  <span className="text-stone-400">정렬:</span>
                  <span className="font-medium text-stone-800">
                    {part.sort_order}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
