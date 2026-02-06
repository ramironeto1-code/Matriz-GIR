
import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
  Scale,
  FileSpreadsheet
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

  const [selectedLine, setSelectedLine] = useState<BusinessLine>(BUSINESS_LINES[0]);
  const [description, setDescription] = useState('');
  const [existingControl, setExistingControl] = useState('');
  const [controlEffectiveness, setControlEffectiveness] = useState<number>(3);
  const [selectedMacro, setSelectedMacro] = useState<Macroprocess | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'matrix' | 'governance'>('dashboard');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const [manualProb, setManualProb] = useState<number>(1);
  const [manualImpact, setManualImpact] = useState<number>(1);
  const [activeSource, setActiveSource] = useState<'ia' | 'unit'>('unit');
  const [tempAnalysis, setTempAnalysis] = useState<AIAnalysis | null>(null);
  const [rasFile, setRasFile] = useState<string | undefined>();

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('gir_occurrences', JSON.stringify(occurrences));
  }, [occurrences]);

  const resetForm = () => {
    setDescription(''); 
    setExistingControl(''); 
    setControlEffectiveness(3); 
    setSelectedMacro(null); 
    setTempAnalysis(null); 
    setEditingId(null);
    setManualProb(1); 
    setManualImpact(1); 
    setActiveSource('unit'); 
    setApiError(null);
    setRasFile(undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result?.toString().split(',')[1];
        setRasFile(base64String);
      };
      reader.readAsDataURL(file);
    }
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
        rasFile
      );
      setTempAnalysis(analysis);
      setActiveSource('ia'); 
    } catch (e: any) { 
      setApiError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmRegistration = () => {
    if (!selectedMacro) return;

    let finalRisks = activeSource === 'unit' 
      ? [{ type: RiskType.OPERATIONAL, probability: manualProb as any, impact: manualImpact as any, justification: "Mensuração manual da Unidade.", normativeCitation: "N/A" }]
      : (tempAnalysis?.risks || []);

    const final: Occurrence = {
      id: editingId || crypto.randomUUID(), 
      businessLineId: selectedLine.id, 
      macroprocessId: selectedMacro.id,
      description, 
      date: new Date().toLocaleDateString('pt-BR'),
      analysis: { 
        ...(tempAnalysis || {
          risks: [], existingControl: '', suggestedControl: '', mitigationSuggested: '',
          controlEffectiveness: 3, rasStatus: 'Dentro', rasJustification: '',
          rasSource: 'Documento', crossLineImpacts: [], resolution4557Reference: 'N/A'
        }), 
        risks: finalRisks, 
        existingControl, 
        controlEffectiveness,
        rasSource: activeSource === 'unit' ? 'Documento' : 'Resolução 4557'
      }
    };

    setOccurrences(prev => {
      if (editingId) return prev.map(o => o.id === editingId ? final : o);
      return [final, ...prev];
    });

    resetForm();
  };

  const handleExportPDF = () => {
    if (occurrences.length === 0) return;
    setIsExporting(true);
    
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    
    doc.setFontSize(18);
    doc.text('Relatório Executivo de Riscos - GECOR GIR', 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${timestamp}`, 14, 28);
    doc.text(`Resolução BCB 4.557/2017`, 14, 34);
    
    const tableData = occurrences.map(occ => {
      const line = BUSINESS_LINES.find(l => l.id === occ.businessLineId)?.name || '';
      const macro = BUSINESS_LINES.find(l => l.id === occ.businessLineId)?.macroprocesses.find(m => m.id === occ.macroprocessId)?.name || '';
      const eff = occ.analysis?.controlEffectiveness || 3;
      const riskSummary = (occ.analysis?.risks || []).map(r => {
        const liquid = calculateLiquidRisk((r.probability + r.impact)/2, eff);
        return `${r.type}: ${liquid.toFixed(2)}`;
      }).join(', ');

      return [
        occ.date,
        line,
        macro,
        occ.description.substring(0, 50) + '...',
        EFFICACY_LABELS[eff],
        riskSummary
      ];
    });

    (doc as any).autoTable({
      startY: 40,
      head: [['Data', 'Linha', 'Macroprocesso', 'Fato Gerador', 'Redutor', 'Riscos Líquidos']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175] },
      styles: { fontSize: 8 }
    });

    doc.save(`Relatorio_GIR_${new Date().getTime()}.pdf`);
    setIsExporting(false);
  };

  const handleExportExcel = () => {
    if (occurrences.length === 0) return;
    
    const data = occurrences.map(occ => ({
      ID: occ.id,
      Data: occ.date,
      Linha: BUSINESS_LINES.find(l => l.id === occ.businessLineId)?.name,
      Macroprocesso: BUSINESS_LINES.find(l => l.id === occ.businessLineId)?.macroprocesses.find(m => m.id === occ.macroprocessId)?.name,
      Descricao: occ.description,
      Controle_Existente: occ.analysis?.existingControl,
      Eficacia_Redutor: EFFICACY_LABELS[occ.analysis?.controlEffectiveness || 3],
      Status_RAS: occ.analysis?.rasStatus,
      Referencia_IA: occ.analysis?.resolution4557Reference
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz GIR");
    XLSX.writeFile(wb, `Matriz_GIR_${new Date().getTime()}.xlsx`);
  };

  const handleEditOccurrence = (occ: Occurrence) => {
    setEditingId(occ.id);
    setDescription(occ.description);
    setExistingControl(occ.analysis?.existingControl || '');
    setControlEffectiveness(occ.analysis?.controlEffectiveness || 3);
    
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
    setActiveTab('matrix');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteOccurrence = (id: string) => {
    if (window.confirm("Deseja excluir este registro permanentemente da matriz?")) {
      setOccurrences(prev => prev.filter(o => o.id !== id));
    }
  };

  return (
    <div className="flex min-h-screen bg-dark-950 text-slate-100 font-inter">
      {/* Sidebar Navigation */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 fixed h-full p-6 flex flex-col gap-6 z-20">
        <div className="flex items-center gap-3 mb-4">
           <div className="p-2 bg-blue-600 rounded-xl shadow-lg"><ShieldAlert className="text-white" size={24} /></div>
           <h1 className="text-xl font-black tracking-tighter">MATRIZ GIR - GECOR</h1>
        </div>
        
        <nav className="flex flex-col gap-1">
           <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl flex items-center gap-3 font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
              <LayoutDashboard size={18}/> Painel Estratégico
           </button>
           <button onClick={() => setActiveTab('governance')} className={`p-3 rounded-xl flex items-center gap-3 font-bold transition-all ${activeTab === 'governance' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800'}`}>
              <Database size={18}/> Governança
           </button>
        </nav>

        <div className="mt-4 flex flex-col gap-1 overflow-y-auto max-h-[50vh] custom-scrollbar">
           <span className="text-[10px] font-black text-slate-600 uppercase px-3 mb-2 tracking-widest">Matrizes por Linha</span>
           {BUSINESS_LINES.map(line => (
             <button key={line.id} onClick={() => { setSelectedLine(line); setActiveTab('matrix'); }} className={`p-3 rounded-xl flex items-center gap-3 font-bold transition-all text-xs text-left ${selectedLine.id === line.id && activeTab === 'matrix' ? 'bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-500 hover:bg-slate-800'}`}>
                <FileStack size={16}/> {line.name}
             </button>
           ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="ml-72 p-10 w-full relative z-10">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex justify-between items-center mb-10">
               <div>
                 <h2 className="text-3xl font-black uppercase tracking-tighter">Visão Consolidada</h2>
                 <p className="text-slate-500 italic">Consolidado Geral de Exposição e Riscos Residuais</p>
               </div>
               <div className="flex gap-3">
                  <button 
                    onClick={handleExportPDF}
                    disabled={isExporting || occurrences.length === 0}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30"
                  >
                    {isExporting ? <Loader2 className="animate-spin" size={16}/> : <Download size={16} />}
                    Relatório PDF
                  </button>
                  <button 
                    onClick={handleExportExcel}
                    disabled={occurrences.length === 0}
                    className="px-6 py-3 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-30"
                  >
                    <FileSpreadsheet size={16} />
                    Exportar XLSX
                  </button>
               </div>
            </header>
            <RiskDashboard occurrences={occurrences} />
          </div>
        )}

        {activeTab === 'matrix' && (
           <div className="max-w-6xl mx-auto space-y-10">
              <header className="flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tight">{selectedLine.name}</h1>
                  <p className="text-slate-500 font-medium italic">Matriz de Risco GIR - Resolução BCB 4.557</p>
                </div>
                <button onClick={handleExportPDF} className="flex items-center gap-2 p-3 bg-blue-600 rounded-xl text-white text-xs font-black uppercase shadow-lg hover:scale-105 transition-all">
                   <Download size={16} /> Exportar Linha
                </button>
              </header>

              {/* Input Form */}
              <div ref={formRef} className={`bg-slate-900 p-8 rounded-[40px] border-2 shadow-2xl transition-all duration-500 ${editingId ? 'border-amber-500/50' : 'border-slate-800'}`}>
                 <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter text-slate-100">
                        {editingId ? <Edit3 className="text-amber-400" /> : <Sparkles className="text-blue-400" />}
                        {editingId ? 'Manutenção de Registro' : 'Identificação do Evento'}
                    </h2>
                    {editingId && (
                      <button onClick={resetForm} className="text-red-400 text-[10px] font-black uppercase hover:text-red-300 flex items-center gap-1 group">
                        <X size={14}/> Cancelar Edição
                      </button>
                    )}
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Macroprocesso</label>
                             <select className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl outline-none focus:border-blue-500 transition-colors text-sm" value={selectedMacro?.id || ''} onChange={(e) => setSelectedMacro(selectedLine.macroprocesses.find(m => m.id === e.target.value) || null)}>
                                <option value="">Selecione...</option>
                                {selectedLine.macroprocesses.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Anexar RAS (PDF)</label>
                             <div className="relative group">
                                <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                <div className={`w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center gap-2 transition-all ${rasFile ? 'border-emerald-500 text-emerald-400' : 'group-hover:border-blue-500 text-slate-500'}`}>
                                   {rasFile ? <CheckCircle2 size={18}/> : <FileUp size={18}/>}
                                   <span className="text-[10px] font-black uppercase">{rasFile ? 'Arquivo Pronto' : 'Upload RAS'}</span>
                                </div>
                             </div>
                          </div>
                       </div>
                       <div>
                          <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Descrição Técnica (Fato Gerador)</label>
                          <textarea className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl h-32 resize-none outline-none focus:border-blue-500 transition-colors" placeholder="Descreva detalhadamente a ocorrência..." value={description} onChange={(e) => setDescription(e.target.value)}/>
                       </div>
                       
                       <div className="bg-slate-950 p-6 rounded-[32px] border border-slate-800 shadow-inner space-y-6">
                          <div>
                            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-4"><UserCheck size={16}/> Autoavaliação da Unidade</p>
                            <div className="grid grid-cols-2 gap-4">
                               <div>
                                  <label className="text-[9px] font-black text-slate-500 uppercase">Probabilidade (A)</label>
                                  <select className="w-full mt-1 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs outline-none" value={manualProb} onChange={(e) => setManualProb(Number(e.target.value))}>
                                     {[1,2,3,4,5].map(v => <option key={v} value={v}>Nota {v}</option>)}
                                  </select>
                               </div>
                               <div>
                                  <label className="text-[9px] font-black text-slate-500 uppercase">Impacto GIR (B)</label>
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
                            <textarea className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl h-20 resize-none outline-none focus:border-emerald-500 transition-colors" placeholder="Barreiras e controles mitigatórios..." value={existingControl} onChange={(e) => setExistingControl(e.target.value)}/>
                          </div>

                          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800">
                             <label className="text-[10px] font-black uppercase text-slate-500 mb-3 block tracking-widest flex items-center gap-2">
                                <ShieldHalf size={14} className="text-blue-400" /> Avaliação do Redutor (Eficácia)
                             </label>
                             <select className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none focus:border-blue-500 transition-all font-bold" value={controlEffectiveness} onChange={(e) => setControlEffectiveness(Number(e.target.value))}>
                                {Object.keys(EFFICACY_LABELS).map((val) => (
                                   <option key={val} value={val}>{val} - {EFFICACY_LABELS[Number(val)]}</option>
                                ))}
                             </select>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       {isAnalyzing ? (
                         <div className="h-full border-2 border-blue-900/30 rounded-[40px] flex flex-col items-center justify-center p-8 bg-slate-950/40 text-center animate-pulse min-h-[400px]">
                            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">IA Analisando Risco Operacional...</p>
                         </div>
                       ) : tempAnalysis ? (
                         <div className="space-y-6 animate-in">
                            <div className="bg-slate-950 p-6 rounded-[32px] border border-slate-800">
                               <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-6 flex items-center gap-2"><Settings2 size={14}/> Comparativo de Mensuração</p>
                               <div className="grid grid-cols-2 gap-4">
                                  <button onClick={() => setActiveSource('unit')} className={`p-4 rounded-2xl flex flex-col items-center border-2 transition-all ${activeSource === 'unit' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 opacity-40'}`}>
                                     <UserCheck size={20} className="mb-2" />
                                     <span className="text-[10px] font-black uppercase">Unidade</span>
                                     <span className="text-lg font-black">{((manualProb + manualImpact)/2).toFixed(2)}</span>
                                  </button>
                                  <button onClick={() => setActiveSource('ia')} className={`p-4 rounded-2xl flex flex-col items-center border-2 transition-all ${activeSource === 'ia' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 opacity-40'}`}>
                                     <BrainCircuit size={20} className="mb-2" />
                                     <span className="text-[10px] font-black uppercase">Auditoria IA</span>
                                     <span className="text-lg font-black">{((tempAnalysis.risks[0]?.probability + tempAnalysis.risks[0]?.impact)/2).toFixed(2)}</span>
                                  </button>
                               </div>
                            </div>
                            
                            <div className="bg-slate-950/50 p-6 rounded-[32px] border border-slate-800 space-y-4">
                               <div>
                                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><FileText size={14}/> Sugestão de Melhoria IA</h4>
                                 <p className="text-[11px] text-slate-300 italic leading-relaxed border-l-2 border-blue-500 pl-4">
                                   {tempAnalysis.suggestedControl}
                                 </p>
                               </div>
                               <div className="pt-4 border-t border-slate-800">
                                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Scale size={14} className="text-amber-500"/> Fundamentação RAS</h4>
                                 <p className="text-[10px] text-slate-400 line-clamp-3">
                                   {tempAnalysis.rasJustification}
                                 </p>
                               </div>
                            </div>
                         </div>
                       ) : (
                         <div className="h-full border-2 border-dashed border-slate-800 rounded-[40px] flex flex-col items-center justify-center p-14 text-center opacity-40 min-h-[400px]">
                            <Cpu size={48} className="mb-4" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Aguardando Avaliação IA</p>
                            <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase">Preencha o fato gerador e clique em avaliar</p>
                         </div>
                       )}
                       {apiError && (
                         <div className="bg-red-950/20 border border-red-900/50 p-4 rounded-2xl text-red-500 text-[10px] font-bold flex items-center gap-2 animate-bounce">
                           <AlertTriangle size={14} /> {apiError}
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="flex justify-end gap-4 border-t border-slate-800 pt-8 mt-10">
                    <button onClick={handleRiskEvaluation} disabled={!description || !selectedMacro || isAnalyzing} className="px-10 py-5 rounded-3xl font-black text-xs flex items-center gap-3 hover:scale-105 transition-all shadow-xl uppercase tracking-widest bg-blue-600 disabled:opacity-50">
                       {isAnalyzing ? <Loader2 className="animate-spin" size={20}/> : <ShieldCheck size={20}/>} 
                       Avaliação de Risco
                    </button>
                    {tempAnalysis && (
                       <button onClick={handleConfirmRegistration} className="px-10 py-5 rounded-3xl font-black text-xs flex items-center gap-3 hover:scale-105 transition-all uppercase shadow-2xl bg-emerald-600">
                          <CheckCircle2 size={20}/> 
                          Commit na Matriz GIR
                       </button>
                    )}
                 </div>
              </div>

              {/* History List */}
              <div className="space-y-8 pt-10">
                 <h3 className="text-2xl font-black flex items-center gap-3 text-slate-200 uppercase tracking-tighter"><HistoryIcon size={24} className="text-blue-500" /> Histórico de Apontamentos</h3>
                 <div className="grid grid-cols-1 gap-6">
                    {occurrences.filter(o => o.businessLineId === selectedLine.id).map(occ => {
                      const eff = occ.analysis?.controlEffectiveness || 3;
                      return (
                       <div key={occ.id} className="bg-slate-900 rounded-[40px] border border-slate-800 overflow-hidden relative shadow-xl hover:border-slate-700 transition-all group">
                          <div className="p-8 bg-slate-800/20 flex justify-between items-start border-b border-slate-800">
                             <div>
                                <h4 className="font-bold text-xl text-slate-100 uppercase mb-2">{occ.description}</h4>
                                <div className="flex flex-wrap gap-2">
                                  <span className="text-[8px] font-black px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-slate-400 uppercase">
                                     {occ.date} • {selectedLine.macroprocesses.find(m => m.id === occ.macroprocessId)?.name}
                                  </span>
                                  <span className="text-[8px] font-black px-3 py-1 rounded-full border border-blue-500/30 text-blue-400 bg-blue-500/5 uppercase">
                                     REDUTOR (EFICÁCIA): {EFFICACY_LABELS[eff]}
                                  </span>
                                </div>
                             </div>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditOccurrence(occ)} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-white transition-all"><Edit3 size={16}/></button>
                                <button onClick={() => handleDeleteOccurrence(occ.id)} className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-red-500 hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
                             </div>
                          </div>

                          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                             {(occ.analysis?.risks || []).map((r, idx) => {
                                const inherent = (r.probability + r.impact) / 2;
                                const liquid = calculateLiquidRisk(inherent, eff);
                                const level = getRiskLevelData(liquid);
                                return (
                                   <div key={idx} className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 flex flex-col gap-4">
                                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                         <div className="flex flex-col">
                                            <span className="text-[11px] font-black uppercase text-blue-400">{r.type}</span>
                                            <span className="text-[8px] font-bold text-slate-500">{r.normativeCitation}</span>
                                         </div>
                                         <div className={`${level.colorClass} px-3 py-1 rounded-lg text-[9px] font-black shadow-lg uppercase`}>
                                            Líquido: {liquid.toFixed(2)}
                                         </div>
                                      </div>
                                      <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                         "{r.justification}"
                                      </p>
                                   </div>
                                );
                             })}
                          </div>
                       </div>
                    )})}
                    {occurrences.filter(o => o.businessLineId === selectedLine.id).length === 0 && (
                      <div className="p-20 text-center border-2 border-dashed border-slate-800 rounded-[40px] opacity-30">
                         <ArchiveRestore size={48} className="mx-auto mb-4" />
                         <p className="text-xs font-black uppercase tracking-widest">Nenhum registro encontrado nesta matriz</p>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'governance' && (
           <div className="max-w-4xl mx-auto space-y-12 animate-in">
              <section className="bg-slate-900 p-12 rounded-[56px] border-2 border-slate-800 shadow-3xl text-center">
                 <h3 className="text-3xl font-black uppercase mb-10 tracking-tighter flex items-center justify-center gap-4">
                   <Database className="text-blue-500" size={32} /> Governança de Dados
                 </h3>
                 <div className="grid grid-cols-1 gap-6">
                    <button onClick={() => { if(window.confirm("Zerar base completa?")) setOccurrences([]); }} className="w-full py-10 bg-red-600 border-4 border-red-700 rounded-[40px] flex flex-col items-center justify-center gap-4 hover:bg-red-700 transition-all shadow-2xl">
                       <AlertTriangle size={48} className="text-white mb-2" />
                       <span className="font-black uppercase text-2xl text-white tracking-[0.2em]">Resetar Matrizes Completas</span>
                    </button>
                 </div>
              </section>
           </div>
        )}
      </main>
    </div>
  );
};
