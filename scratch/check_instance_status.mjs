const API_URL = "https://evolution-api-production-ae1a.up.railway.app";
const GLOBAL_API_KEY = "KKKFav542691";
const INSTANCE_NAME = "noir-cmo886ha";

async function checkStatus() {
  console.log(`Checando status da instância: ${INSTANCE_NAME}`);

  try {
    const response = await fetch(`${API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      method: "GET",
      headers: {
        "apikey": GLOBAL_API_KEY,
      },
    });

    const data = await response.json();
    console.log("Status Code:", response.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("ERRO:", error.message);
  }
}

checkStatus();
