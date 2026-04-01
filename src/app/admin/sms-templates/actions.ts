"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export interface SmsTemplate {
  id: string
  name: string
  body_text: string
  message_type: string
  variables: string[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export async function getTemplates(): Promise<SmsTemplate[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("sms_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return []
  return (data ?? []).map((t) => ({
    ...t,
    variables: Array.isArray(t.variables) ? t.variables : [],
  }))
}

export async function getTemplate(id: string): Promise<SmsTemplate | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("sms_templates")
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
  body_text: string
  message_type: string
  variables: string[]
  is_default?: boolean
}): Promise<{ id?: string; error?: string }> {
  const supabase = createAdminClient()

  if (input.is_default) {
    await supabase
      .from("sms_templates")
      .update({ is_default: false })
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("sms_templates")
    .insert({
      name: input.name,
      body_text: input.body_text,
      message_type: input.message_type,
      variables: input.variables,
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
    body_text: string
    message_type: string
    variables: string[]
    is_default?: boolean
  }
): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  if (input.is_default) {
    await supabase
      .from("sms_templates")
      .update({ is_default: false })
      .eq("is_default", true)
  }

  const { error } = await supabase
    .from("sms_templates")
    .update({
      name: input.name,
      body_text: input.body_text,
      message_type: input.message_type,
      variables: input.variables,
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
    .from("sms_templates")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  return {}
}
