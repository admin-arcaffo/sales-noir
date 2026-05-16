import pkg from 'pg';
const { Client } = pkg;

const passwords = ["KKKFav542691", "Arcaffo@123"];
const host = "aws-1-us-west-2.pooler.supabase.com";
const user = "postgres.ltagymjyplakhpyfxoib";

async function testPasswords() {
  for (const pwd of passwords) {
    console.log(`Testando senha: ${pwd.replace(/./g, '*')}`);
    const client = new Client({
      host: host,
      port: 5432,
      user: user,
      password: pwd,
      database: "postgres",
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`✅ SUCESSO! A senha correta é: ${pwd}`);
      await client.end();
      process.exit(0);
    } catch (err) {
      console.log(`❌ Falhou: ${err.message}`);
    }
  }
  console.log("❌ Nenhuma das senhas funcionou.");
  process.exit(1);
}

testPasswords();
