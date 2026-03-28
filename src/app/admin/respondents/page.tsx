import { supabase } from "@/lib/supabase";
import RespondentClient from "./respondent-client";

export const revalidate = 30;

async function getRespondents() {
  const { data } = await supabase
    .from("respondents")
    .select("*, customers:customer_id(id, company_name)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function getCustomers() {
  const { data } = await supabase
    .from("customers")
    .select("id, company_name")
    .order("company_name", { ascending: true });
  return data ?? [];
}

export default async function RespondentsPage() {
  const [respondents, customers] = await Promise.all([
    getRespondents(),
    getCustomers(),
  ]);

  return <RespondentClient respondents={respondents} customers={customers} />;
}
