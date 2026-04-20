"use client";

import { use } from "react";
import BuilderShell from "@/components/survey/builder/BuilderShell";
import LegacyEditor from "./_legacy/LegacyEditor";

const USE_V2 = process.env.NEXT_PUBLIC_BUILDER_V2 !== "false";

export default function SurveyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return USE_V2 ? <BuilderShell surveyId={id} /> : <LegacyEditor surveyId={id} />;
}
