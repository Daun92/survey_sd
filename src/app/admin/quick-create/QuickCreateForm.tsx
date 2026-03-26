"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { quickCreateSurvey, type QuickCreateResult } from "./actions";
import Link from "next/link";
import {
  Loader2,
  Search,
  CheckCircle2,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  ListChecks,
  X,
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
      setResult(res);
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
                          <button
                            type="button"
                            onClick={() => {
                              setProjectMode("create");
                              setShowProjectDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-stone-50 transition-colors flex items-center gap-2 text-teal-600"
                          >
                            <Plus size={14} />
                            <span className="text-sm font-medium">
                              새 프로젝트 만들기
                            </span>
                          </button>
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

        {/* ── Section 2: 일정 ── */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-stone-800">일정</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                설문 예정일 <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="startDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
                <input
                  name="endDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                배포 예정일
              </label>
              <input
                name="distributeDate"
                type="date"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
              <p className="text-xs text-stone-400 mt-1">
                배포일 이전에는 초안 상태로 유지됩니다. 비워두면 바로
                활성화됩니다.
              </p>
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
                        setPreviewTemplateId(isPreviewing ? null : t.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-teal-600 transition-colors px-2 py-1 rounded"
                    >
                      미리보기
                      {isPreviewing ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                    </button>
                  </label>

                  {/* ── 템플릿 프리뷰 ── */}
                  {isPreviewing && (
                    <TemplatePreview questions={t.questions} />
                  )}
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
    </form>
  );
}

// ── Template Preview Sub-component ──

function TemplatePreview({ questions }: { questions: TemplateQuestion[] }) {
  // Group by page type
  const pages: Record<string, TemplateQuestion[]> = {};
  questions.forEach((q) => {
    const page = q.pageType || "기타";
    if (!pages[page]) pages[page] = [];
    pages[page].push(q);
  });

  return (
    <div className="mt-1 mb-2 rounded-lg border border-stone-200 bg-stone-50 overflow-hidden">
      {Object.entries(pages).map(([pageName, pageQuestions]) => (
        <div key={pageName}>
          <div className="px-4 py-1.5 bg-stone-100 border-b border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">
              {pageName}
            </span>
            <span className="text-[11px] text-stone-400 ml-1.5">
              ({pageQuestions.length}문항)
            </span>
          </div>
          {pageQuestions.map((q) => (
            <div
              key={q.id}
              className="flex items-start gap-3 px-4 py-2 border-b border-stone-100 last:border-0"
            >
              <span className="text-[11px] font-mono text-stone-400 mt-0.5 shrink-0 w-10">
                {q.questionNo}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stone-700 leading-relaxed">
                  {q.questionText}
                </p>
                {q.responseOptions && (
                  <p className="text-[11px] text-stone-400 mt-0.5 truncate">
                    {q.responseOptions}
                  </p>
                )}
              </div>
              <span className="inline-flex items-center rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 shrink-0">
                {questionTypeLabels[q.questionType] ?? q.questionType}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
