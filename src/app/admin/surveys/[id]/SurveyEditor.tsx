"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Plus,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save,
  X,
  Loader2,
  AlertTriangle,
  Check,
} from "lucide-react";
import AiFab from "./ai-fab";
import {
  updateSurvey,
  deleteSurvey,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} from "./actions";

// ─── Types ───

interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: string;
  survey_type: string;
  education_type: string;
  starts_at: string | null;
  ends_at: string | null;
  url_token: string;
}

interface Question {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: string;
  question_code: string | null;
  section: string | null;
  is_required: boolean;
  sort_order: number;
  options: string[] | string | null;
}

interface Props {
  survey: Survey;
  questions: Question[];
  submissionCount: number;
}

// ─── Constants ───

const statusOptions = [
  { value: "draft", label: "초안" },
  { value: "active", label: "진행중" },
  { value: "closed", label: "마감" },
];

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  closed: { label: "마감", className: "bg-stone-100 text-stone-800" },
  draft: {
    label: "초안",
    className: "border border-stone-300 text-stone-700 bg-white",
  },
};

const questionTypeOptions = [
  { value: "likert_5", label: "리커트 5점" },
  { value: "likert_7", label: "리커트 7점" },
  { value: "multiple_choice", label: "객관식 (복수)" },
  { value: "single_choice", label: "객관식 (단일)" },
  { value: "text", label: "주관식" },
  { value: "rating", label: "평점" },
  { value: "yes_no", label: "예/아니오" },
];

const questionTypeLabels: Record<string, string> = {
  likert_5: "리커트 5점",
  likert_7: "리커트 7점",
  text: "주관식",
  multiple_choice: "객관식 (복수)",
  single_choice: "객관식 (단일)",
  rating: "평점",
  yes_no: "예/아니오",
};

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

