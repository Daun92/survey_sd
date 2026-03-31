import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import ExcelJS from "exceljs";

// GET /api/reports/export — Excel 내보내기
export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const surveyId = searchParams.get("surveyId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const surveyWhere: Record<string, unknown> = {};
  if (surveyId) surveyWhere.id = parseInt(surveyId);
  if (year) surveyWhere.surveyYear = parseInt(year);
  if (month) surveyWhere.surveyMonth = parseInt(month);

  const surveys = await prisma.survey.findMany({
    where: surveyWhere,
    include: {
      serviceType: true,
      questions: { orderBy: { questionOrder: "asc" } },
      responses: {
        where: { isComplete: true },
        include: {
          answers: true,
          customer: { select: { companyName: true, contactName: true } },
        },
      },
      _count: { select: { distributions: true } },
    },
  });

  const wb = new ExcelJS.Workbook();

  // 시트 1: 전체 요약
  const summarySheet = wb.addWorksheet("요약");
  summarySheet.columns = [
    { header: "설문명", key: "title", width: 35 },
    { header: "서비스유형", key: "serviceType", width: 14 },
    { header: "년도", key: "year", width: 8 },
    { header: "월", key: "month", width: 6 },
    { header: "배포 수", key: "distributions", width: 10 },
    { header: "응답 수", key: "responses", width: 10 },
    { header: "응답률(%)", key: "responseRate", width: 12 },
    { header: "전체 평균", key: "average", width: 10 },
  ];
  styleHeader(summarySheet);

  for (const survey of surveys) {
    const ratingQuestions = survey.questions.filter((q) => q.questionType.startsWith("rating"));
    const allAnswers = survey.responses.flatMap((r) =>
      r.answers.filter((a) => a.answerNumeric !== null && ratingQuestions.some((q) => q.id === a.questionId))
    );
    const avg = allAnswers.length > 0
      ? allAnswers.reduce((s, a) => s + a.answerNumeric!, 0) / allAnswers.length
      : 0;
    const responseRate = survey._count.distributions > 0
      ? Math.round((survey.responses.length / survey._count.distributions) * 100)
      : 0;

    summarySheet.addRow({
      title: survey.title,
      serviceType: survey.serviceType.name,
      year: survey.surveyYear,
      month: survey.surveyMonth,
      distributions: survey._count.distributions,
      responses: survey.responses.length,
      responseRate,
      average: Math.round(avg * 100) / 100,
    });
  }

  // 시트 2: 문항별 상세 (설문별)
  for (const survey of surveys) {
    const sheetName = survey.title.substring(0, 28).replace(/[\\/*?[\]]/g, "");
    const detailSheet = wb.addWorksheet(sheetName);

    const ratingQuestions = survey.questions.filter((q) => q.questionType.startsWith("rating"));
    detailSheet.columns = [
      { header: "#", key: "order", width: 5 },
      { header: "카테고리", key: "category", width: 14 },
      { header: "문항", key: "question", width: 45 },
      { header: "유형", key: "type", width: 10 },
      { header: "평균", key: "average", width: 8 },
      { header: "응답 수", key: "count", width: 10 },
      ...Array.from({ length: 5 }, (_, i) => ({
        header: `${i + 1}점`, key: `score${i + 1}`, width: 7,
      })),
    ];
    styleHeader(detailSheet);

    for (const [idx, q] of ratingQuestions.entries()) {
      const answers = survey.responses.flatMap((r) =>
        r.answers.filter((a) => a.questionId === q.id && a.answerNumeric !== null)
      );
      const values = answers.map((a) => a.answerNumeric!);
      const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      const dist: Record<string, number> = {};
      for (let i = 1; i <= 5; i++) dist[`score${i}`] = values.filter((v) => v === i).length;

      detailSheet.addRow({
        order: idx + 1,
        category: q.category,
        question: q.questionText,
        type: q.questionType === "rating_5" ? "5점" : "10점",
        average: Math.round(avg * 100) / 100,
        count: values.length,
        ...dist,
      });
    }
  }

  // 시트 3: 개별 응답 원본
  const rawSheet = wb.addWorksheet("개별응답");
  const allQuestions = surveys.flatMap((s) => s.questions.filter((q) => q.questionType.startsWith("rating")));
  const uniqueQuestions = Array.from(new Map(allQuestions.map((q) => [q.questionText, q])).values());

  rawSheet.columns = [
    { header: "설문명", key: "survey", width: 30 },
    { header: "고객사", key: "company", width: 20 },
    { header: "담당자", key: "contact", width: 12 },
    ...uniqueQuestions.map((q, i) => ({
      header: `Q${i + 1}`, key: `q${q.id}`, width: 7,
    })),
  ];
  styleHeader(rawSheet);

  for (const survey of surveys) {
    for (const resp of survey.responses) {
      const row: Record<string, unknown> = {
        survey: survey.title,
        company: resp.customer.companyName,
        contact: resp.customer.contactName,
      };
      for (const a of resp.answers) {
        if (a.answerNumeric !== null) {
          row[`q${a.questionId}`] = a.answerNumeric;
        }
      }
      rawSheet.addRow(row);
    }
  }

  // 시트 4: VOC
  const vocSheet = wb.addWorksheet("VOC");
  vocSheet.columns = [
    { header: "설문명", key: "survey", width: 30 },
    { header: "고객사", key: "company", width: 20 },
    { header: "문항", key: "question", width: 40 },
    { header: "응답", key: "answer", width: 60 },
  ];
  styleHeader(vocSheet);

  for (const survey of surveys) {
    const textQuestions = survey.questions.filter((q) => q.questionType === "text");
    for (const resp of survey.responses) {
      for (const a of resp.answers) {
        const q = textQuestions.find((tq) => tq.id === a.questionId);
        if (q && a.answerValue?.trim()) {
          vocSheet.addRow({
            survey: survey.title,
            company: resp.customer.companyName,
            question: q.questionText,
            answer: a.answerValue,
          });
        }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CS_report_${dateStr}.xlsx"`,
    },
  });
});

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  sheet.getRow(1).height = 24;
}
