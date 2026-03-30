import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const serviceTypes = await prisma.serviceType.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(serviceTypes);
}
