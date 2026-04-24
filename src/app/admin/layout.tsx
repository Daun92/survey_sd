import { unstable_cache } from "next/cache";
import { Sidebar } from "@/components/Sidebar";
import { getUserProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 사이드바 배지(진행중 설문/최근 응답/실패 이메일) 집계.
 * 서버측 RPC 1회 + 30초 tag cache. 모든 관리자 공통 데이터라 user-scoped 가 아님.
 * unstable_cache 콜백은 cookies() 의존 클라이언트를 사용할 수 없어 service role 로 조회.
 * 집계값(숫자)만 반환하므로 정보 누설 우려 없음.
 * mutation 쪽에서 revalidateTag("admin-sidebar-badges") 호출 시 즉시 무효화.
 */
const getCachedBadges = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .rpc("get_admin_sidebar_badges")
      .single<{
        active_surveys: number;
        recent_responses: number;
        failed_emails: number;
      }>();

    const badges: Record<string, number> = {};
    if (data?.active_surveys && data.active_surveys > 0) {
      badges["/admin/surveys"] = data.active_surveys;
    }
    if (data?.recent_responses && data.recent_responses > 0) {
      badges["/admin/responses"] = data.recent_responses;
    }
    if (data?.failed_emails && data.failed_emails > 0) {
      badges["/admin/distribute"] = data.failed_emails;
    }
    return badges;
  },
  ["admin-sidebar-badges"],
  { revalidate: 30, tags: ["admin-sidebar-badges"] }
);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userProfile, badges] = await Promise.all([
    getUserProfile(),
    getCachedBadges(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar userProfile={userProfile} badges={badges} />
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
