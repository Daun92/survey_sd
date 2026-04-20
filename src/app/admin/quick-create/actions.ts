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
  sessionId: string; // 기존 세션에 연결할 경우
}

// ── 프로젝트의 과정/세션 목록 조회 (빠른 생성에서 사용) ──
export async function getProjectSessions(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, education_type, sessions(id, session_number, name, start_date, end_date)")
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  if (error) throw new Error("세션 조회 실패: " + error.message);
  return data ?? [];
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
      sessionId: formData.get("sessionId") as string,
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

    // ── 과정구분 → service_type_id 매핑 ──
    // service_types 테이블이 DB에 없으므로 Prisma seed 기준 ID 직접 매핑
    // (1:집체, 2:원격교육, 3:HRM, 4:스마트훈련, 5:HR컨설팅)
    const divisionToServiceTypeId: Record<string, number> = {
      classroom: 1,
      remote: 2,
      hrm: 3,
      content_dev: 4,
      smart: 4,
      hr_consulting: 5,
    };
    const serviceTypeId = divisionToServiceTypeId[input.educationType] ?? 1;

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

    let sessionId: string;

    if (input.sessionId) {
      // ── 기존 세션 사용 ──
      const { data: existingSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("id", input.sessionId)
        .single();

      if (!existingSession) {
        return { success: false, error: "선택한 세션을 찾을 수 없습니다." };
      }
      sessionId = existingSession.id;
    } else {
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
      sessionId = session.id;
    }

    // ── Create survey ──
    const surveyStatus = input.distributeDate && input.distributeDate > new Date().toISOString().slice(0, 10)
      ? "draft"
      : "active";

    const { data: survey, error: surveyError } = await supabase
      .from("edu_surveys")
      .insert({
        session_id: sessionId,
        project_id: projectId,
        title: input.surveyTitle,
        survey_type: "s2_edu_post",
        education_type: input.educationType || "classroom",
        status: surveyStatus,
        starts_at: input.startDate,
        ends_at: input.endDate,
        owner_id: user.id,
        settings: {
          collect_respondent_info: true,
          show_meta_info: true,
          show_progress: true,
          show_ending_stats: false,
          require_consent: false,
          anonymous: false,
        },
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
        .select(
          "id, question_no, question_text, question_type, response_options, section_label, sort_order, is_required, skip_logic, metadata"
        )
        .eq("template_id", input.templateId)
        .order("sort_order", { ascending: true });

      if (templateQuestions && templateQuestions.length > 0) {
        const eduQuestions = templateQuestions.map((tq) => {
          // options 는 metadata.source_options 우선, 없으면 response_options 파싱
          const metadata = (tq.metadata as Record<string, unknown> | null) ?? null;
          const metaOptionsRaw = metadata && (metadata as Record<string, unknown>).source_options;
          const metaOptions = Array.isArray(metaOptionsRaw)
            ? (metaOptionsRaw as unknown[]).map(String)
            : null;
          const options = metaOptions ?? parseResponseOptions(tq.response_options);

          return {
            survey_id: survey.id,
            question_code: tq.question_no,
            question_text: tq.question_text,
            question_type: tq.question_type, // 복수/단일/리커트 그대로 보존
            section: tq.section_label || "일반",
            sort_order: tq.sort_order,
            is_required: tq.is_required ?? true,
            options: options ? JSON.stringify(options) : null,
            metadata,
          };
        });

        const { data: insertedQuestions, error: questionsError } = await supabase
          .from("edu_questions")
          .insert(eduQuestions)
          .select("id, question_code, sort_order");

        if (questionsError) {
          console.error("[quick-create] 문항 복사 실패:", questionsError);
          return { success: false, error: "문항 복사 실패: " + questionsError.message };
        }
        questionCount = insertedQuestions?.length ?? 0;

        if (insertedQuestions) {
          // ── template question_id → 새 edu_questions.id 매핑 ──
          const idMap = new Map<string, string>();
          for (const tq of templateQuestions) {
            const match = insertedQuestions.find((n) => n.sort_order === tq.sort_order);
            if (match) idMap.set(tq.id, match.id);
          }

          // ── skip_logic 재매핑 (템플릿에 분기가 설정된 경우) ──
          for (const tq of templateQuestions) {
            const sl = tq.skip_logic as
              | { show_when?: { question_id?: string; operator?: string; value?: unknown } }
              | null;
            if (!sl?.show_when?.question_id) continue;
            const newId = idMap.get(tq.id);
            const remappedTarget = idMap.get(sl.show_when.question_id);
            if (!newId || !remappedTarget) continue;
            await supabase
              .from("edu_questions")
              .update({
                skip_logic: {
                  show_when: { ...sl.show_when, question_id: remappedTarget },
                },
              })
              .eq("id", newId);
          }

          // ── Backward-compat: 시스템 에코 템플릿용 기본 skip_logic (템플릿에 설정이 없을 때만) ──
          const ecoQ1 = insertedQuestions.find((q) => q.question_code === "에코Q1");
          if (ecoQ1) {
            const ecoFollowUps = insertedQuestions.filter(
              (q) => q.question_code === "에코Q1-1" || q.question_code === "에코기타"
            );
            for (const q of ecoFollowUps) {
              const tq = templateQuestions.find((t) => t.question_no === q.question_code);
              if (tq?.skip_logic) continue; // 이미 template 분기 적용됨
              const skipLogic = { show_when: { question_id: ecoQ1.id, operator: "equals", value: 6 } };
              await supabase.from("edu_questions").update({ skip_logic: skipLogic }).eq("id", q.id);
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
