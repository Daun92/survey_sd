"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * 응답 한 건의 is_test 플래그를 토글/설정한다.
 * - is_test=true 로 바꾸면 리포트·집계에서 자동 제외 (기존 인프라 그대로 사용).
 * - 공통 링크로 들어왔는데 테스트였음이 사후 판명된 응답을 SQL 없이 정리할 때 사용.
 */
export async function setSubmissionTestFlag(submissionId: string, surveyId: string, isTest: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("edu_submissions")
    .update({ is_test: isTest })
    .eq("id", submissionId);

  if (error) throw new Error("테스트 플래그 변경 실패: " + error.message);

  revalidatePath(`/admin/responses/${surveyId}`);
  revalidatePath(`/admin/reports`);
  revalidatePath(`/admin/responses`);
}
