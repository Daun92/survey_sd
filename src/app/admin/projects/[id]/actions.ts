"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
  const bris_code = formData.get("bris_code") as string;
  const project_type = formData.get("project_type") as string;
  const status = formData.get("status") as string;
  const am_name = formData.get("am_name") as string;
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;
  const notes = formData.get("notes") as string;

  if (!name) {
    throw new Error("프로젝트명은 필수입니다.");
  }

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      bris_code: bris_code || null,
      project_type: project_type || "education",
      status: status || "active",
      am_name: am_name || null,
      start_date: start_date || null,
      end_date: end_date || null,
      notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error("프로젝트 수정 실패: " + error.message);
  }

  revalidatePath(`/admin/projects/${id}`);
  revalidatePath("/admin/projects");
}

export async function deleteProject(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  // 안전장치: 연결된 과정(courses) 확인
  const { count: courseCount } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);

  if (courseCount && courseCount > 0) {
    return { error: `이 프로젝트에 과정이 ${courseCount}개 있어 삭제할 수 없습니다. 과정을 먼저 삭제해주세요.` };
  }

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    return { error: "프로젝트 삭제 실패: " + error.message };
  }

  revalidatePath("/admin/projects");
  return {};
}

// ─── Session CRUD ───────────────────────────────────────

export async function addSessionToCourse(
  courseId: string,
  projectId: string,
  data: {
    name?: string;
    start_date?: string;
    end_date?: string;
    capacity?: number;
  }
) {
  const supabase = await createClient();

  // 자동 번호 계산
  const { data: existing } = await supabase
    .from("sessions")
    .select("session_number")
    .eq("course_id", courseId)
    .order("session_number", { ascending: false })
    .limit(1);

  const nextNumber = (existing?.[0]?.session_number ?? 0) + 1;

  const { error } = await supabase.from("sessions").insert({
    course_id: courseId,
    session_number: nextNumber,
    name: data.name || `${nextNumber}차수`,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    capacity: data.capacity || 0,
    status: "scheduled",
  });

  if (error) throw new Error("세션 추가 실패: " + error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function updateSession(
  sessionId: string,
  projectId: string,
  data: {
    name?: string;
    start_date?: string | null;
    end_date?: string | null;
    capacity?: number;
    status?: string;
  }
) {
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.start_date !== undefined) update.start_date = data.start_date || null;
  if (data.end_date !== undefined) update.end_date = data.end_date || null;
  if (data.capacity !== undefined) update.capacity = data.capacity;
  if (data.status !== undefined) update.status = data.status;

  const { error } = await supabase
    .from("sessions")
    .update(update)
    .eq("id", sessionId);

  if (error) throw new Error("세션 수정 실패: " + error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function deleteSession(sessionId: string, projectId: string) {
  const supabase = await createClient();

  // 안전장치: 연결된 설문 확인
  const { count } = await supabase
    .from("edu_surveys")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (count && count > 0) {
    throw new Error(`이 세션에 연결된 설문이 ${count}개 있어 삭제할 수 없습니다.`);
  }

  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw new Error("세션 삭제 실패: " + error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}

// ─── Course CRUD ────────────────────────────────────────

export async function createCourse(
  projectId: string,
  data: { name: string; education_type?: string }
) {
  const supabase = await createClient();

  const { error } = await supabase.from("courses").insert({
    project_id: projectId,
    name: data.name,
    education_type: data.education_type || "classroom",
  });

  if (error) throw new Error("과정 추가 실패: " + error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function updateCourse(
  courseId: string,
  projectId: string,
  data: { name?: string; education_type?: string }
) {
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.education_type !== undefined) update.education_type = data.education_type;

  const { error } = await supabase
    .from("courses")
    .update(update)
    .eq("id", courseId);

  if (error) throw new Error("과정 수정 실패: " + error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}

export async function deleteCourse(courseId: string, projectId: string) {
  const supabase = await createClient();

  // 안전장치: 세션 존재 확인
  const { count } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (count && count > 0) {
    throw new Error(`이 과정에 세션이 ${count}개 있어 삭제할 수 없습니다. 세션을 먼저 삭제해주세요.`);
  }

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId);

  if (error) throw new Error("과정 삭제 실패: " + error.message);
  revalidatePath(`/admin/projects/${projectId}`);
}
