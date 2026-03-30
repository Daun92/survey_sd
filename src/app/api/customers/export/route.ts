import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";

export async function GET() {
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    include: { serviceType: true },
    orderBy: [{ serviceTypeId: "asc" }, { companyName: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("고객사 목록");

  sheet.columns = [
    { header: "회사명", key: "companyName", width: 25 },
    { header: "서비스유형", key: "serviceType", width: 14 },
    { header: "담당자명", key: "contactName", width: 12 },
    { header: "직책", key: "contactTitle", width: 10 },
    { header: "이메일", key: "email", width: 28 },
    { header: "전화번호", key: "phone", width: 16 },
    { header: "영업담당자", key: "salesRep", width: 12 },
    { header: "소속팀", key: "salesTeam", width: 14 },
    { header: "에코점수", key: "ecoScore", width: 10 },
    { header: "비고", key: "notes", width: 20 },
  ];

  // 헤더 스타일
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  for (const c of customers) {
    sheet.addRow({
      companyName: c.companyName,
      serviceType: c.serviceType.name,
      contactName: c.contactName,
      contactTitle: c.contactTitle,
      email: c.email,
      phone: c.phone,
      salesRep: c.salesRep,
      salesTeam: c.salesTeam,
      ecoScore: c.ecoScore,
      notes: c.notes,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="customers_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
