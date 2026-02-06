
import { GoogleGenAI, Type } from "@google/genai";

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
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

export default async function handler(req: any, res: any) {
  // Configuração de CORS para permitir requisições do frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { description, macroprocess, businessLine, userExistingControl, rasPdfBase64 } = req.body;

  console.log(`[API-LOG] Iniciando análise para fato: ${description.substring(0, 50)}...`);

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("[API-ERROR] Chave de API (process.env.API_KEY) não encontrada nas variáveis da Vercel.");
    return res.status(500).json({ error: 'Configuração Incompleta: API_KEY não definida no dashboard da Vercel.' });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const userPrompt = `Avaliar o fato gerador: "${description}". 
    CONTEXTO: ${macroprocess} na linha ${businessLine}. 
    CONTROLE UNIDADE: ${userExistingControl || 'Não informado.'}`;

    const parts: any[] = [{ text: userPrompt }];
    if (rasPdfBase64) {
      console.log("[API-LOG] PDF detectado, processando anexo multimodal...");
      parts.push({ inlineData: { mimeType: "application/pdf", data: rasPdfBase64 } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts }],
      config: {
        systemInstruction: "Você é um Auditor de Riscos GIR experiente, especializado na Resolução BACEN 4.557. Seu objetivo é analisar fatos geradores e justificar riscos e impactos no RAS institucional. Responda em JSON estruturado.",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) {
      throw new Error("O modelo não retornou conteúdo textual.");
    }

    console.log("[API-LOG] Sucesso no processamento Gemini.");
    return res.status(200).json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("[API-ERROR] Falha crítica na função serverless:", error);
    return res.status(500).json({ 
      error: 'Erro no Motor de IA', 
      message: error.message || 'Erro desconhecido',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
