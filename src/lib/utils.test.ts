import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "./utils";

// PR #89 (formatDate/formatDateTime 를 KST 로 고정) 회귀 방지.
// Vercel serverless 가 TZ=UTC 로 실행되므로 Date 로컬 메서드가 UTC 를 리턴하는 버그.
// 본 테스트는 항상 KST 가 나와야 통과.

describe("formatDate — KST", () => {
  it("UTC midnight 이 지난 후의 KST 다음날을 반환", () => {
    // 2026-04-20 18:00 UTC == 2026-04-21 03:00 KST
    expect(formatDate("2026-04-20T18:00:00Z")).toBe("2026.04.21");
  });

  it("UTC 이른 오전(KST 자정 넘어간 순간) 도 올바른 KST 날짜", () => {
    // 2026-04-20 15:00 UTC == 2026-04-21 00:00 KST
    expect(formatDate("2026-04-20T15:00:00Z")).toBe("2026.04.21");
  });

  it("UTC 오후(KST 다음날 새벽) 처리", () => {
    // 2026-04-20 23:59 UTC == 2026-04-21 08:59 KST
    expect(formatDate("2026-04-20T23:59:00Z")).toBe("2026.04.21");
  });

  it("null / undefined / 빈 문자열 → '-'", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("")).toBe("-");
  });

  it("Invalid Date → '-'", () => {
    expect(formatDate("not-a-date")).toBe("-");
  });

  it("Date 객체 직접 입력도 처리", () => {
    // Date("2026-01-01T00:00:00Z") → KST 2026-01-01 09:00
    expect(formatDate(new Date("2026-01-01T00:00:00Z"))).toBe("2026.01.01");
  });
});

describe("formatDateTime — KST", () => {
  it("UTC 07:36 → KST 16:36 (PR #89 실사례 복원)", () => {
    expect(formatDateTime("2026-04-21T07:36:27Z")).toBe("2026.04.21 16:36");
  });

  it("UTC 15:00 → KST 00:00 (자정 경계, hour=24 엣지 방어)", () => {
    expect(formatDateTime("2026-04-20T15:00:00Z")).toBe("2026.04.21 00:00");
  });

  it("UTC 23:59 → KST 다음날 08:59", () => {
    expect(formatDateTime("2026-04-20T23:59:00Z")).toBe("2026.04.21 08:59");
  });

  it("null/invalid → '-'", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("")).toBe("-");
    expect(formatDateTime("nope")).toBe("-");
  });
});
