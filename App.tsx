
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { BUSINESS_LINES } from './constants';
import { Occurrence, BusinessLine, Macroprocess, AIAnalysis, RiskType } from './types';
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
  Cpu,
  RefreshCcw,
  ArchiveRestore,
  BrainCircuit,
  ShieldHalf,
  AlertTriangle,
  X,
  ShieldCheck,
  RotateCcw,
  Scale,
  FileSpreadsheet,
  Key,
  BookOpen,
  Target,
  Layers,
  Wrench,
  Download,
  FileUp,
  UserCheck,
  ClipboardCheck,
  Info,
  Activity,
  HardDrive,
  FileText,
  Settings
} from 'lucide-react';

const EFFICACY_REDUCTION_MAP: Record<number, number> = {
  1: 0.00,
  2: 0.20,
  3: 0.50,
  4: 0.80,
  5: 0.95,
};

const EFFICACY_LABELS: Record<number, string> = {
  1: '1 - Inexistente (0%)',
  2: '2 - Fraco (20%)',
  3: '3 - Médio (50%)',
  4: '4 - Forte (80%)',
  5: '5 - Excelente (95%)',
};

export const RISK_LEVELS_INFO = [
  { range: '4,21 -> 5,00', label: 'Muito Alto', color: 'bg-red-600', hex: '#dc2626', rgb: [220, 38, 38] },
  { range: '3,41 -> 4,20', label: 'Alto', color: 'bg-orange-600', hex: '#ea580c', rgb: [234, 88, 12] },
  { range: '2,61 -> 3,40', label: 'Médio', color: 'bg-yellow-400', hex: '#facc15', rgb: [250, 204, 21] },
  { range: '1,81 -> 2,60', label: 'Baixo', color: 'bg-sky-500', hex: '#0ea5e9', rgb: [14, 165, 233] },
  { range: '1,00 -> 1,80', label: 'Muito Baixo', color: 'bg-emerald-600', hex: '#059669', rgb: [5, 150, 105] },
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
  <div className="bg-[#0a0f1d] p-8 rounded-[40px] border border-slate-800 shadow-xl">
    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 text-center">Legenda de Risco Líquido</h4>
    <div className="space-y-4">
      {RISK_LEVELS_INFO.map((level, idx) => (
        <div key={idx} className="flex items-center gap-4 group">
          <div className={`w-4 h-4 rounded-full ${level.color} shadow-lg group-hover:scale-125 transition-transform`} />
          <div>
            <p className="text-[10px] font-black text-slate-200 uppercase">{level.label}</p>
            <p className="text-[9px] text-slate-500 font-bold">{level.range}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const App: React.FC = () => {
  const [occurrences, setOccurrences] = useState<Occurrence[]>(() => {
    try {
      const saved = localStorage.getItem('gir_occurrences');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("LocalStorage bloqueado ou inacessível.");
      return [];
    }
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
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  
  const [manualProb, setManualProb] = useState<number>(1);
  const [manualImpact, setManualImpact] = useState<number>(1);
  const [tempAnalysis, setTempAnalysis] = useState<AIAnalysis | null>(null);
  const [rasFile, setRasFile] = useState<string | undefined>();

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('gir_occurrences', JSON.stringify(occurrences));
    } catch (e) {
      console.error("Erro ao salvar no LocalStorage:", e);
    }
  }, [occurrences]);

  useEffect(() => {
    const checkApiKey = async () => {
      // @ts-ignore
      if (window.aistudio) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey || !!process.env.API_KEY);
      } else {
        setHasApiKey(!!process.env.API_KEY);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      setApiError(null);
    }
  };

  const resetForm = () => {
    setDescription(''); 
    setExistingControl(''); 
    setControlEffectiveness(3); 
    setSelectedMacro(null); 
    setTempAnalysis(null); 
    setEditingId(null);
    setManualProb(1);
    setManualImpact(1);
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
      const analysis = await analyzeOccurrence(
        description, 
        selectedMacro.name, 
        selectedLine.name, 
        existingControl,
        rasFile
      );
      setTempAnalysis(analysis);
    } catch (e: any) { 
      setApiError(e.message);
      if (e.message?.includes("LIMITE") || e.message?.includes("429") || e.message?.includes("quota")) {
         setHasApiKey(false);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmRegistration = () => {
    if (!selectedMacro || !tempAnalysis) return;

    const final: Occurrence = {
      id: editingId || crypto.randomUUID(), 
      businessLineId: selectedLine.id, 
      macroprocessId: selectedMacro.id,
      description, 
      date: new Date().toLocaleDateString('pt-BR'),
      analysis: { 
        ...tempAnalysis,
        existingControl,
        controlEffectiveness,
        risks: tempAnalysis.risks.map(r => ({
          ...r,
          probability: manualProb as any,
          impact: manualImpact as any
        }))
      }
    };

    setOccurrences(prev => {
      if (editingId) return prev.map(o => o.id === editingId ? final : o);
      return [final, ...prev];
    });

    resetForm();
  };

  const handleExportExcel = () => {
    if (occurrences.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(occurrences.map(o => ({ 
      Data: o.date, 
      Linha: BUSINESS_LINES.find(l => l.id === o.businessLineId)?.name,
      Macroprocesso: BUSINESS_LINES.find(l => l.id === o.businessLineId)?.macroprocesses.find(m => m.id === o.macroprocessId)?.name,
      Fato: o.description, 
      Controle_Existente: o.analysis?.existingControl,
      Eficacia: EFFICACY_LABELS[o.analysis?.controlEffectiveness || 3],
      Status_RAS: o.analysis?.rasStatus,
      Probabilidade: o.analysis?.risks[0]?.probability,
      Impacto: o.analysis?.risks[0]?.impact,
      Referencia_Normativa: o.analysis?.resolution4557Reference
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GIR");
    XLSX.writeFile(wb, `Matriz_GIR_${new Date().getTime()}.xlsx`);
  };

  const handleExecutiveReport = () => {
    if (occurrences.length === 0) return;
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("MATRIZ GIR - RELATÓRIO EXECUTIVO", 20, 20);
    doc.setFontSize(10);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 20, 28);
    doc.text("Conformidade Resolução BACEN 4.557", 20, 33);
    
    const tableData = occurrences.map(o => {
      const avg = (o.analysis?.risks.reduce((acc, r) => acc + (r.probability + r.impact)/2, 0) || 0) / (o.analysis?.risks.length || 1);
      return [
        o.date,
        BUSINESS_LINES.find(l => l.id === o.businessLineId)?.name || "",
        o.description,
        o.analysis?.rasStatus || "",
        avg.toFixed(2)
      ];
    });

    (doc as any).autoTable({
      startY: 40,
      head: [['DATA', 'LINHA DE NEGÓCIO', 'DESCRIÇÃO DO FATO', 'RAS', 'RISCO LÍQUIDO']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    doc.save(`Relatorio_Executivo_GIR_${new Date().getTime()}.pdf`);
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
      if (occ.analysis.risks.length > 0) {
        setManualProb(occ.analysis.risks[0].probability);
        setManualImpact(occ.analysis.risks[0].impact);
      }
    }
    setActiveTab('matrix');
  };

  const handleDeleteOccurrence = (id: string) => {
    if (window.confirm("Deseja realmente excluir este registro da matriz?")) {
      setOccurrences(prev => prev.filter(o => o.id !== id));
    }
  };

  const getStorageSize = () => {
    try {
      const stringified = localStorage.getItem('gir_occurrences') || '[]';
      return (stringified.length * 2 / 1024).toFixed(1); 
    } catch (e) {
      return "0.0";
    }
  };

  const totalRisksMapped = occurrences.reduce((acc, o) => acc + (o.analysis?.risks.length || 0), 0);

  return (
    <div className="flex min-h-screen bg-dark-950 text-slate-100 font-inter">
      {/* Sidebar Navigation */}
      <div className="w-72 bg-[#0a0f1d] border-r border-slate-800 fixed h-full p-6 flex flex-col gap-6 z-20">
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

        <div className="mt-4 flex flex-col gap-1 overflow-y-auto max-h-[40vh] custom-scrollbar">
           <span className="text-[10px] font-black text-slate-600 uppercase px-3 mb-2 tracking-widest">Matrizes por Linha</span>
           {BUSINESS_LINES.map(line => (
             <button key={line.id} onClick={() => { setSelectedLine(line); setActiveTab('matrix'); }} className={`p-3 rounded-xl flex items-center gap-3 font-bold transition-all text-xs text-left ${selectedLine.id === line.id && activeTab === 'matrix' ? 'bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-500 hover:bg-slate-800'}`}>
                <FileStack size={16}/> {line.name}
             </button>
           ))}
        </div>

        <div className="mt-auto pt-6 border-t border-slate-800">
           <div className={`p-4 rounded-2xl flex flex-col gap-3 ${hasApiKey ? 'bg-emerald-600/10 border border-emerald-500/20' : 'bg-red-600/10 border border-red-500/20'}`}>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                 <span className="text-[9px] font-black uppercase text-slate-400">Status Motor IA</span>
              </div>
              {!hasApiKey && (
                 <button onClick={handleOpenKeySelector} className="flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-[10px] font-black uppercase rounded-lg transition-all shadow-lg">
                    <Key size={12}/> Conectar AI Studio
                 </button>
              )}
           </div>
        </div>
      </div>

      <main className="ml-72 p-10 w-full relative z-10">
        {activeTab === 'dashboard' && <RiskDashboard occurrences={occurrences} />}

        {activeTab === 'matrix' && (
           <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div ref={formRef} className="space-y-8">
                    <div className="flex items-center gap-3 mb-2">
                       <Sparkles className="text-blue-400" size={24} />
                       <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-100">IDENTIFICAÇÃO DO EVENTO</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">MACROPROCESSO</label>
                          <select 
                            className="w-full p-4 bg-[#0f172a]/50 border border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 transition-all appearance-none outline-none" 
                            value={selectedMacro?.id || ''} 
                            onChange={(e) => setSelectedMacro(selectedLine.macroprocesses.find(m => m.id === e.target.value) || null)}
                          >
                             <option value="">Selecione...</option>
                             {selectedLine.macroprocesses.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">ANEXAR RAS (PDF)</label>
                          <div className="relative group h-[54px]">
                             <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                             <div className={`w-full h-full bg-[#0f172a]/50 border border-slate-800 rounded-xl flex items-center justify-center gap-2 transition-all ${rasFile ? 'border-emerald-500 text-emerald-400' : 'text-slate-500 group-hover:border-slate-700'}`}>
                                <FileUp size={16}/>
                                <span className="text-[10px] font-black uppercase">{rasFile ? 'PDF CARREGADO' : 'UPLOAD RAS'}</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">DESCRIÇÃO TÉCNICA (FATO GERADOR)</label>
                       <textarea 
                          className="w-full p-5 bg-[#0f172a]/50 border border-slate-800 rounded-2xl h-36 resize-none text-sm leading-relaxed focus:border-blue-500 transition-all outline-none" 
                          placeholder="Descreva detalhadamente a ocorrência..." 
                          value={description} 
                          onChange={(e) => setDescription(e.target.value)}
                       />
                    </div>

                    <div className="bg-[#0f172a]/30 border border-slate-800 rounded-3xl p-6 space-y-8">
                       <div className="flex items-center gap-2 text-emerald-500">
                          <UserCheck size={18} />
                          <h3 className="text-[11px] font-black uppercase tracking-widest">AUTOAVALIAÇÃO DA UNIDADE</h3>
                       </div>

                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">PROBABILIDADE (A)</label>
                             <select 
                                className="w-full p-4 bg-[#0f172a]/80 border border-slate-800 rounded-xl text-sm font-bold focus:border-emerald-500 transition-all outline-none" 
                                value={manualProb} 
                                onChange={(e) => setManualProb(Number(e.target.value))}
                             >
                                {[1,2,3,4,5].map(v => <option key={v} value={v}>Nota {v}</option>)}
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">IMPACTO GIR (B)</label>
                             <select 
                                className="w-full p-4 bg-[#0f172a]/80 border border-slate-800 rounded-xl text-sm font-bold focus:border-emerald-500 transition-all outline-none" 
                                value={manualImpact} 
                                onChange={(e) => setManualImpact(Number(e.target.value))}
                             >
                                {[1,2,3,4,5].map(v => <option key={v} value={v}>Nota {v}</option>)}
                             </select>
                          </div>
                       </div>

                       <div className="space-y-2">
                          <div className="flex items-center gap-2 text-emerald-500/80 mb-2">
                             <ClipboardCheck size={16} />
                             <label className="text-[9px] font-black uppercase tracking-wider">CONTROLE EFETUADO PELA UNIDADE</label>
                          </div>
                          <textarea 
                             className="w-full p-5 bg-[#0f172a]/50 border border-slate-800 rounded-2xl h-24 resize-none text-sm leading-relaxed focus:border-emerald-500 transition-all outline-none" 
                             placeholder="Barreiras e controles mitigatórios..." 
                             value={existingControl} 
                             onChange={(e) => setExistingControl(e.target.value)}
                          />
                       </div>

                       <div className="space-y-2">
                          <div className="flex items-center gap-2 text-blue-500/80 mb-2">
                             <ShieldHalf size={16} />
                             <label className="text-[9px] font-black uppercase tracking-wider">AVALIAÇÃO DO REDUTOR (EFICÁCIA)</label>
                          </div>
                          <select 
                             className="w-full p-4 bg-[#0f172a]/80 border border-slate-800 rounded-xl text-sm font-bold focus:border-blue-500 transition-all outline-none" 
                             value={controlEffectiveness} 
                             onChange={(e) => setControlEffectiveness(Number(e.target.value))}
                          >
                             {Object.keys(EFFICACY_LABELS).map((val) => <option key={val} value={val}>{EFFICACY_LABELS[Number(val)]}</option>)}
                          </select>
                       </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                       <button onClick={handleRiskEvaluation} disabled={!description || !selectedMacro || isAnalyzing} className="flex-1 px-8 py-5 rounded-3xl font-black text-xs flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition-all">
                          {isAnalyzing ? <Loader2 className="animate-spin" size={20}/> : <BrainCircuit size={20}/>} 
                          IA AVALIAR
                       </button>
                    </div>
                 </div>

                 <div className="relative">
                    {tempAnalysis && (
                       <div className="bg-[#0a0f1d] p-8 rounded-[40px] border border-slate-800 flex flex-col gap-8 shadow-2xl">
                          <div className="flex justify-between items-center border-b border-slate-800 pb-6">
                             <div className="flex items-center gap-3">
                                <Layers className="text-blue-500" size={24}/>
                                <div><p className="text-[10px] font-black uppercase text-blue-400">PARECER TÉCNICO IA</p></div>
                             </div>
                             <div className="px-4 py-1.5 rounded-full border text-[10px] font-black uppercase bg-emerald-600/20 text-emerald-400 border-emerald-500/30">
                                RAS: {tempAnalysis.rasStatus}
                             </div>
                          </div>
                          <div className="space-y-4">
                             {tempAnalysis.risks.map((r, idx) => (
                                <div key={idx} className="bg-[#0f172a] border border-slate-800 p-5 rounded-2xl">
                                   <div className="flex justify-between mb-2">
                                      <span className="text-[11px] font-black text-slate-200 uppercase">{r.type}</span>
                                   </div>
                                   <p className="text-[11px] text-slate-400 italic">"{r.justification}"</p>
                                </div>
                             ))}
                          </div>
                          <button onClick={handleConfirmRegistration} className="w-full py-5 rounded-3xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 transition-all uppercase">
                             GRAVAR NA MATRIZ
                          </button>
                       </div>
                    )}
                 </div>
              </div>

              <div className="mt-16 space-y-8 pb-20">
                 <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <h3 className="text-xl font-black flex items-center gap-3 text-slate-200 uppercase tracking-tighter"><HistoryIcon size={20} className="text-blue-500" /> HISTÓRICO DE LANÇAMENTOS</h3>
                    
                    <div className="flex items-center gap-4">
                       <button 
                          onClick={handleExecutiveReport} 
                          className="px-6 py-2.5 bg-[#0f172a] hover:bg-slate-800 text-slate-400 font-black text-[10px] uppercase rounded-full flex items-center justify-center gap-2 transition-all border border-slate-800"
                       >
                          <Download size={14}/> RELATÓRIO EXECUTIVO
                       </button>
                       
                       <button 
                          onClick={handleExportExcel} 
                          className="px-6 py-2.5 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-500 font-black text-[10px] uppercase rounded-full flex items-center justify-center gap-2 transition-all"
                       >
                          <FileSpreadsheet size={14}/> EXPORTAR XLSX
                       </button>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-4">
                    {occurrences.filter(o => o.businessLineId === selectedLine.id).map(occ => {
                      const avgLiquid = occ.analysis?.risks.reduce((acc, r) => acc + calculateLiquidRisk((r.probability + r.impact)/2, occ.analysis?.controlEffectiveness || 3), 0) || 0;
                      const liquidScore = (avgLiquid / (occ.analysis?.risks.length || 1)).toFixed(2);
                      const levelData = getRiskLevelData(Number(liquidScore));

                      return (
                       <div key={occ.id} className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 flex justify-between items-center group hover:border-slate-600 transition-all">
                          <div className="flex items-center gap-6">
                             <div className={`w-12 h-12 rounded-xl ${levelData.color} flex items-center justify-center text-white font-black text-sm shadow-lg`}>
                                {liquidScore}
                             </div>
                             <div>
                                <h4 className="font-bold text-sm text-slate-100 uppercase">{occ.description}</h4>
                                <div className="flex gap-4 mt-1">
                                   <p className="text-[9px] text-slate-500 font-black uppercase">{occ.date} • {selectedLine.macroprocesses.find(m => m.id === occ.macroprocessId)?.name}</p>
                                   <p className="text-[9px] text-emerald-500 font-black uppercase">RAS: {occ.analysis?.rasStatus}</p>
                                </div>
                             </div>
                          </div>
                          <div className="flex gap-3">
                             <button onClick={() => handleEditOccurrence(occ)} className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-all"><Edit3 size={16}/></button>
                             <button onClick={() => handleDeleteOccurrence(occ.id)} className="p-2 bg-red-950/20 text-red-500 rounded-lg hover:bg-red-950/40 transition-all"><Trash2 size={16}/></button>
                          </div>
                       </div>
                    )})}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'governance' && (
           <div className="max-w-7xl mx-auto space-y-8 animate-in pb-20">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-8">
                    <div className="bg-[#0a0f1d] p-10 rounded-[48px] border border-slate-800 shadow-2xl space-y-8">
                       <div className="flex items-center gap-3">
                          <Activity className="text-blue-500" size={24} />
                          <h2 className="text-xl font-black uppercase tracking-tighter">SAÚDE DO BANCO DE DADOS</h2>
                       </div>
                       
                       <div className="grid grid-cols-3 gap-6">
                          <div className="bg-[#070b14] p-8 rounded-[32px] border border-slate-800/50">
                             <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">TOTAL OCORRÊNCIAS</p>
                             <p className="text-6xl font-black text-white">{occurrences.length}</p>
                          </div>
                          <div className="bg-[#070b14] p-8 rounded-[32px] border border-slate-800/50">
                             <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">RISCOS MAPEADOS</p>
                             <p className="text-6xl font-black text-blue-500">{totalRisksMapped}</p>
                          </div>
                          <div className="bg-[#070b14] p-8 rounded-[32px] border border-slate-800/50 flex flex-col justify-center">
                             <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">STATUS RAS ATIVO</p>
                             <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
                                <span className="text-xl font-black text-emerald-500 uppercase">Operacional</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="bg-[#0a0f1d] p-10 rounded-[48px] border border-slate-800 shadow-2xl space-y-10">
                       <div className="flex items-center gap-3">
                          <ShieldCheck className="text-emerald-500" size={24} />
                          <h2 className="text-xl font-black uppercase tracking-tighter">CHECKLIST DE CONFORMIDADE 4.557</h2>
                       </div>

                       <div className="space-y-3">
                          {[
                            "Estrutura de Gerenciamento de Riscos (EGR)",
                            "Declaração de Apetite por Riscos (RAS)",
                            "Mensuração e Monitoramento de Risco Operacional",
                            "Relatórios de Gerenciamento Integrado",
                            "Políticas de Continuidade de Negócios"
                          ].map((item, idx) => (
                             <div key={idx} className="flex items-center justify-between p-6 bg-[#070b14] border border-slate-800/50 rounded-2xl hover:border-slate-700 transition-all group">
                                <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{item}</span>
                                <CheckCircle2 className="text-emerald-500" size={20} />
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-8">
                    <div className="bg-[#0a0f1d] p-10 rounded-[48px] border border-slate-800 shadow-2xl space-y-8">
                       <div className="flex items-center gap-3">
                          <Settings className="text-slate-500" size={20} />
                          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">GESTÃO DE BASE</h2>
                       </div>

                       <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                             <button 
                                onClick={handleExecutiveReport} 
                                className="flex-1 px-6 py-4 bg-[#0f172a] hover:bg-slate-800 text-slate-400 font-black text-[11px] uppercase rounded-full flex items-center justify-center gap-3 transition-all border border-slate-800"
                             >
                                <Download size={16}/> RELATÓRIO EXECUTIVO
                             </button>
                             
                             <button 
                                onClick={handleExportExcel} 
                                className="flex-1 px-6 py-4 border border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-500 font-black text-[11px] uppercase rounded-full flex items-center justify-center gap-3 transition-all"
                             >
                                <FileSpreadsheet size={16}/> EXPORTAR XLSX
                             </button>
                          </div>
                       </div>

                       <div className="border-t border-slate-800/50 pt-8">
                          <button 
                             onClick={() => { if(window.confirm("Atenção! Esta ação apagará permanentemente todos os registros da matriz. Continuar?")) setOccurrences([]); }}
                             className="w-full p-6 bg-[#1a0b0b] hover:bg-[#2a0f0f] border border-red-900/30 rounded-3xl flex items-center justify-center gap-4 group transition-all"
                          >
                             <Trash2 size={18} className="text-red-500" />
                             <span className="text-[11px] font-black uppercase text-red-500">PURGA DE DADOS TOTAL</span>
                          </button>
                       </div>
                    </div>

                    <div className="bg-[#0a0f1d] p-10 rounded-[48px] border border-slate-800 shadow-2xl space-y-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-8 opacity-5"><HardDrive size={120} /></div>
                       <div className="flex items-center gap-3 relative z-10">
                          <HardDrive className="text-blue-500" size={20} />
                          <h2 className="text-[11px] font-black uppercase tracking-widest text-blue-500">STATUS LOCALSTORAGE</h2>
                       </div>

                       <div className="space-y-4 relative z-10">
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                             <div 
                                className="h-full bg-blue-600 transition-all duration-1000" 
                                style={{ width: `${Math.min(100, (parseFloat(getStorageSize()) / 5120) * 100)}%` }}
                             ></div>
                          </div>
                          <div className="flex justify-end">
                             <span className="text-[10px] font-black text-slate-500 uppercase">{getStorageSize()} KB</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium italic leading-relaxed">
                             Espaço utilizado pela base de dados GIR no navegador.
                          </p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </main>
    </div>
  );
};
