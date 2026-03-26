"use server";

import { supabase } from "@/lib/supabase";
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

function parseResponseOptions(raw: string | null): string[] | null {
  if (!raw) return null;
  if (raw.includes("/")) {
    return raw.split("/").map((s) => s.trim());
  }
  return null;
}

export async function quickCreateSurvey(formData: FormData): Promise<QuickCreateResult> {
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
    throw new Error("필수 항목을 모두 입력해주세요.");
  }

  let projectId: string;
  let projectName: string;
  let customerName: string = "";

  if (input.projectId) {
    // ── 기존 프로젝트 사용 ──
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, customers(company_name)")
      .eq("id", input.projectId)
      .single();

    if (!project) {
      throw new Error("선택한 프로젝트를 찾을 수 없습니다.");
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
      throw new Error("프로젝트명과 고객사를 입력해주세요.");
    }

    // Find or create customer
    let customerId: number;
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("company_name", input.customerName)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({ company_name: input.customerName })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        throw new Error("고객사 생성 실패: " + customerError?.message);
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
      throw new Error("프로젝트 생성 실패: " + projectError?.message);
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
    throw new Error("과정 생성 실패: " + courseError?.message);
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
    throw new Error("차수 생성 실패: " + sessionError?.message);
  }

  // ── Create survey ──
  const user = await requireAuth();
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
    throw new Error("설문 생성 실패: " + surveyError?.message);
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
        throw new Error("문항 복사 실패: " + questionsError.message);
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
    surveyId: survey.id,
    urlToken: survey.url_token,
    surveyTitle: input.surveyTitle,
    projectName,
    customerName,
    questionCount,
  };
}
