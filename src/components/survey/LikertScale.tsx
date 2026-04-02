"use client";

/**
 * LikertScale — 리커트 척도 선택 컴포넌트
 *
 * 3개 폼의 리커트 렌더링(80% 동일)을 통합.
 * 5점/6점 척도, 라벨 커스터마이즈 지원.
 */

interface LikertScaleProps {
  value?: number;
  onChange: (value: number) => void;
  /** 척도 범위 (기본 5) */
  scale?: 5 | 6 | 7;
  /** 커스텀 라벨 (번호 → 텍스트) */
  labels?: Record<number, string>;
  /** 방향 */
  direction?: "horizontal" | "vertical";
  /** 읽기 전용 */
  disabled?: boolean;
}

/** 기본 5점 라벨 */
export const LIKERT_5_LABELS: Record<number, string> = {
  1: "매우 불만족",
  2: "불만족",
  3: "보통",
  4: "만족",
  5: "매우 만족",
};

/** 동의 척도 라벨 */
export const LIKERT_5_AGREE_LABELS: Record<number, string> = {
  1: "매우 그렇지 않다",
  2: "그렇지 않다",
  3: "보통",
  4: "그렇다",
  5: "매우 그렇다",
};

/** 동의/비동의 라벨 */
export const LIKERT_5_AGREE_DISAGREE_LABELS: Record<number, string> = {
  1: "전혀 동의하지 않음",
  2: "비동의",
  3: "보통",
  4: "동의",
  5: "매우 동의",
};

/** 빈도 라벨 */
export const LIKERT_5_FREQUENCY_LABELS: Record<number, string> = {
  1: "전혀 없음",
  2: "드물게",
  3: "보통",
  4: "자주",
  5: "매우 자주",
};

/** 중요도 라벨 */
export const LIKERT_5_IMPORTANCE_LABELS: Record<number, string> = {
  1: "전혀 중요하지 않음",
  2: "중요하지 않음",
  3: "보통",
  4: "중요",
  5: "매우 중요",
};

/** 6점 라벨 */
export const LIKERT_6_LABELS: Record<number, string> = {
  1: "전혀 아니다",
  2: "아니다",
  3: "약간 아니다",
  4: "약간 그렇다",
  5: "그렇다",
  6: "매우 그렇다",
};

export function LikertScale({
  value,
  onChange,
  scale = 5,
  labels = LIKERT_5_LABELS,
  direction = "horizontal",
  disabled = false,
}: LikertScaleProps) {
  const options = Array.from({ length: scale }, (_, i) => i + 1);

  if (direction === "vertical") {
    return (
      <div className="space-y-2">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
              value === n
                ? "bg-teal-50 border-teal-400 text-teal-800 font-medium"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            } disabled:opacity-50`}
          >
            <span className="mr-2 text-gray-400">{n}.</span>
            {labels[n] || `${n}점`}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              value === n
                ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-teal-300 hover:text-teal-600"
            } disabled:opacity-50`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-1">
        <span className="text-[10px] text-gray-400">{labels[1] || ""}</span>
        {labels[Math.ceil(scale / 2)] && (
          <span className="text-[10px] text-gray-400">{labels[Math.ceil(scale / 2)]}</span>
        )}
        <span className="text-[10px] text-gray-400">
          {labels[scale] || ""}
        </span>
      </div>
    </div>
  );
}
