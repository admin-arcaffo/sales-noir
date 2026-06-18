import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'hex';
const ENCRYPTION_KEY = "2aaceadc8a5fa0b8087be74523673bd814f91a14a79f079b71c00c27f59b71e3";
const EVOLUTION_API_URL = "https://evolution-api-production-ae1a.up.railway.app";

function getEncryptionKey() {
  return Buffer.from(ENCRYPTION_KEY, ENCODING);
}

export function decryptToken(encryptedText) {
  const key = getEncryptionKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(parts[0], ENCODING);
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], ENCODING);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function run() {
  const encryptedToken = "2dae5d68955494763497d26fb6e15d16:cd90bdf2dc9870a08a60e1:0d9d52039991499b9722297a33cc3db2";
  const instanceName = "noir-cmo886ha";
  const apiToken = decryptToken(encryptedToken);
  
  console.log("Decrypted Token:", apiToken);
  
  console.log("Calling /instance/connectionState with decrypted token...");
  const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
    method: "GET",
    headers: {
      "apikey": apiToken,
    },
  });
  
  console.log("Status:", response.status);
  const data = await response.json();
  console.log("Body:", JSON.stringify(data, null, 2));
}

run().catch(e => console.error(e));
