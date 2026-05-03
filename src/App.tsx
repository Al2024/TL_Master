/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  MessageSquare, 
  ChevronRight, 
  Search,
  Settings,
  BrainCircuit,
  Filter,
  Upload,
  FileText,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { fetchAssignments, calculateBiasModels, getAdjustedForecast, uploadForecast, uploadCV } from '@/src/services/dataService';
import { calculateBillability, detectBurnoutRisk } from '@/src/lib/predictive';
import { askStrategicArchitect } from '@/src/services/geminiService';
import { Assignment, ProjectType, UpdateType, BiasModel } from '@/src/types';

export default function App() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [biasModels, setBiasModels] = useState<BiasModel[]>([]);
  const [winProbability, setWinProbability] = useState(100);
  const [viewMode, setUpdateType] = useState<UpdateType>(UpdateType.FORECAST);
  const [isAdjusted, setIsAdjusted] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = async () => {
    const data = await fetchAssignments();
    setAssignments(data);
    setBiasModels(calculateBiasModels(data));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleForecastUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsUploading(true);
    try {
      await uploadForecast(e.target.files[0]);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsUploading(true);
    try {
      // For demo, we'll pick first employee ID if available
      const empId = assignments[0]?.employeeId || "unknown";
      await uploadCV(e.target.files[0], empId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const weekKeys = useMemo(() => {
    const keys = new Set<string>();
    assignments.forEach(a => a.weeklyAllocations.forEach(wa => keys.add(wa.week)));
    
    return Array.from(keys).sort((a, b) => {
      const parse = (s: string) => {
        if (!s) return 0;
        // Standard "YYYY DD-MMM"
        const parts = s.split(' ');
        if (parts.length === 2) {
          const [year, dayMonth] = parts;
          const [day, month] = dayMonth.split('-');
          if (day && month) {
            const d = new Date(`${month} ${day}, ${year}`);
            if (!isNaN(d.getTime())) return d.getTime();
          }
        }
        // Fallback or "week X" format
        if (s.includes('week')) {
           const p = s.split(' ');
           return parseInt(p[0]) * 1000 + parseInt(p[2]);
        }
        return 0;
      };
      return parse(a) - parse(b);
    });
  }, [assignments]);

  const displayedAssignments = useMemo(() => {
    let result = assignments.filter(a => a.updateType === (viewMode === UpdateType.ACTUAL ? UpdateType.ACTUAL : UpdateType.FORECAST));
    
    if (viewMode === UpdateType.FORECAST) {
      if (isAdjusted) {
        result = result.map(a => {
          const bias = biasModels.find(bm => bm.pmName === a.projectManager)?.coefficient || 1.0;
          return getAdjustedForecast(a, bias);
        });
      }

      if (winProbability < 100) {
        result = result.map(a => {
          if (a.projectType === ProjectType.PROPOSAL) {
            const prob = winProbability / 100;
            return {
              ...a,
              totalHours: a.totalHours * prob,
              weeklyAllocations: a.weeklyAllocations.map(wa => ({ ...wa, hours: wa.hours * prob }))
            };
          }
          return a;
        });
      }
    }
    
    return result;
  }, [assignments, viewMode, isAdjusted, winProbability, biasModels]);

  const billability = useMemo(() => {
    return calculateBillability(displayedAssignments, weekKeys);
  }, [displayedAssignments, weekKeys]);

  const burnoutRisks = useMemo(() => {
    return detectBurnoutRisk(assignments);
  }, [assignments]);

  const currentBillability = billability[weekKeys[0]] || 0;

  const billabilityData = useMemo(() => {
    return weekKeys.map(week => ({
      name: week.split('-')[1] || week,
      value: billability[week] || 0
    }));
  }, [billability, weekKeys]);

  const handleSendMessage = async () => {
    
    const userMsg = inputText;
    setInputText('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);

    const context = {
      billability: currentBillability,
      tasks: assignments.length,
      risks: burnoutRisks.length,
      winProb: winProbability
    };

    const response = await askStrategicArchitect(userMsg, context);
    setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
    setIsThinking(false);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden" id="main-layout">
      {/* Sidebar Navigation */}
      <aside className="w-14 flex flex-col items-center py-6 bg-slate-950 border-r border-slate-800 space-y-8" id="sidebar">
        <div className="p-2 bg-slate-800 rounded text-emerald-500">
          <BrainCircuit size={20} />
        </div>
        <nav className="flex flex-col space-y-4">
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-emerald-500 hover:bg-slate-900"><BarChart3 size={20}/></Button>
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-emerald-500 hover:bg-slate-900"><Users size={20}/></Button>
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-emerald-500 hover:bg-slate-900"><Settings size={20}/></Button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Header / Branding */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xl">TL</div>
            <h1 className="text-lg font-semibold tracking-tight uppercase">TL MASTER <span className="text-emerald-500 font-mono text-xs ml-2">INTELLIGENCE v2.5</span></h1>
          </div>
          <div className="hidden md:flex gap-8 text-[10px] font-mono">
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase">System Status</span>
              <span className="text-emerald-400 font-bold">LIVE PREDICTIVE ENGINE</span>
            </div>
             <div className="flex flex-col">
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="ghost" size="sm" className="h-full p-0 flex flex-col items-start hover:bg-transparent">
                        <span className="text-slate-500 uppercase">Data Pipeline</span>
                        <span className="text-emerald-400 font-bold flex items-center"><Upload size={10} className="mr-1"/> INGEST DATA</span>
                      </Button>
                    }
                  />
                  <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 font-mono">
                   <DialogHeader>
                     <DialogTitle className="text-emerald-500 uppercase tracking-widest text-sm">Data Ingestion Engine</DialogTitle>
                   </DialogHeader>
                   <div className="space-y-6 py-4">
                     <div className="space-y-2">
                       <p className="text-[10px] text-slate-400 uppercase">Structured Data (CSV Forecasting)</p>
                       <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 cursor-pointer transition-colors bg-slate-950/50">
                         <div className="flex flex-col items-center">
                           <Database className="mb-2 text-slate-500" size={20}/>
                           <span className="text-[10px] uppercase text-slate-500 group-hover:text-slate-300">Drop Forecasting CSV</span>
                         </div>
                         <input type="file" className="hidden" accept=".csv" onChange={handleForecastUpload} />
                       </label>
                     </div>
                     <div className="space-y-2">
                       <p className="text-[10px] text-slate-400 uppercase">Unstructured Data (PDF/Word CVs)</p>
                       <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 cursor-pointer transition-colors bg-slate-950/50">
                         <div className="flex flex-col items-center">
                           <FileText className="mb-2 text-slate-500" size={20}/>
                           <span className="text-[10px] uppercase text-slate-500">Upload Team Profiles</span>
                         </div>
                         <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleCVUpload} />
                       </label>
                     </div>
                     {isUploading && <p className="text-[10px] text-emerald-400 animate-pulse uppercase">Processing data packets...</p>}
                   </div>
                 </DialogContent>
               </Dialog>
            </div>
          </div>
        </header>

        {/* Zone A: The Pulse */}
        <section className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-800 bg-slate-900/20 shrink-0">
          {/* Billability Card */}
          <div className="col-span-1 bg-slate-900 border border-slate-800 p-5 flex flex-col items-center justify-center relative rounded-sm" id="pulse-billability">
            <div className="absolute top-2 left-2 text-[8px] font-mono text-slate-500 uppercase">Billability_Current</div>
            <div className="text-4xl font-bold text-emerald-500 font-mono">{currentBillability.toFixed(0)}%</div>
            <div className="w-full h-1 bg-slate-800 mt-4 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                initial={{ width: 0 }}
                animate={{ width: `${currentBillability}%` }}
              />
            </div>
            <div className="mt-4 h-[40px] w-full opacity-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={billabilityData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
          </div>

          {/* Forecasting Gap Card */}
          <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-800 p-5 flex flex-col justify-center rounded-sm" id="pulse-risks">
            <div className="text-[10px] font-mono text-slate-500 mb-1 uppercase tracking-widest">Predictive_Forecast_Gap</div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-rose-400">-{ (85 - currentBillability).toFixed(0) }% Drop</span>
              <span className="text-xs text-slate-400 mb-1">Projected relative to 85% target</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2 font-mono uppercase">
              Primary Risks: {burnoutRisks.length} Over-Forecasted Units Detected.
            </div>
          </div>

          {/* What-If Slider */}
          <div className="col-span-1 bg-slate-900 border border-slate-800 p-5 rounded-sm" id="pulse-whatif">
            <div className="text-[10px] font-mono text-slate-500 mb-3 uppercase tracking-widest font-bold">What-If_Proposal_Weight</div>
            <div className="px-1">
              <Slider 
                value={[winProbability]} 
                onValueChange={(v) => setWinProbability(v[0])} 
                max={100} 
                step={10}
                className="accent-emerald-500"
              />
            </div>
            <div className="flex justify-between text-[8px] mt-3 font-mono text-slate-500 uppercase tracking-tighter">
              <span>Conservative</span>
              <span className="text-emerald-400 font-bold">{winProbability}%</span>
              <span>Aggressive</span>
            </div>
          </div>
        </section>

        {/* Zone B: The Grid */}
        <section className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-[0.2em]">Resource Utilization Heatmap</h3>
            <div className="flex gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-3 text-[10px] uppercase font-mono border rounded-none ${viewMode === UpdateType.FORECAST && !isAdjusted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}`}
                onClick={() => { setUpdateType(UpdateType.FORECAST); setIsAdjusted(false); }}
              >
                System Forecast
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-3 text-[10px] uppercase font-mono border rounded-none ${isAdjusted ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}`}
                onClick={() => { setUpdateType(UpdateType.FORECAST); setIsAdjusted(true); }}
              >
                Model Adjusted
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 px-3 text-[10px] uppercase font-mono border rounded-none ${viewMode === UpdateType.ACTUAL ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'}`}
                onClick={() => { setUpdateType(UpdateType.ACTUAL); setIsAdjusted(false); }}
              >
                Actuals
              </Button>
            </div>
          </div>

          <div className="flex-1 border border-slate-800 bg-slate-900/10 overflow-hidden relative rounded-sm">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-950/90 backdrop-blur-md z-10">
                  <TableRow className="border-b border-slate-800 hover:bg-transparent">
                    <TableHead className="w-[200px] font-mono text-[10px] uppercase border-r border-slate-800 text-slate-500">Resource / Grade</TableHead>
                    {weekKeys.map(week => {
                      const display = week.includes('week') 
                        ? 'W' + week.split(' ')[2] 
                        : (week.split(' ')[1] || '').replace('-', '');
                      return (
                        <TableHead key={week} className="text-center font-mono text-[10px] min-w-[70px] border-r border-slate-800 text-slate-500">
                          {display || week}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedAssignments.map((a, i) => (
                    <TableRow key={a.id} className="border-b border-slate-800 group hover:bg-slate-900/40">
                      <TableCell className="border-r border-slate-800 py-3 pr-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-semibold text-slate-200">{a.employeeName}</p>
                            <p className="text-[9px] text-slate-500 truncate max-w-[140px] uppercase font-mono tracking-tighter">{a.projectName}</p>
                          </div>
                          {burnoutRisks.includes(a.employeeId) && (
                            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)] animate-pulse shrink-0 ml-2" title="Burnout Risk" />
                          )}
                        </div>
                      </TableCell>
                      {weekKeys.map(week => {
                        const hours = a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0;
                        const intensity = Math.min(hours / 40, 1);
                        
                        // Use design specific colors
                        let bgColor = 'transparent';
                        let textColor = 'rgba(148, 163, 184, 0.4)'; // slate-400 low opacity

                        if (hours > 0) {
                          if (hours > 38) {
                            bgColor = `rgba(244, 63, 94, ${0.4 + intensity * 0.4})`; // rose
                            textColor = '#fff';
                          } else if (hours < 10) {
                            bgColor = `rgba(59, 130, 246, ${0.2 + intensity * 0.4})`; // blue/bench
                            textColor = '#93c5fd';
                          } else {
                            bgColor = `rgba(16, 185, 129, ${0.1 + intensity * 0.7})`; // emerald
                            textColor = hours > 20 ? '#a7f3d0' : '#d1fae5';
                          }
                        }

                        return (
                          <TableCell key={week} className="text-center p-0 align-middle border-r border-slate-800">
                            <div 
                              className="w-full h-full min-h-[44px] flex items-center justify-center font-mono text-[10px]"
                              style={{ backgroundColor: bgColor, color: textColor }}
                            >
                              {hours > 0 ? hours.toFixed(1) : ''}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          
          {/* Key / Legend */}
          <div className="mt-4 flex flex-wrap gap-6 text-[9px] font-mono opacity-50 uppercase tracking-widest shrink-0">
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-emerald-500"></div> Billable</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-500"></div> On Bench</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-rose-500"></div> Burnout / High Bias</div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-slate-800 border border-slate-700"></div> Unallocated</div>
          </div>
        </section>
      </main>

      {/* Zone C: Strategic Chat Sidebar */}
      <aside className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col" id="strategic-chat">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Strategic Architect</span>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
        </div>
        
        <ScrollArea className="flex-1 px-4 py-6">
          <div className="space-y-6">
            <div className="p-4 bg-slate-900/50 rounded-sm border border-slate-800 text-[11px] text-slate-400 font-mono">
               <span className="text-emerald-500 font-bold">ARC-01:</span> Monitoring {assignments.length} allocations. {burnoutRisks.length} staffing anomalies detected. Target billability 85%.
            </div>
            
            <AnimatePresence>
              {chatMessages.map((msg, i) => (
                <div 
                  key={i}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="flex gap-2 items-center text-[8px] text-emerald-500 font-mono uppercase tracking-widest mb-2 ml-1">
                      <BrainCircuit size={10}/> ARCHITECT_RESPONSE
                    </div>
                  )}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`max-w-[90%] p-4 rounded-sm text-[11px] font-mono leading-relaxed border ${
                      msg.role === 'user' 
                        ? 'bg-slate-800/50 border-slate-700 text-slate-300' 
                        : 'bg-slate-950 border-emerald-900/30 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.03)]'
                    }`}
                  >
                    {msg.text}
                  </motion.div>
                </div>
              ))}
            </AnimatePresence>
            
            {isThinking && (
              <div className="flex flex-col items-start">
                <div className="flex gap-2 items-center text-[8px] text-emerald-500 font-mono uppercase tracking-widest mb-2 ml-1">
                  <BrainCircuit size={10} className="animate-spin text-emerald-400"/> THINKING...
                </div>
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-sm w-[90%] text-[10px] text-slate-500 italic font-mono">
                  Vectorizing query... matching CV embeddings... analyzing predictive variance...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-slate-800 bg-slate-900/20">
          <div className="relative bg-slate-950 border border-slate-700 rounded-sm focus-within:border-emerald-500/50 transition-colors">
            <textarea 
              rows={2}
              className="w-full bg-transparent px-3 py-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none font-mono" 
              placeholder="Ask the architect..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            />
            <div className="absolute bottom-2 right-2 text-[8px] text-slate-700 font-mono uppercase tracking-widest group-focus-within:text-emerald-500/50">
              CMD + ↵
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
