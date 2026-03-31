"use client";

import { useState, useRef } from "react";
import { Settings2, ChevronDown, ChevronUp, Save, Loader2, Upload, X, ImageIcon, Play, Square } from "lucide-react";
import { updateSurveySettings } from "../actions";
import { type SurveySettings, type RespondentFieldConfig, RESPONDENT_FIELD_PRESETS } from "./types";

interface Props {
  surveyId: string;
  initialSettings: SurveySettings;
  onSettingsChange: (settings: SurveySettings) => void;
  onSaved: () => void;
}

export function SettingsPanel({ surveyId, initialSettings, onSettingsChange, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<SurveySettings>(initialSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const respondentFields: RespondentFieldConfig[] =
    settings.respondent_fields ?? RESPONDENT_FIELD_PRESETS;

  const update = (patch: Partial<SurveySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onSettingsChange(next);
  };

  const updateField = (id: string, patch: Partial<RespondentFieldConfig>) => {
    const fields = respondentFields.map((f) =>
      f.id === id ? { ...f, ...patch } : f
    );
    update({ respondent_fields: fields });
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      update({ hero_image_url: data.url });
    } catch (e) {
      alert(e instanceof Error ? e.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSurveySettings(surveyId, settings as Record<string, unknown>);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "설정 저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-stone-700 hover:bg-stone-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-stone-400" />
          시작 · 마감 화면 설정
        </div>
        {open ? <ChevronUp size={15} className="text-stone-400" /> : <ChevronDown size={15} className="text-stone-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-stone-100 pt-4 space-y-5">
          {/* ━━━ 시작 화면 설정 ━━━ */}
          <div className="rounded-lg border border-teal-100 bg-teal-50/20 p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-teal-100">
              <Play size={14} className="text-teal-600" />
              <span className="text-[13px] font-semibold text-teal-700">시작 화면</span>
            </div>

          {/* ── 기본 토글 ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors">
              <input type="checkbox" checked={settings.collect_respondent_info !== false} onChange={(e) => update({ collect_respondent_info: e.target.checked })} className="accent-teal-600" />
              <span className="text-sm text-stone-700">응답자 정보 수집</span>
            </label>
            <label className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors">
              <input type="checkbox" checked={settings.anonymous ?? false} onChange={(e) => update({ anonymous: e.target.checked })} className="accent-teal-600" />
              <span className="text-sm text-stone-700">익명 설문</span>
            </label>
            <label className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors">
              <input type="checkbox" checked={settings.show_progress !== false} onChange={(e) => update({ show_progress: e.target.checked })} className="accent-teal-600" />
              <span className="text-sm text-stone-700">진행률 표시</span>
            </label>
            <label className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors">
              <input type="checkbox" checked={settings.show_meta_info !== false} onChange={(e) => update({ show_meta_info: e.target.checked })} className="accent-teal-600" />
              <span className="text-sm text-stone-700">예상 소요 · 문항 수</span>
            </label>
          </div>

          {/* ── 히어로 이미지 ── */}
          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-1.5">히어로 배너 이미지</label>
            {settings.hero_image_url ? (
              <div className="relative rounded-lg overflow-hidden border border-stone-200">
                <img src={settings.hero_image_url} alt="히어로 배너" className="w-full h-32 object-cover" />
                <button
                  onClick={() => update({ hero_image_url: "" })}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-stone-200 py-6 hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
              >
                {uploading ? (
                  <Loader2 size={20} className="text-stone-400 animate-spin" />
                ) : (
                  <ImageIcon size={20} className="text-stone-400" />
                )}
                <span className="text-xs text-stone-400">
                  {uploading ? "업로드 중..." : "클릭하여 이미지 업로드 (JPG, PNG, 5MB 이하)"}
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* ── 환영 메시지 ── */}
          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-1">환영 인삿말</label>
            <textarea
              value={settings.welcome_message ?? ""}
              onChange={(e) => update({ welcome_message: e.target.value })}
              placeholder="안녕하세요, 고객님.&#10;귀하의 소중한 의견은 더 나은 교육 서비스를 제공하는 데 큰 도움이 됩니다."
              rows={3}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          {/* ── 응답자 필드 구성 ── */}
          {settings.collect_respondent_info !== false && (
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-2">응답자 정보 필드</label>
              <div className="space-y-2">
                {respondentFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={(e) => updateField(field.id, { enabled: e.target.checked })}
                      className="accent-teal-600"
                    />
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      className="flex-1 rounded border border-stone-200 px-2 py-1 text-sm focus:border-teal-500 outline-none"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="accent-teal-600"
                      />
                      필수
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 개인정보 수집 안내 (쿠션 문구) ── */}
          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-1">개인정보 수집 안내</label>
            <textarea
              value={settings.privacy_consent_text ?? ""}
              onChange={(e) => update({ privacy_consent_text: e.target.value })}
              placeholder="연락처는 소정의 사은품 제공 목적으로 사용하며, 설문 참여 시 개인정보 사용 동의를 전제로 진행합니다."
              rows={2}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
            />
            <label className="flex items-center gap-2 mt-1.5 text-xs text-stone-500">
              <input
                type="checkbox"
                checked={settings.require_consent ?? false}
                onChange={(e) => update({ require_consent: e.target.checked })}
                className="accent-teal-600"
              />
              동의 체크 필수
            </label>
          </div>

          {/* ── 보안 안내문 ── */}
          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-1">보안 안내문 (하단)</label>
            <input type="text" value={settings.landing_notice ?? ""} onChange={(e) => update({ landing_notice: e.target.value })} placeholder="모든 응답은 익명으로 안전하게 처리됩니다" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
          </div>

          </div>{/* end 시작 화면 블록 */}

          {/* ━━━ 마감 화면 설정 ━━━ */}
          <div className="rounded-lg border border-rose-100 bg-rose-50/20 p-4 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
              <Square size={14} className="text-rose-500" />
              <span className="text-[13px] font-semibold text-rose-600">마감 화면</span>
            </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">마감 제목</label>
              <input type="text" value={settings.ending_title ?? ""} onChange={(e) => update({ ending_title: e.target.value })} placeholder="응답이 제출되었습니다" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">감사 메시지</label>
              <textarea value={settings.thank_you_message ?? ""} onChange={(e) => update({ thank_you_message: e.target.value })} placeholder="소중한 의견에 감사드립니다.&#10;귀하의 응답은 더 나은 서비스를 위해 소중히 활용하겠습니다." rows={3} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none" />
            </div>
          </div>
          <label className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-3 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors">
            <input type="checkbox" checked={settings.show_ending_stats ?? false} onChange={(e) => update({ show_ending_stats: e.target.checked })} className="accent-teal-600" />
            <span className="text-sm text-stone-700">마감 화면에 응답 수 · 소요시간 표시</span>
          </label>
          </div>{/* end 마감 화면 블록 */}

          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 설정 저장
          </button>
        </div>
      )}
    </div>
  );
}
