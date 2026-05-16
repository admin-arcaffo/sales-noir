import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.EVOLUTION_API_URL;
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY;

async function testConnection() {
  console.log(`Testando conexão com: ${API_URL}`);
  console.log(`Usando API Key: ${GLOBAL_API_KEY}`);

  try {
    const response = await fetch(`${API_URL}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": GLOBAL_API_KEY,
      },
      body: JSON.stringify({
        instanceName: "test-connection",
        qrcode: true,
      }),
    });

    const data = await response.json();
    console.log("Status Code:", response.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("SUCESSO: Conexão estabelecida e instância teste criada.");
    } else {
      console.log("ERRO: O servidor respondeu com erro.");
    }
  } catch (error) {
    console.error("ERRO DE REDE/CONEXÃO:", error.message);
  }
}

testConnection();
