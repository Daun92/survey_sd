"use client";

import { use } from "react";
import BuilderShell from "@/components/survey/builder/BuilderShell";
import { DeprecatedPageBanner } from "@/components/layout/deprecated-banner";

export default function SurveyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <>
      <DeprecatedPageBanner
        targetPath="/admin/surveys"
        targetLabel="교육 설문 관리자"
      />
      <BuilderShell surveyId={id} />
    </>
  );
}
