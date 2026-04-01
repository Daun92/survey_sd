"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  ChartColumn,
  Send,
  Mail,
  Smartphone,
  UserCheck,
  FileSearch,
  PenTool,
  Users,
  Activity,
  FileChartColumnIncreasing,
  Building2,
  Settings,
  LogOut,
  UserCog,
  FolderOpen,
  FileBarChart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/auth";

// ─── 설문 설계 ───
const designItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/projects", label: "프로젝트 관리", icon: FolderOpen },
  { href: "/admin/surveys", label: "설문 관리", icon: ClipboardList },
  { href: "/admin/cs-templates", label: "설문 템플릿", icon: BookOpen },
];

// ─── 배포 ───
const distributeItems = [
  { href: "/admin/distribute", label: "배부 관리", icon: Send },
  { href: "/admin/email-templates", label: "메일 템플릿", icon: Mail },
  { href: "/admin/sms-templates", label: "SMS 템플릿", icon: Smartphone },
];

const adminDistributeItems = [
  { href: "/admin/respondents", label: "응답자 관리", icon: UserCheck },
];

// ─── 분석 ───
const analysisItems = [
  { href: "/admin/responses", label: "응답 확인", icon: ChartColumn },
  { href: "/admin/reports", label: "리포트", icon: FileBarChart },
];

const hrdMenuItems = [
  { href: "/admin/hrd", label: "실태조사 관리", icon: FileSearch },
  { href: "/admin/hrd/design", label: "설문 설계", icon: PenTool },
  { href: "/admin/hrd/respondents", label: "응답자 관리", icon: Users },
  { href: "/admin/hrd/dashboard", label: "실시간 현황", icon: Activity },
  { href: "/admin/hrd/statistics", label: "전체 통계", icon: FileChartColumnIncreasing },
  { href: "/admin/hrd/consulting", label: "컨설팅 보고서", icon: Building2 },
];

const roleLabels: Record<string, string> = {
  admin: "관리자",
  creator: "편집자",
  viewer: "조회자",
};

const departmentLabels: Record<string, string> = {
  im: "수행/IM",
  am: "AM",
  sales: "영업기획",
  marketing: "마케팅실",
  consulting: "컨설팅",
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/hrd") return pathname === "/admin/hrd";
  if (href === "/admin/projects") return pathname.startsWith("/admin/projects");
  if (href === "/admin/reports") return pathname.startsWith("/admin/reports");
  return pathname.startsWith(href);
}

interface SidebarProps {
  userProfile: UserProfile;
  badges?: Record<string, number>;
}

export function Sidebar({ userProfile, badges = {} }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const showHrd =
    userProfile.role === "admin" || userProfile.department === "marketing";
  const showSettings = userProfile.role === "admin";

  const avatarChar =
    userProfile.displayName?.[0] || userProfile.email?.[0] || "?";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function renderNavItem(item: { href: string; label: string; icon: React.ComponentType<{ size: number }> }) {
    const active = isActive(pathname, item.href);
    const badge = badges[item.href];
    const isFailure = item.href === "/admin/distribute" && badge;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-teal-50/10 text-teal-300 font-medium"
            : "text-stone-400 hover:bg-stone-800 hover:text-white"
        }`}
      >
        <item.icon size={18} aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
        {badge != null && badge > 0 && (
          <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
            isFailure
              ? "bg-rose-500/20 text-rose-400"
              : "bg-teal-500/20 text-teal-400"
          }`}>
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 overflow-y-auto bg-stone-900 text-white">
      <div className="flex h-14 items-center px-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600 text-xs font-bold">
            E
          </div>
          <span className="text-[15px] font-semibold tracking-tight">
            EXC-Survey
          </span>
        </Link>
      </div>

      <nav className="mt-2 space-y-4 px-3 pb-20">
        {/* 설문 설계 */}
        <div>
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              설문 설계
            </span>
          </div>
          <div className="space-y-0.5">
            {designItems.map(renderNavItem)}
          </div>
        </div>

        {/* 배포 */}
        <div>
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              배포
            </span>
          </div>
          <div className="space-y-0.5">
            {distributeItems.map(renderNavItem)}
            {userProfile.role === "admin" && adminDistributeItems.map(renderNavItem)}
          </div>
        </div>

        {/* 분석 */}
        <div>
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              분석
            </span>
          </div>
          <div className="space-y-0.5">
            {analysisItems.map(renderNavItem)}
          </div>
        </div>

        {showHrd && (
          <div>
            <div className="px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                HRD 실태조사
              </span>
            </div>
            <div className="space-y-0.5">
              {hrdMenuItems.map(renderNavItem)}
            </div>
          </div>
        )}

        {showSettings && (
          <div className="border-t border-stone-800 pt-2">
            <Link
              href="/admin/settings"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(pathname, "/admin/settings")
                  ? "bg-teal-50/10 text-teal-300 font-medium"
                  : "text-stone-400 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <Settings size={18} aria-hidden="true" />
              설정
            </Link>
          </div>
        )}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-stone-800 bg-stone-900 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-700 text-xs font-semibold text-stone-300">
              {avatarChar}
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-stone-200">
                {userProfile.displayName || userProfile.email}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-teal-400">
                  {roleLabels[userProfile.role] || userProfile.role}
                </span>
                {userProfile.department && (
                  <>
                    <span className="text-[10px] text-stone-600">·</span>
                    <span className="text-[10px] text-stone-500">
                      {departmentLabels[userProfile.department] || userProfile.department}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Link
              href="/admin/account"
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-800 hover:text-stone-300 transition-colors"
              title="계정 설정"
            >
              <UserCog size={16} />
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-800 hover:text-stone-300 transition-colors"
              title="로그아웃"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
