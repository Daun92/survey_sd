"use client";

import { useState } from "react";
import { updateProject, deleteProject } from "./actions";
import { Pencil, Trash2, Loader2, X, Check } from "lucide-react";

interface Project {
  id: string;
  name: string;
  bris_code: string | null;
  project_type: string;
  status: string;
  am_name: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

interface Props {
  project: Project;
}

const statusOptions = [
  { value: "active", label: "진행중" },
  { value: "completed", label: "완료" },
  { value: "draft", label: "준비중" },
];

const projectTypeOptions = [
  { value: "education", label: "교육" },
  { value: "consulting", label: "컨설팅" },
  { value: "other", label: "기타" },
];

export function ProjectActions({ project }: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await updateProject(project.id, formData);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      await deleteProject(project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
      setPending(false);
    }
  }

  // Delete confirmation dialog
  if (deleting) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-red-800 mb-2">
          프로젝트를 삭제하시겠습니까?
        </h3>
        <p className="text-sm text-red-600 mb-4">
          <strong>{project.name}</strong> 프로젝트가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        {error && (
          <div className="rounded-lg bg-red-100 border border-red-300 px-4 py-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                삭제 중...
              </>
            ) : (
              <>
                <Trash2 size={14} />
                삭제
              </>
            )}
          </button>
          <button
            onClick={() => {
              setDeleting(false);
              setError(null);
            }}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  // Edit form
  if (editing) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-stone-900">프로젝트 수정</h3>
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            <X size={14} />
            취소
          </button>
        </div>

        <form action={handleUpdate}>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                프로젝트명 <span className="text-red-400">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                defaultValue={project.name}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  BRIS 코드
                </label>
                <input
                  name="bris_code"
                  type="text"
                  defaultValue={project.bris_code ?? ""}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  AM 담당자
                </label>
                <input
                  name="am_name"
                  type="text"
                  defaultValue={project.am_name ?? ""}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  프로젝트 유형
                </label>
                <select
                  name="project_type"
                  defaultValue={project.project_type}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                >
                  {projectTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  상태
                </label>
                <select
                  name="status"
                  defaultValue={project.status}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  시작일
                </label>
                <input
                  name="start_date"
                  type="date"
                  defaultValue={project.start_date ?? ""}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  종료일
                </label>
                <input
                  name="end_date"
                  type="date"
                  defaultValue={project.end_date ?? ""}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                메모
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={project.notes ?? ""}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mt-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-5">
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check size={14} />
                  저장
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Action buttons (default view)
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
      >
        <Pencil size={14} />
        수정
      </button>
      <button
        onClick={() => setDeleting(true)}
        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
        삭제
      </button>
    </div>
  );
}
