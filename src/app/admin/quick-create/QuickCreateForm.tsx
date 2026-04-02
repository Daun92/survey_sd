"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { quickCreateSurvey, getProjectSessions, type QuickCreateResult, type QuickCreateResponse } from "./actions";
import Link from "next/link";
import {
  Loader2,
  Search,
  CheckCircle2,
  ExternalLink,
  Plus,
  FileText,
  Calendar,
  ListChecks,
  X,
  Eye,
} from "lucide-react";
import {
  DIVISION_LABELS,
  QUESTION_TYPE_LABELS,
  type CsDivision,
  type CsQuestionType,
} from "@/types/cs-survey";

// ── Types ──

interface Project {
  id: string;
  name: string;
  customerName: string | null;
}

interface Customer {
  id: number;
  company_name: string;
}

interface TemplateQuestion {
  id: string;
  questionNo: string;
  questionText: string;
  questionType: string;
  pageType: string;
  responseOptions: string | null;
  sectionLabel: string | null;
}

interface Template {
  id: string;
  name: string;
  division: string;
  division_label: string;
  questionCount: number;
  questions: TemplateQuestion[];
}

interface Props {
  projects: Project[];
  customers: Customer[];
  templates: Template[];
}

// ── Constants ──

const DIVISIONS: { value: CsDivision; label: string }[] = Object.entries(
  DIVISION_LABELS
).map(([value, label]) => ({ value: value as CsDivision, label }));

const questionTypeLabels: Record<string, string> = {
  ...QUESTION_TYPE_LABELS,
  multiple_choice: "복수선택",
  rating: "평점",
  yes_no: "예/아니오",
};

// ── Component ──

