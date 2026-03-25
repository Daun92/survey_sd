"use client";

import { useState } from "react";
import { quickCreateSurvey } from "./actions";
import { ListChecks, Building2, Loader2 } from "lucide-react";

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

  const template = templates.find((t) => t.id === selectedTemplate);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await quickCreateSurvey(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
      setPending(false);
    }
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
                  <select
                    name="serviceTypeId"
                    required
                    defaultValue="1"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  >
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[13px] font-medium text-stone-600 mb-1">
                  고객사 선택 <span className="text-red-400">*</span>
                </label>
                <select
                  name="customerName"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                >
                  <option value="" disabled>
                    고객사를 선택하세요
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.company_name}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
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
          disabled={pending}
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
          프로젝트, 과정, 차수, 설문이 한 번에 생성됩니다. 생성 후 설문 상세
          페이지로 이동합니다.
        </p>
      </div>
    </form>
  );
}
