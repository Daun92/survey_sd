import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ============================
// 문항 타입 정의
// ============================
interface TemplateQuestion {
  questionOrder: number;
  questionText: string;
  questionType: "rating_5" | "rating_10" | "text" | "single_choice" | "multi_choice";
  category: string;
  isRequired: boolean;
  options?: string[] | null;
}

// ============================
// 공통 문항 (전 서비스유형 공유)
// ============================
// 카테고리 D: 전반적 만족도 + 카테고리 E: 주관식
const commonSuffix: TemplateQuestion[] = [
  // D. 전반적 만족도
  { questionOrder: 50, questionText: "교육 후 업무 적용 가능성은 어떠십니까?",    questionType: "rating_5", category: "전반적만족도", isRequired: true },
  { questionOrder: 51, questionText: "교육 서비스에 대한 전반적인 만족도는 어떠십니까?", questionType: "rating_5", category: "전반적만족도", isRequired: true },
  { questionOrder: 52, questionText: "향후 동일 서비스를 재이용할 의향이 있으십니까?",  questionType: "rating_5", category: "전반적만족도", isRequired: true },
  { questionOrder: 53, questionText: "해당 서비스를 다른 기업/담당자에게 추천할 의향이 있으십니까?", questionType: "rating_5", category: "전반적만족도", isRequired: true },
  // E. 주관식 (VOC)
  { questionOrder: 60, questionText: "가장 만족스러운 점은 무엇입니까?",           questionType: "text", category: "주관식", isRequired: false },
  { questionOrder: 61, questionText: "개선이 필요한 점이나 건의사항을 자유롭게 작성해 주세요.", questionType: "text", category: "주관식", isRequired: false },
];

// ============================
// 서비스유형별 전용 문항
// ============================

// --- 집체 (In-person Training) ---
const inPersonQuestions: TemplateQuestion[] = [
  // A. 교육내용
  { questionOrder: 1,  questionText: "교육 일정 및 시간 배분은 적절하였습니까?",      questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 2,  questionText: "교육 자료(교재, 핸드아웃 등)는 충분하였습니까?",   questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 3,  questionText: "커리큘럼 구성이 체계적이었습니까?",             questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 4,  questionText: "실습 및 사례 중심 구성은 적절하였습니까?",       questionType: "rating_5", category: "교육내용", isRequired: true },
  // B. 강사
  { questionOrder: 10, questionText: "강사의 전문 지식 및 강의력에 만족하십니까?",     questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 11, questionText: "강사의 교수법 및 전달력은 적절하였습니까?",      questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 12, questionText: "강사 자료 활용은 적절하였습니까?",             questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 13, questionText: "강사의 현장 경험 반영도에 만족하십니까?",        questionType: "rating_5", category: "강사", isRequired: true },
  // C. 운영
  { questionOrder: 20, questionText: "교육 운영(일정 안내, 진행 등)에 만족하십니까?",   questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 21, questionText: "교육 환경(교육장, 시설 등)에 만족하십니까?",     questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 22, questionText: "교육 담당자의 응대 및 지원에 만족하십니까?",      questionType: "rating_5", category: "운영", isRequired: true },
  ...commonSuffix,
];

// --- 원격교육 (Remote Education) ---
const remoteQuestions: TemplateQuestion[] = [
  // A. 교육내용
  { questionOrder: 1,  questionText: "교육 콘텐츠의 품질에 만족하십니까?",            questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 2,  questionText: "교육 내용이 실무에 도움이 되었습니까?",           questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 3,  questionText: "커리큘럼 구성이 체계적이었습니까?",             questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 4,  questionText: "온라인 콘텐츠의 구성 및 분량은 적절하였습니까?",   questionType: "rating_5", category: "교육내용", isRequired: true },
  // B. 강사
  { questionOrder: 10, questionText: "강사(튜터)의 전문성에 만족하십니까?",           questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 11, questionText: "강사(튜터)의 학습 지원 및 피드백은 적절하였습니까?", questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 12, questionText: "온라인 환경에서의 소통은 원활하였습니까?",        questionType: "rating_5", category: "강사", isRequired: true },
  // C. 운영
  { questionOrder: 20, questionText: "교육 운영(안내, 일정관리 등)에 만족하십니까?",    questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 21, questionText: "LMS 시스템 접근성 및 사용 편의성에 만족하십니까?", questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 22, questionText: "학습 진행 중 기술 지원에 만족하십니까?",          questionType: "rating_5", category: "운영", isRequired: true },
  ...commonSuffix,
];

