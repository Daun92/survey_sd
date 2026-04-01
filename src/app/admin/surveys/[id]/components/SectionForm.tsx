"use client";

import { useState, useRef } from "react";
import { Check, Loader2, Trash2, Upload, X, ImageIcon } from "lucide-react";
import { renameSection, updateSectionIntro, deleteSection } from "../actions";
import type { SectionIntro } from "./types";

const INTRO_COLORS = [
  { value: "transparent", label: "투명", style: { backgroundColor: "transparent", border: "1.5px dashed #d1d5db" } },
  { value: "neutral",     label: "기본",   style: { backgroundColor: "#a8a29e" } },
  { value: "brand",       label: "초록",   style: { backgroundColor: "#14b8a6" } },
  { value: "cool",        label: "파랑",   style: { backgroundColor: "#3b82f6" } },
  { value: "warm",        label: "주황",   style: { backgroundColor: "#d97706" } },
  { value: "rose",        label: "분홍",   style: { backgroundColor: "#f43f5e" } },
  { value: "violet",      label: "보라",   style: { backgroundColor: "#8b5cf6" } },
  { value: "green",       label: "녹색",   style: { backgroundColor: "#22c55e" } },
] as const;

interface Props {
  surveyId: string;
  sectionName: string;
  questionCount: number;
  intro?: SectionIntro;
  onDone: () => void;
  onCancel: () => void;
}

export function SectionForm({ surveyId, sectionName, questionCount, intro, onDone, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(sectionName);
  const [introTitle, setIntroTitle] = useState(intro?.title ?? "");
  const [introDescription, setIntroDescription] = useState(intro?.description ?? "");
  const [introColor, setIntroColor] = useState<string>(intro?.color ?? "brand");
  const [introImageUrl, setIntroImageUrl] = useState(intro?.image_url ?? "");
  const [introImageSize, setIntroImageSize] = useState<string>(intro?.image_size ?? "original");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIntroImageUrl(data.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (name.trim() !== sectionName) {
        await renameSection(surveyId, sectionName, name.trim());
      }

      await updateSectionIntro(surveyId, name.trim(), {
        title: introTitle.trim() || undefined,
        description: introDescription.trim() || undefined,
        color: introColor,
        image_url: introImageUrl || undefined,
        image_size: introImageUrl ? introImageSize : undefined,
      });

      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (questionCount > 0) {
      alert("질문이 있는 섹션은 삭제할 수 없습니다.\n먼저 질문을 다른 섹션으로 이동해 주세요.");
      return;
    }
    if (!confirm(`"${sectionName}" 섹션을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await deleteSection(surveyId, sectionName);
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-stone-800">섹션 편집</p>

      {/* 섹션 이름 */}
      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">
          섹션 이름 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="섹션 이름"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
        />
        {name.trim() !== sectionName && name.trim() && (
          <p className="mt-1 text-[11px] text-amber-600">
            이 섹션의 모든 질문({questionCount}개)이 새 이름으로 변경됩니다
          </p>
        )}
      </div>

      {/* 섹션 안내 배너 */}
      <div className="border-t border-stone-100 pt-3">
        <p className="text-[13px] font-medium text-stone-700 mb-1">섹션 안내 배너</p>
        <p className="text-[11px] text-stone-400 mb-2">
          설정하면 질문 목록 상단에 안내 배너가 표시됩니다
        </p>

        <div className="space-y-2">
          <div>
            <label className="block text-[11px] text-stone-500 mb-0.5">안내 제목</label>
            <input
              type="text"
              value={introTitle}
              onChange={(e) => setIntroTitle(e.target.value)}
              placeholder="예: 강사 평가"
              className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-stone-500 mb-0.5">안내 설명</label>
            <textarea
              value={introDescription}
              onChange={(e) => setIntroDescription(e.target.value)}
              placeholder="이 섹션에 대한 안내 (선택)"
              rows={2}
              className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-y field-sizing-content"
            />
          </div>

          {/* 이미지 업로드 */}
          <div>
            <label className="block text-[11px] text-stone-500 mb-0.5">배너 이미지</label>
            {introImageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-stone-200">
                <img src={introImageUrl} alt="섹션 배너" className="w-full h-24 object-cover" />
                <button
                  onClick={() => setIntroImageUrl("")}
                  className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-200 px-3 py-3 text-[11px] text-stone-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/50 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                {uploading ? "업로드 중..." : "이미지 업로드 (선택)"}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* 이미지 크기 선택 */}
          {introImageUrl && (
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">이미지 크기</label>
              <div className="flex gap-1.5 mb-2">
                {[
                  { value: "original", label: "원본" },
                  { value: "full",     label: "전체" },
                  { value: "medium",   label: "중간" },
                  { value: "small",    label: "작게" },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setIntroImageSize(s.value)}
                    className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-all ${
                      introImageSize === s.value
                        ? "border-teal-400 bg-teal-50 text-teal-700"
                        : "border-stone-200 text-stone-400 hover:border-stone-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {/* 이미지 크기 미리보기 */}
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-2 flex justify-center items-center min-h-[60px]">
                <img
                  src={introImageUrl}
                  alt="미리보기"
                  style={{
                    display: "block",
                    height: "auto",
                    maxHeight: "80px",
                    borderRadius: "4px",
                    ...(introImageSize === "full"
                      ? { width: "100%" }
                      : introImageSize === "medium"
                      ? { width: "55%" }
                      : introImageSize === "small"
                      ? { width: "35%" }
                      : { width: "auto", maxWidth: "100%" }),
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] text-stone-500 mb-1.5">색상 테마</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {INTRO_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setIntroColor(c.value)}
                  className={`h-6 w-6 rounded-full transition-all ${
                    introColor === c.value
                      ? "ring-2 ring-offset-1 ring-stone-400 scale-110"
                      : "opacity-60 hover:opacity-90"
                  }`}
                  style={c.style}
                  title={c.label}
                />
              ))}
              <span className="text-[10px] text-stone-400 ml-1">
                {INTRO_COLORS.find((c) => c.value === introColor)?.label ?? ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleDelete}
          disabled={deleting || questionCount > 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mr-auto"
          title={questionCount > 0 ? "질문이 있는 섹션은 삭제할 수 없습니다" : ""}
        >
          <Trash2 size={13} /> 삭제
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 저장
        </button>
      </div>
    </div>
  );
}
