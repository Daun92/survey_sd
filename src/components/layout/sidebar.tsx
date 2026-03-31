"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  GraduationCap,
  Send,
  MessageSquare,
  BarChart3,
  Upload,
} from "lucide-react";

const navigation = [
  { name: "대시보드", href: "/", icon: LayoutDashboard },
  { name: "고객사 관리", href: "/customers", icon: Building2 },
  { name: "설문 관리", href: "/surveys", icon: ClipboardList },
  { name: "교육 확인", href: "/training", icon: GraduationCap },
  { name: "배포 관리", href: "/distribute", icon: Send },
  { name: "인터뷰", href: "/interviews", icon: MessageSquare },
  { name: "리포트", href: "/reports", icon: BarChart3 },
  { name: "데이터 임포트", href: "/import", icon: Upload },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      {/* 로고 */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <ClipboardList className="h-6 w-6 text-primary" />
        <span className="font-semibold text-base">CS 설문 관리</span>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navigation.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* 하단 정보 */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          CS 설문 관리 시스템 v0.1
        </p>
      </div>
    </aside>
  );
}
