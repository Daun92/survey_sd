"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, ChevronLeft, ChevronRight, CheckCircle2, Clock, FileText, Shield } from "lucide-react";
import { type Question, type SurveySettings, type PreviewTab, type RespondentFieldConfig, RESPONDENT_FIELD_PRESETS, likertLabels, getLikertLabels, parseOptions, groupQuestionsBySection } from "./components/types";

interface PreviewProps {
  surveyTitle: string;
  surveyDescription: string;
  questions: Question[];
  settings: SurveySettings;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
}

export default function SurveyPreview({ surveyTitle, surveyDescription, questions, settings, activeTab, onTabChange }: PreviewProps) {
  const tabs: { key: PreviewTab; label: string }[] = [
    { key: "landing", label: "시작" },
    { key: "questions", label: "문항" },
    { key: "ending", label: "마감" },
  ];

  return (
    <div>
      {/* 탭 + 헤더 */}
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

      {/* 모바일 프레임 */}
      <div className="mx-auto w-[360px] rounded-[2rem] border-[3px] border-stone-800 bg-stone-800 shadow-2xl overflow-hidden">
        <div className="flex justify-center py-2 bg-stone-800">
          <div className="w-20 h-5 rounded-full bg-stone-900" />
        </div>

        <div className="bg-stone-50 h-[580px] overflow-y-auto">
          {activeTab === "landing" && <LandingPreview title={surveyTitle} description={surveyDescription} settings={settings} questionCount={questions.length} />}
          {activeTab === "questions" && <QuestionsPreview title={surveyTitle} questions={questions} settings={settings} />}
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

// ─── Landing Preview ───

function LandingPreview({ title, description, settings, questionCount }: { title: string; description: string; settings: SurveySettings; questionCount: number }) {
  const estimatedMin = Math.max(1, Math.ceil(questionCount * 0.4));
  const fields: RespondentFieldConfig[] =
    settings.respondent_fields?.filter((f) => f.enabled) ??
    RESPONDENT_FIELD_PRESETS.filter((f) => f.enabled);

  return (
    <div className="flex flex-col min-h-full overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 bg-white border-b border-stone-100">
        <Image src="/logo_exc.png" alt="EXPERT" width={80} height={16} className="h-3.5 w-auto" />
        <span className="text-[9px] text-stone-400 ml-auto">Satisfaction Survey</span>
      </div>

      {/* Hero image */}
      {settings.hero_image_url && (
        <div className="w-full h-24 overflow-hidden">
          <img src={settings.hero_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Center-aligned content */}
      <div className="flex-1 flex flex-col justify-center">

      {/* Title (표기용 제목) */}
      <div className="px-5 pt-5 text-center">
        <h2 className="text-[15px] font-bold text-stone-800 leading-snug">{title || "설문 제목"}</h2>
      </div>

      {/* Welcome */}
      <div className="px-5 pt-2 pb-1">
        <p className="text-[11px] text-stone-500 leading-relaxed text-center whitespace-pre-line">
          {settings.welcome_message || "안녕하세요, 고객님.\n귀하의 소중한 의견은 더 나은 교육 서비스를\n제공하는 데 큰 도움이 됩니다."}
        </p>
        <div className="w-8 h-px bg-stone-200 mx-auto mt-3" />
      </div>

      <div className="px-5 py-3 space-y-3">

        {/* Description / 안내사항 */}
        {description && (
          <div className="bg-white border border-stone-200 rounded-lg p-3">
            <p className="text-[8px] font-semibold text-stone-600 mb-0.5">안내사항</p>
            <p className="text-[9px] text-stone-500 leading-relaxed">{description}</p>
          </div>
        )}

        {/* Meta cards */}
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

        {/* Respondent fields */}
        {settings.collect_respondent_info !== false && fields.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[8px] font-semibold text-stone-400 uppercase tracking-widest">응답자 정보</p>
            <div className={`grid gap-1.5 ${fields.length === 1 ? 'grid-cols-1' : fields.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {fields.map((f) => (
                <div key={f.id} className="rounded-lg border border-stone-200 bg-white px-2 py-2">
                  <span className="text-[10px] text-stone-400">{f.label}{f.required ? ' *' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Consent card */}
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

        {/* CTA */}
        <button className="w-full h-[36px] rounded-xl bg-teal-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1">
          설문 시작하기 <ChevronRight size={13} />
        </button>
      </div>

      </div>{/* end center-aligned content */}

      {/* Privacy notice */}
      <div className="px-5 pb-3 flex items-center gap-1 justify-center">
        <Shield size={9} className="text-stone-300" />
        <span className="text-[8px] text-stone-400">
          {settings.landing_notice || "모든 응답은 익명으로 안전하게 처리됩니다"}
        </span>
      </div>
    </div>
  );
}

// ─── Section Intro Color Map ───
const sectionIntroColorMap: Record<string, { bg: string; border: string; title: string; desc: string; bar: string }> = {
  brand:       { bg: "bg-teal-50",   border: "border-teal-200",   title: "text-teal-800",   desc: "text-teal-600",   bar: "bg-teal-400"   },
  neutral:     { bg: "bg-stone-100", border: "border-stone-300",  title: "text-stone-700",  desc: "text-stone-500",  bar: "bg-stone-400"  },
  warm:        { bg: "bg-amber-50",  border: "border-amber-200",  title: "text-amber-800",  desc: "text-amber-600",  bar: "bg-amber-400"  },
  cool:        { bg: "bg-blue-50",   border: "border-blue-200",   title: "text-blue-800",   desc: "text-blue-600",   bar: "bg-blue-400"   },
  rose:        { bg: "bg-rose-50",   border: "border-rose-200",   title: "text-rose-800",   desc: "text-rose-600",   bar: "bg-rose-400"   },
  violet:      { bg: "bg-violet-50", border: "border-violet-200", title: "text-violet-800", desc: "text-violet-600", bar: "bg-violet-400" },
  green:       { bg: "bg-emerald-50",border: "border-emerald-200",title: "text-emerald-800",desc: "text-emerald-600",bar: "bg-emerald-400"},
  transparent: { bg: "bg-transparent",border: "border-transparent",title: "text-stone-800", desc: "text-stone-500",  bar: "bg-transparent"},
  // 하위 호환
  teal:        { bg: "bg-teal-50",   border: "border-teal-200",   title: "text-teal-800",   desc: "text-teal-600",   bar: "bg-teal-400"   },
  blue:        { bg: "bg-blue-50",   border: "border-blue-200",   title: "text-blue-800",   desc: "text-blue-600",   bar: "bg-blue-400"   },
  amber:       { bg: "bg-amber-50",  border: "border-amber-200",  title: "text-amber-800",  desc: "text-amber-600",  bar: "bg-amber-400"  },
};
const defaultIntroColor = sectionIntroColorMap.brand;

// ─── Questions Preview (Section Page-flip) ───

function QuestionsPreview({ title, questions, settings }: { title: string; questions: Question[]; settings: SurveySettings }) {
  const sections = groupQuestionsBySection(questions);
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
  const intro = settings.section_intros?.[sectionName];
  const introColor = sectionIntroColorMap[intro?.color ?? "brand"] ?? defaultIntroColor;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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

      {/* Section Intro Banner */}
      {(intro?.title || intro?.description || intro?.image_url) && (
        <div className={`mx-4 mt-3 rounded-lg border overflow-hidden ${introColor.bg} ${introColor.border}`}>
          {/* full 크기: 배너 상단 full-bleed */}
          {intro.image_url && intro.image_size === "full" && (
            <img
              src={intro.image_url}
              alt=""
              className="w-full block"
              style={{ display: "block", height: "auto", maxHeight: "120px", objectFit: "cover" }}
            />
          )}
          {(intro?.title || intro?.description) && <div className={`h-[2px] ${introColor.bar}`} />}
          <div className="px-3 py-2.5">
            {/* full 이외 크기: 패딩 안에서 실제 이미지 크기 반영 */}
            {intro.image_url && intro.image_size !== "full" && (
              <div className="flex justify-center mb-2">
                <img
                  src={intro.image_url}
                  alt=""
                  style={{
                    display: "block",
                    height: "auto",
                    maxHeight: "80px",
                    ...(intro.image_size === "small"
                      ? { width: "35%" }
                      : intro.image_size === "medium"
                      ? { width: "55%" }
                      : { width: "auto", maxWidth: "100%" }),
                  }}
                />
              </div>
            )}
            {intro.title && (
              <p className={`text-[11px] font-bold leading-tight mb-0.5 ${introColor.title}`}>{intro.title}</p>
            )}
            {intro.description && (
              <p className={`text-[10px] leading-relaxed whitespace-pre-line ${introColor.desc}`}>{intro.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
        {(() => {
          let visibleIdx = 0;
          return sectionQuestions.map((q, qIdx) => {
          // 안내 블록 미리보기
          if (q.question_type === "info_block") {
            const style = (q.metadata?.block_style as string) || "info";
            if (style === "divider") {
              return (
                <div key={q.id} className="py-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-stone-200" />
                    {q.question_text && <span className="text-[9px] text-stone-400 shrink-0">{q.question_text}</span>}
                    <div className="flex-1 h-px bg-stone-200" />
                  </div>
                </div>
              );
            }
            const blockMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
              info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", icon: "ℹ" },
              warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", icon: "⚠" },
              success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", icon: "✓" },
              tip: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-800", icon: "💡" },
            };
            const b = blockMap[style] || blockMap.info;
            return (
              <div key={q.id} className={`rounded-lg border px-3 py-2 ${b.bg} ${b.border}`}>
                <div className="flex items-start gap-1.5">
                  <span className={`shrink-0 text-[10px] ${b.text}`}>{b.icon}</span>
                  <p className={`text-[10px] leading-relaxed ${b.text}`}>{q.question_text}</p>
                </div>
              </div>
            );
          }

          visibleIdx++;
          return (
          <div key={q.id} className="space-y-2">
            <p className="text-[13px] text-stone-800 leading-relaxed">
              <span className="text-[11px] font-semibold text-teal-600 mr-1.5">{String(visibleIdx).padStart(2, "0")}</span>
              {q.question_text}
              {q.is_required && <span className="text-rose-400 ml-0.5">*</span>}
            </p>

            {q.question_type === "likert_5" && (() => {
              const qLabels = getLikertLabels(q.metadata?.likert_label_preset as string | undefined);
              const pts = [1, 2, 3, 4, 5];
              return (
                <div className="space-y-0.5">
                  <div className="flex gap-1">
                    {pts.map((v) => (
                      <div key={v} className="flex-1 flex items-center justify-center py-2 rounded-lg border border-stone-200 bg-white">
                        <span className="text-[13px] text-stone-500">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {pts.map((v) => (
                      <span key={v} className="flex-1 text-center text-[7px] text-stone-400 leading-tight">
                        {v === 1 || v === 3 || v === 5 ? qLabels[v] : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {q.question_type === "likert_7" && (
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
                {parseOptions(q.options).map((opt, i) => (
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
          );
        });
        })()}
      </div>

      {/* Bottom nav (section) */}
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

// ─── Ending Preview ───

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

      {/* Stats placeholder */}
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
