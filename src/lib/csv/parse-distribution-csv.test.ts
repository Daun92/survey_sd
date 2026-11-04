import { describe, expect, it } from "vitest";
import { getPhoneWarning, parseDistributionCsv } from "./parse-distribution-csv";

// T-073: 대상자관리 📥 대상자 CSV 의 번호 열 이름이 '휴대' 라서 번호가 통째로 빠졌던 사고
// (2026-09-30·10-06 업로드 23건). 같은 파일이 다시 올라와도 번호가 들어가야 한다.

const row = "김진주,한국가스기술공사,111586@kogas-tech.or.kr";

describe("parseDistributionCsv 전화번호 열 인식", () => {
  it.each(["휴대", "휴대전화", "휴대폰", "연락처", "전화번호"])(
    "헤더 '%s' 를 전화번호로 읽는다",
    (header) => {
      const [parsed] = parseDistributionCsv(`담당자,회사,이메일,${header}\n${row},'010-2064-8132`);
      expect(parsed.phoneNormalized).toBe("010-2064-8132");
    }
  );

  it("기존 헤더 '전화' 도 계속 읽는다", () => {
    const [parsed] = parseDistributionCsv(`담당자,회사,이메일,전화\n${row},010-2064-8132`);
    expect(parsed.phoneNormalized).toBe("010-2064-8132");
  });

  it("일반전화(연락처)와 휴대전화가 함께 있으면 휴대전화를 쓴다 (발송이 SMS)", () => {
    const [parsed] = parseDistributionCsv(
      `담당자,회사,이메일,연락처,휴대전화\n${row},'042-600-8163,'010-2064-8132`
    );
    expect(parsed.phoneNormalized).toBe("010-2064-8132");
  });

  it("휴대전화 칸이 비어 있으면 같은 행의 일반전화로 채운다", () => {
    const [parsed] = parseDistributionCsv(`담당자,회사,이메일,연락처,휴대전화\n${row},'02-410-1894,`);
    expect(parsed.phoneNormalized).toBe("02-410-1894");
  });
});

describe("getPhoneWarning", () => {
  const parse = (body: string) => parseDistributionCsv(`담당자,회사,이메일,전화\n${body}`);

  it("모든 행에 번호가 없으면 'all' (열 이름 문제일 가능성)", () => {
    const rows = parseDistributionCsv(`담당자,회사,이메일,비고\n${row},메모\n${row},메모`);
    expect(getPhoneWarning(rows)).toEqual({ level: "all", missing: 2, total: 2 });
  });

  it("일부 행만 번호가 없으면 'some'", () => {
    const rows = parse(`${row},010-2064-8132\n${row},`);
    expect(getPhoneWarning(rows)).toEqual({ level: "some", missing: 1, total: 2 });
  });

  it("모든 행에 번호가 있으면 'none'", () => {
    const rows = parse(`${row},010-2064-8132`);
    expect(getPhoneWarning(rows)).toEqual({ level: "none", missing: 0, total: 1 });
  });
});
