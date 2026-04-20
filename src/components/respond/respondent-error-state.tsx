"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  ServerCrash,
  type LucideIcon,
} from "lucide-react";

export type RespondentErrorVariant =
  | "invalid" // 유효하지 않은 토큰 (404-like)
  | "expired" // 설문 종료/마감
  | "not_started" // 설문 아직 배포 전 (draft)
  | "submitted" // 이미 응답 완료
  | "server_error"; // 네트워크/서버 오류

interface VariantConfig {
  Icon: LucideIcon;
  title: string;
  description: string;
  iconClass: string;
  iconBgClass: string;
}

const VARIANTS: Record<RespondentErrorVariant, VariantConfig> = {
  invalid: {
    Icon: AlertCircle,
    title: "유효하지 않은 설문 링크입니다",
    description: "링크를 다시 확인하시거나 담당자에게 문의해 주세요.",
    iconClass: "text-stone-500",
    iconBgClass: "bg-stone-100",
  },
  expired: {
    Icon: Lock,
    title: "설문이 종료되었습니다",
    description: "응답 기간이 만료된 설문입니다.",
    iconClass: "text-rose-500",
    iconBgClass: "bg-rose-50",
  },
  not_started: {
    Icon: Clock,
    title: "설문이 아직 시작되지 않았습니다",
    description: "배포 일정이 확정되면 다시 안내드릴 예정입니다.",
    iconClass: "text-amber-500",
    iconBgClass: "bg-amber-50",
  },
  submitted: {
    Icon: CheckCircle2,
    title: "이미 응답이 완료된 설문입니다",
    description: "소중한 의견 감사드립니다. 재응답이 필요한 경우 담당자에게 문의해 주세요.",
    iconClass: "text-emerald-500",
    iconBgClass: "bg-emerald-50",
  },
  server_error: {
    Icon: ServerCrash,
    title: "서버에 연결할 수 없습니다",
    description: "잠시 후 다시 시도하거나 담당자에게 연락해 주세요.",
    iconClass: "text-stone-500",
    iconBgClass: "bg-stone-100",
  },
};

interface RespondentErrorStateProps {
  variant: RespondentErrorVariant;
  title?: string;
  description?: string;
  action?: ReactNode;
}

/**
 * 응답자 라우트 공용 에러·종료 안내 화면.
 *
 * variant 별 기본 아이콘·문구 제공. title/description 으로 오버라이드 가능.
 * stone/teal 기본 팔레트 사용 — .expert-theme CSS var 에 의존하지 않음.
 */
export function RespondentErrorState({
  variant,
  title,
  description,
  action,
}: RespondentErrorStateProps) {
  const config = VARIANTS[variant];
  const { Icon } = config;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBgClass}`}
        >
          <Icon className={`h-8 w-8 ${config.iconClass}`} aria-hidden />
        </div>
        <h1 className="text-lg font-bold text-stone-800">
          {title ?? config.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          {description ?? config.description}
        </p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
