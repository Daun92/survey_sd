"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
} from "lucide-react";
import {
  addSessionToCourse,
  updateSession,
  deleteSession,
  createCourse,
  updateCourse,
  deleteCourse,
} from "./actions";

interface Session {
  id: string;
  session_number: number;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  status: string;
  survey_count?: number;
}

interface Course {
  id: string;
  name: string;
  education_type: string | null;
  sessions: Session[];
}

interface Props {
  projectId: string;
  courses: Course[];
  sessionSurveyCounts: Record<string, number>; // session_id → survey count
}

const eduTypeLabels: Record<string, string> = {
  classroom: "집합",
  online: "온라인",
  remote: "원격",
  blended: "블렌디드",
};

const statusLabels: Record<string, { label: string; className: string }> = {
  scheduled: { label: "예정", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "완료", className: "bg-rose-100 text-rose-800" },
  cancelled: { label: "취소", className: "bg-red-100 text-red-800" },
};

export function SessionManager({ projectId, courses, sessionSurveyCounts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ─── Add Session ───
  const [addingSessionFor, setAddingSessionFor] = useState<string | null>(null);
  const [newSession, setNewSession] = useState({ name: "", start_date: "", end_date: "", capacity: "" });

  // ─── Edit Session ───
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", start_date: "", end_date: "", capacity: "", status: "" });

  // ─── Add Course ───
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: "", education_type: "classroom" });

  // ─── Edit Course ───
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [editCourseData, setEditCourseData] = useState({ name: "", education_type: "" });

  function handleAddSession(courseId: string) {
    startTransition(async () => {
      await addSessionToCourse(courseId, projectId, {
        name: newSession.name || undefined,
        start_date: newSession.start_date || undefined,
        end_date: newSession.end_date || undefined,
        capacity: newSession.capacity ? parseInt(newSession.capacity) : undefined,
      });
      setAddingSessionFor(null);
      setNewSession({ name: "", start_date: "", end_date: "", capacity: "" });
      router.refresh();
    });
  }

  function handleUpdateSession(sessionId: string) {
    startTransition(async () => {
      await updateSession(sessionId, projectId, {
        name: editData.name,
        start_date: editData.start_date || null,
        end_date: editData.end_date || null,
        capacity: editData.capacity ? parseInt(editData.capacity) : 0,
        status: editData.status,
      });
      setEditingSession(null);
      router.refresh();
    });
  }

  function handleDeleteSession(sessionId: string) {
    if (!confirm("이 세션을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      try {
        await deleteSession(sessionId, projectId);
        router.refresh();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  function handleAddCourse() {
    if (!newCourse.name.trim()) return;
    startTransition(async () => {
      await createCourse(projectId, {
        name: newCourse.name,
        education_type: newCourse.education_type,
      });
      setShowAddCourse(false);
      setNewCourse({ name: "", education_type: "classroom" });
      router.refresh();
    });
  }

  function handleUpdateCourse(courseId: string) {
    startTransition(async () => {
      await updateCourse(courseId, projectId, {
        name: editCourseData.name,
        education_type: editCourseData.education_type,
      });
      setEditingCourse(null);
      router.refresh();
    });
  }

  function handleDeleteCourse(courseId: string) {
    if (!confirm("이 과정을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      try {
        await deleteCourse(courseId, projectId);
        router.refresh();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "삭제 실패");
      }
    });
  }

  function startEditSession(session: Session) {
    setEditingSession(session.id);
    setEditData({
      name: session.name || "",
      start_date: session.start_date || "",
      end_date: session.end_date || "",
      capacity: session.capacity?.toString() || "",
      status: session.status || "scheduled",
    });
  }

  function startEditCourse(course: Course) {
    setEditingCourse(course.id);
    setEditCourseData({
      name: course.name,
      education_type: course.education_type || "classroom",
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-8">
      <div className="p-5 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-stone-900">과정 및 세션</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            총 {courses.length}개 과정,{" "}
            {courses.reduce((sum, c) => sum + (c.sessions?.length || 0), 0)}개 세션
          </p>
        </div>
      </div>

      {courses.length === 0 && !showAddCourse ? (
        <div className="p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              <BookOpen size={24} />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">등록된 과정이 없습니다</h3>
          <p className="text-sm text-stone-500 mb-4">과정을 추가하여 세션을 관리하세요.</p>
          <button
            onClick={() => setShowAddCourse(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Plus size={13} />
            과정 추가
          </button>
        </div>
      ) : (
        <div>
          {courses.map((course) => {
            const sessions = Array.isArray(course.sessions)
              ? [...course.sessions].sort((a, b) => a.session_number - b.session_number)
              : [];
            const isEditingThisCourse = editingCourse === course.id;

            return (
              <div key={course.id}>
                {/* Course Header */}
                <div className="px-5 py-2.5 bg-stone-50/80 border-b border-stone-100">
                  {isEditingThisCourse ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs"
                        value={editCourseData.name}
                        onChange={(e) => setEditCourseData({ ...editCourseData, name: e.target.value })}
                      />
                      <select
                        className="rounded border border-stone-300 px-2 py-1 text-xs"
                        value={editCourseData.education_type}
                        onChange={(e) => setEditCourseData({ ...editCourseData, education_type: e.target.value })}
                      >
                        <option value="classroom">집합</option>
                        <option value="online">온라인</option>
                        <option value="remote">원격</option>
                        <option value="blended">블렌디드</option>
                      </select>
                      <button
                        onClick={() => handleUpdateCourse(course.id)}
                        disabled={isPending}
                        className="p-1 text-teal-600 hover:text-teal-800"
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingCourse(null)} className="p-1 text-stone-400 hover:text-stone-600">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-teal-600" />
                      <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                        {course.name}
                      </span>
                      <span className="text-xs text-stone-400 ml-1">({sessions.length}세션)</span>
                      {course.education_type && (
                        <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                          {eduTypeLabels[course.education_type] || course.education_type}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => startEditCourse(course)}
                          className="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                          title="과정 수정"
                        >
                          <Pencil size={12} />
                        </button>
                        {sessions.length === 0 && (
                          <button
                            onClick={() => handleDeleteCourse(course.id)}
                            disabled={isPending}
                            className="p-1 text-stone-300 hover:text-red-500 transition-colors"
                            title="과정 삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Session Rows */}
                {sessions.map((session) => {
                  const sStatus = statusLabels[session.status] ?? statusLabels.scheduled;
                  const surveyCount = sessionSurveyCounts[session.id] || 0;
                  const isEditing = editingSession === session.id;

                  return isEditing ? (
                    <div key={session.id} className="px-5 py-3 border-b border-stone-100 bg-amber-50/30">
                      <div className="grid grid-cols-[3rem_1fr_1fr_1fr_5rem_6rem_auto] gap-2 items-center text-xs">
                        <span className="font-mono text-stone-400">#{session.session_number}</span>
                        <input
                          className="rounded border border-stone-300 px-2 py-1"
                          placeholder="세션명"
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                        <input
                          type="date"
                          className="rounded border border-stone-300 px-2 py-1"
                          value={editData.start_date}
                          onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
                        />
                        <input
                          type="date"
                          className="rounded border border-stone-300 px-2 py-1"
                          value={editData.end_date}
                          onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
                        />
                        <input
                          type="number"
                          className="rounded border border-stone-300 px-2 py-1"
                          placeholder="정원"
                          value={editData.capacity}
                          onChange={(e) => setEditData({ ...editData, capacity: e.target.value })}
                        />
                        <select
                          className="rounded border border-stone-300 px-2 py-1"
                          value={editData.status}
                          onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                        >
                          <option value="scheduled">예정</option>
                          <option value="in_progress">진행중</option>
                          <option value="completed">완료</option>
                          <option value="cancelled">취소</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateSession(session.id)}
                            disabled={isPending}
                            className="p-1 text-teal-600 hover:text-teal-800"
                          >
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingSession(null)} className="p-1 text-stone-400 hover:text-stone-600">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={session.id}
                      className="flex items-center gap-4 px-5 py-3 border-b border-stone-100 last:border-0 group"
                    >
                      <span className="text-xs font-mono text-stone-400 shrink-0 w-12">
                        #{session.session_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800">
                          {session.name || `세션 ${session.session_number}`}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-stone-400">
                            {formatDate(session.start_date)} ~ {formatDate(session.end_date)}
                          </span>
                          {session.capacity ? (
                            <span className="flex items-center gap-1 text-xs text-stone-400">
                              <Users size={11} />
                              {session.capacity}명
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${sStatus.className}`}>
                        {sStatus.label}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditSession(session)}
                          className="p-1 text-stone-400 hover:text-stone-600"
                          title="세션 수정"
                        >
                          <Pencil size={13} />
                        </button>
                        {surveyCount === 0 ? (
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={isPending}
                            className="p-1 text-stone-300 hover:text-red-500"
                            title="세션 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span className="p-1 text-stone-200 cursor-not-allowed" title={`설문 ${surveyCount}개 연결됨`}>
                            <Trash2 size={13} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add Session Inline Form */}
                {addingSessionFor === course.id ? (
                  <div className="px-5 py-3 border-b border-stone-100 bg-teal-50/30">
                    <div className="grid grid-cols-[1fr_1fr_1fr_5rem_auto] gap-2 items-center text-xs">
                      <input
                        className="rounded border border-stone-300 px-2 py-1.5"
                        placeholder="세션명 (자동: N차수)"
                        value={newSession.name}
                        onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                      />
                      <input
                        type="date"
                        className="rounded border border-stone-300 px-2 py-1.5"
                        value={newSession.start_date}
                        onChange={(e) => setNewSession({ ...newSession, start_date: e.target.value })}
                      />
                      <input
                        type="date"
                        className="rounded border border-stone-300 px-2 py-1.5"
                        value={newSession.end_date}
                        onChange={(e) => setNewSession({ ...newSession, end_date: e.target.value })}
                      />
                      <input
                        type="number"
                        className="rounded border border-stone-300 px-2 py-1.5"
                        placeholder="정원"
                        value={newSession.capacity}
                        onChange={(e) => setNewSession({ ...newSession, capacity: e.target.value })}
                      />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAddSession(course.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                        >
                          <Check size={12} />
                          추가
                        </button>
                        <button
                          onClick={() => {
                            setAddingSessionFor(null);
                            setNewSession({ name: "", start_date: "", end_date: "", capacity: "" });
                          }}
                          className="p-1.5 text-stone-400 hover:text-stone-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-2 border-b border-stone-100">
                    <button
                      onClick={() => setAddingSessionFor(course.id)}
                      className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium transition-colors"
                    >
                      <Plus size={12} />
                      세션 추가
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Course */}
          {showAddCourse ? (
            <div className="px-5 py-3 bg-teal-50/30">
              <div className="flex items-center gap-2 text-xs">
                <input
                  className="flex-1 rounded border border-stone-300 px-2 py-1.5"
                  placeholder="과정명"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                />
                <select
                  className="rounded border border-stone-300 px-2 py-1.5"
                  value={newCourse.education_type}
                  onChange={(e) => setNewCourse({ ...newCourse, education_type: e.target.value })}
                >
                  <option value="classroom">집합</option>
                  <option value="online">온라인</option>
                  <option value="remote">원격</option>
                  <option value="blended">블렌디드</option>
                </select>
                <button
                  onClick={handleAddCourse}
                  disabled={isPending || !newCourse.name.trim()}
                  className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  <Check size={12} />
                  추가
                </button>
                <button
                  onClick={() => {
                    setShowAddCourse(false);
                    setNewCourse({ name: "", education_type: "classroom" });
                  }}
                  className="p-1.5 text-stone-400 hover:text-stone-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-3">
              <button
                onClick={() => setShowAddCourse(true)}
                className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-teal-600 font-medium transition-colors"
              >
                <Plus size={13} />
                과정 추가
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
