"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

interface RecipientInput {
  recipient_name: string;
  recipient_email?: string;
  recipient_company?: string;
  recipient_department?: string;
  recipient_position?: string;
  recipient_phone?: string;
}

// ── 개인별 링크 생성 (배치 단위) ──
export async function createPersonalLinks(
  surveyId: string,
  recipients: RecipientInput[],
  batchTitle?: string
) {
  if (recipients.length === 0) {
    throw new Error("수신자를 1명 이상 입력해 주세요.");
  }

  // 1. 배치 생성
  const { data: batch, error: batchError } = await supabase
    .from("distribution_batches")
    .insert({
      survey_id: surveyId,
      channel: "link",
      title: batchTitle || `개인 링크 배치 (${new Date().toLocaleDateString("ko-KR")})`,
      total_count: recipients.length,
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    throw new Error("배치 생성 실패: " + (batchError?.message ?? "알 수 없는 오류"));
  }

  // 2. 개별 배포 레코드 생성
  const distributions = recipients.map((r) => ({
    batch_id: batch.id,
    survey_id: surveyId,
    recipient_name: r.recipient_name,
    recipient_email: r.recipient_email || null,
    recipient_company: r.recipient_company || null,
    recipient_department: r.recipient_department || null,
    recipient_position: r.recipient_position || null,
    recipient_phone: r.recipient_phone || null,
    channel: "link",
    status: "pending",
  }));

  const { error: distError } = await supabase
    .from("distributions")
    .insert(distributions);

  if (distError) {
    // 배치 롤백
    await supabase.from("distribution_batches").delete().eq("id", batch.id);
    throw new Error("개인 링크 생성 실패: " + distError.message);
  }

  revalidatePath("/admin/distribute");
  return { batchId: batch.id, count: recipients.length };
}

// ── 설문별 배포 현황 조회 ──
export async function getDistributions(surveyId: string) {
  const { data, error } = await supabase
    .from("distributions")
    .select("*, distribution_batches(title)")
    .eq("survey_id", surveyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("배포 조회 실패: " + error.message);
  return data ?? [];
}

// ── 배포 삭제 ──
export async function deleteDistribution(distributionId: string) {
  const { error } = await supabase
    .from("distributions")
    .delete()
    .eq("id", distributionId);

  if (error) throw new Error("삭제 실패: " + error.message);
  revalidatePath("/admin/distribute");
}

// ── 배치 삭제 (하위 배포 모두 삭제) ──
export async function deleteBatch(batchId: string) {
  const { error } = await supabase
    .from("distribution_batches")
    .delete()
    .eq("id", batchId);

  if (error) throw new Error("배치 삭제 실패: " + error.message);
  revalidatePath("/admin/distribute");
}
