"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  variables: string[]
  education_type: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export async function getTemplates(): Promise<EmailTemplate[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return []
  return (data ?? []).map((t) => ({
    ...t,
    variables: Array.isArray(t.variables) ? t.variables : [],
  }))
}

export async function getTemplate(id: string): Promise<EmailTemplate | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) return null
  return {
    ...data,
    variables: Array.isArray(data.variables) ? data.variables : [],
  }
}

export async function createTemplate(input: {
  name: string
  subject: string
  body_html: string
  variables: string[]
  education_type?: string | null
  is_default?: boolean
}): Promise<{ id?: string; error?: string }> {
  const supabase = createAdminClient()

  // 기본 템플릿 설정 시 기존 기본 해제
  if (input.is_default) {
    await supabase
      .from("email_templates")
      .update({ is_default: false })
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: input.name,
      subject: input.subject,
      body_html: input.body_html,
      variables: input.variables,
      education_type: input.education_type ?? null,
      is_default: input.is_default ?? false,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }
  return { id: data.id }
}

export async function updateTemplate(
  id: string,
  input: {
    name: string
    subject: string
    body_html: string
    variables: string[]
    education_type?: string | null
    is_default?: boolean
  }
): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  if (input.is_default) {
    await supabase
      .from("email_templates")
      .update({ is_default: false })
      .eq("is_default", true)
  }

  const { error } = await supabase
    .from("email_templates")
    .update({
      name: input.name,
      subject: input.subject,
      body_html: input.body_html,
      variables: input.variables,
      education_type: input.education_type ?? null,
      is_default: input.is_default ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
}

export async function deleteTemplate(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
}
