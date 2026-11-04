import { describe, expect, it } from "vitest";
import { normPhone, phoneLookupKeys } from "./phone-key";

// T-073: 배포 업로드가 응답자를 '010-2230-5532' 같은 원문 문자열로 찾아서, 숫자만으로 저장된 기존 응답자
// ('01022305532', 495건)를 못 찾았다. 새로 만들려다 unique index(respondents_phone_norm_key, fn_cs_norm_phone)
// 에 막혀 2026-09-02 이후 발송 48건의 respondent_id 가 비었다.

describe("normPhone — DB fn_cs_norm_phone 과 같은 규칙", () => {
  it.each([
    ["010-2064-8132", "01020648132"],
    ["'010-2064-8132", "01020648132"],
    ["+82 10-2064-8132", "01020648132"],
    ["1020648132", "01020648132"], // 엑셀 숫자 변환으로 빠진 앞자리 0
    ["02-410-1894", "024101894"],
  ])("%s → %s", (input, expected) => {
    expect(normPhone(input)).toBe(expected);
  });

  it("숫자가 없으면 null", () => {
    expect(normPhone("")).toBeNull();
    expect(normPhone("-")).toBeNull();
  });
});

describe("phoneLookupKeys — 저장 형식(숫자만·하이픈)과 무관하게 같은 번호를 찾는 키", () => {
  it("휴대번호는 숫자만과 3-4-4 하이픈 형식을 모두 낸다", () => {
    expect(phoneLookupKeys("010-2230-5532")).toEqual(
      expect.arrayContaining(["01022305532", "010-2230-5532"])
    );
    expect(phoneLookupKeys("01022305532")).toEqual(
      expect.arrayContaining(["01022305532", "010-2230-5532"])
    );
  });

  it("서울 02 번호는 2-3-4 / 2-4-4 형식", () => {
    expect(phoneLookupKeys("024101894")).toEqual(expect.arrayContaining(["024101894", "02-410-1894"]));
    expect(phoneLookupKeys("0262561042")).toEqual(expect.arrayContaining(["0262561042", "02-6256-1042"]));
  });

  it("지역번호 10자리는 3-3-4 형식", () => {
    expect(phoneLookupKeys("0416801233")).toEqual(expect.arrayContaining(["0416801233", "041-680-1233"]));
  });

  it("번호가 없으면 빈 배열", () => {
    expect(phoneLookupKeys("")).toEqual([]);
  });
});
