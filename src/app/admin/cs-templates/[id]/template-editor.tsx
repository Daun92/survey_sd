"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Check, X, Loader2, Save } from "lucide-react";
import { updateTemplate, addTemplateQuestion, updateTemplateQuestion, deleteTemplateQuestion } from "../actions";

interface Question {
  id: string;
  question_no: string;
  question_text: string;
  question_type: string;
  page_type: string | null;
  response_options: string | null;
  section_label: string | null;
  sort_order: number;
}

interface Props {
  templateId: string;
  templateName: string;
  templateDescription: string;
  isSystem: boolean;
  questions: Question[];
}

const questionTypeLabels: Record<string, string> = {
  single_choice: "단일선택",
  multiple_choice: "복수선택",
  likert_5: "5점 척도",
  likert_6: "6점 척도",
  likert_7: "7점 척도",
  text: "주관식",
  rating: "평점",
  yes_no: "예/아니오",
};

export function TemplateEditor({ templateId, templateName, templateDescription, isSystem, questions }: Props) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(templateName);
  const [description, setDescription] = useState(templateDescription);
  const [savingName, setSavingName] = useState(false);

  // Question editing
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await updateTemplate(templateId, { name, description });
      setEditingName(false);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSavingName(false);
    }
  };

  if (isSystem) return null;

  return (
    <div className="space-y-6">
      {/* 이름/설명 편집 */}
      {editingName ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-3">
          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-1">템플릿 이름</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-1">설명</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveName} disabled={savingName} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {savingName ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 저장
            </button>
            <button onClick={() => { setName(templateName); setDescription(templateDescription); setEditingName(false); }} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50">취소</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditingName(true)} className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-teal-600">
          <Pencil size={12} /> 이름/설명 수정
        </button>
      )}

      {/* 문항 추가 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => setAddingQuestion(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
        >
          <Plus size={13} /> 문항 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {addingQuestion && (
        <QuestionEditForm
          templateId={templateId}
          nextSortOrder={questions.length > 0 ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 0}
          onDone={() => { setAddingQuestion(false); router.refresh(); }}
          onCancel={() => setAddingQuestion(false)}
        />
      )}

      {/* 문항별 수정/삭제 (섹션별 그룹) */}
      {(() => {
        const sections: Record<string, Question[]> = {};
        questions.forEach((q) => {
          const sec = q.section_label || "기타";
          if (!sections[sec]) sections[sec] = [];
          sections[sec].push(q);
        });
        return Object.entries(sections).map(([sectionName, sectionQuestions]) => (
          <div key={sectionName}>
            <div className="px-4 py-2 bg-stone-50/80 border-b border-stone-100">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">{sectionName}</span>
              <span className="text-[11px] text-stone-400 ml-1.5">({sectionQuestions.length})</span>
            </div>
            {sectionQuestions.map((q) => (
              editingQId === q.id ? (
                <QuestionEditForm
                  key={q.id}
                  templateId={templateId}
                  question={q}
                  nextSortOrder={q.sort_order}
                  onDone={() => { setEditingQId(null); router.refresh(); }}
                  onCancel={() => setEditingQId(null)}
                />
              ) : (
                <div key={q.id} className="group flex items-start gap-3 px-4 py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                  <span className="text-xs font-mono text-stone-400 mt-0.5 shrink-0 w-12">{q.question_no}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-800 leading-relaxed">{q.question_text}</p>
                    {q.response_options && <p className="text-xs text-stone-400 mt-0.5">{q.response_options}</p>}
                  </div>
                  {q.section_label && (
                    <span className="inline-flex rounded bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium text-teal-700 shrink-0">
                      {q.section_label}
                    </span>
                  )}
                  <span className="inline-flex rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600 shrink-0">
                    {questionTypeLabels[q.question_type] ?? q.question_type}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => setEditingQId(q.id)} className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50"><Pencil size={13} /></button>
                    <QuestionDeleteButton questionId={q.id} templateId={templateId} onDeleted={() => router.refresh()} />
                  </div>
                </div>
              )
            ))}
          </div>
        ));
      })()}
    </div>
  );
}

// ── Question Edit Form ──

function QuestionEditForm({ templateId, question, nextSortOrder, onDone, onCancel }: {
  templateId: string;
  question?: Question;
  nextSortOrder: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!question;
  const [saving, setSaving] = useState(false);
  const [questionNo, setQuestionNo] = useState(question?.question_no || "");
  const [questionText, setQuestionText] = useState(question?.question_text || "");
  const [questionType, setQuestionType] = useState(question?.question_type || "likert_5");
  const [responseOptions, setResponseOptions] = useState(question?.response_options || "");
  const [sectionLabel, setSectionLabel] = useState(question?.section_label || "");

  const handleSave = async () => {
    if (!questionText.trim()) return;
    setSaving(true);
    try {
      if (isEdit && question) {
        await updateTemplateQuestion(question.id, templateId, {
          question_no: questionNo, question_text: questionText,
          question_type: questionType, response_options: responseOptions.trim() || null,
          section_label: sectionLabel.trim() || null,
        });
      } else {
        await addTemplateQuestion(templateId, {
          question_no: questionNo || `Q${nextSortOrder + 1}`,
          question_text: questionText, question_type: questionType,
          response_options: responseOptions.trim() || null,
          section_label: sectionLabel.trim() || null,
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

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-3">
      <p className="text-sm font-semibold text-stone-800">{isEdit ? "문항 수정" : "새 문항 추가"}</p>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">문항 코드</label>
          <input type="text" value={questionNo} onChange={(e) => setQuestionNo(e.target.value)} placeholder="Q1" className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none" />
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">유형</label>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none">
            {Object.entries(questionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">섹션</label>
          <input type="text" value={sectionLabel} onChange={(e) => setSectionLabel(e.target.value)} placeholder="일반" className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none" />
        </div>
        <div>
          <label className="block text-[11px] text-stone-500 mb-0.5">선택지 (/ 구분)</label>
          <input type="text" value={responseOptions} onChange={(e) => setResponseOptions(e.target.value)} placeholder="옵션1/옵션2/옵션3" className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-stone-500 mb-0.5">질문 내용 *</label>
        <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={2} className="w-full rounded border border-stone-300 px-2 py-1.5 text-xs focus:border-teal-500 outline-none resize-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !questionText.trim()} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {isEdit ? "수정" : "추가"}
        </button>
        <button onClick={onCancel} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">취소</button>
      </div>
    </div>
  );
}

// ── Question Delete Button ──

function QuestionDeleteButton({ questionId, templateId, onDeleted }: { questionId: string; templateId: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("이 문항을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await deleteTemplateQuestion(questionId, templateId);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
      setDeleting(false);
    }
  };

  return (
    <button onClick={handleDelete} disabled={deleting} className="rounded p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50">
      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
    </button>
  );
}
