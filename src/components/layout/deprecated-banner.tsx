import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface DeprecatedPageBannerProps {
  /** 실제 사용하도록 안내할 대상 경로 (예: "/admin/reports") */
  targetPath: string;
  /** 대상 경로 이름 (버튼 라벨용, 예: "교육 리포트 관리자") */
  targetLabel: string;
  /** 선택적 상세 설명. 없으면 기본 문구 사용. */
  reason?: string;
}

/**
 * Prisma 기반 (dashboard)/* 페이지 상단에 삽입하는 deprecated 알림.
 *
 * 해당 페이지들은 더 이상 사용되지 않으며 모든 운영은 Supabase edu_* 기반
 * `/admin/*` 경로로 진행한다. 실수 유입을 막기 위해 노란색 배너 + 이동 링크 노출.
 *
 * 전략: 소프트 마이그레이션 (삭제 없음). AGENTS.md 의 라우팅 규칙 참고.
 */
export function DeprecatedPageBanner({
  targetPath,
  targetLabel,
  reason,
}: DeprecatedPageBannerProps) {
  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <AlertTriangle
        size={18}
        className="mt-0.5 shrink-0 text-amber-600"
        aria-hidden
      />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900">
          이 페이지는 더 이상 사용되지 않습니다
        </p>
        <p className="mt-0.5 text-[13px] text-amber-800/80 leading-relaxed">
          {reason ??
            "Prisma 기반 레거시 관리자 UI 입니다. 실사용 관리자 콘솔은 교육 CS 도메인(Supabase edu_* 테이블)을 바탕으로 한 " +
              targetLabel +
              " 입니다."}
        </p>
      </div>
      <Link
        href={targetPath}
        className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
      >
        {targetLabel}
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}
