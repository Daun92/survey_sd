"use client";

import { useState } from "react";
import { Settings2, ChevronDown, ChevronUp, Save, Loader2 } from "lucide-react";
import { updateSurveySettings } from "../actions";
import { type SurveySettings } from "./types";

interface Props {
  surveyId: string;
  initialSettings: SurveySettings;
  onSettingsChange: (settings: SurveySettings) => void;
  onSaved: () => void;
}

export function SettingsPanel({ surveyId, initialSettings, onSettingsChange, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SurveySettings>(initialSettings);

  const update = (patch: Partial<SurveySettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onSettingsChange(next);
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
          랜딩 · 엔딩 페이지 설정
        </div>
        {open ? <ChevronUp size={15} className="text-stone-400" /> : <ChevronDown size={15} className="text-stone-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-stone-100 pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </div>

          <div>
            <label className="block text-[13px] font-medium text-stone-600 mb-1">개인정보 안내문 (랜딩 페이지 하단)</label>
            <input type="text" value={settings.landing_notice ?? ""} onChange={(e) => update({ landing_notice: e.target.value })} placeholder="모든 응답은 익명으로 안전하게 처리됩니다" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">엔딩 제목</label>
              <input type="text" value={settings.ending_title ?? ""} onChange={(e) => update({ ending_title: e.target.value })} placeholder="응답이 제출되었습니다" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-stone-600 mb-1">감사 메시지</label>
              <input type="text" value={settings.thank_you_message ?? ""} onChange={(e) => update({ thank_you_message: e.target.value })} placeholder="소중한 의견에 감사드립니다." className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 설정 저장
          </button>
        </div>
      )}
    </div>
  );
}
