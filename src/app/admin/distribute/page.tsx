import { supabase } from "@/lib/supabase";
import DistributeClient from "./distribute-client";

export const revalidate = 60;

async function getSurveyData() {
  const { data: surveys } = await supabase
    .from("edu_surveys")
    .select(`
      id, title, status, url_token, created_at,
      sessions ( id, name,
        class_groups ( id, name, survey_url_token )
      )
    `)
    .in("status", ["active", "draft"])
    .order("created_at", { ascending: false });

  return (surveys ?? []).map((s: any) => ({
    id: s.id,
    title: s.title,
    token: s.url_token,
    status: s.status,
    classGroups: (s.sessions?.class_groups ?? []).map((g: any) => ({
      id: g.id,
      name: g.name,
      token: g.survey_url_token,
    })),
  }));
}

export default async function DistributePage() {
  const surveys = await getSurveyData();

  return <DistributeClient surveys={surveys} />;
}
