
import { GoogleGenAI, Type } from "@google/genai";
import { RiskType } from "../types";

const ALLOWED_RISK_TYPES = Object.values(RiskType).join(", ");

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: `Tipo de risco: ${ALLOWED_RISK_TYPES}` },
          justification: { type: Type.STRING },
          probability: { type: Type.INTEGER },
          impact: { type: Type.INTEGER },
          normativeCitation: { type: Type.STRING }
        },
        required: ["type", "justification", "probability", "impact", "normativeCitation"]
      }
    },
    suggestedControl: { type: Type.STRING },
    mitigationSuggested: { type: Type.STRING },
    controlEffectiveness: { type: Type.INTEGER },
    rasStatus: { type: Type.STRING },
    rasJustification: { type: Type.STRING },
    rasSource: { type: Type.STRING },
    crossLineImpacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { businessLineId: { type: Type.STRING }, reason: { type: Type.STRING } },
        required: ["businessLineId", "reason"]
      }
    },
    resolution4557Reference: { type: Type.STRING }
  },
  required: ["risks", "suggestedControl", "mitigationSuggested", "controlEffectiveness", "rasStatus", "rasJustification", "rasSource", "crossLineImpacts", "resolution4557Reference"]
};

export const analyzeOccurrence = async (
  description: string, 
  macroprocess: string, 
  businessLine: string, 
  userExistingControl?: string,
  rasPdfBase64?: string
) => {
  // Always create a new instance before call to use current API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const userPrompt = `Avaliar o fato gerador: "${description}". 
    CONTEXTO: ${macroprocess} na linha ${businessLine}. 
    CONTROLE UNIDADE: ${userExistingControl || 'Não informado.'}`;

    const parts: any[] = [{ text: userPrompt }];
    if (rasPdfBase64) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: rasPdfBase64 } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts }],
      config: {
        // Using systemInstruction for role defining as per guidelines
        systemInstruction: "Você é um Auditor de Riscos GIR experiente, especializado na Resolução BACEN 4.557. Seu objetivo é analisar fatos geradores e justificar riscos e impactos no RAS institucional. Responda em Português (Brasil).",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1
      }
    });

    // Access text property directly
    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("A IA não retornou uma resposta válida.");
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error("GIR API Error:", error);
    const errorMsg = error.message || "";
    
    if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("LIMITE DE COTA EXCEDIDO: Sua chave de API atingiu o limite de uso gratuito ou não possui faturamento configurado no Google Cloud. Por favor, conecte uma nova chave paga ou aguarde o reset da cota.");
    }
    
    if (errorMsg.includes("Requested entity was not found")) {
      throw new Error("CHAVE INVÁLIDA: A chave de API selecionada não foi encontrada. Por favor, reconecte usando o botão lateral.");
    }
    
    throw new Error("FALHA TÉCNICA: " + errorMsg);
  }
};
