"use client";

import { useState } from "react";
import { Check, X, Plus, Loader2, Trash2 } from "lucide-react";
import { addQuestion, updateQuestion, deleteQuestion } from "../actions";
import { type Question, type SkipLogic, questionTypeOptions, needsOptions, parseOptions } from "./types";

interface Props {
  surveyId: string;
  question?: Question;
  allQuestions?: Question[];
  nextSortOrder: number;
  onDone: () => void;
  onCancel: () => void;
  onDeleted?: () => void;
}

export function QuestionForm({ surveyId, question, allQuestions, nextSortOrder, onDone, onCancel, onDeleted }: Props) {
  const isEdit = !!question;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [questionText, setQuestionText] = useState(question?.question_text || "");
  const [questionType, setQuestionType] = useState(question?.question_type || "likert_5");
  const [questionCode, setQuestionCode] = useState(question?.question_code || "");
  const [section, setSection] = useState(question?.section || "일반");
  const [isRequired, setIsRequired] = useState(question?.is_required ?? true);
  const [options, setOptions] = useState<string[]>(question ? parseOptions(question.options) : ["옵션 1", "옵션 2"]);

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
      const payload = {
        question_text: questionText.trim(),
        question_type: questionType,
        question_code: questionCode.trim() || undefined,
        section: section.trim() || "일반",
        is_required: isRequired,
        sort_order: question?.sort_order ?? nextSortOrder,
        options: needsOptions(questionType) ? options.filter((o) => o.trim()) : null,
        skip_logic: skipLogic,
      };
      if (isEdit && question) {
        await updateQuestion(question.id, surveyId, payload);
      } else {
        await addQuestion(surveyId, payload);
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
      await deleteQuestion(question.id, surveyId);
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
            {questionTypeOptions.map((qt) => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">문항 코드</label>
          <input type="text" value={questionCode} onChange={(e) => setQuestionCode(e.target.value)} placeholder="Q1" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
        </div>
      </div>
      <div className="flex gap-3 items-end">
        <div className="flex-1 min-w-0">
          <label className="block text-[13px] font-medium text-stone-600 mb-1">섹션</label>
          <input type="text" value={section} onChange={(e) => setSection(e.target.value)} placeholder="일반" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
        </div>
        <div className="shrink-0 pb-2">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} className="accent-teal-600" /> 필수
          </label>
        </div>
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
      {/* Skip Logic */}
      {otherQuestions.length > 0 && (
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
                      <option key={q.id} value={q.id}>{q.question_code || q.question_text.slice(0, 20)}</option>
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
              <p className="text-[11px] text-amber-700">
                기준 문항의 답변이 조건을 만족할 때만 이 문항이 표시됩니다
              </p>
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
  targetQuestion?: Question;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!targetQuestion) {
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="기준 문항을 선택하세요" disabled className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs bg-stone-50 outline-none" />;
  }

  const type = targetQuestion.question_type;

  // Likert scales
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

  // Yes/No
  if (type === "yes_no") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
        <option value="">선택</option>
        {yesNoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  // Choice types — show actual options
  if (type === "single_choice" || type === "multiple_choice") {
    const opts = parseOptions(targetQuestion.options);
    if (opts.length > 0) {
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
          <option value="">선택</option>
          {opts.map((opt, i) => <option key={i} value={String(i + 1)}>{i + 1}. {opt}</option>)}
        </select>
      );
    }
  }

  // Fallback: text input
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="값 입력" className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none" />;
}
