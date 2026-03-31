"use client";

/**
 * SurveyProgress — 설문 진행 상태 표시 바
 *
 * /s/, /hrd/, /survey/ 3개 폼에서 공통 사용.
 * 기존 3곳의 중복 구현(90% 동일)을 통합.
 */

interface SurveyProgressProps {
  current: number;
  total: number;
  /** 진행률 표시 라벨 (예: "3/10 섹션") */
  label?: string;
  /** 바 높이 */
  variant?: "thin" | "thick";
  /** 색상 테마 */
  color?: "teal" | "blue" | "indigo";
}

const colorMap = {
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
};

export function SurveyProgress({
  current,
  total,
  label,
  variant = "thin",
  color = "teal",
}: SurveyProgressProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const height = variant === "thick" ? "h-2" : "h-1";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1 px-1">
          <span className="text-xs text-gray-500">{label}</span>
          <span className="text-xs text-gray-400">{percent}%</span>
        </div>
      )}
      <div className={`w-full ${height} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${colorMap[color]} rounded-full transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
