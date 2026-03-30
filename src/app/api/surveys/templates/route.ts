import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const templates = await prisma.questionTemplate.findMany({
    include: { serviceType: true },
    orderBy: { serviceTypeId: "asc" },
  });
  return NextResponse.json(templates);
});
