"use client";

import Link from "next/link";
import { useEffect } from "react";
import { kindFromErrorMessage } from "@/lib/supabase/errors";

interface SectionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** 섹션 이름 — 제목에 사용 */
  section: string;
}

/**
 * /admin/<section> 하위에서 throw 된 에러를 사용자에게 표시.
 * error.message 에 `[PGRST002]` 같은 태그가 있으면 종류별 안내로 분기.
 */
export function SectionError({ error, reset, section }: SectionErrorProps) {
  useEffect(() => {
    // 운영 로그에 전체 에러 + cause (supabaseError 가 심어둔 hint) 를 남김
    console.error(`[admin/${section}] error:`, error, (error as { cause?: unknown }).cause);
  }, [error, section]);

  const kind = kindFromErrorMessage(error.message ?? "");

  const { title, hint } = (() => {
    switch (kind) {
      case "schema_cache":
        return {
          title: `일시적 DB 설정 이상`,
          hint: "잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의 바랍니다.",
        };
      case "rls_denied":
        return {
          title: `접근 권한이 없습니다`,
          hint: "이 데이터에 접근할 권한이 없습니다. 관리자에게 권한을 요청하세요.",
        };
      case "timeout":
        return {
          title: `응답 지연`,
          hint: "쿼리가 시간 내에 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.",
        };
      case "no_rows":
        return {
          title: `데이터를 찾을 수 없습니다`,
          hint: "요청한 항목이 존재하지 않거나 삭제되었습니다.",
        };
      case "network":
        return {
          title: `네트워크 오류`,
          hint: "연결 상태를 확인 후 다시 시도해 주세요.",
        };
      default:
        return {
          title: `${section} 영역에서 문제가 발생했습니다`,
          hint: error.message || "알 수 없는 오류가 발생했습니다.",
        };
    }
  })();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-rose-50 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-stone-900 mb-2">{title}</h2>
        <p className="text-sm text-stone-500 mb-6 whitespace-pre-line">{hint}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            다시 시도
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            대시보드로
          </Link>
        </div>
        {error.digest && (
          <p className="mt-4 text-[10px] text-stone-300 font-mono">digest: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
