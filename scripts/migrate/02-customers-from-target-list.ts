/**
 * 기존 "CS 대상자 리스트 작성" Excel에서 고객사 데이터를 임포트합니다.
 *
 * 대상 파일: 참고/26년/26년 2월/0.2월 CS 대상자 리스트 작성_260127.xlsx
 * 시트별 서비스유형:
 *   - (집체)* → 집체  (컬럼: 년, 월, 구분, ..., 회사명[7], ..., AM[10])
 *   - HRM → HRM      (컬럼: 년, 월, ..., 회사명[13], ..., AM/PM[11])
 *   - 원격교육 → 원격교육 (컬럼: 연, 월, ..., 회사명[7], ..., AM[10])
 *   - 과정개발 → skip (not a service type for surveys)
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

interface SheetConfig {
  sheetPattern: RegExp;
  serviceTypeName: string;
  companyCol: number;    // 회사명 컬럼 번호
  amCol: number;         // AM(영업담당) 컬럼 번호
  teamCol: number;       // 구분(팀) 컬럼 번호
  yearCol: number;
  monthCol: number;
  headerRow: number;     // 헤더 행 번호
}

const SHEET_CONFIGS: SheetConfig[] = [
  { sheetPattern: /집체/, serviceTypeName: "집체", companyCol: 7, amCol: 10, teamCol: 3, yearCol: 1, monthCol: 2, headerRow: 3 },
  { sheetPattern: /HRM/, serviceTypeName: "HRM", companyCol: 13, amCol: 11, teamCol: 3, yearCol: 1, monthCol: 2, headerRow: 3 },
  { sheetPattern: /원격/, serviceTypeName: "원격교육", companyCol: 7, amCol: 10, teamCol: 3, yearCol: 1, monthCol: 2, headerRow: 2 },
];

async function main() {
  console.log("고객사 마이그레이션 시작...\n");

  // 서비스유형 매핑
  const serviceTypes = await prisma.serviceType.findMany();
  const stMap = new Map(serviceTypes.map((s) => [s.name, s.id]));

  // 대상 파일들
  const baseDir = path.resolve(__dirname, "../../../참고");
  const files = [
    path.join(baseDir, "26년/26년 2월/0.2월 CS 대상자 리스트 작성_260127.xlsx"),
    path.join(baseDir, "26년/26년 1월/0.1월 CS 대상자 리스트 작성_260120.xlsx"),
  ];

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const filePath of files) {
    console.log(`\n📄 파일: ${path.basename(filePath)}`);

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(filePath);
    } catch {
      console.log(`  ⚠️ 파일을 읽을 수 없습니다. 건너뜁니다.`);
      continue;
    }

    for (const ws of wb.worksheets) {
      const config = SHEET_CONFIGS.find((c) => c.sheetPattern.test(ws.name));
      if (!config) {
        console.log(`  [SKIP] 시트: ${ws.name} (매칭되는 설정 없음)`);
        continue;
      }

      const serviceTypeId = stMap.get(config.serviceTypeName);
      if (!serviceTypeId) {
        console.log(`  [SKIP] 서비스유형 없음: ${config.serviceTypeName}`);
        continue;
      }

      console.log(`  📊 시트: ${ws.name} → ${config.serviceTypeName} (rows: ${ws.rowCount})`);
      const seen = new Set<string>();
      let sheetCreated = 0;
      let sheetUpdated = 0;

      for (let r = config.headerRow + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const companyName = String(row.getCell(config.companyCol).value || "").trim();
        if (!companyName || companyName.length < 2) continue;

        // 중복 방지 (같은 시트 내)
        const key = `${companyName}_${serviceTypeId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const salesRep = String(row.getCell(config.amCol).value || "").trim() || null;
        const salesTeam = String(row.getCell(config.teamCol).value || "").trim() || null;

        try {
          const existing = await prisma.customer.findUnique({
            where: { companyName_serviceTypeId: { companyName, serviceTypeId } },
          });

          if (existing) {
            // 영업담당자 정보가 새로 있으면 업데이트
            if (salesRep && !existing.salesRep) {
              await prisma.customer.update({
                where: { id: existing.id },
                data: { salesRep, salesTeam: salesTeam || existing.salesTeam },
              });
              sheetUpdated++;
            }
          } else {
            await prisma.customer.create({
              data: {
                companyName,
                serviceTypeId,
                salesRep,
                salesTeam,
                isActive: true,
              },
            });
            sheetCreated++;
          }
        } catch (e) {
          // unique constraint 등 무시
          totalSkipped++;
        }
      }

      console.log(`     → 생성: ${sheetCreated}, 업데이트: ${sheetUpdated}`);
      totalCreated += sheetCreated;
      totalUpdated += sheetUpdated;
    }
  }

  // 샘플 파일들에서도 추가 임포트 (원격교육, HR컨설팅)
  const sampleFiles = [
    { file: path.join(baseDir, "26년/(샘플)CS 설문 및 인터뷰 대상 고객사_원격교육.xlsx"), serviceType: "원격교육" },
    { file: path.join(baseDir, "26년/(샘플)CS 설문 및 인터뷰 대상 고객사_HR컨설팅.xlsx"), serviceType: "HR컨설팅" },
  ];

  for (const { file: filePath, serviceType } of sampleFiles) {
    const serviceTypeId = stMap.get(serviceType);
    if (!serviceTypeId) continue;

    console.log(`\n📄 샘플 파일: ${path.basename(filePath)} → ${serviceType}`);

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(filePath);
    } catch {
      console.log(`  ⚠️ 파일을 읽을 수 없습니다.`);
      continue;
    }

    const ws = wb.worksheets[0];
    if (!ws) continue;

    // 이 샘플 파일 구조: Row 2가 헤더 (프로젝트명, 고객사명, PM정보, 수주코드, 이름, 직급, 이메일, 전화, 휴대폰)
    let created = 0;
    for (let r = 3; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const companyName = String(row.getCell(3).value || "").trim(); // 고객사명
      if (!companyName || companyName.length < 2) continue;

      const contactName = String(row.getCell(6).value || "").trim() || null;
      const contactTitle = String(row.getCell(7).value || "").trim() || null;
      const email = String(row.getCell(8).value || "").trim() || null;
      const phone = String(row.getCell(10).value || row.getCell(9).value || "").trim() || null;
      const salesRep = String(row.getCell(4).value || "").trim() || null; // PM정보

      try {
        await prisma.customer.upsert({
          where: { companyName_serviceTypeId: { companyName, serviceTypeId } },
          update: {
            contactName: contactName || undefined,
            contactTitle: contactTitle || undefined,
            email: email || undefined,
            phone: phone || undefined,
          },
          create: {
            companyName,
            serviceTypeId,
            contactName,
            contactTitle,
            email,
            phone,
            salesRep,
            isActive: true,
          },
        });
        created++;
      } catch {
        totalSkipped++;
      }
    }
    console.log(`  → 처리: ${created}건`);
    totalCreated += created;
  }

  console.log(`\n\n✅ 마이그레이션 완료!`);
  console.log(`   생성: ${totalCreated}, 업데이트: ${totalUpdated}, 스킵: ${totalSkipped}`);

  // 최종 통계
  const counts = await prisma.customer.groupBy({
    by: ["serviceTypeId"],
    _count: true,
    where: { isActive: true },
  });
  console.log("\n📊 서비스유형별 고객사 수:");
  for (const c of counts) {
    const st = serviceTypes.find((s) => s.id === c.serviceTypeId);
    console.log(`   ${st?.name || "?"}: ${c._count}건`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ 오류:", e);
  process.exit(1);
});
