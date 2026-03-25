"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardList,
  BookOpen,
  MessageSquare,
  ChartColumn,
  QrCode,
  Zap,
  FileSearch,
  PenTool,
  Users,
  Activity,
  FileChartColumnIncreasing,
  Building2,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const eduMenuItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/quick-create", label: "간편 생성", icon: Zap },
  { href: "/admin/projects", label: "프로젝트", icon: FolderOpen },
  { href: "/admin/surveys", label: "설문 관리", icon: ClipboardList },
  { href: "/admin/cs-templates", label: "CS 문항 템플릿", icon: BookOpen },
  { href: "/admin/responses", label: "응답 관리", icon: MessageSquare },
  { href: "/admin/reports", label: "리포트", icon: ChartColumn },
  { href: "/admin/distribute", label: "QR 배포", icon: QrCode },
];

const hrdMenuItems = [
  { href: "/admin/hrd", label: "실태조사 관리", icon: FileSearch },
  { href: "/admin/hrd/design", label: "설문 설계", icon: PenTool },
  { href: "/admin/hrd/respondents", label: "응답자 관리", icon: Users },
  { href: "/admin/hrd/dashboard", label: "실시간 현황", icon: Activity },
  { href: "/admin/hrd/statistics", label: "전체 통계", icon: FileChartColumnIncreasing },
  { href: "/admin/hrd/consulting", label: "컨설팅 보고서", icon: Building2 },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/hrd") return pathname === "/admin/hrd";
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
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
        <div>
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              교육 만족도
            </span>
          </div>
          <div className="space-y-0.5">
            {eduMenuItems.map((item) => {
              const active = isActive(pathname, item.href);
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
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              HRD 실태조사
            </span>
          </div>
          <div className="space-y-0.5">
            {hrdMenuItems.map((item) => {
              const active = isActive(pathname, item.href);
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
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

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
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-stone-800 bg-stone-900 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-700 text-xs font-semibold text-stone-300">
              관
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-medium text-stone-200">관리자</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-800 hover:text-stone-300 transition-colors"
            title="로그아웃"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
