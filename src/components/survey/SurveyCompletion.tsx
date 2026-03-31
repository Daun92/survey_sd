"use client";

import { CheckCircle } from "lucide-react";

/**
 * SurveyCompletion — 설문 완료 화면
 *
 * 3개 폼의 완료 화면을 통합.
 */

interface SurveyCompletionProps {
  title?: string;
  message?: string;
  /** 추가 통계 표시 (소요시간 등) */
  stats?: Array<{ label: string; value: string }>;
  /** 닫기 동작 */
  onClose?: () => void;
}

export function SurveyCompletion({
  title = "설문이 완료되었습니다",
  message = "소중한 의견 감사합니다. 응답이 정상적으로 제출되었습니다.",
  stats,
  onClose,
}: SurveyCompletionProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="text-teal-500" size={32} />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>

        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-gray-50 rounded-lg p-3 text-center"
              >
                <div className="text-lg font-semibold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
