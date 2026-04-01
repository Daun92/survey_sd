import { createAdminClient } from "@/lib/supabase/admin"
import SmsTemplateEditor from "./template-editor"

export const dynamic = "force-dynamic"

async function getTemplates() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("sms_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  return (data ?? []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    name: t.name as string,
    body_text: t.body_text as string,
    message_type: t.message_type as string,
    variables: Array.isArray(t.variables) ? (t.variables as string[]) : [],
    is_default: t.is_default as boolean,
    created_at: t.created_at as string,
    updated_at: t.updated_at as string,
  }))
}

export default async function SmsTemplatesPage() {
  const templates = await getTemplates()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-800">SMS 템플릿</h1>
        <p className="mt-1 text-sm text-stone-500">
          설문 안내 문자 메시지 템플릿을 관리합니다
        </p>
      </div>
      <SmsTemplateEditor templates={templates} />
    </div>
  )
}
