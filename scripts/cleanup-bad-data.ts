import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // [object Object] 삭제
  const deleted1 = await prisma.customer.deleteMany({
    where: { companyName: "[object Object]" },
  });
  console.log("[object Object] 삭제:", deleted1.count);

  // 샘플 데이터 삭제 (000, 00회사)
  const deleted2 = await prisma.customer.deleteMany({
    where: { companyName: { in: ["000", "00회사"] } },
  });
  console.log("샘플 데이터 삭제:", deleted2.count);

  // 최종 통계
  const total = await prisma.customer.count({ where: { isActive: true } });
  console.log("\n최종 고객사 수:", total);

  await prisma.$disconnect();
}

main().catch(console.error);
