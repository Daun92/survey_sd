import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";

// 한국어 컬럼명 → 필드 매핑
const COLUMN_MAP: Record<string, string> = {
  "회사명": "companyName",
  "고객사명": "companyName",
  "고객사": "companyName",
  "업체명": "companyName",
  "기관명": "companyName",
  "담당자": "contactName",
  "담당자명": "contactName",
  "직책": "contactTitle",
  "직급": "contactTitle",
  "이메일": "email",
  "메일": "email",
  "email": "email",
  "전화번호": "phone",
  "연락처": "phone",
  "휴대폰": "phone",
  "핸드폰": "phone",
  "영업담당": "salesRep",
  "영업담당자": "salesRep",
  "수주담당": "salesRep",
  "담당영업": "salesRep",
  "소속팀": "salesTeam",
  "팀": "salesTeam",
  "소속": "salesTeam",
  "에코": "ecoScore",
  "에코점수": "ecoScore",
  "비고": "notes",
  "메모": "notes",
  "서비스유형": "serviceTypeName",
  "유형": "serviceTypeName",
  "교육유형": "serviceTypeName",
};

function normalizeColumnName(raw: string): string {
  return raw.toString().trim().replace(/\s+/g, "");
}

import { withAuth } from "@/lib/api-utils";

// POST /api/customers/import
export const POST = withAuth({ type: "role", minRole: "creator" }, async (request: NextRequest) => {
  const formData = await request.formData();
  const file = formData.get("file") as File;

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
    stNameMap.set(st.nameEn, st.id);
  }

  // 헤더 행 찾기 (첫 10행 내에서 회사명 컬럼이 있는 행)
  let headerRow = 1;
  let columnMapping: Record<number, string> = {};

  for (let row = 1; row <= Math.min(10, worksheet.rowCount); row++) {
    const r = worksheet.getRow(row);
    const mapping: Record<number, string> = {};
    let hasCompanyName = false;

    r.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const normalized = normalizeColumnName(String(cell.value || ""));
      const field = COLUMN_MAP[normalized];
      if (field) {
        mapping[colNumber] = field;
        if (field === "companyName") hasCompanyName = true;
      }
    });

    if (hasCompanyName) {
      headerRow = row;
      columnMapping = mapping;
      break;
    }
  }

  if (Object.keys(columnMapping).length === 0) {
    return NextResponse.json(
      { error: "회사명 컬럼을 찾을 수 없습니다. 첫 행에 '회사명' 또는 '고객사명' 헤더가 필요합니다." },
      { status: 400 }
    );
  }

  // 데이터 행 파싱
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  // 파일명에서 서비스유형 추론
  let defaultServiceTypeId: number | null = null;
  const fileName = file.name;
  for (const [name, id] of stNameMap) {
    if (fileName.includes(name)) {
      defaultServiceTypeId = id;
      break;
    }
  }
  // 파일명 패턴 추가 매칭
  if (!defaultServiceTypeId) {
    if (fileName.includes("원격")) defaultServiceTypeId = stNameMap.get("원격교육") ?? null;
    else if (fileName.includes("집체")) defaultServiceTypeId = stNameMap.get("집체") ?? null;
    else if (fileName.includes("스마트")) defaultServiceTypeId = stNameMap.get("스마트훈련") ?? null;
    else if (fileName.includes("컨설팅")) defaultServiceTypeId = stNameMap.get("HR컨설팅") ?? null;
  }

  for (let rowNum = headerRow + 1; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const record: Record<string, string> = {};

    for (const [colNum, field] of Object.entries(columnMapping)) {
      const cell = row.getCell(parseInt(colNum));
      const value = cell.value;
      if (value !== null && value !== undefined) {
        // richText 객체 처리
        if (typeof value === "object" && "richText" in (value as object)) {
          const rt = (value as { richText: Array<{ text: string }> }).richText;
          record[field] = rt.map((r) => r.text).join("").trim();
        } else {
          const str = String(value).trim();
          if (str !== "[object Object]") {
            record[field] = str;
          }
        }
      }
    }

    // 빈 행 스킵
    if (!record.companyName || record.companyName.length < 2) continue;

    // 서비스유형 결정
    let serviceTypeId = defaultServiceTypeId;
    if (record.serviceTypeName) {
      const matched = stNameMap.get(record.serviceTypeName);
      if (matched) serviceTypeId = matched;
    }
    if (!serviceTypeId) {
      // 기본값: 첫 번째 서비스유형
      serviceTypeId = serviceTypes[0]?.id ?? 1;
    }

    try {
      await prisma.customer.upsert({
        where: {
          companyName_serviceTypeId: {
            companyName: record.companyName,
            serviceTypeId,
          },
        },
        update: {
          contactName: record.contactName || undefined,
          contactTitle: record.contactTitle || undefined,
          email: record.email || undefined,
          phone: record.phone || undefined,
          salesRep: record.salesRep || undefined,
          salesTeam: record.salesTeam || undefined,
          ecoScore: record.ecoScore ? parseInt(record.ecoScore) || null : undefined,
          notes: record.notes || undefined,
          isActive: true,
        },
        create: {
          companyName: record.companyName,
          contactName: record.contactName || null,
          contactTitle: record.contactTitle || null,
          email: record.email || null,
          phone: record.phone || null,
          serviceTypeId,
          salesRep: record.salesRep || null,
          salesTeam: record.salesTeam || null,
          ecoScore: record.ecoScore ? parseInt(record.ecoScore) || null : null,
          notes: record.notes || null,
        },
      });
      success++;
    } catch (e) {
      failed++;
      errors.push(`행 ${rowNum}: ${record.companyName} - ${(e as Error).message}`);
    }
  }

  // 임포트 로그 저장
  await prisma.importLog.create({
    data: {
      fileName: file.name,
      importType: "customers",
      recordsTotal: success + failed,
      recordsSuccess: success,
      recordsFailed: failed,
      errorsJson: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return NextResponse.json({ success, failed, errors: errors.slice(0, 10) });
});
