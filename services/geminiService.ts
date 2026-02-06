
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
          justification: { 
            type: Type.STRING, 
            description: "Justificativa técnica detalhada contendo obrigatoriamente a fundamentação legal baseada na Res. 4.557." 
          },
          probability: { type: Type.INTEGER, description: "Nota de 1 a 5 para probabilidade" },
          impact: { type: Type.INTEGER, description: "Nota de 1 a 5 para impacto" },
          normativeCitation: { 
            type: Type.STRING, 
            description: "Citação específica de Artigo, Parágrafo ou Inciso da Resolução 4.557 (Ex: Art. 32, Inciso II)." 
          }
        },
        required: ["type", "justification", "probability", "impact", "normativeCitation"]
      }
    },
    suggestedControl: { type: Type.STRING },
    mitigationSuggested: { type: Type.STRING },
    controlEffectiveness: { type: Type.INTEGER },
    rasStatus: { 
      type: Type.STRING, 
      description: "Status frente à RAS. Use: 'Dentro', 'Alerta' ou 'Fora'." 
    },
    rasJustification: { 
      type: Type.STRING, 
      description: "Justificativa técnica detalhada cruzando dados do PDF RAS com os pilares da Res. 4.557." 
    },
    rasSource: { type: Type.STRING },
    crossLineImpacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          businessLineId: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["businessLineId", "reason"]
      }
    },
    resolution4557Reference: { 
      type: Type.STRING, 
      description: "Pilar principal da norma afetado (Ex: Estrutura de Gestão de Risco Operacional)." 
    }
  },
  required: [
    "risks", "suggestedControl", "mitigationSuggested", "controlEffectiveness", 
    "rasStatus", "rasJustification", "rasSource", "crossLineImpacts", "resolution4557Reference"
  ]
};

export const analyzeOccurrence = async (
  description: string, 
  macroprocess: string, 
  businessLine: string, 
  userExistingControl?: string,
  rasPdfBase64?: string
) => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("A chave de API (API_KEY) não foi detectada no servidor. Verifique as variáveis de ambiente.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const textPrompt = `ATUAÇÃO: Auditor Especialista em Riscos Integrados (GIR) - Conformidade Regulatória.
    OBJETIVO: Realizar a AVALIAÇÃO DE RISCO da ocorrência: "${description}".
    CONTEXTO: Macroprocesso "${macroprocess}" na Linha de Negócio "${businessLine}".
    CONTROLE ATUAL: ${userExistingControl || 'Nenhum informado.'}
    
    DIRETRIZES DE COMPLIANCE (BACEN 4.557):
    1. OBRIGATÓRIO: Justificar cada risco citando especificamente Artigos, Parágrafos ou Incisos da Resolução 4.557/2017.
    2. EXAUSTIVIDADE: Analise todos os riscos transversais.
    3. INTEGRIDADE: Se a RAS for fornecida (via arquivo), valide a conformidade.
    4. FORMATAÇÃO: A citação normativa deve seguir o padrão: 'Conforme Art. X, § Y, Inciso Z'.`;

    const parts: any[] = [{ text: textPrompt }];

    if (rasPdfBase64) {
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: rasPdfBase64
        }
      });
    }

    // Uso do modelo PRO para maior precisão em tarefas complexas de conformidade
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    if (!response.text) {
      throw new Error("Não foi possível obter uma resposta estruturada da IA.");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Erro na análise Gemini:", error);
    
    if (error.message?.includes("API_KEY")) {
      throw new Error("Erro de Configuração: API_KEY ausente no ambiente de hospedagem.");
    }
    
    if (error.message?.includes("quota") || error.message?.includes("429")) {
      throw new Error("Limite de requisições excedido. Tente novamente em alguns segundos.");
    }
    
    throw new Error(error.message || "Erro na comunicação com o motor de IA.");
  }
};
