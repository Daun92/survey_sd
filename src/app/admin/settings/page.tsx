import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Settings2,
  Globe,
  CheckCircle2,
  XCircle,
  Inbox,
  Server,
  Layers,
} from "lucide-react";
import { GeminiSettings } from "./gemini-settings";
import { getUserProfile, canAccessSettings } from "@/lib/auth";

export const revalidate = 300;

async function getSettingsData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: appSettings }, { data: serviceTypes }] = await Promise.all([
    supabase.from("app_settings").select("*"),
    supabase
      .from("service_types")
      .select("id, name, name_en, is_active")
      .order("name", { ascending: true }),
  ]);

  return {
    appSettings: appSettings ?? [],
    serviceTypes: serviceTypes ?? [],
  };
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const profile = await getUserProfile();
  if (!canAccessSettings(profile)) {
    redirect("/admin?error=unauthorized");
  }

  const { appSettings, serviceTypes } = await getSettingsData(supabase);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800">설정</h1>
        <p className="text-sm text-stone-500 mt-1">
          시스템 설정을 관리하세요
        </p>
      </div>

      <div className="space-y-6">
        {/* Gemini AI 설정 */}
        <GeminiSettings />
        {/* 기본 설정 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 p-5 border-b border-stone-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Server size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                기본 설정
              </h2>
              <p className="text-sm text-stone-500">
                애플리케이션 기본 설정 값
              </p>
            </div>
          </div>
          <div className="p-5">
            {appSettings.length === 0 ? (
              <div className="text-center py-6">
                <div className="flex justify-center mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
                    <Settings2 size={20} className="text-stone-400" />
                  </div>
                </div>
                <p className="text-sm text-stone-500">
                  등록된 설정이 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {appSettings.map(
                  (
                    setting: Record<string, string | number | boolean | null>,
                    idx: number,
                  ) => (
                    <div
                      key={String(setting.id ?? idx)}
                      className={`flex items-center justify-between py-3 ${idx < appSettings.length - 1 ? "border-b border-stone-100" : ""}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-700">
                          {String(setting.key ?? setting.name ?? `설정 ${idx + 1}`)}
                        </p>
                        {setting.description && (
                          <p className="text-xs text-stone-400 mt-0.5">
                            {String(setting.description)}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-stone-600 font-mono bg-stone-50 rounded-md px-2.5 py-1">
                        {String(setting.value ?? "-")}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {/* 서비스 유형 관리 */}
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 p-5 border-b border-stone-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Layers size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                서비스 유형 관리
              </h2>
              <p className="text-sm text-stone-500">
                설문에 사용되는 서비스 유형 목록
              </p>
            </div>
          </div>
          <div>
            {serviceTypes.length === 0 ? (
              <div className="text-center py-10">
                <div className="flex justify-center mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
                    <Inbox size={20} className="text-stone-400" />
                  </div>
                </div>
                <p className="text-sm text-stone-500">
                  등록된 서비스 유형이 없습니다.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center px-5 h-9 bg-stone-50/80 border-b border-stone-100">
                  <div className="flex-[2] text-xs font-medium text-stone-500">
                    서비스명
                  </div>
                  <div className="flex-[2] text-xs font-medium text-stone-500">
                    영문명
                  </div>
                  <div className="flex-1 text-xs font-medium text-stone-500 text-right">
                    상태
                  </div>
                </div>
                {serviceTypes.map((stype) => (
                  <div
                    key={stype.id}
                    className="flex items-center px-5 h-12 border-b border-stone-100 last:border-0"
                  >
                    <div className="flex-[2] flex items-center gap-2">
                      <Globe size={14} className="text-teal-600 shrink-0" />
                      <span className="text-sm font-medium text-stone-800 truncate">
                        {stype.name}
                      </span>
                    </div>
                    <div className="flex-[2] text-sm text-stone-500 truncate">
                      {stype.name_en ?? "-"}
                    </div>
                    <div className="flex-1 flex justify-end">
                      {stype.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 size={14} />
                          활성
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-400">
                          <XCircle size={14} />
                          비활성
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
