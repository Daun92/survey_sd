import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

export const GET = withAuth({ type: "auth" }, async (request: NextRequest) => {
  const serviceTypes = await prisma.serviceType.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(serviceTypes);
});
