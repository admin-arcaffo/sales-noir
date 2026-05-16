import { PrismaClient } from '@prisma/client';

async function testConnection(url) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url
      }
    }
  });

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.log(`Erro com URL ${url.split('@')[1]}: ${err.message}`);
    return false;
  }
}

async function run() {
  const pwd1 = "KKKFav542691";
  const pwd2 = "Arcaffo@123";
  const user = "postgres.ltagymjyplakhpyfxoib";
  const host = "aws-1-us-west-2.pooler.supabase.com";

  const url1 = `postgresql://${user}:${pwd1}@${host}:5432/postgres`;
  const url2 = `postgresql://${user}:Arcaffo%40123@${host}:5432/postgres`;

  console.log("Testando URL 1 (KKKFav)...");
  if (await testConnection(url1)) {
    console.log("✅ URL 1 FUNCIONOU!");
    process.exit(0);
  }

  console.log("Testando URL 2 (Arcaffo@123)...");
  if (await testConnection(url2)) {
    console.log("✅ URL 2 FUNCIONOU!");
    process.exit(0);
  }

  console.log("❌ Nenhuma funcionou.");
  process.exit(1);
}

run();
