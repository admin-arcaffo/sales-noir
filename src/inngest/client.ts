import { Inngest } from "inngest";

// Criando o cliente do Inngest
// Em versões recentes, passamos apenas o ID e as definições básicas.
export const inngest = new Inngest({ id: "sales-noir" });