export function QuickCreateForm({ projects, customers, templates }: Props) {
  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [educationType, setEducationType] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickCreateResult | null>(null);

  // Project selector state
  const [projectMode, setProjectMode] = useState<"select" | "create">("select");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  // Customer selector for new project
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Session selector (기존 프로젝트 선택 시)
  type CourseWithSessions = { id: string; name: string; education_type: string | null; sessions: { id: string; session_number: number; name: string | null; start_date: string | null; end_date: string | null }[] };
  const [sessionMode, setSessionMode] = useState<"create" | "select">("create");
  const [projectSessions, setProjectSessions] = useState<CourseWithSessions[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Schedule
  const [separateDistributeDate, setSeparateDistributeDate] = useState(false);

  // Template preview
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(
    null
  );

  // Filtered lists
  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects;
    const q = projectSearch.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.customerName && p.customerName.toLowerCase().includes(q))
    );
  }, [projects, projectSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => c.company_name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  // Recommended templates based on education type
  const sortedTemplates = useMemo(() => {
    if (!educationType) return templates;
    return [...templates].sort((a, b) => {
      const aMatch = a.division === educationType ? -1 : 0;
      const bMatch = b.division === educationType ? -1 : 0;
      return aMatch - bMatch;
    });
  }, [templates, educationType]);

  // 프로젝트 선택 시 세션 목록 로드
  useEffect(() => {
    if (selectedProject && projectMode === "select") {
      setLoadingSessions(true);
      getProjectSessions(selectedProject.id)
        .then((data) => setProjectSessions(data))
        .catch(() => setProjectSessions([]))
        .finally(() => setLoadingSessions(false));
    } else {
      setProjectSessions([]);
      setSessionMode("create");
      setSelectedSessionId("");
    }
  }, [selectedProject, projectMode]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(e.target as Node)
      ) {
        setShowProjectDropdown(false);
      }
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const res = await quickCreateSurvey(formData);
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "생성 중 오류가 발생했습니다."
      );
    } finally {
      setPending(false);
    }
  }

  // ── Success Screen ──
  if (result) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50">
              <CheckCircle2 size={28} className="text-teal-600" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-stone-800 mb-1">
            설문이 생성되었습니다
          </h2>
          <p className="text-sm text-stone-500">
            모든 항목이 성공적으로 생성되었습니다
          </p>
        </div>

        <div className="rounded-lg bg-stone-50 p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">설문 제목</span>
            <span className="font-medium text-stone-800">
              {result.surveyTitle}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">프로젝트</span>
            <span className="font-medium text-stone-800">
              {result.projectName}
            </span>
          </div>
          {result.customerName && (
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">고객사</span>
              <span className="font-medium text-stone-800">
                {result.customerName}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">복사된 문항</span>
            <span className="font-medium text-teal-600">
              {result.questionCount}개
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Link
            href={`/admin/surveys/${result.surveyId}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <ExternalLink size={15} />
            설문 상세 보기
          </Link>
          <Link
            href="/admin/surveys"
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            설문 목록으로
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setSelectedTemplate("");
              setSelectedProject(null);
              setProjectSearch("");
              setProjectMode("select");
              setEducationType("");
              setCustomerSearch("");
              setSelectedCustomerName("");
              setSeparateDistributeDate(false);
            }}
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <Plus size={15} />
            새로 만들기
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <form action={handleSubmit}>
      <div className="space-y-6">
        {/* ── Section 1: 설문 정보 ── */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-stone-800">
              설문 정보
            </h2>
          </div>

          <div className="space-y-4">
            {/* 설문 제목 */}
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                설문 제목 <span className="text-red-400">*</span>
              </label>
              <input
                name="surveyTitle"
                type="text"
                required
                placeholder="예: 2026년 상반기 리더십 교육 만족도 조사"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
            </div>

            {/* 프로젝트 선택/생성 */}
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                프로젝트 <span className="text-red-400">*</span>
              </label>

              {projectMode === "select" ? (
                <div ref={projectDropdownRef} className="relative">
                  {selectedProject ? (
                    <div className="flex items-center justify-between rounded-lg border border-teal-400 bg-teal-50/30 px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-stone-800">
                          {selectedProject.name}
                        </span>
                        {selectedProject.customerName && (
                          <span className="text-xs text-stone-400 ml-2">
                            ({selectedProject.customerName})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProject(null);
                          setProjectSearch("");
                        }}
                        className="text-stone-400 hover:text-stone-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                        />
                        <input
                          type="text"
                          value={projectSearch}
                          onChange={(e) => {
                            setProjectSearch(e.target.value);
                            setShowProjectDropdown(true);
                          }}
                          onFocus={() => setShowProjectDropdown(true)}
                          placeholder={`프로젝트 검색 (${projects.length}개)`}
                          className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                        />
                      </div>

                      {showProjectDropdown && (
                        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setProjectMode("create");
                              setShowProjectDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors flex items-center gap-2 text-teal-600 border-b border-stone-200"
                          >
                            <Plus size={14} />
                            <span className="text-sm font-medium">
                              새 프로젝트 만들기
                            </span>
                          </button>
                          {filteredProjects.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedProject(p);
                                setProjectSearch("");
                                setShowProjectDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors border-b border-stone-100 last:border-0"
                            >
                              <div className="text-sm font-medium text-stone-800">
                                {p.name}
                              </div>
                              {p.customerName && (
                                <div className="text-xs text-stone-400">
                                  {p.customerName}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Hidden fields */}
                  <input
                    type="hidden"
                    name="projectId"
                    value={selectedProject?.id ?? ""}
                  />
                </div>
              ) : (
                /* ── 새 프로젝트 인라인 생성 ── */
                <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-teal-700">
                      새 프로젝트
                    </span>
                    <button
                      type="button"
                      onClick={() => setProjectMode("select")}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      취소
                    </button>
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-stone-600 mb-1">
                      프로젝트명 <span className="text-red-400">*</span>
                    </label>
                    <input
                      name="newProjectName"
                      type="text"
                      required={projectMode === "create"}
                      placeholder="예: 2026년 상반기 리더십 교육"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <div ref={customerDropdownRef} className="relative">
                    <label className="block text-[13px] font-medium text-stone-600 mb-1">
                      고객사 <span className="text-red-400">*</span>
                    </label>
                    {selectedCustomerName ? (
                      <div className="flex items-center justify-between rounded-lg border border-teal-400 bg-white px-3 py-2">
                        <span className="text-sm font-medium text-stone-800">
                          {selectedCustomerName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerName("");
                            setCustomerSearch("");
                          }}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                          />
                          <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => {
                              setCustomerSearch(e.target.value);
                              setShowCustomerDropdown(true);
                            }}
                            onFocus={() => setShowCustomerDropdown(true)}
                            placeholder="고객사 검색 또는 새 이름 입력"
                            className="w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                          />
                        </div>
                        {showCustomerDropdown && (
                          <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                            {filteredCustomers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomerName(c.company_name);
                                  setCustomerSearch("");
                                  setShowCustomerDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-teal-50 transition-colors"
                              >
                                {c.company_name}
                              </button>
                            ))}
                            {customerSearch &&
                              !customers.some(
                                (c) =>
                                  c.company_name.toLowerCase() ===
                                  customerSearch.toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerName(customerSearch);
                                    setCustomerSearch("");
                                    setShowCustomerDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 transition-colors flex items-center gap-1.5"
                                >
                                  <Plus size={13} />
                                  &quot;{customerSearch}&quot; 새로 등록
                                </button>
                              )}
                          </div>
                        )}
                      </>
                    )}
                    <input
                      type="hidden"
                      name="customerName"
                      value={selectedCustomerName}
                    />
                    <input type="hidden" name="projectId" value="" />
                  </div>
                </div>
              )}
            </div>

            {/* 과정구분 */}
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1.5">
                과정구분
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {DIVISIONS.map((d) => (
                  <label
                    key={d.value}
                    className={`flex items-center justify-center rounded-lg border px-2 py-2 cursor-pointer text-xs font-medium transition-colors ${
                      educationType === d.value
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-stone-200 text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="educationType"
                      value={d.value}
                      checked={educationType === d.value}
                      onChange={() => setEducationType(d.value)}
                      className="sr-only"
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Session Selector (기존 프로젝트 선택 시) ── */}
        {selectedProject && projectSessions.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks size={16} className="text-teal-600" />
              <h2 className="text-sm font-semibold text-stone-800">세션 선택</h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="_sessionMode"
                    checked={sessionMode === "create"}
                    onChange={() => { setSessionMode("create"); setSelectedSessionId(""); }}
                    className="text-teal-600"
                  />
                  새 세션 자동 생성
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="_sessionMode"
                    checked={sessionMode === "select"}
                    onChange={() => setSessionMode("select")}
                    className="text-teal-600"
                  />
                  기존 세션에 설문 추가
                </label>
              </div>

              {sessionMode === "select" && (
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  {loadingSessions ? (
                    <div className="p-4 text-center text-sm text-stone-400">로딩 중...</div>
                  ) : (
                    projectSessions.map((course) => (
                      <div key={course.id}>
                        <div className="px-3 py-1.5 bg-stone-50 text-xs font-medium text-stone-500 border-b border-stone-100">
                          {course.name}
                          {course.education_type && (
                            <span className="ml-1.5 text-teal-600">
                              ({course.education_type === "classroom" ? "집합" : course.education_type === "remote" ? "원격" : course.education_type})
                            </span>
                          )}
                        </div>
                        {(Array.isArray(course.sessions) ? course.sessions : [])
                          .sort((a: { session_number: number }, b: { session_number: number }) => a.session_number - b.session_number)
                          .map((s: { id: string; session_number: number; name: string | null; start_date: string | null; end_date: string | null }) => (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer border-b border-stone-50 last:border-0 hover:bg-teal-50/50 transition-colors ${selectedSessionId === s.id ? "bg-teal-50" : ""}`}
                          >
                            <input
                              type="radio"
                              name="_sessionSelect"
                              checked={selectedSessionId === s.id}
                              onChange={() => setSelectedSessionId(s.id)}
                              className="text-teal-600"
                            />
                            <span className="font-mono text-xs text-stone-400">#{s.session_number}</span>
                            <span className="text-stone-700">{s.name || `${s.session_number}차수`}</span>
                            {s.start_date && (
                              <span className="text-xs text-stone-400 ml-auto">
                                {s.start_date} ~ {s.end_date || ""}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <input type="hidden" name="sessionId" value={sessionMode === "select" ? selectedSessionId : ""} />
          </div>
        )}

        {/* ── Section 2: 일정 ── */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-stone-800">일정</h2>
          </div>

          <div className="space-y-4">
            {/* 교육 기간 */}
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-0.5">
                교육 기간 <span className="text-red-400">*</span>
              </label>
              <p className="text-xs text-stone-400 mb-2">
                교육이 진행되는 시작일과 종료일
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">시작일</label>
                  <input
                    name="startDate"
                    type="date"
                    required
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">종료일</label>
                  <input
                    name="endDate"
                    type="date"
                    required
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-stone-100" />

            {/* 설문 배포 */}
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-0.5">
                설문 배포
              </label>
              <p className="text-xs text-stone-400 mb-2">
                기본적으로 교육 종료일에 설문이 자동 활성화됩니다
              </p>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={separateDistributeDate}
                  onChange={(e) => setSeparateDistributeDate(e.target.checked)}
                  className="accent-teal-600 rounded"
                />
                <span className="text-[13px] text-stone-600">
                  배포일을 별도로 지정
                </span>
              </label>

              {separateDistributeDate && (
                <div className="mt-2">
                  <label className="block text-[11px] text-stone-400 mb-1">배포 예정일</label>
                  <input
                    name="distributeDate"
                    type="date"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>
              )}

              <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2.5 text-xs text-teal-700 space-y-1">
                <p className="font-medium">자동 설문 관리</p>
                <p>• 배포 시작일(또는 배포 예정일)이 되면 설문이 자동으로 오픈됩니다</p>
                <p>• 종료일이 지나면 설문이 자동으로 마감됩니다</p>
                <p className="text-teal-600/70">설문 관리 페이지에서 수동 오픈/마감도 가능합니다</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: 템플릿 선택 ── */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks size={16} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-stone-800">
              템플릿 선택
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* 빈 설문 */}
            <label
              className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                selectedTemplate === "__none__"
                  ? "border-teal-500 bg-teal-50/50"
                  : "border-stone-200 hover:border-stone-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="templateId"
                  value=""
                  checked={selectedTemplate === "__none__"}
                  onChange={() => setSelectedTemplate("__none__")}
                  className="accent-teal-600"
                />
                <div>
                  <span className="text-sm font-medium text-stone-800">
                    빈 설문으로 시작
                  </span>
                  <p className="text-xs text-stone-400">
                    직접 문항을 구성합니다
                  </p>
                </div>
              </div>
            </label>

            {/* 템플릿 목록 */}
            {sortedTemplates.map((t) => {
              const isRecommended =
                educationType && t.division === educationType;
              const isSelected = selectedTemplate === t.id;
              const isPreviewing = previewTemplateId === t.id;

              return (
                <div key={t.id}>
                  <label
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-teal-500 bg-teal-50/50"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="templateId"
                        value={t.id}
                        checked={isSelected}
                        onChange={() => setSelectedTemplate(t.id)}
                        className="accent-teal-600"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-800">
                            {t.name}
                          </span>
                          {isRecommended && (
                            <span className="inline-flex items-center rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                              추천
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-stone-400">
                          {t.division_label} · {t.questionCount}문항
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setPreviewTemplateId(t.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-teal-600 transition-colors px-2 py-1 rounded"
                    >
                      <Eye size={13} />
                      미리보기
                    </button>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={
            pending ||
            !selectedTemplate ||
            (projectMode === "select" && !selectedProject) ||
            (projectMode === "create" && !selectedCustomerName)
          }
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              생성 중...
            </>
          ) : (
            "설문 생성하기"
          )}
        </button>
      </div>

      {/* ── Template Preview Modal ── */}
      {previewTemplateId && (
        <TemplatePreviewModal
          template={templates.find((t) => t.id === previewTemplateId)!}
          onClose={() => setPreviewTemplateId(null)}
        />
      )}
    </form>
  );
}

// ── Template Preview Modal ──

const likertLabels: Record<number, string> = {
  5: "매우 만족",
  4: "만족",
  3: "보통",
  2: "불만족",
  1: "매우 불만족",
};

function TemplatePreviewModal({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  if (!template) return null;

  // Group questions into sections by sectionLabel
  const sections: { name: string; questions: TemplateQuestion[] }[] = [];
  const sectionMap = new Map<string, TemplateQuestion[]>();
  template.questions.forEach((q) => {
    const section = q.sectionLabel || "일반";
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    sectionMap.get(section)!.push(q);
  });
  for (const [name, questions] of sectionMap) {
    sections.push({ name, questions });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] max-h-[90vh] rounded-3xl shadow-2xl border border-stone-300 overflow-hidden bg-stone-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Phone Frame Header ── */}
        <div className="bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-[10px] font-bold text-white">
                E
              </div>
              <span className="text-[15px] font-semibold text-stone-800 truncate">
                {template.name}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
            >
              <X size={16} className="text-stone-500" />
            </button>
          </div>
          <div className="h-[3px] bg-stone-100">
            <div className="h-full bg-teal-500 w-full rounded-r-full" />
          </div>
        </div>

        {/* ── Questions (respondent view) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {sections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="space-y-5">
              {sections.length > 1 && (
                <div className="flex items-center gap-2 pb-1">
                  <span className="text-[13px] font-semibold text-teal-600">
                    {sectionIdx + 1}/{sections.length}
                  </span>
                  <span className="text-[15px] font-semibold text-stone-800">
                    {section.name}
                  </span>
                </div>
              )}
              {section.questions.map((q, qIdx) => (
                <div key={q.id} className="space-y-3">
                  <p className="text-[15px] text-stone-800 leading-relaxed">
                    <span className="text-[13px] font-semibold text-teal-600 mr-2">
                      {String(qIdx + 1).padStart(2, "0")}
                    </span>
                    {q.questionText}
                    <span className="text-rose-400 ml-1">*</span>
                  </p>

                  {/* Likert Scale */}
                  {(q.questionType === "likert_5" ||
                    q.questionType === "likert_6") && (
                    <div className="space-y-1">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <div
                            key={value}
                            className="flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-medium border-[1.5px] bg-white text-stone-500 border-stone-200"
                          >
                            {value}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <span key={value} className="flex-1 text-center text-[9px] text-stone-400 leading-tight">
                            {value === 1 || value === 3 || value === 5 ? (likertLabels[value] ?? "") : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Single Choice */}
                  {(q.questionType === "single_choice" ||
                    q.questionType === "multiple_choice") &&
                    q.responseOptions && (
                      <div className="space-y-1.5">
                        {q.responseOptions.split("/").map((opt, i) => (
                          <div
                            key={i}
                            className="w-full min-h-[44px] flex items-center px-4 rounded-xl border-[1.5px] border-stone-200 bg-white text-sm text-stone-500"
                          >
                            {opt.trim()}
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Text */}
                  {q.questionType === "text" && (
                    <div className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-400">
                      의견을 입력해 주세요...
                    </div>
                  )}

                  {qIdx < section.questions.length - 1 && (
                    <div className="h-px bg-stone-100" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Bottom Bar ── */}
        <div className="bg-white border-t border-stone-100 sticky bottom-0">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-xs text-stone-400">
              {template.questionCount}문항 미리보기
            </span>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 bg-teal-600 text-white font-semibold text-sm rounded-xl transition-colors hover:bg-teal-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
