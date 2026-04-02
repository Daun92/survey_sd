"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, ChevronLeft, ChevronRight, CheckCircle2, Clock, FileText, Shield } from "lucide-react";
import {
  type CSQuestion, type SurveySettings, type PreviewTab,
  type RespondentFieldConfig, RESPONDENT_FIELD_PRESETS,
  likertLabels, parseResponseOptions, groupQuestionsBySectionLabel,
} from "./types";

interface PreviewProps {
  templateName: string;
  questions: CSQuestion[];
  settings: SurveySettings;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
}

export default function TemplatePreview({ templateName, questions, settings, activeTab, onTabChange }: PreviewProps) {
  const tabs: { key: PreviewTab; label: string }[] = [
    { key: "landing", label: "랜딩" },
    { key: "questions", label: "문항" },
    { key: "ending", label: "엔딩" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-stone-400" />
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">미리보기</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === t.key ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-[360px] rounded-[2rem] border-[3px] border-stone-800 bg-stone-800 shadow-2xl overflow-hidden">
        <div className="flex justify-center py-2 bg-stone-800">
          <div className="w-20 h-5 rounded-full bg-stone-900" />
        </div>
        <div className="bg-stone-50 h-[580px] overflow-y-auto">
          {activeTab === "landing" && <LandingPreview title={templateName} settings={settings} questionCount={questions.length} />}
          {activeTab === "questions" && <QuestionsPreview title={templateName} questions={questions} />}
          {activeTab === "ending" && <EndingPreview settings={settings} />}
        </div>
        <div className="flex justify-center py-1.5 bg-stone-800">
          <div className="w-28 h-1 rounded-full bg-stone-600" />
        </div>
      </div>

      <p className="text-center text-[11px] text-stone-400 mt-3">응답자에게 보이는 화면입니다</p>
    </div>
  );
}

function LandingPreview({ title, settings, questionCount }: { title: string; settings: SurveySettings; questionCount: number }) {
  const estimatedMin = Math.max(1, Math.ceil(questionCount * 0.4));
  const fields: RespondentFieldConfig[] =
    settings.respondent_fields?.filter((f) => f.enabled) ??
    RESPONDENT_FIELD_PRESETS.filter((f) => f.enabled);

  return (
    <div className="flex flex-col min-h-full overflow-y-auto">
      <div className="flex items-center gap-2 px-5 py-2.5 bg-white border-b border-stone-100">
        <Image src="/logo_exc.png" alt="EXPERT" width={80} height={16} className="h-3.5 w-auto" />
        <span className="text-[9px] text-stone-400 ml-auto">Satisfaction Survey</span>
      </div>

      {settings.hero_image_url && (
        <div className="w-full h-24 overflow-hidden">
          <img src={settings.hero_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center">
        <div className="px-5 pt-5 text-center">
          <h2 className="text-[15px] font-bold text-stone-800 leading-snug">{title || "템플릿 제목"}</h2>
        </div>

        <div className="px-5 pt-2 pb-1">
          <p className="text-[11px] text-stone-500 leading-relaxed text-center whitespace-pre-line">
            {settings.welcome_message || "안녕하세요, 고객님.\n귀하의 소중한 의견은 더 나은 교육 서비스를\n제공하는 데 큰 도움이 됩니다."}
          </p>
          <div className="w-8 h-px bg-stone-200 mx-auto mt-3" />
        </div>

        <div className="px-5 py-3 space-y-3">
          {settings.show_meta_info !== false && (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-white border border-stone-200 px-2 py-2">
                <Clock size={11} className="text-teal-600 shrink-0" />
                <div>
                  <p className="text-[8px] text-stone-400">예상 소요</p>
                  <p className="text-[10px] font-semibold text-stone-800">{estimatedMin}분</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-white border border-stone-200 px-2 py-2">
                <FileText size={11} className="text-teal-600 shrink-0" />
                <div>
                  <p className="text-[8px] text-stone-400">전체 문항</p>
                  <p className="text-[10px] font-semibold text-stone-800">{questionCount}문항</p>
                </div>
              </div>
            </div>
          )}

          {settings.collect_respondent_info !== false && fields.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[8px] font-semibold text-stone-400 uppercase tracking-widest">응답자 정보</p>
              <div className="grid grid-cols-2 gap-1.5">
                {fields.map((f) => (
                  <div key={f.id} className="rounded-lg border border-stone-200 bg-white px-2 py-2">
                    <span className="text-[10px] text-stone-400">{f.label}{f.required ? " *" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {settings.privacy_consent_text && (
            <div className="rounded-lg bg-white border border-stone-200 p-3">
              <div className="flex items-start gap-1.5 mb-1">
                <Shield size={10} className="text-teal-600 mt-0.5 shrink-0" />
                <p className="text-[8px] font-semibold text-stone-600">개인정보 수집 안내</p>
              </div>
              <p className="text-[9px] text-stone-500 leading-relaxed">{settings.privacy_consent_text}</p>
              {settings.require_consent && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-stone-100">
                  <div className="w-3 h-3 rounded border border-stone-300" />
                  <span className="text-[9px] text-stone-600">위 내용에 동의합니다</span>
                </div>
              )}
            </div>
          )}

          <button className="w-full h-[36px] rounded-xl bg-teal-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1">
            설문 시작하기 <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="px-5 pb-3 flex items-center gap-1 justify-center">
        <Shield size={9} className="text-stone-300" />
        <span className="text-[8px] text-stone-400">
          {settings.landing_notice || "모든 응답은 익명으로 안전하게 처리됩니다"}
        </span>
      </div>
    </div>
  );
}

function QuestionsPreview({ title, questions }: { title: string; questions: CSQuestion[] }) {
  const sections = groupQuestionsBySectionLabel(questions);
  const [currentSection, setCurrentSection] = useState(0);

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
          <Eye size={20} className="text-stone-300" />
        </div>
        <p className="text-sm text-stone-400">문항을 추가하면<br />여기에 미리보기가 표시됩니다</p>
      </div>
    );
  }

  const safeCurrent = Math.min(currentSection, sections.length - 1);
  const [sectionName, sectionQuestions] = sections[safeCurrent] ?? sections[0];

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-[13px] font-bold text-stone-800 truncate max-w-[200px]">{title}</span>
          {sections.length > 1 && (
            <span className="text-[11px] font-medium text-teal-600">{safeCurrent + 1}/{sections.length}</span>
          )}
        </div>
        {sections.length > 1 && (
          <>
            <div className="h-[3px] bg-stone-100">
              <div className="h-full bg-teal-500 transition-all duration-300 rounded-r-full" style={{ width: `${((safeCurrent + 1) / sections.length) * 100}%` }} />
            </div>
            <div className="px-5 py-2 border-b border-stone-100">
              <span className="text-[12px] font-semibold text-stone-700">{sectionName}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        {sectionQuestions.map((q, qIdx) => (
          <div key={q.id} className="space-y-2">
            <p className="text-[13px] text-stone-800 leading-relaxed">
              <span className="text-[11px] font-semibold text-teal-600 mr-1.5">{String(qIdx + 1).padStart(2, "0")}</span>
              {q.question_text}
            </p>

            {(q.question_type === "likert_5") && (
              <div className="space-y-0.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <div key={v} className="flex-1 flex items-center justify-center py-2 rounded-lg border border-stone-200 bg-white">
                      <span className="text-[13px] text-stone-500">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <span key={v} className="flex-1 text-center text-[7px] text-stone-400 leading-tight">
                      {v === 1 || v === 3 || v === 5 ? likertLabels[v] : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(q.question_type === "likert_6") && (
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5, 6].map((v) => (
                  <div key={v} className="flex-1 flex items-center justify-center py-2 rounded border border-stone-200 bg-white text-[12px] text-stone-500">{v}</div>
                ))}
              </div>
            )}

            {(q.question_type === "likert_7") && (
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                  <div key={v} className="flex-1 flex items-center justify-center py-2 rounded border border-stone-200 bg-white text-[12px] text-stone-500">{v}</div>
                ))}
              </div>
            )}

            {q.question_type === "text" && (
              <div className="rounded-lg border border-stone-200 bg-white px-3 py-2.5">
                <span className="text-[12px] text-stone-300">의견을 입력해 주세요...</span>
              </div>
            )}

            {(q.question_type === "single_choice" || q.question_type === "multiple_choice") && (
              <div className="space-y-1">
                {parseResponseOptions(q.response_options).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
                    <div className={`w-4 h-4 border-2 border-stone-300 ${q.question_type === "single_choice" ? "rounded-full" : "rounded"}`} />
                    <span className="text-[12px] text-stone-600">{opt}</span>
                  </div>
                ))}
              </div>
            )}

            {q.question_type === "rating" && (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <div key={v} className="w-8 h-8 rounded border border-stone-200 bg-white flex items-center justify-center text-stone-300 text-[14px]">★</div>
                ))}
              </div>
            )}

            {q.question_type === "yes_no" && (
              <div className="flex gap-2">
                <div className="flex-1 py-2 rounded-lg border border-stone-200 bg-white text-center text-[12px] text-stone-500">예</div>
                <div className="flex-1 py-2 rounded-lg border border-stone-200 bg-white text-center text-[12px] text-stone-500">아니오</div>
              </div>
            )}

            {qIdx < sectionQuestions.length - 1 && <div className="h-px bg-stone-100 mt-1" />}
          </div>
        ))}
      </div>

      {sections.length > 1 && (
        <div className="bg-white border-t border-stone-100 px-5 py-2.5 flex items-center justify-between">
          <button onClick={() => setCurrentSection(Math.max(0, safeCurrent - 1))} disabled={safeCurrent === 0} className="text-xs text-stone-500 disabled:opacity-30 flex items-center gap-0.5">
            <ChevronLeft size={14} /> 이전
          </button>
          <span className="text-[10px] text-stone-400">{sectionName}</span>
          <button onClick={() => setCurrentSection(Math.min(sections.length - 1, safeCurrent + 1))} disabled={safeCurrent === sections.length - 1} className="text-xs text-teal-600 font-medium disabled:opacity-30 flex items-center gap-0.5">
            다음 <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function EndingPreview({ settings }: { settings: SurveySettings }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-[60px] h-[60px] rounded-full bg-teal-50 border-2 border-teal-100 flex items-center justify-center mb-5">
        <CheckCircle2 size={28} className="text-teal-600" />
      </div>
      <h2 className="text-[18px] font-bold text-stone-800 mb-2">
        {settings.ending_title || "응답이 제출되었습니다"}
      </h2>
      <p className="text-sm text-stone-500 whitespace-pre-line leading-relaxed mb-6">
        {settings.thank_you_message || "소중한 의견에 감사드립니다.\n응답 내용은 서비스 품질 개선에 활용됩니다."}
      </p>
      {settings.show_ending_stats && (
        <div className="flex items-center gap-4 text-stone-400 mb-8">
          <div className="text-center">
            <p className="text-lg font-bold text-stone-600">--</p>
            <p className="text-[10px]">응답 수</p>
          </div>
          <div className="h-6 w-px bg-stone-200" />
          <div className="text-center">
            <p className="text-lg font-bold text-stone-600">--</p>
            <p className="text-[10px]">소요 시간</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 opacity-30">
        <Image src="/logo_exc.png" alt="EXPERT" width={60} height={12} className="h-3 w-auto" />
      </div>
      <p className="text-[9px] text-stone-300 mt-1">Powered by EXC-Survey</p>
    </div>
  );
}
