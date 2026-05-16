import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- USERS ---");
  const users = await prisma.user.findMany({
    include: { organization: true }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log("\n--- ORGANIZATIONS ---");
  const orgs = await prisma.organization.findMany();
  console.log(JSON.stringify(orgs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
