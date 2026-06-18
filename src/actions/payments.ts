"use server";

import { headers } from "next/headers";
import { registerPendingPayment } from "./crm";

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "";
const isProduction = process.env.ASAAS_ENVIRONMENT === "production";
const ASAAS_API_URL = isProduction 
  ? "https://api.asaas.com/v3" 
  : "https://sandbox.asaas.com/api/v3";

// Helper to make requests to Asaas
async function asaasFetch(endpoint: string, options: RequestInit = {}) {
  if (!ASAAS_API_KEY) {
    throw new Error("Asaas API key is not configured in environment variables (ASAAS_API_KEY).");
  }

  const url = `${ASAAS_API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "access_token": ASAAS_API_KEY,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Asaas API error: ${response.status} ${response.statusText} - ${text}`);
  }

  if (!response.ok) {
    const errorDetails = data.errors ? data.errors.map((e: any) => e.description).join(", ") : "Erro desconhecido";
    throw new Error(`Asaas error [${response.status}]: ${errorDetails}`);
  }

  return data;
}

// Find or Create Asaas Customer
async function getOrCreateCustomer(name: string, email: string, cpfCnpj: string) {
  const cleanEmail = email.toLowerCase().trim();
  const cleanCpfCnpj = cpfCnpj.replace(/\D/g, "");

  try {
    // Search existing customer by email
    const searchResult = await asaasFetch(`/customers?email=${encodeURIComponent(cleanEmail)}`);
    if (searchResult.data && searchResult.data.length > 0) {
      return searchResult.data[0].id;
    }
  } catch (err) {
    console.warn("Error searching customer in Asaas, creating new one:", err);
  }

  // Create new customer
  const customer = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: name.trim(),
      email: cleanEmail,
      cpfCnpj: cleanCpfCnpj
    })
  });

  return customer.id;
}

// 1. Create Pix Payment (Single Charge)
export async function createAsaasPixPayment(input: {
  email: string;
  name: string;
  cpfCnpj: string;
  plan: "mensal" | "anual";
}) {
  try {
    const customerId = await getOrCreateCustomer(input.name, input.email, input.cpfCnpj);
    
    // Monthly: R$ 109,90, Annual with 20% discount: R$ 1.055,04
    const value = input.plan === "mensal" ? 109.90 : 1055.04;
    const description = `Sales Arcaffo - ${input.plan === "mensal" ? "Plano Mensal (Pix)" : "Plano Anual (Pix - 20% OFF)"}`;
    
    // Set due date to today
    const today = new Date();
    const dueDate = today.toISOString().split("T")[0];

    // Create payment in Asaas
    const payment = await asaasFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value,
        dueDate,
        description
      })
    });

    // Get QR Code image and payload key
    const qrCodeData = await asaasFetch(`/payments/${payment.id}/pixQrCode`);

    return {
      success: true,
      paymentId: payment.id,
      qrCodeImage: qrCodeData.encodedImage, // Base64 PNG image
      pixKey: qrCodeData.payload, // Copy & paste code
      expirationDate: qrCodeData.expirationDate
    };
  } catch (error: any) {
    console.error("Asaas Pix Payment Creation Error:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido ao gerar Pix no Asaas."
    };
  }
}

// 2. Create Credit Card Payment (Installment for Annual, Subscription for Monthly)
export async function createAsaasCardPayment(input: {
  email: string;
  name: string;
  cpfCnpj: string;
  plan: "mensal" | "anual";
  cardNum: string;
  cardName: string;
  cardExpiry: string;
  cardCvv: string;
}) {
  try {
    const customerId = await getOrCreateCustomer(input.name, input.email, input.cpfCnpj);
    
    const headersList = await headers();
    const clientIp = headersList.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";

    const [expiryMonth, expiryYear] = input.cardExpiry.split("/");
    const fullYear = `20${expiryYear}`;

    const creditCard = {
      holderName: input.cardName.trim().toUpperCase(),
      number: input.cardNum.replace(/\s/g, ""),
      expiryMonth: expiryMonth.trim(),
      expiryYear: fullYear.trim(),
      cvv: input.cardCvv.trim()
    };

    const creditCardHolderInfo = {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
      postalCode: "01001000", // Default / Fallback CEP (São Paulo center) to simplify UX
      addressNumber: "100", // Default address number
      phone: "11999999999" // Default contact phone
    };

    if (input.plan === "mensal") {
      // Create Asaas Subscription for Monthly Plan
      const today = new Date();
      const nextDueDate = today.toISOString().split("T")[0];

      const subscription = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: 109.90,
          nextDueDate,
          cycle: "MONTHLY",
          description: "Sales Arcaffo - Assinatura Mensal (Cartão)",
          creditCard,
          creditCardHolderInfo,
          remoteIp: clientIp
        })
      });

      // Approve upgrade on DB automatically
      await registerPendingPayment(input.email, "mensal");

      return {
        success: true,
        subscriptionId: subscription.id
      };
    } else {
      // Plano Anual: R$ 1.318,80 divided into 12 installments of R$ 109,90 without interest
      const today = new Date();
      const dueDate = today.toISOString().split("T")[0];

      const payment = await asaasFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: 1318.80,
          installmentCount: 12,
          dueDate,
          description: "Sales Arcaffo - Plano Anual (12x Cartão)",
          creditCard,
          creditCardHolderInfo,
          remoteIp: clientIp
        })
      });

      // Approve upgrade on DB automatically
      await registerPendingPayment(input.email, "anual");

      return {
        success: true,
        paymentId: payment.id
      };
    }
  } catch (error: any) {
    console.error("Asaas Card Payment Creation Error:", error);
    return {
      success: false,
      error: error.message || "Erro ao processar transação de cartão com o Asaas."
    };
  }
}

// 3. Poll Payment Status for Pix
export async function checkAsaasPaymentStatus(paymentId: string, email: string, plan: "mensal" | "anual") {
  try {
    const payment = await asaasFetch(`/payments/${paymentId}`);
    
    // In Asaas, payment is paid when status is CONFIRMED or RECEIVED
    const isPaid = payment.status === "CONFIRMED" || payment.status === "RECEIVED";
    
    if (isPaid) {
      await registerPendingPayment(email, plan);
      return {
        success: true,
        paid: true,
        status: payment.status
      };
    }

    return {
      success: true,
      paid: false,
      status: payment.status
    };
  } catch (error: any) {
    console.error("Error checking Asaas payment status:", error);
    return {
      success: false,
      paid: false,
      error: error.message || "Erro ao verificar status de pagamento."
    };
  }
}
