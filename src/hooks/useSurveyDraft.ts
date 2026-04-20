"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 응답자 설문 draft 를 sessionStorage 에 자동 저장·복원하는 훅.
 *
 * - 초기값: sessionStorage 에 저장된 값이 있으면 그걸로, 없으면 initialState
 * - state 변경 시 자동 저장 (debounce 250ms)
 * - sessionStorage 라 탭 닫으면 사라짐 (localStorage 는 다른 응답자가 같은 기기를
 *   쓸 때 오염 위험이 있어 의도적으로 제외)
 * - clear() 로 명시적 삭제 — 제출 성공 시 호출
 *
 * SSR 안전: 초기 렌더에서는 initialState 를 반환, 마운트 후 sessionStorage 값이 있으면 교체
 */
export function useSurveyDraft<T>(
  key: string,
  initialState: T,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(initialState);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마운트 후 1회: sessionStorage 에서 draft 복원
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        setState(parsed);
      }
    } catch {
      // JSON parse 실패나 storage 차단 등은 무시하고 initialState 유지
    } finally {
      hydratedRef.current = true;
    }
    // key 가 변하면 다른 draft 이므로 복원 단계를 다시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // state 변경 시 자동 저장 (debounce)
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (typeof window === "undefined") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(state));
      } catch {
        // QuotaExceededError 등 무시
      }
    }, 250);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [key, state]);

  const clear = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  return [state, setState, clear];
}
