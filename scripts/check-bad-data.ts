import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const bad = await prisma.customer.findMany({
    where: { companyName: { contains: "object", mode: "insensitive" } },
    select: { id: true, companyName: true, serviceTypeId: true },
  });
  console.log("[object Object] 포함:", bad.length);
  bad.forEach((b) => console.log(" ", b));

  const nulls = await prisma.customer.findMany({
    where: { companyName: { contains: "null", mode: "insensitive" } },
    select: { id: true, companyName: true, serviceTypeId: true },
  });
  console.log("\nnull 포함:", nulls.length);
  nulls.forEach((b) => console.log(" ", b));

  // 짧은 이름
  const short = await prisma.customer.findMany({
    where: { companyName: { not: { contains: " " } } },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
    take: 20,
  });
  console.log("\n가나다 순 처음 20개:");
  short.forEach((b) => console.log(" ", b.id, b.companyName));

  await prisma.$disconnect();
}

main().catch(console.error);
