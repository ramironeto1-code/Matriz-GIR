
import { BusinessLine, RiskType } from './types';

export const BUSINESS_LINES: BusinessLine[] = [
  {
    id: 'financeiro',
    name: 'Financeiro Recursos Próprios',
    relevantRisks: [
      RiskType.OPERATIONAL,
      RiskType.MARKET,
      RiskType.LIQUIDITY,
      RiskType.LEGAL,
      RiskType.STRATEGIC,
      RiskType.CYBER,
      RiskType.REPUTATIONAL,
      RiskType.SOCIO_ENVIRONMENTAL,
      RiskType.COMPLIANCE,
      RiskType.INTEGRITY
    ],
    macroprocesses: [
      { id: 'f1', name: 'Contas a Pagar' },
      { id: 'f2', name: 'Contas a Receber' },
      { id: 'f3', name: 'Resgate de Aplicação Financeira / Venda TVM' },
      { id: 'f4', name: 'Aplicação Financeira' },
      { id: 'f5', name: 'Planejamento Estratégico' },
      { id: 'f6', name: 'Infraestrutura / Know How' }
    ]
  },
  {
    id: 'credito',
    name: 'Crédito (Carteira de Risco)',
    relevantRisks: [
      RiskType.OPERATIONAL,
      RiskType.CREDIT,
      RiskType.LEGAL,
      RiskType.REPUTATIONAL,
      RiskType.CYBER,
      RiskType.COMPLIANCE,
      RiskType.SOCIO_ENVIRONMENTAL,
      RiskType.INTEGRITY
    ],
    macroprocesses: [
      { id: 'c1', name: 'Atendimento' },
      { id: 'c2', name: 'Cadastro' },
      { id: 'c3', name: 'Análise' },
      { id: 'c4', name: 'Contratação' },
      { id: 'c5', name: 'Liberação' },
      { id: 'c6', name: 'Acompanhamento' },
      { id: 'c7', name: 'Cobrança Administrativa' },
      { id: 'c8', name: 'Renegociação' },
      { id: 'c9', name: 'Cobrança Judicial' },
      { id: 'c10', name: 'Administração de BNDU' },
      { id: 'c11', name: 'RH' },
      { id: 'c12', name: 'Infraestrutura' },
      { id: 'c13', name: 'Tecnologia' }
    ]
  },
  {
    id: 'fundos',
    name: 'Administração de Fundos e Repasses',
    relevantRisks: [
      RiskType.OPERATIONAL,
      RiskType.COMPLIANCE,
      RiskType.LEGAL,
      RiskType.REPUTATIONAL,
      RiskType.CYBER,
      RiskType.INTEGRITY,
      RiskType.STRATEGIC
    ],
    macroprocesses: [
      { id: 'r0', name: 'Concessão de Crédito' },
      { id: 'r1', name: 'Recebimento de Proposta' },
      { id: 'r2', name: 'Enquadramento' },
      { id: 'r3', name: 'Análise Técnica' },
      { id: 'r4', name: 'Contratação' },
      { id: 'r5', name: 'Liberação de Recursos' },
      { id: 'r6', name: 'Acompanhamento de Projeto' },
      { id: 'r7', name: 'Prestação de Contas' },
      { id: 'r8', name: 'Registro de Movimentação Financeira' },
      { id: 'r9', name: 'Planejamento Estratégico' },
      { id: 'r10', name: 'Infraestrutura/ Know How' }
    ]
  }
];
