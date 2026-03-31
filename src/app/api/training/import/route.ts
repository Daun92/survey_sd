import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import ExcelJS from "exceljs";

// POST /api/training/import — 교육 실시 여부 취합 Excel 임포트
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const year = parseInt(formData.get("year") as string) || new Date().getFullYear();
  const month = parseInt(formData.get("month") as string) || new Date().getMonth() + 1;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return NextResponse.json({ error: "시트가 없습니다" }, { status: 400 });
  }

  // 서비스유형 조회
  const serviceTypes = await prisma.serviceType.findMany();
  const stNameMap = new Map<string, number>();
  for (const st of serviceTypes) {
    stNameMap.set(st.name, st.id);
  }

  // 고객사 조회 (빠른 매칭용)
  const allCustomers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true, serviceTypeId: true },
  });
  const customerMap = new Map<string, number>();
  for (const c of allCustomers) {
    customerMap.set(`${c.companyName}_${c.serviceTypeId}`, c.id);
  }

  // 파일명에서 영업담당자 추출 (패턴: "(O)12월 교육 실시 여부_홍길동.xlsx")
  let verifiedBy: string | null = null;
  const fileNameMatch = file.name.match(/여부[_\s]*([가-힣]+)/);
  if (fileNameMatch) {
    verifiedBy = fileNameMatch[1];
  }

  // 컬럼 매핑 탐색
  const COLUMN_HINTS: Record<string, string> = {
    "회사명": "companyName", "고객사명": "companyName", "고객사": "companyName", "업체명": "companyName",
    "교육실시여부": "hasTraining", "실시여부": "hasTraining", "교육여부": "hasTraining",
    "교육과정명": "trainingName", "과정명": "trainingName", "교육명": "trainingName",
    "서비스유형": "serviceType", "유형": "serviceType",
    "비고": "notes", "메모": "notes",
  };

  let headerRow = 1;
  let columnMapping: Record<number, string> = {};

  for (let row = 1; row <= Math.min(10, worksheet.rowCount); row++) {
    const r = worksheet.getRow(row);
    const mapping: Record<number, string> = {};
    let hasCompany = false;

    r.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const normalized = String(cell.value || "").trim().replace(/\s+/g, "");
      const field = COLUMN_HINTS[normalized];
      if (field) {
        mapping[colNumber] = field;
        if (field === "companyName") hasCompany = true;
      }
    });

    if (hasCompany) {
      headerRow = row;
      columnMapping = mapping;
      break;
    }
  }

  if (Object.keys(columnMapping).length === 0) {
    return NextResponse.json(
      { error: "회사명 컬럼을 찾을 수 없습니다" },
      { status: 400 }
    );
  }

  // 파일명에서 서비스유형 추론
  let defaultServiceTypeId: number | null = null;
  for (const [name, id] of stNameMap) {
    if (file.name.includes(name)) {
      defaultServiceTypeId = id;
      break;
    }
  }

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let rowNum = headerRow + 1; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const record: Record<string, string> = {};

    for (const [colNum, field] of Object.entries(columnMapping)) {
      const cell = row.getCell(parseInt(colNum));
      if (cell.value !== null && cell.value !== undefined) {
        record[field] = String(cell.value).trim();
      }
    }

    if (!record.companyName) continue;

    // 교육 실시 여부 파싱 (O, X, Y, N, 예, 아니오)
    let hasTraining = false;
    const tv = (record.hasTraining || "").toUpperCase();
    if (["O", "Y", "예", "있음", "TRUE", "1"].includes(tv)) {
      hasTraining = true;
    }

    // 서비스유형 결정
    let serviceTypeId = defaultServiceTypeId;
    if (record.serviceType) {
      const matched = stNameMap.get(record.serviceType);
      if (matched) serviceTypeId = matched;
    }
    if (!serviceTypeId) serviceTypeId = serviceTypes[0]?.id ?? 1;

    // 고객사 매칭
    const customerId = customerMap.get(`${record.companyName}_${serviceTypeId}`);
    if (!customerId) {
      failed++;
      errors.push(`행 ${rowNum}: "${record.companyName}" - 등록된 고객사를 찾을 수 없음`);
      continue;
    }

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
          hasTraining,
          trainingName: record.trainingName || null,
          verifiedBy,
          verifiedAt: new Date(),
          notes: record.notes || null,
        },
        create: {
          customerId,
          trainingYear: year,
          trainingMonth: month,
          serviceTypeId,
          hasTraining,
          trainingName: record.trainingName || null,
          verifiedBy,
          verifiedAt: new Date(),
          notes: record.notes || null,
        },
      });
      success++;
    } catch (e) {
      failed++;
      errors.push(`행 ${rowNum}: ${record.companyName} - ${(e as Error).message}`);
    }
  }

  await prisma.importLog.create({
    data: {
      fileName: file.name,
      importType: "training",
      recordsTotal: success + failed,
      recordsSuccess: success,
      recordsFailed: failed,
      errorsJson: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return NextResponse.json({ success, failed, errors: errors.slice(0, 10) });
});
