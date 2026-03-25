"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { quickCreateSurvey, type QuickCreateResult } from "./actions";
import Link from "next/link";
import {
  ListChecks,
  Building2,
  Loader2,
  Search,
  CheckCircle2,
  ExternalLink,
  QrCode,
  Plus,
} from "lucide-react";

interface Customer {
  id: number;
  company_name: string;
}

interface Template {
  id: string;
  name: string;
  division_label: string;
  questionCount: number;
}

interface ServiceType {
  id: number;
  name: string;
}

interface Props {
  customers: Customer[];
  templates: Template[];
  serviceTypes: ServiceType[];
}

export function QuickCreateForm({ customers, templates, serviceTypes }: Props) {
  const [isNew, setIsNew] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickCreateResult | null>(null);

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => c.company_name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const template = templates.find((t) => t.id === selectedTemplate);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const res = await quickCreateSurvey(formData);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setPending(false);
    }
  }

  // Success screen
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
            <span className="text-stone-500">고객사</span>
            <span className="font-medium text-stone-800">{result.customerName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">프로젝트</span>
            <span className="font-medium text-stone-800">{result.projectName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">설문 제목</span>
            <span className="font-medium text-stone-800">{result.projectName} 만족도 조사</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">복사된 문항</span>
            <span className="font-medium text-teal-600">{result.questionCount}개</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">설문 URL 토큰</span>
            <span className="font-mono text-xs text-stone-600">{result.urlToken}</span>
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
            href="/admin/distribute"
            className="flex items-center justify-center gap-2 rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <QrCode size={15} />
            QR 배포 페이지
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setSelectedCustomer("");
              setCustomerSearch("");
              setSelectedTemplate("");
              setIsNew(false);
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

  return (
    <form action={handleSubmit}>
      <div className="space-y-6">
        {/* Customer Section */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-800">고객사 정보</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="radio"
                  name="customerMode"
                  checked={!isNew}
                  onChange={() => setIsNew(false)}
                  className="accent-teal-600"
                />
                기존 고객사
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input
                  type="radio"
                  name="customerMode"
                  checked={isNew}
                  onChange={() => setIsNew(true)}
                  className="accent-teal-600"
                />
                신규 고객사
              </label>
            </div>

            {isNew ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[13px] font-medium text-stone-600 mb-1">
                    고객사명 <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="customerName"
                    type="text"
                    required
                    placeholder="고객사명을 입력하세요"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-stone-600 mb-1">
                    서비스 유형 <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {serviceTypes.map((st, idx) => (
                      <label
                        key={st.id}
                        className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 cursor-pointer hover:border-stone-300 has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50/50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="serviceTypeId"
                          value={st.id}
                          required
                          defaultChecked={idx === 0}
                          className="accent-teal-600"
                        />
                        <span className="text-sm text-stone-700">{st.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div ref={dropdownRef} className="relative">
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  고객사 검색 <span className="text-red-400">*</span>
                </label>
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
                      setShowDropdown(true);
                      if (selectedCustomer) setSelectedCustomer("");
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder={`고객사명 검색 (총 ${customers.length}개)`}
                    className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* Selected indicator */}
                {selectedCustomer && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-teal-600">
                    <CheckCircle2 size={13} />
                    <span className="font-medium">{selectedCustomer}</span> 선택됨
                  </div>
                )}

                {/* Dropdown */}
                {showDropdown && !selectedCustomer && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                    {filteredCustomers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-stone-400">
                        검색 결과가 없습니다
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c.company_name);
                            setCustomerSearch(c.company_name);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                        >
                          {c.company_name}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Hidden input for form submission */}
                <input
                  type="hidden"
                  name="customerName"
                  value={selectedCustomer}
                  required
                />
                <input type="hidden" name="serviceTypeId" value="1" />
              </div>
            )}
          </div>
        </div>

        {/* Project Section */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-stone-800 mb-4">프로젝트 정보</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                프로젝트명 <span className="text-red-400">*</span>
              </label>
              <input
                name="projectName"
                type="text"
                required
                placeholder="예: 2026년 상반기 리더십 교육"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">
                과정명
              </label>
              <input
                name="courseName"
                type="text"
                placeholder="비워두면 프로젝트명과 동일하게 설정됩니다"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  시작일 <span className="text-red-400">*</span>
                </label>
                <input
                  name="startDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  종료일 <span className="text-red-400">*</span>
                </label>
                <input
                  name="endDate"
                  type="date"
                  required
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Template Section */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks size={16} className="text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-800">설문 템플릿</h2>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-2">
              템플릿 선택 <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {templates.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    selectedTemplate === t.id
                      ? "border-teal-500 bg-teal-50/50"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="templateId"
                      value={t.id}
                      required
                      checked={selectedTemplate === t.id}
                      onChange={() => setSelectedTemplate(t.id)}
                      className="accent-teal-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-stone-800">
                        {t.name}
                      </span>
                      <span className="text-xs text-stone-400 ml-2">
                        {t.division_label}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-stone-500">
                    {t.questionCount}문항
                  </span>
                </label>
              ))}
            </div>
          </div>

          {template && (
            <div className="mt-3 rounded-lg bg-stone-50 px-4 py-2.5">
              <p className="text-xs text-stone-500">
                <span className="font-medium text-stone-600">{template.name}</span>
                의 {template.questionCount}개 문항이 설문에 자동으로 추가됩니다.
              </p>
            </div>
          )}
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
          disabled={pending || (!isNew && !selectedCustomer)}
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

        <p className="text-xs text-stone-400 text-center">
          프로젝트, 과정, 차수, 설문이 한 번에 생성됩니다.
        </p>
      </div>
    </form>
  );
}