// --- HRM ---
const hrmQuestions: TemplateQuestion[] = [
  // A. 교육내용 (진단/분석)
  { questionOrder: 1,  questionText: "HRM 진단 결과의 정확성에 만족하십니까?",        questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 2,  questionText: "진단 결과에 기반한 개선 방향이 유용하였습니까?",    questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 3,  questionText: "결과보고의 품질 및 내용에 만족하십니까?",         questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 4,  questionText: "결과물이 조직 니즈에 부합하였습니까?",           questionType: "rating_5", category: "교육내용", isRequired: true },
  // B. 강사 (컨설턴트)
  { questionOrder: 10, questionText: "담당 컨설턴트의 전문성에 만족하십니까?",         questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 11, questionText: "컨설턴트의 맞춤형 솔루션 제공 능력에 만족하십니까?", questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 12, questionText: "담당자와의 커뮤니케이션에 만족하십니까?",          questionType: "rating_5", category: "강사", isRequired: true },
  // C. 운영
  { questionOrder: 20, questionText: "프로젝트 일정 준수 및 진행에 만족하십니까?",      questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 21, questionText: "프로젝트 비용 대비 결과물에 만족하십니까?",        questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 22, questionText: "사후 지원 및 후속 관리에 만족하십니까?",          questionType: "rating_5", category: "운영", isRequired: true },
  ...commonSuffix,
];

// --- 스마트훈련 (Smart Training) ---
const smartTrainingQuestions: TemplateQuestion[] = [
  // A. 교육내용
  { questionOrder: 1,  questionText: "훈련 콘텐츠의 품질에 만족하십니까?",            questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 2,  questionText: "훈련 내용이 실무 역량 향상에 도움이 되었습니까?",   questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 3,  questionText: "콘텐츠의 최신성 및 트렌드 반영에 만족하십니까?",    questionType: "rating_5", category: "교육내용", isRequired: true },
  // B. 강사 (튜터)
  { questionOrder: 10, questionText: "튜터의 전문성에 만족하십니까?",                questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 11, questionText: "튜터의 학습 지원 및 피드백에 만족하십니까?",       questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 12, questionText: "튜터와의 소통이 원활하였습니까?",               questionType: "rating_5", category: "강사", isRequired: true },
  // C. 운영
  { questionOrder: 20, questionText: "훈련 운영(안내, 관리 등)에 만족하십니까?",       questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 21, questionText: "훈련 플랫폼(모바일/PC) 접근성에 만족하십니까?",    questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 22, questionText: "기술 지원 및 문의 응대에 만족하십니까?",          questionType: "rating_5", category: "운영", isRequired: true },
  ...commonSuffix,
];

