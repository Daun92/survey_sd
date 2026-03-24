/**
 * 교육 실시 여부 취합 Excel에서 TrainingRecord를 임포트합니다.
 *
 * 대상: 참고/26년/26년 2월/0-1.1월 교육 실시 여부_취합_260213.xlsx
 * 구조: Row 1 = 서비스유형 (집체 / HRM / 원격교육 등), Row 2 = 헤더
 *       고객사 컬럼 = 6, AM 컬럼 = 9, 수주팀 = 2
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("교육 실시 여부 마이그레이션 시작...\n");

  const serviceTypes = await prisma.serviceType.findMany();
  const stMap = new Map(serviceTypes.map((s) => [s.name, s.id]));

  // 고객사 매핑
  const allCustomers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true, serviceTypeId: true },
  });
  const customerMap = new Map<string, number>();
  for (const c of allCustomers) {
    customerMap.set(`${c.companyName}_${c.serviceTypeId}`, c.id);
  }

  const baseDir = path.resolve(__dirname, "../../../참고");
  const files = [
    { file: path.join(baseDir, "26년/26년 2월/0-1.1월 교육 실시 여부_취합_260213.xlsx"), year: 2026, month: 1 },
    { file: path.join(baseDir, "26년/26년 1월/0-1.12월 교육 실시 여부_취합_260119.xlsx"), year: 2025, month: 12 },
  ];

  let totalCreated = 0;
  let totalNotFound = 0;

  for (const { file: filePath, year, month } of files) {
    console.log(`📄 파일: ${path.basename(filePath)} (${year}년 ${month}월)`);

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(filePath);
    } catch {
      console.log(`  ⚠️ 파일을 읽을 수 없습니다.`);
      continue;
    }

    const ws = wb.worksheets[0];
    if (!ws) continue;

    // 시트 파싱: 서비스유형 구간을 찾아야 함
    // Row 1의 셀에 "집체", "HRM", "원격교육" 등이 표시됨
    // 각 구간은 해당 서비스유형의 데이터
    let currentServiceType: string | null = null;
    let currentServiceTypeId: number | null = null;
    let headerPassed = false;
    let created = 0;
    let notFound = 0;

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cell1 = String(row.getCell(1).value || "").trim();

      // 서비스유형 구간 감지
      if (stMap.has(cell1)) {
        currentServiceType = cell1;
        currentServiceTypeId = stMap.get(cell1)!;
        headerPassed = false;
        console.log(`  📊 구간: ${currentServiceType}`);
        continue;
      }

      // 헤더 행 감지 (No. 또는 번호)
      if (cell1 === "No." || cell1 === "번호" || cell1 === "No") {
        headerPassed = true;
        continue;
      }

      if (!headerPassed || !currentServiceTypeId) continue;

      // 빈 행이면 구간 종료
      const companyName = String(row.getCell(6).value || "").trim();
      if (!companyName || companyName.length < 2) {
        // 연속 빈 행이면 구간 끝
        const nextCompany = String(ws.getRow(r + 1)?.getCell(6).value || "").trim();
        if (!nextCompany || nextCompany.length < 2) continue;
        continue;
      }

      // 고객사 매칭
      const customerId = customerMap.get(`${companyName}_${currentServiceTypeId}`);
      if (!customerId) {
        notFound++;
        continue;
      }

      const salesRep = String(row.getCell(9).value || "").trim() || null;

      try {
        await prisma.trainingRecord.upsert({
          where: {
            customerId_trainingYear_trainingMonth: {
              customerId,
              trainingYear: year,
              trainingMonth: month,
            },
          },
          update: {
            hasTraining: true,
            verifiedBy: salesRep,
            verifiedAt: new Date(),
          },
          create: {
            customerId,
            trainingYear: year,
            trainingMonth: month,
            serviceTypeId: currentServiceTypeId,
            hasTraining: true,
            trainingName: String(row.getCell(5).value || "").trim() || null,
            verifiedBy: salesRep,
            verifiedAt: new Date(),
          },
        });
        created++;
      } catch {
        // skip
      }
    }

    console.log(`  → 생성: ${created}, 미매칭: ${notFound}\n`);
    totalCreated += created;
    totalNotFound += notFound;
  }

  console.log(`\n✅ 교육 실시 여부 마이그레이션 완료!`);
  console.log(`   총 생성: ${totalCreated}, 미매칭 고객사: ${totalNotFound}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ 오류:", e);
  process.exit(1);
});
