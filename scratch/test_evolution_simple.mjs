const API_URL = "https://evolution-api-production-ae1a.up.railway.app";
const GLOBAL_API_KEY = "KKKFav542691";

async function testConnection() {
  console.log(`Testando com integração baileys...`);

  try {
    const response = await fetch(`${API_URL}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": GLOBAL_API_KEY,
      },
      body: JSON.stringify({
        instanceName: "test-noir-" + Math.floor(Math.random() * 1000),
        integration: "WHATSAPP-BAILEYS", // Adicionando isso
        qrcode: true,
      }),
    });

    const data = await response.json();
    console.log("Status Code:", response.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("ERRO:", error.message);
  }
}

testConnection();