function parseOptions(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const needsOptions = (type: string) =>
  type === "multiple_choice" || type === "single_choice";

// ─── Survey Info Editor ───

function SurveyInfoEditor({
  survey,
  onUpdated,
}: {
  survey: Survey;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(survey.title);
  const [status, setStatus] = useState(survey.status);
  const [startsAt, setStartsAt] = useState(formatDateForInput(survey.starts_at));
  const [endsAt, setEndsAt] = useState(formatDateForInput(survey.ends_at));
  const [description, setDescription] = useState(survey.description || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSurvey(survey.id, {
        title,
        status,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        description: description || null,
      });
      setEditing(false);
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "수정 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(survey.title);
    setStatus(survey.status);
    setStartsAt(formatDateForInput(survey.starts_at));
    setEndsAt(formatDateForInput(survey.ends_at));
    setDescription(survey.description || "");
    setEditing(false);
  };

  const currentStatus = statusLabels[survey.status] ?? statusLabels.draft;

  if (!editing) {
    return (
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-start gap-3 mb-2">
            <h1 className="text-2xl font-bold text-stone-800">{survey.title}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1.5 shrink-0 ${currentStatus.className}`}
            >
              {currentStatus.label}
            </span>
          </div>
          {survey.description && (
            <p className="text-sm text-stone-500 mt-1">{survey.description}</p>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <Pencil size={13} />
          수정
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">
          설문 제목
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">
          설명
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">
            상태
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">
            시작일
          </label>
          <input
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">
            종료일
          </label>
          <input
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          저장
        </button>
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <X size={13} />
          취소
        </button>
      </div>
    </div>
  );
}

// ─── Delete Survey Confirmation ───

function DeleteSurveyButton({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSurvey(surveyId);
      router.push("/admin/surveys");
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={13} />
        설문 삭제
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">
            정말 이 설문을 삭제하시겠습니까?
          </p>
          <p className="text-xs text-red-600 mt-1">
            설문과 모든 문항이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Trash2 size={13} />
              )}
              삭제 확인
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-white transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Question Form (add/edit) ───

function QuestionForm({
  surveyId,
  question,
  nextSortOrder,
  onDone,
  onCancel,
}: {
  surveyId: string;
  question?: Question;
  nextSortOrder: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!question;
  const [saving, setSaving] = useState(false);
  const [questionText, setQuestionText] = useState(question?.question_text || "");
  const [questionType, setQuestionType] = useState(question?.question_type || "likert_5");
  const [questionCode, setQuestionCode] = useState(question?.question_code || "");
  const [section, setSection] = useState(question?.section || "일반");
  const [isRequired, setIsRequired] = useState(question?.is_required ?? true);
  const [options, setOptions] = useState<string[]>(
    question ? parseOptions(question.options) : ["옵션 1", "옵션 2"]
  );

  const handleSave = async () => {
    if (!questionText.trim()) return;
    setSaving(true);
    try {
      const payload = {
        question_text: questionText.trim(),
        question_type: questionType,
        question_code: questionCode.trim() || undefined,
        section: section.trim() || "일반",
        is_required: isRequired,
        sort_order: question?.sort_order ?? nextSortOrder,
        options: needsOptions(questionType) ? options.filter((o) => o.trim()) : null,
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

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (idx: number) =>
    setOptions(options.filter((_, i) => i !== idx));
  const updateOption = (idx: number, value: string) =>
    setOptions(options.map((o, i) => (i === idx ? value : o)));

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-3">
      <p className="text-sm font-semibold text-stone-800">
        {isEdit ? "문항 수정" : "새 문항 추가"}
      </p>

      <div>
        <label className="block text-[13px] font-medium text-stone-600 mb-1">
          질문 내용 <span className="text-red-400">*</span>
        </label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={2}
          placeholder="질문 내용을 입력하세요"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">
            유형
          </label>
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          >
            {questionTypeOptions.map((qt) => (
              <option key={qt.value} value={qt.value}>
                {qt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">
            문항 코드
          </label>
          <input
            type="text"
            value={questionCode}
            onChange={(e) => setQuestionCode(e.target.value)}
            placeholder="Q1"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1">
            섹션
          </label>
          <input
            type="text"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="일반"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="accent-teal-600"
            />
            필수 응답
          </label>
        </div>
      </div>

      {/* Options editor for choice types */}
      {needsOptions(questionType) && (
        <div>
          <label className="block text-[13px] font-medium text-stone-600 mb-1.5">
            선택지
          </label>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-5 text-right shrink-0">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`옵션 ${idx + 1}`}
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus size={13} />
              선택지 추가
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !questionText.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}
          {isEdit ? "수정 완료" : "문항 추가"}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ─── Question Row ───

function QuestionRow({
  question,
  index,
  surveyId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRefresh,
}: {
  question: Question;
  index: number;
  surveyId: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteQuestion(question.id, surveyId);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (editing) {
    return (
      <div className="px-5 py-3 border-b border-stone-100 last:border-0">
        <QuestionForm
          surveyId={surveyId}
          question={question}
          nextSortOrder={question.sort_order}
          onDone={() => {
            setEditing(false);
            onRefresh();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const opts = parseOptions(question.options);

  return (
    <div className="group flex items-start gap-3 px-5 py-3.5 border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors">
      {/* Reorder buttons */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-stone-300 hover:text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="위로 이동"
        >
          <ChevronUp size={14} />
        </button>
        <GripVertical size={12} className="text-stone-300" />
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-stone-300 hover:text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="아래로 이동"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Code */}
      <span className="text-xs font-mono text-stone-400 mt-0.5 shrink-0 w-14">
        {question.question_code || `Q${index + 1}`}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-800 leading-relaxed">
          {question.question_text}
          {question.is_required && (
            <span className="text-red-400 ml-0.5">*</span>
          )}
        </p>
        {opts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {opts.map((opt, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500"
              >
                {opt}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Type badge */}
      <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 shrink-0">
        {questionTypeLabels[question.question_type] ?? question.question_type}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="rounded p-1 text-stone-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
          title="수정"
        >
          <Pencil size={14} />
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              {deleting ? "..." : "확인"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-stone-500 hover:bg-stone-100 transition-colors"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main SurveyEditor ───

export default function SurveyEditor({
  survey: initialSurvey,
  questions: initialQuestions,
  submissionCount,
}: Props) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);

  const survey = initialSurvey;
  const questions = initialQuestions;

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleMoveQuestion = async (
    currentIndex: number,
    direction: "up" | "down"
  ) => {
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newQuestions = [...questions];
    const temp = newQuestions[currentIndex];
    newQuestions[currentIndex] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;

    const orderedIds = newQuestions.map((q, idx) => ({
      id: q.id,
      sort_order: idx,
    }));

    try {
      await reorderQuestions(survey.id, orderedIds);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "순서 변경 실패");
    }
  };

  const nextSortOrder =
    questions.length > 0
      ? Math.max(...questions.map((q) => q.sort_order)) + 1
      : 0;

  // Group questions by section
  const sections: Record<string, (Question & { _globalIndex: number })[]> = {};
  questions.forEach((q, idx) => {
    const section = q.section || "기타";
    if (!sections[section]) sections[section] = [];
    sections[section].push({ ...q, _globalIndex: idx });
  });

  return (
    <div>
      {/* Survey Info */}
      <div className="mb-6">
        <SurveyInfoEditor survey={survey} onUpdated={refresh} />
      </div>

      {/* Delete survey */}
      <div className="mb-8">
        <DeleteSurveyButton surveyId={survey.id} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">
            총 문항 수
          </p>
          <p className="text-2xl font-bold text-stone-800">{questions.length}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">
            총 응답 수
          </p>
          <p className="text-2xl font-bold text-teal-600">{submissionCount}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <p className="text-[13px] font-medium text-stone-500 mb-1">섹션 수</p>
          <p className="text-2xl font-bold text-stone-800">
            {Object.keys(sections).length}
          </p>
        </div>
      </div>

      {/* Questions List */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">설문 문항</h2>
            <p className="text-sm text-stone-500 mt-0.5">
              총 {questions.length}개 문항
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Plus size={14} />
            문항 추가
          </button>
        </div>

        {/* Add question form */}
        {showAddForm && (
          <div className="px-5 py-4 border-b border-stone-100">
            <QuestionForm
              surveyId={survey.id}
              nextSortOrder={nextSortOrder}
              onDone={() => {
                setShowAddForm(false);
                refresh();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {questions.length === 0 && !showAddForm ? (
          <div className="p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
                <Plus size={24} />
              </div>
            </div>
            <h3 className="text-sm font-medium text-stone-800 mb-1">
              등록된 문항이 없습니다
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              설문 문항을 추가해 주세요.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
            >
              <Plus size={15} />
              첫 문항 추가
            </button>
          </div>
        ) : (
          <div>
            {Object.entries(sections).map(([sectionName, sectionQuestions]) => (
              <div key={sectionName}>
                <div className="px-5 py-2.5 bg-stone-50/80 border-b border-stone-100">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    {sectionName}
                  </span>
                  <span className="text-xs text-stone-400 ml-2">
                    ({sectionQuestions.length}문항)
                  </span>
                </div>
                {sectionQuestions.map((question) => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    index={question._globalIndex}
                    surveyId={survey.id}
                    isFirst={question._globalIndex === 0}
                    isLast={question._globalIndex === questions.length - 1}
                    onMoveUp={() =>
                      handleMoveQuestion(question._globalIndex, "up")
                    }
                    onMoveDown={() =>
                      handleMoveQuestion(question._globalIndex, "down")
                    }
                    onRefresh={refresh}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI FAB */}
      <AiFab surveyId={survey.id} educationType={survey.education_type || ""} templates={[]} onQuestionsAdded={refresh} />
    </div>
  );
}
