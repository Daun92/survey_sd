"use client";

import type { ReactNode } from "react";

/**
 * 응답자 화면을 모바일 중심으로 감싸는 공통 프레임.
 *
 * - 모바일: full-viewport, stone-50 배경
 * - md 이상 데스크탑: 420px 너비로 중앙 정렬, 둥근 카드 스타일 + 그림자
 * - 교육 CS 응답자 대다수가 모바일에서 접근한다는 실사용 패턴을 반영
 *
 * /s, /d, /respond, /survey 공용.
 */
export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-200 md:flex md:items-center md:justify-center md:py-8">
      <div className="w-full md:w-[420px] md:min-h-[720px] md:max-h-[90vh] md:rounded-3xl md:shadow-2xl md:border md:border-stone-300 md:overflow-hidden bg-stone-50 flex flex-col min-h-screen md:min-h-0 md:relative">
        {children}
      </div>
    </div>
  );
}
