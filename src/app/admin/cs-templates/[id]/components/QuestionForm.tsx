"use client";

import { useState } from "react";
import { Check, X, Plus, Loader2, Trash2 } from "lucide-react";
import { addTemplateQuestion, updateTemplateQuestion, deleteTemplateQuestion } from "../../actions";
import { type CSQuestion, type SkipLogic, csQuestionTypeOptions, parseResponseOptions } from "./types";

interface Props {
  templateId: string;
  question?: CSQuestion;
  allQuestions?: CSQuestion[];
  sectionNames?: string[];
  defaultSection?: string;
  nextSortOrder: number;
  onDone: () => void;
  onCancel: () => void;
  onDeleted?: () => void;
}

const needsOptions = (type: string) =>
  type === "multiple_choice" || type === "single_choice";

export function QuestionForm({ templateId, question, allQuestions, sectionNames, defaultSection, nextSortOrder, onDone, onCancel, onDeleted }: Props) {
  const isEdit = !!question;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [questionNo, setQuestionNo] = useState(question?.question_no || (isEdit ? "" : `Q${nextSortOrder + 1}`));
  const [questionText, setQuestionText] = useState(question?.question_text || "");
  const [questionType, setQuestionType] = useState(question?.question_type || "likert_5");
  const [sectionLabel, setSectionLabel] = useState(question?.section_label || defaultSection || "");
  const [customSection, setCustomSection] = useState(false);
  const [isRequired, setIsRequired] = useState(question?.is_required ?? true);
  const [options, setOptions] = useState<string[]>(
    question?.response_options ? parseResponseOptions(question.response_options) : ["옵션 1", "옵션 2"]
  );

  // Info block metadata
  const existingMeta = question?.metadata as Record<string, unknown> | undefined;
  const [blockStyle, setBlockStyle] = useState<string>((existingMeta?.block_style as string) || "info");
  const isInfoBlock = questionType === "info_block";

  // Skip logic
  const [hasSkipLogic, setHasSkipLogic] = useState(!!question?.skip_logic);
  const [skipQuestionId, setSkipQuestionId] = useState(question?.skip_logic?.show_when?.question_id || "");
  const [skipOperator, setSkipOperator] = useState<string>(question?.skip_logic?.show_when?.operator || "equals");
  const [skipValue, setSkipValue] = useState(String(question?.skip_logic?.show_when?.value ?? ""));
  const otherQuestions = (allQuestions || []).filter((q) => q.id !== question?.id);

  const handleSave = async () => {
    if (!questionText.trim()) return;
    setSaving(true);
    try {
      const skipLogic: SkipLogic | null = hasSkipLogic && skipQuestionId && skipValue
        ? { show_when: { question_id: skipQuestionId, operator: skipOperator as SkipLogic["show_when"]["operator"], value: isNaN(Number(skipValue)) ? skipValue : Number(skipValue) } }
        : null;

      const responseOptions = needsOptions(questionType)
        ? options.filter((o) => o.trim()).join("/")
        : undefined;

      const base: Record<string, unknown> = {
        question_no: questionNo.trim() || undefined,
        question_text: questionText.trim(),
        question_type: questionType,
        response_options: responseOptions,
        section_label: sectionLabel.trim() || undefined,
        is_required: isInfoBlock ? false : isRequired,
        skip_logic: skipLogic,
      };

      if (isInfoBlock) {
        base.metadata = { block_style: blockStyle };
      }

      if (isEdit && question) {
        await updateTemplateQuestion(question.id, templateId, base);
      } else {
        await addTemplateQuestion(templateId, {
          ...(base as any),
          question_no: base.question_no || `Q${nextSortOrder + 1}`,
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
            <option value="info_block">안내 블록</option>
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">문항 코드</label>
          <input type="text" value={questionNo} onChange={(e) => setQuestionNo(e.target.value)} placeholder="Q1" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
        </div>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
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
        {!isInfoBlock && (
          <div className="shrink-0 pb-2">
            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="accent-teal-600" /> 필수
            </label>
          </div>
        )}
      </div>

      {/* 안내 블록 스타일 */}
      {isInfoBlock && (
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1.5">블록 스타일</label>
          <div className="flex gap-2">
            {[
              { value: "info", label: "정보", className: "border-blue-300 bg-blue-50 text-blue-700" },
              { value: "warning", label: "주의", className: "border-amber-300 bg-amber-50 text-amber-700" },
              { value: "divider", label: "구분선", className: "border-stone-300 bg-stone-50 text-stone-600" },
            ].map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setBlockStyle(s.value)}
                className={`flex-1 rounded-lg border-[1.5px] px-3 py-2 text-xs font-medium transition-all ${
                  blockStyle === s.value ? s.className : "border-stone-200 bg-white text-stone-400"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택지 관리 */}
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

      {/* 조건부 표시 (Skip Logic) */}
      {!isInfoBlock && otherQuestions.length > 0 && (
        <div className="border-t border-stone-100 pt-3">
          <label className="flex items-center gap-2 text-[13px] text-stone-600 cursor-pointer mb-2">
            <input type="checkbox" checked={hasSkipLogic} onChange={(e) => setHasSkipLogic(e.target.checked)} className="accent-teal-600" />
            <span className="font-medium">조건부 표시</span>
            <span className="text-stone-400 font-normal">— 특정 답변일 때만 이 문항을 표시</span>
          </label>
          {hasSkipLogic && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-0.5">기준 문항</label>
                  <select value={skipQuestionId} onChange={(e) => setSkipQuestionId(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
                    <option value="">선택</option>
                    {otherQuestions.map((q) => (
                      <option key={q.id} value={q.id}>{q.question_no || q.question_text.slice(0, 20)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-0.5">조건</label>
                  <select value={skipOperator} onChange={(e) => setSkipOperator(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
                    <option value="equals">같을 때</option>
                    <option value="not_equals">다를 때</option>
                    <option value="greater_than">초과</option>
                    <option value="less_than">미만</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-0.5">값</label>
                  <SkipValueSelector
                    targetQuestion={otherQuestions.find((q) => q.id === skipQuestionId)}
                    value={skipValue}
                    onChange={setSkipValue}
                  />
                </div>
              </div>
              <p className="text-[11px] text-amber-700">기준 문항의 답변이 조건을 만족할 때만 이 문항이 표시됩니다</p>
            </div>
          )}
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

// ─── Skip Value Selector ───

const likertOptions = [
  { value: "5", label: "5 (매우 만족)" },
  { value: "4", label: "4 (만족)" },
  { value: "3", label: "3 (보통)" },
  { value: "2", label: "2 (불만족)" },
  { value: "1", label: "1 (매우 불만족)" },
];

const likert6Options = [
  ...likertOptions,
  { value: "6", label: "6 (사용하지않음)" },
];

const yesNoOptions = [
  { value: "1", label: "1 (예)" },
  { value: "2", label: "2 (아니오)" },
];

function SkipValueSelector({ targetQuestion, value, onChange }: {
  targetQuestion?: CSQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!targetQuestion) {
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="기준 문항을 선택하세요" disabled className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs bg-stone-50 outline-none" />;
  }

  const type = targetQuestion.question_type;

  if (type === "likert_5" || type === "likert_7") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
        <option value="">선택</option>
        {likertOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (type === "likert_6") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
        <option value="">선택</option>
        {likert6Options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (type === "yes_no") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
        <option value="">선택</option>
        {yesNoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (type === "single_choice" || type === "multiple_choice") {
    const opts = parseResponseOptions(targetQuestion.response_options);
    if (opts.length > 0) {
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
          <option value="">선택</option>
          {opts.map((opt, i) => <option key={i} value={String(i + 1)}>{i + 1}. {opt}</option>)}
        </select>
      );
    }
  }

  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="값 입력" className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none" />;
}
