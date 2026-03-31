import type { CellValue } from "exceljs";

/**
 * ExcelJS 셀 값을 안전한 문자열로 변환합니다.
 * richText, formula, hyperlink 등 객체 타입을 올바르게 처리합니다.
 */
export function cellToString(value: CellValue): string {
  if (value === null || value === undefined) return "";

  // richText 객체
  if (typeof value === "object" && "richText" in value) {
    return (value.richText as Array<{ text: string }>).map((r) => r.text).join("").trim();
  }

  // formula 결과
  if (typeof value === "object" && "result" in value) {
    return cellToString((value as { result: CellValue }).result);
  }

  // hyperlink
  if (typeof value === "object" && "text" in value) {
    return String((value as { text: string }).text).trim();
  }

  // Date 객체
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }

  const str = String(value).trim();

  // [object Object] 감지 → 빈 문자열 반환
  if (str === "[object Object]") return "";

  return str;
}
