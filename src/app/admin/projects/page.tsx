import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  FolderOpen,
  Building2,
  Calendar,
  User,
  Hash,
  Plus,
} from "lucide-react";

export const revalidate = 60;

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "진행중", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "완료", className: "bg-stone-100 text-stone-800" },
  draft: {
    label: "준비중",
    className: "border border-stone-200 text-stone-700 bg-white",
  },
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function getProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, bris_code, project_type, status, am_name, start_date, end_date, created_at, customer_id, customers(id, company_name), courses(id, sessions(id))"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return data ?? [];
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">프로젝트</h1>
          <p className="text-sm text-stone-500 mt-1">
            교육 프로젝트를 관리하세요
          </p>
        </div>
        <Link
          href="/admin/quick-create"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} />
          새 프로젝트
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-stone-400">
              <FolderOpen size={24} />
            </div>
          </div>
          <h3 className="text-sm font-medium text-stone-800 mb-1">
            등록된 프로젝트가 없습니다
          </h3>
          <p className="text-sm text-stone-500">
            새 프로젝트를 생성해 주세요.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => {
            const status =
              statusLabels[project.status] ?? statusLabels.draft;
            const customer = Array.isArray(project.customers)
              ? project.customers[0]
              : project.customers;
            const courses = Array.isArray(project.courses)
              ? project.courses
              : [];
            const courseCount = courses.length;
            const sessionCount = courses.reduce(
              (sum: number, c: { sessions?: { id: string }[] }) =>
                sum + (Array.isArray(c.sessions) ? c.sessions.length : 0),
              0
            );

            return (
              <Link
                key={project.id}
                href={`/admin/projects/${project.id}`}
                className="rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow block"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-semibold text-stone-800 leading-snug line-clamp-2 pr-2">
                      {project.name}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {customer?.company_name && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2
                        size={14}
                        className="text-stone-400 shrink-0"
                      />
                      <span className="text-[13px] text-stone-600 truncate">
                        {customer.company_name}
                      </span>
                    </div>
                  )}

                  {project.bris_code && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Hash
                        size={14}
                        className="text-stone-400 shrink-0"
                      />
                      <span className="text-[13px] text-stone-500 font-mono">
                        {project.bris_code}
                      </span>
                    </div>
                  )}

                  {project.am_name && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <User
                        size={14}
                        className="text-stone-400 shrink-0"
                      />
                      <span className="text-[13px] text-stone-600">
                        {project.am_name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mb-4">
                    <Calendar
                      size={14}
                      className="text-stone-400 shrink-0"
                    />
                    <span className="text-[13px] text-stone-500">
                      {formatDate(project.start_date)} ~{" "}
                      {formatDate(project.end_date)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-stone-100">
                    <span className="text-xs text-stone-500">
                      과정{" "}
                      <span className="font-medium text-stone-700">
                        {courseCount}
                      </span>
                    </span>
                    <span className="text-xs text-stone-500">
                      세션{" "}
                      <span className="font-medium text-stone-700">
                        {sessionCount}
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
