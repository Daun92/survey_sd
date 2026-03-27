"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, Archive, RotateCcw, Loader2 } from "lucide-react";
import { duplicateTemplate, deleteTemplate, archiveTemplate, restoreTemplate } from "../actions";

interface Props {
  templateId: string;
  isSystem: boolean;
  isActive: boolean;
}

export function TemplateDetailActions({ templateId, isSystem, isActive }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(action);
    try {
      await fn();
      if (action === "delete") {
        router.push("/admin/cs-templates");
      } else {
        router.refresh();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "작업 실패");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* 복제 — 모든 템플릿 가능 */}
      <button
        onClick={() => handleAction("duplicate", async () => {
          const newId = await duplicateTemplate(templateId);
          router.push(`/admin/cs-templates/${newId}`);
        })}
        disabled={!!loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
      >
        {loading === "duplicate" ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
        복제
      </button>

      {/* 사용자 템플릿만 보관/복원/삭제 가능 */}
      {!isSystem && (
        <>
          {isActive ? (
            <button
              onClick={() => handleAction("archive", () => archiveTemplate(templateId))}
              disabled={!!loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              {loading === "archive" ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
              보관
            </button>
          ) : (
            <button
              onClick={() => handleAction("restore", () => restoreTemplate(templateId))}
              disabled={!!loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50"
            >
              {loading === "restore" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              복원
            </button>
          )}
          <button
            onClick={() => {
              if (!confirm("이 템플릿과 모든 문항을 영구 삭제하시겠습니까?")) return;
              handleAction("delete", () => deleteTemplate(templateId));
            }}
            disabled={!!loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {loading === "delete" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            삭제
          </button>
        </>
      )}
    </div>
  );
}
