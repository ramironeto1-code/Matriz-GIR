
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { BUSINESS_LINES } from './constants';
import { Occurrence, BusinessLine, Macroprocess, AIAnalysis, RiskType, DataSnapshot } from './types';
import { analyzeOccurrence } from './services/geminiService';
import { RiskDashboard } from './components/RiskDashboard';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Loader2, 
  History as HistoryIcon,
  Database,
  CheckCircle2,
  Sparkles,
  Trash2,
  Edit3,
  FileStack,
  Download,
  FileUp,
  Table as TableIcon,
  Cpu,
  RefreshCcw,
  ArchiveRestore,
  UserCheck,
  Settings2,
  BrainCircuit,
  ClipboardCheck,
  Info,
  ShieldHalf,
  FileText,
  AlertTriangle,
  X,
  Save,
  ShieldCheck,
  Printer,
  RotateCcw,
  Scale
} from 'lucide-react';

const EFFICACY_REDUCTION_MAP: Record<number, number> = {
  1: 0.00,
  2: 0.20,
  3: 0.50,
  4: 0.80,
  5: 0.95,
};

const EFFICACY_LABELS: Record<number, string> = {
  1: 'Inexistente (0%)',
  2: 'Fraco (20%)',
  3: 'Médio (50%)',
  4: 'Forte (80%)',
  5: 'Excelente (95%)',
};

export const RISK_LEVELS_INFO = [
  { range: '4,21 -> 5,00', label: 'Muito Alto', color: 'bg-red-600', hex: '#dc2626', rgb: [220, 38, 38], description: 'Riscos críticos com mitigação imediata necessária.' },
  { range: '3,41 -> 4,20', label: 'Alto', color: 'bg-orange-600', hex: '#ea580c', rgb: [234, 88, 12], description: 'Riscos elevados que exigem plano de ação robusto.' },
  { range: '2,61 -> 3,40', label: 'Médio', color: 'bg-yellow-400', hex: '#facc15', rgb: [250, 204, 21], description: 'Riscos moderados com necessidade de monitoramento.' },
  { range: '1,81 -> 2,60', label: 'Baixo', color: 'bg-sky-500', hex: '#0ea5e9', rgb: [14, 165, 233], description: 'Riscos controlados com aceitação residual.' },
  { range: '1,00 -> 1,80', label: 'Muito Baixo', color: 'bg-emerald-600', hex: '#059669', rgb: [5, 150, 105], description: 'Riscos irrelevantes monitorados periodicamente.' },
];

export const getRiskLevelData = (score: number) => {
  if (score >= 4.21) return { ...RISK_LEVELS_INFO[0], colorClass: RISK_LEVELS_INFO[0].color + ' text-white' };
  if (score >= 3.41) return { ...RISK_LEVELS_INFO[1], colorClass: RISK_LEVELS_INFO[1].color + ' text-white' };
  if (score >= 2.61) return { ...RISK_LEVELS_INFO[2], colorClass: RISK_LEVELS_INFO[2].color + ' text-gray-950' };
  if (score >= 1.81) return { ...RISK_LEVELS_INFO[3], colorClass: RISK_LEVELS_INFO[3].color + ' text-white' };
  return { ...RISK_LEVELS_INFO[4], colorClass: RISK_LEVELS_INFO[4].color + ' text-white' };
};

export const calculateLiquidRisk = (inherentScore: number, effectiveness: number) => {
  const reduction = EFFICACY_REDUCTION_MAP[effectiveness] || 0;
  return inherentScore * (1 - reduction);
};

