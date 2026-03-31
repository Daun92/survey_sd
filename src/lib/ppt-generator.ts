import PptxGenJS from "pptxgenjs";

// 색상 상수
const COLORS = {
  dark: "18181B",
  white: "FFFFFF",
  gray: "71717A",
  lightGray: "F4F4F5",
  primary: "3B82F6",
  green: "22C55E",
  red: "EF4444",
  amber: "F59E0B",
};

interface SurveyStat {
  surveyId: number;
  title: string;
  surveyYear: number;
  surveyMonth: number;
  serviceType: string;
  overallAverage: number;
  totalDistributions: number;
  totalResponses: number;
  responseRate: number;
  categoryStats: Array<{ category: string; average: number }>;
  questionStats: Array<{
    questionText: string;
    category: string | null;
    average: number;
    count: number;
    distribution: Record<number, number>;
  }>;
}

interface VocItem {
  customer: string;
  question: string;
  answer: string;
  category: string | null;
}

interface ServiceTypeStat {
  serviceType: string;
  average: number;
  totalResponses: number;
}

interface PptData {
  year: number;
  month: number;
  overall: { average: number; totalSurveys: number; totalResponses: number; totalDistributions: number };
  serviceTypeStats: ServiceTypeStat[];
  surveys: SurveyStat[];
  voc: VocItem[];
}

export function generatePpt(data: PptData): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "CS 설문 관리 시스템";
  pptx.title = `${data.year}년 ${data.month}월 고객관계개선회의 보고서`;

  addCoverSlide(pptx, data);
  addSummarySlide(pptx, data);
  if (data.serviceTypeStats.length > 1) addServiceTypeSlide(pptx, data);
  for (const survey of data.surveys) {
    addCategorySlide(pptx, survey);
    addQuestionDetailSlide(pptx, survey);
  }
  if (data.voc.length > 0) addVocSlide(pptx, data);
  addMemoSlide(pptx, data);

  return pptx;
}

// 슬라이드 1: 표지
function addCoverSlide(pptx: PptxGenJS, data: PptData) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };

  slide.addText(`${data.month}월 고객관계개선회의 보고서`, {
    x: 1, y: 2, w: 11, h: 1.2,
    fontSize: 32, fontFace: "맑은 고딕", color: COLORS.white, bold: true,
    align: "center",
  });

  slide.addText(`${data.year}년 ${data.month}월`, {
    x: 1, y: 3.3, w: 11, h: 0.6,
    fontSize: 18, fontFace: "맑은 고딕", color: COLORS.gray, align: "center",
  });

  const today = new Date();
  slide.addText(`${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`, {
    x: 1, y: 4.2, w: 11, h: 0.5,
    fontSize: 14, fontFace: "맑은 고딕", color: COLORS.gray, align: "center",
  });
}

// 슬라이드 2: 전체 요약
function addSummarySlide(pptx: PptxGenJS, data: PptData) {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "전체 요약");

  const cards = [
    { label: "전체 평균 만족도", value: `${data.overall.average.toFixed(2)} / 5`, color: COLORS.primary },
    { label: "총 응답 수", value: `${data.overall.totalResponses}건`, color: COLORS.green },
    { label: "총 배포 수", value: `${data.overall.totalDistributions}건`, color: COLORS.amber },
    { label: "평균 응답률", value: data.overall.totalDistributions > 0
      ? `${Math.round((data.overall.totalResponses / data.overall.totalDistributions) * 100)}%`
      : "-", color: COLORS.dark },
  ];

  cards.forEach((card, i) => {
    const x = 0.5 + i * 3.1;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.5, w: 2.8, h: 1.5,
      fill: { color: COLORS.lightGray }, rectRadius: 0.1,
    });
    slide.addText(card.label, {
      x, y: 1.6, w: 2.8, h: 0.5,
      fontSize: 11, fontFace: "맑은 고딕", color: COLORS.gray, align: "center",
    });
    slide.addText(card.value, {
      x, y: 2.1, w: 2.8, h: 0.8,
      fontSize: 24, fontFace: "맑은 고딕", color: card.color, bold: true, align: "center",
    });
  });

  // 설문별 요약 테이블
  if (data.surveys.length > 0) {
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: "설문명", options: { bold: true, fill: { color: COLORS.dark }, color: COLORS.white, fontSize: 10 } },
        { text: "서비스유형", options: { bold: true, fill: { color: COLORS.dark }, color: COLORS.white, fontSize: 10 } },
        { text: "평균", options: { bold: true, fill: { color: COLORS.dark }, color: COLORS.white, fontSize: 10 } },
        { text: "응답", options: { bold: true, fill: { color: COLORS.dark }, color: COLORS.white, fontSize: 10 } },
        { text: "응답률", options: { bold: true, fill: { color: COLORS.dark }, color: COLORS.white, fontSize: 10 } },
      ],
    ];
    for (const s of data.surveys) {
      rows.push([
        { text: s.title, options: { fontSize: 9 } },
        { text: s.serviceType, options: { fontSize: 9 } },
        { text: s.overallAverage.toFixed(2), options: { fontSize: 9, align: "center" } },
        { text: `${s.totalResponses}건`, options: { fontSize: 9, align: "center" } },
        { text: `${s.responseRate}%`, options: { fontSize: 9, align: "center" } },
      ]);
    }

    slide.addTable(rows, {
      x: 0.5, y: 3.5, w: 12,
      border: { type: "solid", pt: 0.5, color: "E4E4E7" },
      colW: [5, 2, 1.5, 1.5, 1.5],
    });
  }
}

