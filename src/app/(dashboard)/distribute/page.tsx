"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, FileText } from "lucide-react";
import { DeprecatedPageBanner } from "@/components/layout/deprecated-banner";

interface Survey {
  id: number;
  title: string;
  surveyYear: number;
  surveyMonth: number;
  status: string;
  serviceType: { name: string };
  _count: { distributions: number; responses: number };
}

export default function DistributePage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);

  useEffect(() => {
    fetch("/api/surveys")
      .then((r) => r.json())
      .then(setSurveys);
  }, []);

  // draft 제외
  const activeSurveys = surveys.filter((s) => s.status !== "draft");
  const draftSurveys = surveys.filter((s) => s.status === "draft");

  return (
    <div className="space-y-6">
      <DeprecatedPageBanner
        targetPath="/admin/distribute"
        targetLabel="교육 배포 관리자"
      />
      <div>
        <h1 className="text-2xl font-bold">배포 관리</h1>
        <p className="text-muted-foreground">설문을 선택하여 배포 현황을 관리하세요</p>
      </div>

      {/* 활성 설문 */}
      {activeSurveys.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">진행 중인 설문</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeSurveys.map((s) => {
              const responseRate = s._count.distributions > 0
                ? Math.round((s._count.responses / s._count.distributions) * 100)
                : 0;
              return (
                <Card key={s.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
                      <Badge variant="secondary">{s.serviceType.name}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-lg font-semibold">{s._count.distributions}</div>
                        <div className="text-muted-foreground">배포</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{s._count.responses}</div>
                        <div className="text-muted-foreground">응답</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">{responseRate}%</div>
                        <div className="text-muted-foreground">응답률</div>
                      </div>
                    </div>
                    {/* 응답률 바 */}
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${responseRate}%` }}
                      />
                    </div>
                    <Link
                      href={`/distribute/${s.id}`}
                      className={buttonVariants({ size: "sm", className: "w-full" })}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      배포 관리
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 초안 설문 */}
      {draftSurveys.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">초안 설문 (배포 가능)</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {draftSurveys.map((s) => (
              <Card key={s.id} className="opacity-70">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base leading-tight">{s.title}</CardTitle>
                    <Badge variant="outline">초안</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/distribute/${s.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
                  >
                    배포 시작
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {surveys.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>설문이 없습니다. 설문 관리에서 먼저 설문을 생성해주세요.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
