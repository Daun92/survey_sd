"use client";

import { use } from "react";
import BuilderShell from "@/components/survey/builder/BuilderShell";

export default function SurveyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BuilderShell surveyId={id} />;
}