// --- HR컨설팅 (HR Consulting) ---
const hrConsultingQuestions: TemplateQuestion[] = [
  // A. 교육내용 (컨설팅 결과)
  { questionOrder: 1,  questionText: "HR 컨설팅 진단 및 분석의 정확성에 만족하십니까?",   questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 2,  questionText: "컨설팅 결과물의 품질에 만족하십니까?",             questionType: "rating_5", category: "교육내용", isRequired: true },
  { questionOrder: 3,  questionText: "컨설팅 결과가 조직 개선에 기여하였습니까?",         questionType: "rating_5", category: "교육내용", isRequired: true },
  // B. 강사 (컨설턴트)
  { questionOrder: 10, questionText: "컨설턴트의 전문성에 만족하십니까?",               questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 11, questionText: "컨설턴트의 산업별 이해도에 만족하십니까?",          questionType: "rating_5", category: "강사", isRequired: true },
  { questionOrder: 12, questionText: "프로젝트 진행 과정에서의 소통에 만족하십니까?",      questionType: "rating_5", category: "강사", isRequired: true },
  // C. 운영
  { questionOrder: 20, questionText: "프로젝트 일정 및 비용이 적절하였습니까?",          questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 21, questionText: "후속 지원 및 사후 관리에 만족하십니까?",           questionType: "rating_5", category: "운영", isRequired: true },
  { questionOrder: 22, questionText: "프로젝트 전반의 진행 과정에 만족하십니까?",         questionType: "rating_5", category: "운영", isRequired: true },
  ...commonSuffix,
];

// ============================
// 시드 실행
// ============================
async function main() {
  console.log("시드 데이터 삽입 시작...");

  // --- 1. 서비스유형 ---
  const serviceTypes = [
    { name: "집체",     nameEn: "in_person" },
    { name: "원격교육",  nameEn: "remote" },
    { name: "HRM",     nameEn: "hrm" },
    { name: "스마트훈련", nameEn: "smart_training" },
    { name: "HR컨설팅",  nameEn: "hr_consulting" },
  ];

  for (const st of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { name: st.name },
      update: { nameEn: st.nameEn },
      create: { name: st.name, nameEn: st.nameEn, isActive: true },
    });
  }
  console.log("  [OK] 서비스유형 5종 완료");

  // --- 2. 문항 템플릿 ---
  const allST = await prisma.serviceType.findMany();
  const stMap = Object.fromEntries(allST.map((s) => [s.nameEn, s.id]));

  const templateDefs: Array<{
    serviceTypeEn: string;
    templateName: string;
    questions: TemplateQuestion[];
  }> = [
    { serviceTypeEn: "in_person",      templateName: "집체 교육 만족도 설문 (기본)",     questions: inPersonQuestions },
    { serviceTypeEn: "remote",         templateName: "원격교육 만족도 설문 (기본)",      questions: remoteQuestions },
    { serviceTypeEn: "hrm",            templateName: "HRM 만족도 설문 (기본)",         questions: hrmQuestions },
    { serviceTypeEn: "smart_training", templateName: "스마트훈련 만족도 설문 (기본)",    questions: smartTrainingQuestions },
    { serviceTypeEn: "hr_consulting",  templateName: "HR컨설팅 만족도 설문 (기본)",     questions: hrConsultingQuestions },
  ];

  for (const def of templateDefs) {
    const serviceTypeId = stMap[def.serviceTypeEn];
    if (!serviceTypeId) {
      console.warn(`  [SKIP] 서비스유형 매핑 실패: ${def.serviceTypeEn}`);
      continue;
    }

    // 기존 기본 템플릿이 있으면 업데이트, 없으면 생성
    const existing = await prisma.questionTemplate.findFirst({
      where: { serviceTypeId, isDefault: true },
    });

    const data = {
      serviceTypeId,
      templateName: def.templateName,
      questionsJson: JSON.stringify(def.questions),
      isDefault: true,
    };

    if (existing) {
      await prisma.questionTemplate.update({
        where: { id: existing.id },
        data: { templateName: data.templateName, questionsJson: data.questionsJson },
      });
    } else {
      await prisma.questionTemplate.create({ data });
    }

    const categories = Array.from(new Set(def.questions.map((q) => q.category)));
    console.log(`  [OK] ${def.templateName} (${def.questions.length}문항, 카테고리: ${categories.join("/")})`);
  }

  console.log("\n시드 데이터 삽입 완료!");
}

main()
  .catch((e) => {
    console.error("시드 오류:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
