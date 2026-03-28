"use client";

import { useState } from "react";
import { Check, X, Plus, Loader2, Trash2 } from "lucide-react";
import { addTemplateQuestion, updateTemplateQuestion, deleteTemplateQuestion } from "../../actions";
import { type CSQuestion, csQuestionTypeOptions, parseResponseOptions } from "./types";

interface Props {
  templateId: string;
  question?: CSQuestion;
  sectionNames?: string[];
  defaultSection?: string;
  nextSortOrder: number;
  onDone: () => void;
  onCancel: () => void;
  onDeleted?: () => void;
}

const needsOptions = (type: string) =>
  type === "multiple_choice" || type === "single_choice";

export function QuestionForm({ templateId, question, sectionNames, defaultSection, nextSortOrder, onDone, onCancel, onDeleted }: Props) {
  const isEdit = !!question;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [questionNo, setQuestionNo] = useState(question?.question_no || (isEdit ? "" : `Q${nextSortOrder + 1}`));
  const [questionText, setQuestionText] = useState(question?.question_text || "");
  const [questionType, setQuestionType] = useState(question?.question_type || "likert_5");
  const [sectionLabel, setSectionLabel] = useState(question?.section_label || defaultSection || "");
  const [customSection, setCustomSection] = useState(false);
  const [options, setOptions] = useState<string[]>(
    question?.response_options ? parseResponseOptions(question.response_options) : ["옵션 1", "옵션 2"]
  );

  const handleSave = async () => {
    if (!questionText.trim()) return;
    setSaving(true);
    try {
      const responseOptions = needsOptions(questionType)
        ? options.filter((o) => o.trim()).join("/")
        : undefined;

      if (isEdit && question) {
        await updateTemplateQuestion(question.id, templateId, {
          question_no: questionNo.trim() || undefined,
          question_text: questionText.trim(),
          question_type: questionType,
          response_options: responseOptions,
          section_label: sectionLabel.trim() || undefined,
        });
      } else {
        await addTemplateQuestion(templateId, {
          question_no: questionNo.trim() || `Q${nextSortOrder + 1}`,
          question_text: questionText.trim(),
          question_type: questionType,
          response_options: responseOptions,
          section_label: sectionLabel.trim() || undefined,
          sort_order: nextSortOrder,
        });
      }
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!question || !onDeleted) return;
    if (!confirm("이 문항을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await deleteTemplateQuestion(question.id, templateId);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-stone-800">{isEdit ? "문항 수정" : "새 문항 추가"}</p>

      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">질문 내용 <span className="text-red-400">*</span></label>
        <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={2} placeholder="질문 내용을 입력하세요" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">유형</label>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none">
            {csQuestionTypeOptions.map((qt) => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">문항 코드</label>
          <input type="text" value={questionNo} onChange={(e) => setQuestionNo(e.target.value)} placeholder="Q1" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">섹션</label>
        {sectionNames && sectionNames.length > 0 && !customSection ? (
          <select
            value={sectionLabel}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setCustomSection(true);
                setSectionLabel("");
              } else {
                setSectionLabel(e.target.value);
              }
            }}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          >
            <option value="">섹션 없음</option>
            {sectionNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__new__">+ 새 섹션</option>
          </select>
        ) : (
          <div className="flex gap-1.5">
            <input type="text" value={sectionLabel} onChange={(e) => setSectionLabel(e.target.value)} placeholder="섹션 이름" className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" autoFocus={customSection} />
            {customSection && sectionNames && sectionNames.length > 0 && (
              <button type="button" onClick={() => { setCustomSection(false); setSectionLabel(sectionNames[0]); }} className="text-xs text-stone-400 hover:text-stone-600">취소</button>
            )}
          </div>
        )}
      </div>

      {needsOptions(questionType) && (
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1.5">선택지</label>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-5 text-right shrink-0">{idx + 1}.</span>
                <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[idx] = e.target.value; setOptions(n); }} placeholder={`옵션 ${idx + 1}`} className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
                {options.length > 1 && <button type="button" onClick={() => setOptions(options.filter((_, i) => i !== idx))} className="text-stone-400 hover:text-red-500"><X size={14} /></button>}
              </div>
            ))}
            <button type="button" onClick={() => setOptions([...options, ""])} className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"><Plus size={13} /> 선택지 추가</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {isEdit && onDeleted && (
          <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 mr-auto">
            <Trash2 size={13} /> 삭제
          </button>
        )}
        <button onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors ml-auto">취소</button>
        <button onClick={handleSave} disabled={saving || !questionText.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {isEdit ? "수정 완료" : "문항 추가"}
        </button>
      </div>
    </div>
  );
}