// 슬라이드 3: 서비스유형별 비교
function addServiceTypeSlide(pptx: PptxGenJS, data: PptData) {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "서비스유형별 만족도 비교");

  const chartData = [{
    name: "평균 만족도",
    labels: data.serviceTypeStats.map((s) => s.serviceType),
    values: data.serviceTypeStats.map((s) => s.average),
  }];

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5, y: 1.5, w: 12, h: 5,
    showValue: true,
    dataLabelFontSize: 10,
    catAxisOrientation: "minMax",
    valAxisMinVal: 0,
    valAxisMaxVal: 5,
    chartColors: [COLORS.primary],
  });
}

// 슬라이드 4: 카테고리별 만족도 (설문별)
function addCategorySlide(pptx: PptxGenJS, survey: SurveyStat) {
  if (survey.categoryStats.length === 0) return;

  const slide = pptx.addSlide();
  addSlideTitle(slide, `카테고리별 만족도 — ${survey.serviceType}`);

  const chartData = [{
    name: "평균",
    labels: survey.categoryStats.map((c) => c.category),
    values: survey.categoryStats.map((c) => c.average),
  }];

  slide.addChart(pptx.ChartType.bar, chartData, {
    x: 0.5, y: 1.5, w: 12, h: 5,
    showValue: true,
    dataLabelFontSize: 10,
    barDir: "bar",
    valAxisMinVal: 0,
    valAxisMaxVal: 5,
    chartColors: [COLORS.primary],
  });
}

// 슬라이드 5: 문항별 상세 테이블 (설문별)
function addQuestionDetailSlide(pptx: PptxGenJS, survey: SurveyStat) {
  if (survey.questionStats.length === 0) return;

  const slide = pptx.addSlide();
  addSlideTitle(slide, `문항별 상세 — ${survey.serviceType}`);

  const headerOpts = { bold: true, fill: { color: COLORS.dark }, color: COLORS.white, fontSize: 8 };
  const rows: PptxGenJS.TableRow[] = [
    [
      { text: "#", options: headerOpts },
      { text: "카테고리", options: headerOpts },
      { text: "문항", options: headerOpts },
      { text: "평균", options: headerOpts },
      { text: "응답", options: headerOpts },
    ],
  ];

  for (const [i, q] of survey.questionStats.entries()) {
    rows.push([
      { text: String(i + 1), options: { fontSize: 8, align: "center" } },
      { text: q.category || "", options: { fontSize: 8 } },
      { text: q.questionText, options: { fontSize: 8 } },
      { text: q.average.toFixed(2), options: { fontSize: 8, align: "center", bold: true } },
      { text: `${q.count}`, options: { fontSize: 8, align: "center" } },
    ]);
  }

  slide.addTable(rows, {
    x: 0.5, y: 1.3, w: 12,
    border: { type: "solid", pt: 0.5, color: "E4E4E7" },
    colW: [0.5, 1.5, 7.5, 1, 1],
    autoPage: true,
    autoPageRepeatHeader: true,
  });
}

// 슬라이드 6: VOC 요약
function addVocSlide(pptx: PptxGenJS, data: PptData) {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "VOC (고객 의견)");

  // 긍정/개선 분류
  const positive = data.voc.filter((v) =>
    v.question.includes("만족") || v.question.includes("좋")
  );
  const improvement = data.voc.filter((v) =>
    v.question.includes("개선") || v.question.includes("건의")
  );

  let y = 1.3;

  if (positive.length > 0) {
    slide.addText("긍정 의견", {
      x: 0.5, y, w: 5.5, h: 0.4,
      fontSize: 12, fontFace: "맑은 고딕", bold: true, color: COLORS.green,
    });
    y += 0.4;
    for (const v of positive.slice(0, 5)) {
      slide.addText(`• [${v.customer}] ${v.answer}`, {
        x: 0.7, y, w: 5.3, h: 0.35,
        fontSize: 9, fontFace: "맑은 고딕", color: COLORS.dark,
      });
      y += 0.35;
    }
  }

  y = 1.3;
  if (improvement.length > 0) {
    slide.addText("개선 의견", {
      x: 6.5, y, w: 5.5, h: 0.4,
      fontSize: 12, fontFace: "맑은 고딕", bold: true, color: COLORS.red,
    });
    y += 0.4;
    for (const v of improvement.slice(0, 5)) {
      slide.addText(`• [${v.customer}] ${v.answer}`, {
        x: 6.7, y, w: 5.3, h: 0.35,
        fontSize: 9, fontFace: "맑은 고딕", color: COLORS.dark,
      });
      y += 0.35;
    }
  }
}

// 슬라이드 7: 메모/특이사항
function addMemoSlide(pptx: PptxGenJS, data: PptData) {
  const slide = pptx.addSlide();
  addSlideTitle(slide, "이번 달 주요 이슈 / 특이사항");

  slide.addText("(여기에 내용을 추가해 주세요)", {
    x: 0.5, y: 2, w: 12, h: 3,
    fontSize: 14, fontFace: "맑은 고딕", color: COLORS.gray, align: "center", valign: "middle",
  });
}

// 헬퍼: 슬라이드 제목
function addSlideTitle(slide: PptxGenJS.Slide, title: string) {
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 12, h: 0.7,
    fontSize: 20, fontFace: "맑은 고딕", color: COLORS.dark, bold: true,
  });
  slide.addShape("line" as unknown as PptxGenJS.ShapeType, {
    x: 0.5, y: 1.05, w: 12, h: 0,
    line: { color: "E4E4E7", width: 1 },
  });
}
