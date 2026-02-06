
export enum RiskType {
  OPERATIONAL = 'Operacional',
  LIQUIDITY = 'Liquidez',
  LEGAL = 'Legal',
  CYBER = 'Cibernético',
  REPUTATIONAL = 'Reputacional',
  CREDIT = 'Crédito',
  MARKET = 'Mercado',
  SOCIO_ENVIRONMENTAL = 'Sócioambiental',
  COMPLIANCE = 'Compliance',
  STRATEGIC = 'Estratégico',
  INTEGRITY = 'Integridade'
}

export interface Macroprocess {
  id: string;
  name: string;
}

export interface BusinessLine {
  id: string;
  name: string;
  macroprocesses: Macroprocess[];
  relevantRisks: RiskType[];
}

export interface Occurrence {
  id: string;
  businessLineId: string;
  macroprocessId: string;
  description: string;
  date: string;
  analysis?: AIAnalysis;
  linkedOccurrences?: string[];
}

export interface AIRiskEntry {
  type: RiskType;
  justification: string;
  probability: 1 | 2 | 3 | 4 | 5; // Nota (A)
  impact: 1 | 2 | 3 | 4 | 5;      // Nota (B)
  // Added normativeCitation to match schema and UI usage
  normativeCitation: string;
}

export interface AIAnalysis {
  risks: AIRiskEntry[];
  existingControl: string;        
  suggestedControl: string;       
  mitigationSuggested: string;    
  controlEffectiveness: number;   
  rasStatus: 'Dentro' | 'Alerta' | 'Fora'; // Comparativo RAS
  rasJustification: string;       // Justificativa do status RAS
  rasSource: 'Documento' | 'Resolução 4557'; // Origem da análise
  crossLineImpacts: {
    businessLineId: string;
    reason: string;
  }[];
  resolution4557Reference: string;
}

export interface RiskWeight {
  riskType: RiskType;
  weight: number;
}

export interface DataSnapshot {
  id: string;
  timestamp: string;
  dataCount: number;
  data: Occurrence[];
}
