import { describe, expect, it } from "vitest";
import { pickSamePersonByEmail } from "./match-by-email";

// T-073/T-075: 번호가 빠진 업로드에서 이메일만 같은 다른 사람의 응답자 기록을 재사용하고 이름을 덮어써
// 오염이 생겼다. 예) 김진주 행이 박소현 번호 기록(같은 이메일)에 붙음, 권연수·김준형이 공용 이메일 기록 1건 공유.

describe("pickSamePersonByEmail", () => {
  it("같은 이메일 후보 중 이름이 같은 사람의 id 를 고른다", () => {
    const candidates = [
      { id: "a", name: "김준형" },
      { id: "b", name: "권연수" },
    ];
    expect(pickSamePersonByEmail(candidates, "권연수")).toBe("b");
  });

  it("이메일만 같고 이름이 다르면 재사용하지 않는다 (null → 새 응답자)", () => {
    expect(pickSamePersonByEmail([{ id: "a", name: "박소현" }], "김진주")).toBeNull();
  });

  it("이름 앞뒤 공백은 무시한다", () => {
    expect(pickSamePersonByEmail([{ id: "a", name: " 김진주 " }], "김진주")).toBe("a");
  });

  it("후보 이름이 비어 있으면 같은 사람으로 보지 않는다", () => {
    expect(pickSamePersonByEmail([{ id: "a", name: null }], "김진주")).toBeNull();
  });
});
