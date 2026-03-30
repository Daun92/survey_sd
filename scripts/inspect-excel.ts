import ExcelJS from "exceljs";
import path from "path";

async function inspect(filePath: string, maxRows = 5) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log("=== FILE:", path.basename(filePath), "===");
  console.log("Sheets:", wb.worksheets.map((s) => s.name));
  for (const ws of wb.worksheets) {
    console.log(`\n--- Sheet: ${ws.name} (rows: ${ws.rowCount}) ---`);
    for (let r = 1; r <= Math.min(maxRows, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= 15) cells.push(`${col}:${String(cell.value || "").substring(0, 35)}`);
      });
      console.log(`Row ${r}:`, cells.join(" | "));
    }
  }
}

const base = path.resolve(__dirname, "../../참고");

async function main() {
  // 실제 데이터가 있는 월별 대상자 리스트
  console.log("========== 대상자 리스트 ==========");
  await inspect(path.join(base, "26년/26년 2월/0.2월 CS 대상자 리스트 작성_260127.xlsx"), 6);

  console.log("\n\n========== 교육실시여부 취합 ==========");
  await inspect(path.join(base, "26년/26년 2월/0-1.1월 교육 실시 여부_취합_260213.xlsx"), 6);

  console.log("\n\n========== 교육실시여부 개별 ==========");
  await inspect(path.join(base, "26년/26년 1월/1. 12월 교육실시여부조사/12월 교육 실시 여부_000.xlsx"), 6);
}

main().catch(console.error);
