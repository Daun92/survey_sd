import ExcelJS from "exceljs";
import path from "path";

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(__dirname, "../../참고/26년/26년 2월/0.2월 CS 대상자 리스트 작성_260127.xlsx"));

  const ws = wb.worksheets[0]; // 집체 수도권
  console.log("Sheet:", ws.name);

  // 회사명 컬럼(7)에서 [object Object]가 되는 셀을 찾기
  for (let r = 4; r <= 10; r++) {
    const cell = ws.getRow(r).getCell(7);
    const raw = cell.value;
    console.log(`\nRow ${r}, Col 7:`);
    console.log("  type:", typeof raw);
    console.log("  value:", JSON.stringify(raw, null, 2)?.substring(0, 200));
    console.log("  String():", String(raw));
    if (raw && typeof raw === "object" && "richText" in (raw as object)) {
      const rt = (raw as { richText: Array<{ text: string }> }).richText;
      console.log("  richText joined:", rt.map((r) => r.text).join(""));
    }
  }
}

main().catch(console.error);
