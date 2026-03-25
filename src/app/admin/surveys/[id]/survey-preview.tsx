"use client";

import { Smartphone, Eye } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  question_code: string | null;
  section: string | null;
  is_required: boolean;
  options: string[] | string | null;
}

interface PreviewProps {
  surveyTitle: string;
  questions: Question[];
}

const likertLabels: Record<number, string> = {
  5: "매우 만족",
  4: "만족",
  3: "보통",
  2: "불만족",
  1: "매우 불만족",
};

function parseOptions(opts: string[] | string | null): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts;
  try {
    const parsed = JSON.parse(opts);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return opts.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  }
}

export default function SurveyPreview({ surveyTitle, questions }: PreviewProps) {
  // 섹션 그룹핑
  const sections: Record<string, Question[]> = {};
  questions.forEach((q) => {
    const section = q.section || "기타";
    if (!sections[section]) sections[section] = [];
    sections[section].push(q);
  });

  const sectionEntries = Object.entries(sections);

  return (
    <div className="sticky top-8">
      {/* 프리뷰 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Eye size={14} className="text-stone-400" />
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
          미리보기
        </span>
      </div>

      {/* 모바일 프레임 */}
      <div className="mx-auto w-[360px] rounded-[2rem] border-[3px] border-stone-800 bg-stone-800 shadow-2xl overflow-hidden">
        {/* 노치 */}
        <div className="flex justify-center py-2 bg-stone-800">
          <div className="w-20 h-5 rounded-full bg-stone-900" />
        </div>

        {/* 스크린 */}
        <div className="bg-stone-50 h-[580px] overflow-y-auto">
          {/* 상단 바 */}
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-stone-100">
            <span className="text-[13px] font-bold text-stone-800 truncate max-w-[240px]">
              {surveyTitle || "설문 제목"}
            </span>
            <Smartphone size={14} className="text-stone-300" />
          </div>

          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center px-6">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                <Eye size={20} className="text-stone-300" />
              </div>
              <p className="text-sm text-stone-400">
                문항을 추가하면
                <br />
                여기에 미리보기가 표시됩니다
              </p>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-5">
              {sectionEntries.map(([sectionName, sectionQuestions], sIdx) => (
                <div key={sectionName}>
                  {sectionEntries.length > 1 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-semibold text-teal-600">
                        {sIdx + 1}/{sectionEntries.length}
                      </span>
                      <span className="text-[13px] font-semibold text-stone-800">
                        {sectionName}
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {sectionQuestions.map((q, qIdx) => (
                      <div key={q.id} className="space-y-2">
                        <p className="text-[13px] text-stone-800 leading-relaxed">
                          <span className="text-[11px] font-semibold text-teal-600 mr-1.5">
                            {String(qIdx + 1).padStart(2, "0")}
                          </span>
                          {q.question_text}
                          {q.is_required && (
                            <span className="text-rose-400 ml-0.5">*</span>
                          )}
                        </p>

                        {/* Likert 5점 */}
                        {q.question_type === "likert_5" && (
                          <div className="flex gap-1">
                            {[5, 4, 3, 2, 1].map((v) => (
                              <div
                                key={v}
                                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border border-stone-200 bg-white"
                              >
                                <span className="text-[13px] text-stone-500">{v}</span>
                                <span className="text-[8px] text-stone-400 leading-tight">
                                  {likertLabels[v]}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Likert 7점 */}
                        {q.question_type === "likert_7" && (
                          <div className="flex gap-0.5">
                            {[7, 6, 5, 4, 3, 2, 1].map((v) => (
                              <div
                                key={v}
                                className="flex-1 flex items-center justify-center py-2 rounded border border-stone-200 bg-white text-[12px] text-stone-500"
                              >
                                {v}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 주관식 */}
                        {q.question_type === "text" && (
                          <div className="rounded-lg border border-stone-200 bg-white px-3 py-2.5">
                            <span className="text-[12px] text-stone-300">
                              의견을 입력해 주세요...
                            </span>
                          </div>
                        )}

                        {/* 객관식 (단일/복수) */}
                        {(q.question_type === "single_choice" ||
                          q.question_type === "multiple_choice") && (
                          <div className="space-y-1">
                            {parseOptions(q.options).map((opt, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2"
                              >
                                <div
                                  className={`w-4 h-4 border-2 border-stone-300 ${
                                    q.question_type === "single_choice"
                                      ? "rounded-full"
                                      : "rounded"
                                  }`}
                                />
                                <span className="text-[12px] text-stone-600">
                                  {opt}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 평점 */}
                        {q.question_type === "rating" && (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((v) => (
                              <div
                                key={v}
                                className="w-8 h-8 rounded border border-stone-200 bg-white flex items-center justify-center text-stone-300 text-[14px]"
                              >
                                ★
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 예/아니오 */}
                        {q.question_type === "yes_no" && (
                          <div className="flex gap-2">
                            <div className="flex-1 py-2 rounded-lg border border-stone-200 bg-white text-center text-[12px] text-stone-500">
                              예
                            </div>
                            <div className="flex-1 py-2 rounded-lg border border-stone-200 bg-white text-center text-[12px] text-stone-500">
                              아니오
                            </div>
                          </div>
                        )}

                        {qIdx < sectionQuestions.length - 1 && (
                          <div className="h-px bg-stone-100 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 바 */}
        <div className="flex justify-center py-1.5 bg-stone-800">
          <div className="w-28 h-1 rounded-full bg-stone-600" />
        </div>
      </div>

      <p className="text-center text-[11px] text-stone-400 mt-3">
        응답자에게 보이는 화면입니다
      </p>
    </div>
  );
}
