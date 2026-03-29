import { createClient } from "@/lib/supabase/server";
import RespondentClient from "./respondent-client";

export const revalidate = 30;

async function getRespondents(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("respondents")
    .select("*, customers:customer_id(id, company_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

async function getCustomers(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("customers")
    .select("id, company_name")
    .order("company_name", { ascending: true });
  return data ?? [];
}

export default async function RespondentsPage() {
  const supabase = await createClient();
  const [respondents, customers] = await Promise.all([
    getRespondents(supabase),
    getCustomers(supabase),
  ]);

  return <RespondentClient respondents={respondents} customers={customers} />;
}
