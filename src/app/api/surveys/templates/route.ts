import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const templates = await prisma.questionTemplate.findMany({
    include: { serviceType: true },
    orderBy: { serviceTypeId: "asc" },
  });
  return NextResponse.json(templates);
}
