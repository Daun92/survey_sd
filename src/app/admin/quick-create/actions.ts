"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

interface QuickCreateInput {
  surveyTitle: string;
  projectId: string;
  newProjectName: string;
  customerName: string;
  educationType: string;
  startDate: string;
  endDate: string;
  distributeDate: string;
  templateId: string;
}

export interface QuickCreateResult {
  surveyId: string;
  urlToken: string;
  surveyTitle: string;
  projectName: string;
  customerName: string;
  questionCount: number;
}

export type QuickCreateResponse =
  | { success: true; data: QuickCreateResult }
  | { success: false; error: string };

function parseResponseOptions(raw: string | null): string[] | null {
  if (!raw) return null;
  if (raw.includes("/")) {
    return raw.split("/").map((s) => s.trim());
  }
  return null;
}

export async function quickCreateSurvey(formData: FormData): Promise<QuickCreateResponse> {
  try {
    // ── 인증 확인을 가장 먼저 수행 ──
    const user = await requireAuth();
    const supabase = await createClient();

    const input: QuickCreateInput = {
      surveyTitle: formData.get("surveyTitle") as string,
      projectId: formData.get("projectId") as string,
      newProjectName: formData.get("newProjectName") as string,
      customerName: formData.get("customerName") as string,
      educationType: formData.get("educationType") as string,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      distributeDate: formData.get("distributeDate") as string,
      templateId: formData.get("templateId") as string,
    };

    if (!input.surveyTitle || !input.startDate || !input.endDate) {
      return { success: false, error: "필수 항목을 모두 입력해주세요." };
    }

    // ── 사용자 역할 확인 (RLS에서 creator 이상 필요) ──
    const { data: roleData } = await supabase
      .rpc("get_user_role", { p_user_id: user.id })
      .single<{ role: string }>();

    const userRole = roleData?.role || "viewer";
    if (userRole === "viewer") {
      return { success: false, error: "설문 생성 권한이 없습니다. 관리자에게 creator 역할을 요청하세요." };
    }

    // ── 과정구분 → service_type_id 조회 (유연 매핑) ──
    const divisionMap: Record<string, { nameEn: string; nameKr: string }> = {
      classroom:     { nameEn: "in_person",      nameKr: "집체" },
      remote:        { nameEn: "remote",         nameKr: "원격교육" },
      content_dev:   { nameEn: "smart_training", nameKr: "스마트훈련" },
      smart:         { nameEn: "smart_training", nameKr: "스마트훈련" },
      hrm:           { nameEn: "hrm",            nameKr: "HRM" },
      hr_consulting: { nameEn: "hr_consulting",  nameKr: "HR컨설팅" },
    };
    const mapping = divisionMap[input.educationType] || divisionMap.classroom;

    // 전체 service_types 조회 후 유연 매칭
    const { data: allServiceTypes, error: stError } = await supabase
      .from("service_types")
      .select("id, name, name_en");

    if (stError) {
      console.error("[quick-create] service_types 조회 에러:", stError);
    }
    console.log("[quick-create] service_types 테이블:", JSON.stringify(allServiceTypes));

    let serviceTypeId: number | null = null;
    if (allServiceTypes && allServiceTypes.length > 0) {
      // 1차: name_en 매칭
      const byEn = allServiceTypes.find((st) => st.name_en === mapping.nameEn);
      // 2차: name(한글) 매칭
      const byKr = !byEn ? allServiceTypes.find((st) => st.name === mapping.nameKr) : null;
      // 3차: 첫 번째 타입 폴백
      const matched = byEn || byKr || allServiceTypes[0];
      serviceTypeId = matched.id;
    }

    if (!serviceTypeId) {
      console.error("[quick-create] service_types 비어있음, educationType:", input.educationType);
      return { success: false, error: "서비스 유형 데이터가 없습니다. 관리자에게 문의하세요." };
    }

    let projectId: string;
    let projectName: string;
    let customerName: string = "";

    if (input.projectId) {
      // ── 기존 프로젝트 사용 ──
      const { data: project, error: projectFetchError } = await supabase
        .from("projects")
        .select("id, name, customers(company_name)")
        .eq("id", input.projectId)
        .single();

      if (projectFetchError) {
        console.error("[quick-create] 프로젝트 조회 실패:", projectFetchError);
      }

      if (!project) {
        return { success: false, error: "선택한 프로젝트를 찾을 수 없습니다." };
      }

      projectId = project.id;
      projectName = project.name;
      const customer = Array.isArray(project.customers)
        ? project.customers[0]
        : project.customers;
      customerName = (customer as { company_name?: string } | null)?.company_name ?? "";
    } else {
      // ── 새 프로젝트 생성 ──
      if (!input.newProjectName || !input.customerName) {
        return { success: false, error: "프로젝트명과 고객사를 입력해주세요." };
      }

      // Find or create customer (company_name + service_type_id가 UNIQUE)
      let customerId: number;
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("company_name", input.customerName)
        .eq("service_type_id", serviceTypeId)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            company_name: input.customerName,
            service_type_id: serviceTypeId,
          })
          .select("id")
          .single();

        if (customerError || !newCustomer) {
          console.error("[quick-create] 고객사 생성 실패:", customerError);
          return { success: false, error: "고객사 생성 실패: " + (customerError?.message || "알 수 없는 오류") };
        }
        customerId = newCustomer.id;
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          customer_id: customerId,
          name: input.newProjectName,
          status: "active",
          start_date: input.startDate,
          end_date: input.endDate,
        })
        .select("id")
        .single();

      if (projectError || !project) {
        console.error("[quick-create] 프로젝트 생성 실패:", projectError);
        return { success: false, error: "프로젝트 생성 실패: " + (projectError?.message || "RLS 정책에 의해 차단되었을 수 있습니다") };
      }

      projectId = project.id;
      projectName = input.newProjectName;
      customerName = input.customerName;
    }

    // ── Create course ──
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .insert({
        project_id: projectId,
        name: projectName,
        education_type: input.educationType || "classroom",
      })
      .select("id")
      .single();

    if (courseError || !course) {
      console.error("[quick-create] 과정 생성 실패:", courseError);
      return { success: false, error: "과정 생성 실패: " + (courseError?.message || "알 수 없는 오류") };
    }

    // ── Create session ──
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        course_id: course.id,
        session_number: 1,
        name: "1차수",
        start_date: input.startDate,
        end_date: input.endDate,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("[quick-create] 차수 생성 실패:", sessionError);
      return { success: false, error: "차수 생성 실패: " + (sessionError?.message || "알 수 없는 오류") };
    }

    // ── Create survey ──
    const surveyStatus = input.distributeDate && input.distributeDate > new Date().toISOString().slice(0, 10)
      ? "draft"
      : "active";

    const { data: survey, error: surveyError } = await supabase
      .from("edu_surveys")
      .insert({
        session_id: session.id,
        project_id: projectId,
        title: input.surveyTitle,
        survey_type: "s2_edu_post",
        education_type: input.educationType || "classroom",
        status: surveyStatus,
        starts_at: input.startDate,
        ends_at: input.endDate,
        owner_id: user.id,
      })
      .select("id, url_token")
      .single();

    if (surveyError || !survey) {
      console.error("[quick-create] 설문 생성 실패:", surveyError);
      return { success: false, error: "설문 생성 실패: " + (surveyError?.message || "알 수 없는 오류") };
    }

    // ── Copy template questions ──
    let questionCount = 0;
    if (input.templateId) {
      const { data: templateQuestions } = await supabase
        .from("cs_survey_questions")
        .select("question_no, question_text, question_type, response_options, section_label, sort_order")
        .eq("template_id", input.templateId)
        .order("sort_order", { ascending: true });

      if (templateQuestions && templateQuestions.length > 0) {
        const eduQuestions = templateQuestions.map((tq) => {
          const options = parseResponseOptions(tq.response_options);
          return {
            survey_id: survey.id,
            question_code: tq.question_no,
            question_text: tq.question_text,
            question_type: tq.question_type === "single_choice" ? "multiple_choice" : tq.question_type,
            section: tq.section_label || "일반",
            sort_order: tq.sort_order,
            is_required: true,
            options: options ? JSON.stringify(options) : null,
          };
        });

        const { data: insertedQuestions, error: questionsError } = await supabase
          .from("edu_questions")
          .insert(eduQuestions)
          .select("id, question_code");

        if (questionsError) {
          console.error("[quick-create] 문항 복사 실패:", questionsError);
          return { success: false, error: "문항 복사 실패: " + questionsError.message };
        }
        questionCount = insertedQuestions?.length ?? 0;

        // ── Auto-set skip_logic for eco system questions ──
        if (insertedQuestions) {
          const ecoQ1 = insertedQuestions.find((q) => q.question_code === "에코Q1");
          if (ecoQ1) {
            const ecoFollowUps = insertedQuestions.filter((q) =>
              q.question_code === "에코Q1-1" || q.question_code === "에코기타"
            );
            if (ecoFollowUps.length > 0) {
              const skipLogic = { show_when: { question_id: ecoQ1.id, operator: "equals", value: 6 } };
              await Promise.all(
                ecoFollowUps.map((q) =>
                  supabase.from("edu_questions").update({ skip_logic: skipLogic }).eq("id", q.id)
                )
              );
            }
          }
        }
      }
    }

    return {
      success: true,
      data: {
        surveyId: survey.id,
        urlToken: survey.url_token,
        surveyTitle: input.surveyTitle,
        projectName,
        customerName,
        questionCount,
      },
    };
  } catch (err) {
    // redirect()는 NEXT_REDIRECT 에러를 throw하므로 다시 throw
    if (err instanceof Error && err.message === "NEXT_REDIRECT") {
      throw err;
    }
    // 그 외 예상치 못한 에러
    console.error("[quick-create] 예상치 못한 오류:", err);
    return { success: false, error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다." };
  }
}
