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

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error("프로젝트 삭제 실패: " + error.message);
  }

  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}
