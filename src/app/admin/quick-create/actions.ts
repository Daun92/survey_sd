"use server";

import { supabase } from "@/lib/supabase";

interface QuickCreateInput {
  customerName: string;
  serviceTypeId: number;
  projectName: string;
  courseName: string;
  startDate: string;
  endDate: string;
  templateId: string;
}

export interface QuickCreateResult {
  surveyId: string;
  urlToken: string;
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
    customerName: formData.get("customerName") as string,
    serviceTypeId: Number(formData.get("serviceTypeId")),
    projectName: formData.get("projectName") as string,
    courseName: formData.get("courseName") as string,
    startDate: formData.get("startDate") as string,
    endDate: formData.get("endDate") as string,
    templateId: formData.get("templateId") as string,
  };

  if (!input.customerName || !input.projectName || !input.templateId || !input.startDate || !input.endDate) {
    throw new Error("필수 항목을 모두 입력해주세요.");
  }

  // 1. Find or create customer
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
      .insert({
        company_name: input.customerName,
        service_type_id: input.serviceTypeId,
      })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      throw new Error("고객사 생성 실패: " + customerError?.message);
    }
    customerId = newCustomer.id;
  }

  // 2. Create project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      customer_id: customerId,
      name: input.projectName,
      status: "active",
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    throw new Error("프로젝트 생성 실패: " + projectError?.message);
  }

  // 3. Create course
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      project_id: project.id,
      name: input.courseName || input.projectName,
    })
    .select("id")
    .single();

  if (courseError || !course) {
    throw new Error("과정 생성 실패: " + courseError?.message);
  }

  // 4. Create session
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

  // 5. Create survey
  const { data: survey, error: surveyError } = await supabase
    .from("edu_surveys")
    .insert({
      session_id: session.id,
      project_id: project.id,
      title: input.projectName + " 만족도 조사",
      survey_type: "s2_edu_post",
      status: "active",
      starts_at: input.startDate,
      ends_at: input.endDate,
    })
    .select("id, url_token")
    .single();

  if (surveyError || !survey) {
    throw new Error("설문 생성 실패: " + surveyError?.message);
  }

  // 6. Copy questions from template
  const { data: templateQuestions } = await supabase
    .from("cs_survey_questions")
    .select("question_no, question_text, question_type, response_options, section_label, sort_order")
    .eq("template_id", input.templateId)
    .order("sort_order", { ascending: true });

  let questionCount = 0;
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

    const { error: questionsError } = await supabase
      .from("edu_questions")
      .insert(eduQuestions);

    if (questionsError) {
      throw new Error("문항 복사 실패: " + questionsError.message);
    }
    questionCount = eduQuestions.length;
  }

  return {
    surveyId: survey.id,
    urlToken: survey.url_token,
    projectName: input.projectName,
    customerName: input.customerName,
    questionCount,
  };
}
