
import { RiskType } from "../types";

export const analyzeOccurrence = async (
  description: string, 
  macroprocess: string, 
  businessLine: string, 
  userExistingControl?: string,
  rasPdfBase64?: string
) => {
  console.log("[GIR-DEBUG] Enviando solicitação para análise via API Serverless...");
  
  try {
    const response = await fetch('/api/eval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        macroprocess,
        businessLine,
        userExistingControl,
        rasPdfBase64
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GIR-DEBUG] Falha na resposta da API:", {
        status: response.status,
        text: errorText
      });
      throw new Error(`Erro na API (${response.status}): ${errorText || 'Erro desconhecido'}`);
    }

    const data = await response.json();
    console.log("[GIR-DEBUG] Análise da IA recebida com sucesso.");
    return data;

  } catch (error: any) {
    console.error("[GIR-DEBUG] Erro de rede ou processamento:", error);
    throw new Error(error.message || "O motor de IA não pôde ser alcançado. Verifique os logs do servidor.");
  }
};
