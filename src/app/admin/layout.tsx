import { Sidebar } from "@/components/Sidebar";
import { getUserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function getSidebarBadges() {
  const supabase = await createClient();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    { count: activeSurveys },
    { count: recentResponses },
    { count: failedEmails },
  ] = await Promise.all([
    supabase
      .from("edu_surveys")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("edu_submissions")
      .select("*", { count: "exact", head: true })
      .gte("submitted_at", dayAgo.toISOString()),
    supabase
      .from("distributions")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  const badges: Record<string, number> = {};
  if (activeSurveys && activeSurveys > 0) badges["/admin/surveys"] = activeSurveys;
  if (recentResponses && recentResponses > 0) badges["/admin/responses"] = recentResponses;
  if (failedEmails && failedEmails > 0) badges["/admin/distribute"] = failedEmails;
  return badges;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userProfile, badges] = await Promise.all([
    getUserProfile(),
    getSidebarBadges(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar userProfile={userProfile} badges={badges} />
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