export const RiskLegend: React.FC = () => (
  <div className="bg-slate-900 p-8 rounded-[32px] border border-slate-800 shadow-xl">
    <h4 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-widest flex items-center gap-2">
      <Info size={14} className="text-blue-400" /> Legenda de Risco (GIR)
    </h4>
    <div className="space-y-4">
      {RISK_LEVELS_INFO.map((level, i) => (
        <div key={i} className="flex items-start gap-4">
          <div className={`w-3 h-12 rounded-full ${level.color}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-200 uppercase">{level.label}</span>
              <span className="text-[8px] font-bold text-slate-500">{level.range}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight mt-1">{level.description}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const App: React.FC = () => {
  const [occurrences, setOccurrences] = useState<Occurrence[]>(() => {
    const saved = localStorage.getItem('gir_occurrences');
    return saved ? JSON.parse(saved) : [];
  });

  const [snapshots, setSnapshots] = useState<DataSnapshot[]>(() => {
    const saved = localStorage.getItem('gir_snapshots');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [selectedLine, setSelectedLine] = useState<BusinessLine>(BUSINESS_LINES[0]);
  const [description, setDescription] = useState('');
  const [existingControl, setExistingControl] = useState('');
  const [controlEffectiveness, setControlEffectiveness] = useState<number>(3);
  const [selectedMacro, setSelectedMacro] = useState<Macroprocess | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'matrix' | 'manual'>('dashboard');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [manualProb, setManualProb] = useState<number>(1);
  const [manualImpact, setManualImpact] = useState<number>(1);
  const [activeSource, setActiveSource] = useState<'ia' | 'unit'>('unit');
  
  const [rasPdfBase64, setRasPdfBase64] = useState<string | null>(() => localStorage.getItem('gir_ras_pdf'));
  const [tempAnalysis, setTempAnalysis] = useState<AIAnalysis | null>(null);
  const [originalDataBeforeEdit, setOriginalDataBeforeEdit] = useState<{description: string, control: string} | null>(null);
  
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('gir_occurrences', JSON.stringify(occurrences));
  }, [occurrences]);

  const hasChanges = useMemo(() => {
    if (!editingId || !originalDataBeforeEdit) return false;
    return description !== originalDataBeforeEdit.description || existingControl !== originalDataBeforeEdit.control;
  }, [editingId, originalDataBeforeEdit, description, existingControl]);

  const resetForm = () => {
    setDescription(''); setExistingControl(''); setControlEffectiveness(3); 
    setSelectedMacro(null); setTempAnalysis(null); setEditingId(null);
    setManualProb(1); setManualImpact(1); setActiveSource('unit'); setApiError(null);
    setOriginalDataBeforeEdit(null);
  };

  const handleDeleteOccurrence = (id: string, bypassConfirm = false) => {
    if (bypassConfirm || window.confirm("CONFIRMAR EXCLUSÃO DEFINITIVA? Este registro será removido da Matriz e do Painel Estratégico imediatamente.")) {
      setOccurrences(prev => prev.filter(o => o.id !== id));
      resetForm();
    }
  };

  const handleDiscardForm = () => {
    if (editingId) {
      // Automaticamente deleta a matriz gravada e exclui do painel estratégico ao descartar em modo de edição
      handleDeleteOccurrence(editingId, true);
    } else {
      resetForm();
    }
  };

  const generateExecutiveReport = () => {
    setIsGeneratingPdf(true);
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString('pt-BR');
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO EXECUTIVO', 105, 80, { align: 'center' });
    doc.setFontSize(24);
    doc.text('MATRIZ GIR - GECOR', 105, 95, { align: 'center' });
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1.5);
    doc.line(40, 105, 170, 105);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('GESTÃO INTEGRADA DE RISCOS - RESOLUÇÃO 4.557', 105, 115, { align: 'center' });
    
    doc.addPage();
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('1. CONSOLIDADO ESTRATÉGICO', 20, 25);
    
    let yPos = 40;
    BUSINESS_LINES.forEach(line => {
      const lineOccs = occurrences.filter(o => o.businessLineId === line.id);
      let totalInherent = 0;
      let totalLiquid = 0;
      let riskCount = 0;

      lineOccs.forEach(o => {
        const eff = o.analysis?.controlEffectiveness || 3;
        (o.analysis?.risks || []).forEach(r => {
          const inh = (r.probability + r.impact) / 2;
          totalInherent += inh;
          totalLiquid += calculateLiquidRisk(inh, eff);
          riskCount++;
        });
      });

      const avgInherent = riskCount > 0 ? totalInherent / riskCount : 0;
      const avgLiquid = riskCount > 0 ? totalLiquid / riskCount : 0;
      const reduction = avgInherent > 0 ? ((avgInherent - avgLiquid) / avgInherent) * 100 : 0;
      const level = getRiskLevelData(avgLiquid);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(20, yPos, 170, 35, 3, 3, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(line.name.toUpperCase(), 25, yPos + 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Inerente Médio: ${avgInherent.toFixed(2)}`, 25, yPos + 18);
      doc.text(`Risco Líquido (GIR): ${avgLiquid.toFixed(2)}`, 25, yPos + 23);
      doc.text(`Mitigação: ${reduction.toFixed(0)}%`, 25, yPos + 28);
      doc.setFillColor(level.rgb[0], level.rgb[1], level.rgb[2]);
      doc.roundedRect(130, yPos + 12, 50, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(level.label.toUpperCase(), 155, yPos + 20, { align: 'center' });
      
      yPos += 45;
      if (yPos > 250) { doc.addPage(); yPos = 25; }
    });
    
    doc.save(`Relatorio_Executivo_GIR_${new Date().getTime()}.pdf`);
    setIsGeneratingPdf(false);
  };

  const handleEditOccurrence = (occ: Occurrence) => {
    setEditingId(occ.id);
    setDescription(occ.description);
    setExistingControl(occ.analysis?.existingControl || '');
    setControlEffectiveness(occ.analysis?.controlEffectiveness || 3);
    setOriginalDataBeforeEdit({ description: occ.description, control: occ.analysis?.existingControl || '' });
    
    const line = BUSINESS_LINES.find(l => l.id === occ.businessLineId);
    if (line) {
      setSelectedLine(line);
      const macro = line.macroprocesses.find(m => m.id === occ.macroprocessId);
      if (macro) setSelectedMacro(macro);
    }
    if (occ.analysis) {
      setTempAnalysis(occ.analysis);
      setActiveSource(occ.analysis.rasSource === 'Documento' ? 'unit' : 'ia');
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRiskEvaluation = async () => {
    if (!description || !selectedMacro) return;
    setIsAnalyzing(true);
    setApiError(null);
    try {
      const analysis: AIAnalysis = await analyzeOccurrence(
        description, 
        selectedMacro.name, 
        selectedLine.name, 
        existingControl, 
        rasPdfBase64 || undefined
      );
      setTempAnalysis(analysis);
      if (editingId) {
         setOriginalDataBeforeEdit({ description, control: existingControl });
      }
    } catch (e: any) { 
      setApiError(e.message === "QUOTA_EXCEEDED" ? "Cota excedida." : "Erro na Avaliação.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmRegistration = () => {
    if ((!tempAnalysis && activeSource === 'ia') || !selectedMacro) return;
    let finalRisks = activeSource === 'unit' 
      ? [{ type: RiskType.OPERATIONAL, probability: manualProb as any, impact: manualImpact as any, justification: "Mensuração manual da Unidade.", normativeCitation: "N/A" }]
      : tempAnalysis!.risks;

    const final: Occurrence = {
      id: editingId || crypto.randomUUID(), 
      businessLineId: selectedLine.id, 
      macroprocessId: selectedMacro.id,
      description, 
      date: editingId ? (occurrences.find(o => o.id === editingId)?.date || new Date().toLocaleDateString('pt-BR')) : new Date().toLocaleDateString('pt-BR'),
      analysis: { 
        ...(tempAnalysis || {
          risks: [], existingControl: '', suggestedControl: '', mitigationSuggested: '',
          controlEffectiveness: 3, rasStatus: 'Dentro', rasJustification: '',
          rasSource: 'Documento', crossLineImpacts: [], resolution4557Reference: 'N/A'
        }), 
        risks: finalRisks, existingControl, controlEffectiveness,
        rasSource: activeSource === 'unit' ? 'Documento' : 'Resolução 4557'
      }
    };

    setOccurrences(prev => {
      const updated = editingId ? prev.map(o => o.id === editingId ? final : o) : [final, ...prev];
      return updated;
    });

    resetForm();
  };

  const handleClearAllData = () => {
    if (window.confirm("⚠️ PERIGO: Deseja ZERAR toda a base de dados da Matriz GIR? O Painel Estratégico ficará vazio.")) {
      setOccurrences([]);
      localStorage.removeItem('gir_occurrences');
      resetForm();
    }
  };

  const clearByBusinessLine = (lineId: string) => {
    const lineName = BUSINESS_LINES.find(l => l.id === lineId)?.name;
    if (window.confirm(`Deseja apagar permanentemente todo o histórico de "${lineName}"?`)) {
      setOccurrences(prev => prev.filter(o => o.businessLineId !== lineId));
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-950 text-slate-100 font-inter">
      <div className="w-72 bg-slate-900 border-r border-slate-800 fixed h-full p-6 flex flex-col gap-6 z-20">
        <div className="flex items-center gap-3 mb-4">
           <div className="p-2 bg-blue-600 rounded-xl shadow-lg"><ShieldAlert className="text-white" size={24} /></div>
           <h1 className="text-xl font-black tracking-tighter">MATRIZ GIR - GECOR</h1>
        </div>
        <nav className="flex flex-col gap-1">
           <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl flex items-center gap-3 font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
              <LayoutDashboard size={18}/> Painel Estratégico
           </button>
           <button onClick={() => setActiveTab('manual')} className={`p-3 rounded-xl flex items-center gap-3 font-bold transition-all ${activeTab === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
              <Database size={18}/> Governança GIR
           </button>
        </nav>
        <div className="mt-4 flex flex-col gap-1 overflow-y-auto max-h-[40vh] custom-scrollbar">
           <span className="text-[10px] font-black text-slate-600 uppercase px-3 mb-2 tracking-widest">Matrizes por Linha</span>
           {BUSINESS_LINES.map(line => (
             <button key={line.id} onClick={() => { setSelectedLine(line); setActiveTab('matrix'); }} className={`p-3 rounded-xl flex items-center gap-3 font-bold transition-all text-xs text-left ${selectedLine.id === line.id && activeTab === 'matrix' ? 'bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-500 hover:bg-slate-800'}`}>
                <FileStack size={16}/> {line.name}
             </button>
           ))}
        </div>
      </div>

      <main className="ml-72 p-10 w-full relative z-10">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black uppercase tracking-tighter">Visão Consolidada</h2>
               <button 
                 onClick={generateExecutiveReport} 
                 disabled={isGeneratingPdf || occurrences.length === 0}
                 className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black text-xs flex items-center gap-3 shadow-lg transition-all"
               >
                 {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
                 Gerar Relatório Executivo (PDF)
               </button>
            </div>
            <RiskDashboard occurrences={occurrences} />
          </div>
        )}

        {activeTab === 'matrix' && (
           <div className="max-w-6xl mx-auto space-y-10 animate-in">
              <header className="flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tight">{selectedLine.name}</h1>
                  <p className="text-slate-500 font-medium italic">Compliance Integrado: Resolução 4.557 BACEN</p>
                </div>
              </header>

              <div ref={formRef} className={`bg-slate-900 p-8 rounded-[40px] border-2 shadow-2xl transition-all duration-500 ${editingId ? 'border-amber-500/50' : 'border-slate-800'}`}>
                 <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                        {editingId ? <Edit3 className="text-amber-400" /> : <Sparkles className="text-blue-400" />}
                        {editingId ? 'Manutenção de Registro' : 'Identificação do Evento'}
                    </h2>
                    <div className="flex items-center gap-3">
                      {(description || editingId) && (
                        <button onClick={handleDiscardForm} className="text-red-400 text-[10px] font-black uppercase hover:text-red-300 flex items-center gap-1 group">
                          <X size={14} className="group-hover:rotate-90 transition-transform"/> {editingId ? 'Excluir Definitivamente' : 'Descartar'}
                        </button>
                      )}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Macroprocesso Auditado</label>
                          <select className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none" value={selectedMacro?.id || ''} onChange={(e) => setSelectedMacro(selectedLine.macroprocesses.find(m => m.id === e.target.value) || null)}>
                             <option value="">Selecione o Macroprocesso...</option>
                             {selectedLine.macroprocesses.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Descrição Técnica (Fato Gerador)</label>
                          <textarea className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl h-32 resize-none outline-none focus:border-blue-500 transition-colors" placeholder="Descreva o fato..." value={description} onChange={(e) => setDescription(e.target.value)}/>
                       </div>
                       
                       <div className="bg-slate-950 p-6 rounded-[32px] border border-slate-800 shadow-inner space-y-6">
                          <div>
                            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4"><UserCheck size={16}/> Autoavaliação da Unidade</p>
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                  <label className="text-[9px] font-black text-slate-500 uppercase">Probabilidade</label>
                                  <select className="w-full mt-1 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs outline-none" value={manualProb} onChange={(e) => setManualProb(Number(e.target.value))}>
                                     {[1,2,3,4,5].map(v => <option key={v} value={v}>Nota {v}</option>)}
                                  </select>
                               </div>
                               <div>
                                  <label className="text-[9px] font-black text-slate-500 uppercase">Impacto GIR</label>
                                  <select className="w-full mt-1 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs outline-none" value={manualImpact} onChange={(e) => setManualImpact(Number(e.target.value))}>
                                     {[1,2,3,4,5].map(v => <option key={v} value={v}>Nota {v}</option>)}
                                  </select>
                               </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-800 pt-6">
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest flex items-center gap-2">
                               <ClipboardCheck size={14} className="text-emerald-500" /> Controle Efetuado pela Unidade
                            </label>
                            <textarea className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl h-24 resize-none outline-none focus:border-emerald-500 transition-colors" placeholder="Descreva as barreiras mitigatórias..." value={existingControl} onChange={(e) => setExistingControl(e.target.value)}/>
                          </div>
                       </div>

                       <div className="bg-slate-950 p-6 rounded-[32px] border border-slate-800">
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-3 block tracking-widest flex items-center gap-2">
                             <ShieldHalf size={14} className="text-blue-400" /> Eficácia do Controle (Redutor)
                          </label>
                          <select className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs outline-none" value={controlEffectiveness} onChange={(e) => setControlEffectiveness(Number(e.target.value))}>
                             {Object.keys(EFFICACY_LABELS).map((val) => (
                                <option key={val} value={val}>{val} - {EFFICACY_LABELS[Number(val)]}</option>
                             ))}
                          </select>
                       </div>
                    </div>

                    <div className="space-y-6">
                       {isAnalyzing ? (
                         <div className="h-full border-2 border-blue-900/30 rounded-[40px] flex flex-col items-center justify-center p-8 bg-slate-950/40 text-center">
                            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Auditoria GIR em andamento...</p>
                         </div>
                       ) : tempAnalysis ? (
                         <div className="space-y-6 animate-in">
                            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800">
                               <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-4 flex items-center gap-2"><Settings2 size={14}/> Fonte de Mensuração</p>
                               <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setActiveSource('unit')} className={`p-4 rounded-2xl flex flex-col items-center border-2 transition-all ${activeSource === 'unit' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 opacity-40'}`}>
                                     <UserCheck size={20} className="mb-2" />
                                     <span className="text-[10px] font-black uppercase">Unidade</span>
                                     <span className="text-lg font-black">{((manualProb + manualImpact)/2).toFixed(2)}</span>
                                  </button>
                                  <button onClick={() => setActiveSource('ia')} className={`p-4 rounded-2xl flex flex-col items-center border-2 transition-all ${activeSource === 'ia' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 opacity-40'}`}>
                                     <BrainCircuit size={20} className="mb-2" />
                                     <span className="text-[10px] font-black uppercase">Auditoria IA</span>
                                     <span className="text-lg font-black">{tempAnalysis.risks[0]?.probability ? ((tempAnalysis.risks[0].probability + tempAnalysis.risks[0].impact)/2).toFixed(2) : "0.00"}</span>
                                  </button>
                               </div>
                            </div>
                         </div>
                       ) : (
                         <div className="h-full border-2 border-dashed border-slate-800 rounded-[40px] flex flex-col items-center justify-center p-14 text-center">
                            <Cpu size={48} className="mb-4 opacity-20" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-700">Aguardando Avaliação Normativa</p>
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="flex justify-end gap-4 border-t border-slate-800 pt-8 mt-10">
                    {(!tempAnalysis || (editingId && hasChanges)) ? (
                       <button onClick={handleRiskEvaluation} disabled={!description || !selectedMacro || isAnalyzing} className="px-12 py-5 rounded-3xl font-black text-xs flex items-center gap-3 hover:scale-105 transition-all shadow-xl uppercase tracking-widest bg-blue-600">
                          {isAnalyzing ? <Loader2 className="animate-spin" size={20}/> : (editingId ? <RotateCcw size={20}/> : <ShieldCheck size={20}/>)} 
                          {editingId ? 'Salvar e Reanalisar' : 'Avaliação de Risco'}
                       </button>
                    ) : (
                       <button onClick={handleConfirmRegistration} className="px-12 py-5 rounded-3xl font-black text-xs flex items-center gap-3 hover:scale-105 transition-all uppercase shadow-2xl bg-emerald-600">
                          <CheckCircle2 size={20}/> 
                          {editingId ? 'Validar e Gravar Alterações' : 'Commit na Matriz GIR'}
                       </button>
                    )}
                 </div>
              </div>

              <div className="space-y-6 pt-10">
                 <h3 className="text-2xl font-black flex items-center gap-3 text-slate-200 uppercase tracking-tighter"><HistoryIcon size={24} className="text-blue-500" /> Histórico de Apontamentos</h3>
                 <div className="space-y-10">
                    {occurrences.filter(o => o.businessLineId === selectedLine.id).map(occ => {
                      const eff = occ.analysis?.controlEffectiveness || 3;
                      return (
                       <div key={occ.id} className={`bg-slate-900 rounded-[40px] border-2 overflow-hidden relative shadow-2xl transition-all ${editingId === occ.id ? 'border-amber-500' : 'border-slate-800'}`}>
                          <div className="p-8 bg-slate-800/40 flex justify-between items-start border-b border-slate-800">
                             <div>
                                <h4 className="font-bold text-xl text-slate-100 uppercase mb-2">{occ.description}</h4>
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-[8px] font-black px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-slate-400 uppercase">
                                     {occ.date} • {selectedLine.macroprocesses.find(m => m.id === occ.macroprocessId)?.name}
                                  </span>
                                  <span className="text-[8px] font-black px-3 py-1 rounded-full border border-blue-500/30 text-blue-400 bg-blue-500/5 uppercase">
                                     EFICÁCIA: {EFFICACY_LABELS[eff]}
                                  </span>
                                </div>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => handleEditOccurrence(occ)} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 hover:bg-amber-500 hover:text-white transition-all"><Edit3 size={18}/></button>
                                <button onClick={() => handleDeleteOccurrence(occ.id)} className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl text-red-500 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18}/></button>
                             </div>
                          </div>

                          <div className="p-8 bg-slate-950/30 border-b border-slate-800">
                             <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                                <ShieldCheck size={14} /> Controle Efetuado pela Unidade
                             </h5>
                             <p className="text-xs text-slate-400 italic leading-relaxed">
                                {occ.analysis?.existingControl || "Nenhum controle informado pela unidade gestora."}
                             </p>
                          </div>

                          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                             {(occ.analysis?.risks || []).map((r, idx) => {
                                const inherent = (r.probability + r.impact) / 2;
                                const liquid = calculateLiquidRisk(inherent, eff);
                                const level = getRiskLevelData(liquid);
                                return (
                                   <div key={idx} className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col gap-4 relative group hover:border-slate-600 transition-colors">
                                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                         <div className="flex flex-col">
                                            <span className="text-[11px] font-black uppercase text-blue-400 tracking-tight">{r.type}</span>
                                            <span className="text-[8px] font-bold text-slate-500">{r.normativeCitation}</span>
                                         </div>
                                         <div className={`${level.colorClass} px-3 py-1 rounded-lg text-[9px] font-black shadow-lg uppercase`}>
                                            Líquido: {liquid.toFixed(2)}
                                         </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                         <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50 text-center">
                                            <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Nota A (Prob.)</p>
                                            <p className="text-sm font-black text-slate-200">{r.probability}</p>
                                         </div>
                                         <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50 text-center">
                                            <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Nota B (Impacto)</p>
                                            <p className="text-sm font-black text-slate-200">{r.impact}</p>
                                         </div>
                                      </div>

                                      <div className="space-y-2">
                                         <p className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1">
                                            <FileText size={10} /> Justificativa Normativa:
                                         </p>
                                         <p className="text-[11px] text-slate-400 leading-relaxed italic border-l-2 border-slate-800 pl-3">
                                            "{r.justification}"
                                         </p>
                                      </div>
                                   </div>
                                );
                             })}
                             
                             {(!occ.analysis?.risks || occ.analysis.risks.length === 0) && (
                               <div className="col-span-full py-10 flex flex-col items-center justify-center opacity-30 text-center">
                                  <Scale size={40} className="mb-4" />
                                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma mensuração técnica disponível para este evento.</p>
                               </div>
                             )}
                          </div>
                       </div>
                    )})}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'manual' && (
           <div className="max-w-4xl mx-auto space-y-12 animate-in pb-24">
              <section className="bg-slate-900 p-12 rounded-[56px] border-2 border-slate-800 shadow-3xl">
                 <h3 className="text-3xl font-black uppercase mb-10 tracking-tighter text-center flex items-center justify-center gap-4">
                   <Database className="text-blue-500" size={32} /> Governança GIR
                 </h3>
                 <div className="grid grid-cols-1 gap-6">
                    {BUSINESS_LINES.map(line => (
                       <button key={line.id} onClick={() => clearByBusinessLine(line.id)} className="w-full flex items-center justify-between p-6 bg-red-950/10 border border-red-900/30 rounded-3xl hover:bg-red-600 group transition-all shadow-lg">
                          <span className="text-xs font-black text-red-500 uppercase group-hover:text-white">LIMPAR MATRIZ: {line.name}</span>
                          <Trash2 size={20} className="text-red-500 group-hover:text-white" />
                       </button>
                    ))}
                    <button onClick={handleClearAllData} className="mt-10 w-full py-12 bg-red-600 border-4 border-red-700 rounded-[40px] flex flex-col items-center justify-center gap-4 hover:bg-red-700 transition-all shadow-2xl group">
                       <AlertTriangle size={48} className="text-white mb-2" />
                       <span className="font-black uppercase text-2xl text-white tracking-[0.2em]">Zerar Base GIR Completa</span>
                    </button>
                 </div>
              </section>
           </div>
        )}
      </main>
    </div>
  );
};
