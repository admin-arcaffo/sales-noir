async function cleanup() {
  const instanceName = 'noir-cmo886ha';
  const API_URL = process.env.EVOLUTION_API_URL;
  const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY;

  console.log(`Tentando deletar a instância na API: ${instanceName}...`);
  try {
    const response = await fetch(`${API_URL}/instance/delete/${instanceName}`, {
      method: "DELETE",
      headers: {
        "apikey": GLOBAL_API_KEY as string,
      },
    });

    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Body: ${text}`);
  } catch (err: any) {
    console.error(`Erro ao deletar:`, err.message);
  }
}

cleanup();
