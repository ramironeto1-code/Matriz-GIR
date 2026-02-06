import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Occurrence, RiskType, BusinessLine } from '../types';
import { BUSINESS_LINES } from '../constants';
import { getRiskLevelData, calculateLiquidRisk, RiskLegend } from '../App';
import { ShieldAlert, TrendingUp, TrendingDown, ShieldCheck, Activity, ArrowDown } from 'lucide-react';

interface Props {
  occurrences: Occurrence[];
}

export const RiskDashboard: React.FC<Props> = ({ occurrences }) => {
  const getChartData = () => {
    const counts: Record<string, { inherent: number, liquid: number }> = {};
    Object.values(RiskType).forEach(t => counts[t] = { inherent: 0, liquid: 0 });

    occurrences.forEach(occ => {
      const eff = occ.analysis?.controlEffectiveness || 3;
      occ.analysis?.risks.forEach(r => {
        const inherent = (r.probability + r.impact) / 2;
        const liquid = calculateLiquidRisk(inherent, eff);
        counts[r.type].inherent += inherent;
        counts[r.type].liquid += liquid;
      });
    });

    return Object.entries(counts).map(([name, data]) => ({
      name,
      inherent: data.inherent,
      liquid: data.liquid
    })).filter(d => d.inherent > 0);
  };

  const calculateLineStats = () => {
    return BUSINESS_LINES.map(line => {
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

      const levelData = getRiskLevelData(avgLiquid);

      return {
        name: line.name,
        avgInherent,
        avgLiquid,
        reduction,
        level: levelData.label,
        colorClass: levelData.colorClass,
        count: lineOccs.length
      };
    });
  };

  const data = getChartData();
  const lineStats = calculateLineStats();
  const getEntryColor = (val: number) => getRiskLevelData(val).hex;

  return (
    <div className="space-y-8 animate-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {lineStats.map((stat, i) => (
          <div key={i} className="bg-slate-900 border-2 border-slate-800 rounded-[40px] p-8 transition-all hover:border-slate-700 shadow-xl group relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                <ShieldCheck size={80} className="text-emerald-500" />
             </div>
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6 text-center">{stat.name}</h4>
             
             <div className="flex flex-col items-center gap-6 relative z-10">
                <div className="flex justify-center gap-10 w-full items-center">
                   <div className="text-center">
                      <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Inerente (Média)</p>
                      <p className="text-lg font-black text-slate-400">{stat.count > 0 ? stat.avgInherent.toFixed(2) : "0.00"}</p>
                   </div>
                   <ArrowDown className="text-emerald-500/50 group-hover:translate-y-1 transition-transform" size={24} />
                   <div className="text-center">
                      <p className="text-[8px] font-black text-emerald-500 uppercase mb-1">Líquido (GIR)</p>
                      <p className="text-4xl font-black text-slate-100">{stat.count > 0 ? stat.avgLiquid.toFixed(2) : "0.00"}</p>
                   </div>
                </div>

                <div className="w-full bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col items-center gap-3">
                   {stat.count > 0 ? (
                     <>
                        <span className={`${stat.colorClass} text-[10px] font-black px-6 py-2 rounded-xl shadow-lg uppercase`}>{stat.level}</span>
                        <div className="flex items-center gap-2">
                           <TrendingDown size={14} className="text-emerald-400" />
                           <span className="text-[11px] font-black text-emerald-400">{stat.reduction.toFixed(0)}% de Mitigação</span>
                        </div>
                     </>
                   ) : (
                     <span className="text-[9px] font-black text-slate-700 uppercase">Aguardando dados...</span>
                   )}
                </div>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 p-10 rounded-[48px] border border-slate-800 shadow-3xl">
          <div className="flex justify-between items-center mb-10">
            <div>
                <h2 className="text-2xl font-black text-slate-100 uppercase tracking-tight">Exposição Acumulada Bacen 4557</h2>
                <p className="text-sm text-slate-500 font-medium">Análise Comparativa Inerente vs Líquido</p>
            </div>
            <Activity className="text-blue-500 opacity-50" size={32} />
          </div>

          <div className="h-[400px] w-full">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                  <XAxis type="number" hide domain={[0, 'dataMax + 1']} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid #334155' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Bar dataKey="inherent" fill="#1e293b" radius={[0, 8, 8, 0]} barSize={20} opacity={0.3} name="Inerente Acumulado" />
                  <Bar dataKey="liquid" radius={[0, 12, 12, 0]} barSize={36} name="Líquido Acumulado">
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getEntryColor(entry.liquid / (occurrences.length || 1))} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20"><Activity size={64} /><p className="mt-4 font-black uppercase text-xs">Aguardando registros da matriz</p></div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <RiskLegend />
          <div className="bg-blue-600/10 border border-blue-500/20 rounded-3xl p-8 shadow-inner">
            <h4 className="text-blue-400 font-black uppercase text-[10px] tracking-widest mb-4">Nota Técnica de Cálculo</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed italic">
              O cálculo de Risco Líquido utiliza a média aritmética das notas A (Probabilidade) e B (Impacto), ajustada pelo redutor de eficácia do controle mitigatório (0% a 95% de redução), conforme as melhores práticas de auditoria e diretrizes da Resolução BCB 4.557.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
