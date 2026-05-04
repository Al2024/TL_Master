/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BarChart3, Users, TrendingUp, AlertTriangle, BrainCircuit,
  Upload, FileText, Database, Activity, Target, Clock, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { fetchAssignments, fetchBatches, calculateBiasModels, getAdjustedForecast, uploadForecast, uploadCV } from '@/src/services/dataService';
import { askStrategicArchitect } from '@/src/services/geminiService';
import { Assignment, ProjectType, UpdateType, BiasModel } from '@/src/types';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const parseWeekStr = (s: string): number => {
  if (!s) return 0;
  const [year, dayMonth] = s.split(' ');
  if (!dayMonth) return 0;
  const [day, mon] = dayMonth.split('-');
  const d = new Date(`${mon} ${day}, ${year}`);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const fmt = (n: number, dec = 0) => n.toLocaleString('en-AU', { maximumFractionDigits: dec });
const pct = (n: number) => `${n.toFixed(1)}%`;

const COLORS = {
  billable: '#10b981',   // emerald
  proposal: '#f59e0b',   // amber
  nonBillable: '#6366f1',// indigo
  actual: '#38bdf8',     // sky
  forecast: '#10b981',   // emerald
  burnout: '#f43f5e',    // rose
  bench: '#3b82f6',      // blue
  capacity: '#334155',   // slate
};

const PROJECT_TYPE_COLORS: Record<string, string> = {
  B: COLORS.billable,
  P: COLORS.proposal,
  N: COLORS.nonBillable,
};

// â”€â”€â”€ KPI Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function KpiCard({ label, value, sub, color = '#10b981', icon: Icon, trend }: {
  label: string; value: string; sub?: string; color?: string; icon?: any; trend?: number;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-sm flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{label}</span>
        {Icon && <Icon size={14} color={color} />}
      </div>
      <div className="text-3xl font-bold font-mono" style={{ color }}>{value}</div>
      <div className="flex items-center justify-between">
        {sub && <span className="text-[9px] text-slate-500 font-mono">{sub}</span>}
        {trend !== undefined && (
          <span className={`text-[9px] font-mono ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend >= 0 ? 'â–²' : 'â–¼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Custom Tooltip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 p-3 rounded text-[10px] font-mono space-y-1">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{fmt(p.value, 0)}h</span>
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ Main App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [batches, setBatches] = useState<{ id: number; label: string; filename: string; uploaded_at: string; row_count: number }[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [winProbability, setWinProbability] = useState(100);
  const [isAdjusted, setIsAdjusted] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Chat scroll + streaming
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fullAiTextRef = useRef('');
  const [streamingIdx, setStreamingIdx] = useState<number | null>(null);

  const loadData = async (batchId?: number | null) => {
    setIsLoading(true);
    const [data, batchList] = await Promise.all([
      fetchAssignments(batchId),
      fetchBatches(),
    ]);
    setAssignments(data);
    setBatches(batchList);
    // If no batch was explicitly chosen, snap to latest
    if (batchId === undefined && batchList.length > 0) {
      setSelectedBatchId(batchList[0].id);
    }
    setIsLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleForecastUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsUploading(true);
    setUploadMessage('Uploading forecast...');
    try {
      const result = await uploadForecast(e.target.files[0]);
      const newBatchId = result?.batchId ?? null;
      if (newBatchId) setSelectedBatchId(newBatchId);
      await loadData(newBatchId);
      setUploadMessage(`Ingested successfully — ${result?.label ?? 'new batch'}`);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : 'Upload failed.');
    } finally { setIsUploading(false); }
  };

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsUploading(true);
    setUploadMessage('Uploading CV...');
    try {
      const empId = assignments[0]?.employeeId || 'unknown';
      await uploadCV(e.target.files[0], empId);
      setUploadMessage('CV uploaded successfully.');
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : 'CV upload failed.');
    } finally { setIsUploading(false); }
  };

  // â”€â”€ Derived Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const forecastRows = useMemo(() => assignments.filter(a => a.updateType === UpdateType.FORECAST), [assignments]);
  const actualRows   = useMemo(() => assignments.filter(a => a.updateType === UpdateType.ACTUAL),   [assignments]);

  const uniqueEmployees = useMemo(() => new Set(assignments.map(a => a.employeeId)), [assignments]);
  const headcount = uniqueEmployees.size;
  const weeklyCapacity = headcount * 40;

  const weekKeys = useMemo(() => {
    const keys = new Set<string>();
    assignments.forEach(a => a.weeklyAllocations.forEach(wa => keys.add(wa.week)));
    return Array.from(keys).sort((a, b) => parseWeekStr(a) - parseWeekStr(b));
  }, [assignments]);

  const todayMs = Date.now();
  const currentWeekKey = useMemo(() => {
    if (!weekKeys.length) return '';
    let closest = weekKeys[0];
    let minDiff = Infinity;
    weekKeys.forEach(w => {
      const diff = Math.abs(parseWeekStr(w) - todayMs);
      if (diff < minDiff) { minDiff = diff; closest = w; }
    });
    return closest;
  }, [weekKeys]);

  // Hours per week Ã— project type
  const weeklyChartData = useMemo(() => {
    return weekKeys.map(week => {
      const label = week.split(' ')[1] || week;
      let forecastBillable = 0, forecastProposal = 0, forecastNonBillable = 0;
      let actualTotal = 0;
      forecastRows.forEach(a => {
        const h = a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0;
        if (a.projectType === ProjectType.BILLABLE) forecastBillable += h;
        else if (a.projectType === ProjectType.PROPOSAL) forecastProposal += h;
        else forecastNonBillable += h;
      });
      actualRows.forEach(a => {
        actualTotal += a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0;
      });
      const forecastTotal = forecastBillable + forecastProposal + forecastNonBillable;
      return { week: label, forecastTotal, forecastBillable, forecastProposal, forecastNonBillable, actualTotal, capacity: weeklyCapacity };
    });
  }, [weekKeys, forecastRows, actualRows, weeklyCapacity]);

  // Current week KPIs
  const currentWeekData = useMemo(() => weeklyChartData.find(d => {
    const label = currentWeekKey.split(' ')[1] || currentWeekKey;
    return d.week === label;
  }) || { forecastBillable: 0, forecastTotal: 0, actualTotal: 0, capacity: weeklyCapacity }, [weeklyChartData, currentWeekKey]);

  const billabilityPct   = weeklyCapacity > 0 ? (currentWeekData.forecastBillable / weeklyCapacity) * 100 : 0;
  const utilizationPct   = weeklyCapacity > 0 ? (currentWeekData.forecastTotal / weeklyCapacity) * 100 : 0;

  // Forecast accuracy (weeks where we have both forecast AND actual hours)
  const accuracyData = useMemo(() => {
    const results: { week: string; accuracy: number; variance: number }[] = [];
    weekKeys.forEach(week => {
      const fTotal = forecastRows.reduce((s, a) => s + (a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0), 0);
      const aTotal = actualRows.reduce((s, a) => s + (a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0), 0);
      if (fTotal > 0 && aTotal > 0) {
        results.push({ week: week.split(' ')[1] || week, accuracy: (aTotal / fTotal) * 100, variance: aTotal - fTotal });
      }
    });
    return results;
  }, [weekKeys, forecastRows, actualRows]);

  const avgAccuracy = accuracyData.length
    ? accuracyData.reduce((s, d) => s + d.accuracy, 0) / accuracyData.length
    : null;

  // Bench risk: employees with < 8h forecast in next 2 upcoming weeks
  const benchRiskEmployees = useMemo(() => {
    const todayIdx = weekKeys.indexOf(currentWeekKey);
    const nextWeeks = weekKeys.slice(todayIdx, todayIdx + 3);
    const risks: string[] = [];
    uniqueEmployees.forEach(empId => {
      const empForecasts = forecastRows.filter(a => a.employeeId === empId);
      const totalNext = nextWeeks.reduce((sum, week) =>
        sum + empForecasts.reduce((s, a) => s + (a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0), 0), 0);
      if (totalNext < 8 * nextWeeks.length) risks.push(empId);
    });
    return risks;
  }, [forecastRows, uniqueEmployees, weekKeys, currentWeekKey]);

  // Burnout risk: employees with > 42h forecast in next 2 weeks
  const burnoutRiskEmployees = useMemo(() => {
    const todayIdx = weekKeys.indexOf(currentWeekKey);
    const nextWeeks = weekKeys.slice(todayIdx, todayIdx + 3);
    const risks: string[] = [];
    uniqueEmployees.forEach(empId => {
      const empForecasts = forecastRows.filter(a => a.employeeId === empId);
      for (const week of nextWeeks) {
        const weekTotal = empForecasts.reduce((s, a) => s + (a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0), 0);
        if (weekTotal > 42) { risks.push(empId); break; }
      }
    });
    return risks;
  }, [forecastRows, uniqueEmployees, weekKeys, currentWeekKey]);

  // PM Bias
  const biasModels = useMemo(() => calculateBiasModels(assignments), [assignments]);
  const pmBias = useMemo(() => {
    return biasModels
      .filter(b => b.coefficient !== 1.0)
      .sort((a, b) => Math.abs(b.coefficient - 1) - Math.abs(a.coefficient - 1))
      .slice(0, 8);
  }, [biasModels]);

  // Project type mix (total hours)
  const projectMix = useMemo(() => {
    const totals: Record<string, number> = { B: 0, P: 0, N: 0 };
    forecastRows.forEach(a => { totals[a.projectType] = (totals[a.projectType] || 0) + a.totalHours; });
    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    return [
      { name: 'Billable', value: totals.B, pct: total ? (totals.B / total) * 100 : 0 },
      { name: 'Proposal', value: totals.P, pct: total ? (totals.P / total) * 100 : 0 },
      { name: 'Non-Billable', value: totals.N, pct: total ? (totals.N / total) * 100 : 0 },
    ];
  }, [forecastRows]);

  // Discipline utilization
  const disciplineData = useMemo(() => {
    const map: Record<string, number> = {};
    forecastRows.forEach(a => {
      if (!a.discipline) return;
      const disc = a.discipline.split(':')[1]?.trim() || a.discipline;
      map[disc] = (map[disc] || 0) + a.totalHours;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, hours]) => ({ name, hours }));
  }, [forecastRows]);

  // Employee utilization table (current + next 3 weeks)
  const todayIdx = weekKeys.indexOf(currentWeekKey);
  const heatmapWeeks = weekKeys.slice(Math.max(0, todayIdx - 2), todayIdx + 10);

  const employeeRows = useMemo(() => {
    const empMap: Record<string, { name: string; grade: string; discipline: string }> = {};
    assignments.forEach(a => {
      if (!empMap[a.employeeId]) empMap[a.employeeId] = { name: a.employeeName, grade: a.grade, discipline: a.discipline };
    });
    return Object.entries(empMap).map(([id, info]) => {
      const empForecasts = forecastRows.filter(a => a.employeeId === id);
      const empActuals   = actualRows.filter(a => a.employeeId === id);
      const weekHours = heatmapWeeks.map(week => {
        const fH = empForecasts.reduce((s, a) => s + (a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0), 0);
        const aH = empActuals.reduce((s, a) => s + (a.weeklyAllocations.find(wa => wa.week === week)?.hours || 0), 0);
        return { forecast: fH, actual: aH };
      });
      return { id, ...info, weekHours, isBurnout: burnoutRiskEmployees.includes(id), isBench: benchRiskEmployees.includes(id) };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments, forecastRows, actualRows, heatmapWeeks, burnoutRiskEmployees, benchRiskEmployees]);

  // Auto-scroll to bottom whenever messages or thinking state changes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isThinking]);

  // Stream AI response character by character
  useEffect(() => {
    if (streamingIdx === null) return;
    const full = fullAiTextRef.current;
    if (streamingIdx >= full.length) {
      setStreamingIdx(null);
      return;
    }
    const charsPerTick = Math.max(1, Math.floor(full.length / 80)); // finish in ~80 ticks
    const timer = setTimeout(() => {
      const next = Math.min(streamingIdx + charsPerTick, full.length);
      setChatMessages(prev => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = { role: 'ai', text: full.slice(0, next) };
        return msgs;
      });
      setStreamingIdx(next);
    }, 16); // ~60fps
    return () => clearTimeout(timer);
  }, [streamingIdx]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const userMsg = inputText;
    setInputText('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsThinking(true);
    const context = {
      billability: billabilityPct,
      tasks: assignments.length,
      headcount,
      risks: burnoutRiskEmployees.length,
      bench: benchRiskEmployees.length,
      forecastAccuracy: avgAccuracy,
      winProb: winProbability,
    };
    const response = await askStrategicArchitect(userMsg, context);
    setIsThinking(false);
    // Seed an empty AI message then stream characters in
    fullAiTextRef.current = response;
    setChatMessages(prev => [...prev, { role: 'ai', text: '' }]);
    setStreamingIdx(0);
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-14 flex flex-col items-center py-6 bg-slate-950 border-r border-slate-800 space-y-8">
        <div className="p-2 bg-slate-800 rounded text-emerald-500"><BrainCircuit size={20} /></div>
        <nav className="flex flex-col space-y-4">
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-emerald-500 hover:bg-slate-900" onClick={() => setActiveTab('overview')}><BarChart3 size={20} /></Button>
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-emerald-500 hover:bg-slate-900" onClick={() => setActiveTab('grid')}><Users size={20} /></Button>
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-emerald-500 hover:bg-slate-900" onClick={() => setActiveTab('intelligence')}><Activity size={20} /></Button>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xl">TL</div>
            <h1 className="text-base font-semibold tracking-tight uppercase">
              TL MASTER <span className="text-emerald-500 font-mono text-[10px] ml-2">INTELLIGENCE v2.5</span>
            </h1>
          </div>
          <div className="flex items-center gap-6 text-[10px] font-mono">
            {/* Batch selector */}
            {batches.length > 0 && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-slate-500 uppercase text-[9px]">Data Snapshot</span>
                <select
                  value={selectedBatchId ?? ''}
                  onChange={e => {
                    const id = Number(e.target.value);
                    setSelectedBatchId(id);
                    loadData(id);
                  }}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono rounded px-2 py-0.5 focus:outline-none focus:border-emerald-500/60 cursor-pointer max-w-[200px] truncate"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {new Date(b.uploaded_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })} · {b.row_count} rows
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col items-end">
              <span className="text-slate-500 uppercase">System Status</span>
              <span className={`font-bold ${isLoading ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isLoading ? 'LOADING...' : 'LIVE PREDICTIVE ENGINE'}
              </span>
            </div>
            <Dialog>
              <DialogTrigger render={
                <Button variant="ghost" size="sm" className="h-8 px-3 border border-slate-700 text-emerald-400 font-mono text-[10px] hover:bg-slate-800">
                  <Upload size={12} className="mr-1" /> INGEST DATA
                </Button>
              } />
              <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 font-mono">
                <DialogHeader>
                  <DialogTitle className="text-emerald-500 uppercase tracking-widest text-sm">Data Ingestion Engine</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase mb-2">Structured Data (CSV Forecasting)</p>
                    <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 cursor-pointer transition-colors">
                      <div className="flex flex-col items-center"><Database className="mb-1 text-slate-500" size={18} /><span className="text-[10px] uppercase text-slate-500">Drop Forecasting CSV</span></div>
                      <input type="file" className="hidden" accept=".csv" onChange={handleForecastUpload} />
                    </label>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase mb-2">Unstructured Data (PDF/Word CVs)</p>
                    <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-slate-700 rounded-lg hover:border-emerald-500/50 cursor-pointer transition-colors">
                      <div className="flex flex-col items-center"><FileText className="mb-1 text-slate-500" size={18} /><span className="text-[10px] uppercase text-slate-500">Upload Team Profiles</span></div>
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleCVUpload} />
                    </label>
                  </div>
                  {isUploading && <p className="text-[10px] text-emerald-400 animate-pulse uppercase">Processing...</p>}
                  {uploadMessage && !isUploading && <p className="text-[10px] text-slate-300">{uploadMessage}</p>}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-slate-800 px-6 bg-slate-900/30 shrink-0">
            <TabsList className="h-10 bg-transparent gap-1 p-0">
              {[['overview','Overview'], ['grid','Resource Grid'], ['intelligence','Intelligence']].map(([v, l]) => (
                <TabsTrigger key={v} value={v} className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-400 text-slate-500 text-[11px] uppercase font-mono tracking-wider px-4 bg-transparent">
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* â”€â”€ OVERVIEW TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <TabsContent value="overview" className="flex-1 overflow-auto p-6 space-y-6 mt-0">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Billability (This Week)" value={pct(billabilityPct)} sub={`Target: 85% | Cap: ${fmt(weeklyCapacity)}h`} color={billabilityPct >= 85 ? COLORS.billable : billabilityPct >= 60 ? '#f59e0b' : '#f43f5e'} icon={Target} />
              <KpiCard label="Utilization (This Week)" value={pct(utilizationPct)} sub={`${fmt(currentWeekData.forecastTotal)}h of ${fmt(weeklyCapacity)}h capacity`} color={COLORS.billable} icon={TrendingUp} />
              <KpiCard label="Forecast Accuracy" value={avgAccuracy != null ? pct(avgAccuracy) : 'N/A'} sub={`${accuracyData.length} weeks w/ actuals`} color={avgAccuracy != null && avgAccuracy > 90 ? COLORS.billable : '#f59e0b'} icon={Zap} />
              <KpiCard label="Alerts" value={`${burnoutRiskEmployees.length + benchRiskEmployees.length}`} sub={`${burnoutRiskEmployees.length} burnout Â· ${benchRiskEmployees.length} bench risk`} color={burnoutRiskEmployees.length + benchRiskEmployees.length > 0 ? COLORS.burnout : COLORS.billable} icon={AlertTriangle} />
            </div>

            {/* Forecast vs Actual Chart + Project Mix */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Main weekly chart */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-sm p-5">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Weekly Hours â€” Forecast vs Actual</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', textTransform: 'uppercase', color: '#64748b' }} />
                    <Line type="monotone" dataKey="forecastBillable" name="Billable Forecast" stroke={COLORS.billable} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="forecastProposal" name="Proposal Forecast" stroke={COLORS.proposal} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="actualTotal" name="Actuals" stroke={COLORS.actual} strokeWidth={2} dot={false} strokeDasharray="2 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Project Mix Donut */}
              <div className="bg-slate-900 border border-slate-800 rounded-sm p-5">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Project Mix (Total Forecast Hours)</div>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={projectMix} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>
                      {projectMix.map((entry, i) => (
                        <Cell key={i} fill={[COLORS.billable, COLORS.proposal, COLORS.nonBillable][i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${fmt(v)}h`} contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: '10px', fontFamily: 'monospace' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {projectMix.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm" style={{ background: [COLORS.billable, COLORS.proposal, COLORS.nonBillable][i] }} />
                        <span className="text-slate-400">{p.name}</span>
                      </div>
                      <span className="text-slate-200 font-bold">{pct(p.pct)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Forecast Accuracy trend + What-If */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-sm p-5">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Forecast Accuracy by Week (Actual / Forecast %)</div>
                {accuracyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={accuracyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} />
                      <YAxis domain={[0, 150]} tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} unit="%" />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: '10px', fontFamily: 'monospace' }} formatter={(v: any) => `${v.toFixed(1)}%`} />
                      <Bar dataKey="accuracy" name="Accuracy %" radius={[2, 2, 0, 0]}>
                        {accuracyData.map((d, i) => (
                          <Cell key={i} fill={d.accuracy > 100 ? COLORS.burnout : d.accuracy > 85 ? COLORS.billable : COLORS.proposal} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-600 text-xs font-mono">No actuals data yet â€” upload actuals to see accuracy</div>
                )}
              </div>

              {/* What-If Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-sm p-5 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">What-If: Proposal Win Rate</div>
                  <div className="text-[9px] text-slate-600 font-mono mb-4">Scales proposal hours by probability</div>
                  <div className="px-1 mb-3">
                    <Slider value={[winProbability]} onValueChange={v => setWinProbability(Array.isArray(v) ? v[0] : v)} max={100} step={10} />
                  </div>
                  <div className="flex justify-between text-[9px] mt-2 font-mono text-slate-500 uppercase">
                    <span>Conservative</span>
                    <span className="text-emerald-400 font-bold text-sm">{winProbability}%</span>
                    <span>Aggressive</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Adjusted Proposal Hours</span>
                    <span className="text-amber-400 font-bold">{fmt(projectMix.find(p => p.name === 'Proposal')?.value || 0 * winProbability / 100)}h</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Total Adjusted Forecast</span>
                    <span className="text-emerald-400 font-bold">{fmt(forecastRows.reduce((s, a) => s + a.totalHours, 0))}h</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* â”€â”€ RESOURCE GRID TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <TabsContent value="grid" className="flex-1 overflow-hidden flex flex-col p-6 mt-0">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest">Resource Utilization Grid</h3>
                <p className="text-[9px] text-slate-600 font-mono mt-0.5">Showing {heatmapWeeks.length} weeks Â· Colors = forecast hours Â· â—† = actual available</p>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-emerald-500" /> Billable (20-38h)</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-rose-500" /> Burnout (&gt;42h)</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-blue-500" /> Bench (&lt;8h)</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-slate-800" /> Unallocated</div>
              </div>
            </div>
            <div className="flex-1 border border-slate-800 bg-slate-900/10 overflow-hidden rounded-sm">
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
                    <TableRow className="border-b border-slate-800 hover:bg-transparent">
                      <TableHead className="w-[200px] font-mono text-[10px] uppercase border-r border-slate-800 text-slate-500 sticky left-0 bg-slate-950">Employee / Grade</TableHead>
                      {heatmapWeeks.map(week => {
                        const isCurrent = week === currentWeekKey;
                        return (
                          <TableHead key={week} className={`text-center font-mono text-[9px] min-w-[64px] border-r border-slate-800 ${isCurrent ? 'text-emerald-400' : 'text-slate-500'}`}>
                            <div>{week.split(' ')[1] || week}</div>
                            {isCurrent && <div className="text-[7px] text-emerald-600">â–¶ NOW</div>}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeRows.map(emp => (
                      <TableRow key={emp.id} className="border-b border-slate-800 hover:bg-slate-900/40">
                        <TableCell className="border-r border-slate-800 py-2 sticky left-0 bg-slate-950">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-8 rounded-full shrink-0 ${emp.isBurnout ? 'bg-rose-500' : emp.isBench ? 'bg-blue-500' : 'bg-emerald-500/30'}`} />
                            <div>
                              <p className="text-[11px] font-semibold text-slate-200 leading-tight">{emp.name}</p>
                              <p className="text-[8px] text-slate-600 font-mono truncate max-w-[150px]">{emp.grade?.split(':')[0]?.trim()}</p>
                            </div>
                          </div>
                        </TableCell>
                        {emp.weekHours.map((wh, wi) => {
                          const h = wh.forecast;
                          const isPast = wi < (todayIdx - Math.max(0, todayIdx - 2));
                          let bg = 'transparent', color = 'rgba(100,116,139,0.3)';
                          if (h > 0) {
                            if (h > 42) { bg = 'rgba(244,63,94,0.35)'; color = '#fda4af'; }
                            else if (h < 8) { bg = 'rgba(59,130,246,0.2)'; color = '#93c5fd'; }
                            else { const i = Math.min((h - 8) / 32, 1); bg = `rgba(16,185,129,${0.1 + i * 0.6})`; color = i > 0.5 ? '#a7f3d0' : '#d1fae5'; }
                          }
                          return (
                            <TableCell key={wi} className="text-center p-0 border-r border-slate-800">
                              <div className="w-full min-h-[42px] flex flex-col items-center justify-center font-mono text-[10px] gap-0.5" style={{ background: bg, color }}>
                                {h > 0 && <span className="font-bold">{h.toFixed(0)}</span>}
                                {wh.actual > 0 && <span className="text-[7px] opacity-60">â—†{wh.actual.toFixed(0)}</span>}
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
          </TabsContent>

          {/* â”€â”€ INTELLIGENCE TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <TabsContent value="intelligence" className="flex-1 overflow-auto p-6 space-y-6 mt-0">
            {/* Alert cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Burnout Risk */}
              <div className="bg-slate-900 border border-rose-900/40 rounded-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-rose-400" />
                  <span className="text-[10px] font-mono text-rose-400 uppercase tracking-widest">Burnout Risk â€” {burnoutRiskEmployees.length} Employees</span>
                </div>
                {burnoutRiskEmployees.length === 0
                  ? <p className="text-[11px] text-slate-600 font-mono">No burnout risk detected in upcoming weeks.</p>
                  : <div className="space-y-1">
                      {burnoutRiskEmployees.map(id => {
                        const emp = employeeRows.find(e => e.id === id);
                        return emp ? (
                          <div key={id} className="flex items-center justify-between text-[10px] font-mono bg-rose-950/20 px-3 py-1.5 rounded">
                            <span className="text-slate-300">{emp.name}</span>
                            <span className="text-rose-400 text-[9px]">{emp.grade?.split(':')[0]?.trim()}</span>
                          </div>
                        ) : null;
                      })}
                    </div>}
              </div>

              {/* Bench Risk */}
              <div className="bg-slate-900 border border-blue-900/40 rounded-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-blue-400" />
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Bench Risk â€” {benchRiskEmployees.length} Employees</span>
                </div>
                {benchRiskEmployees.length === 0
                  ? <p className="text-[11px] text-slate-600 font-mono">All staff have adequate allocation ahead.</p>
                  : <div className="space-y-1">
                      {benchRiskEmployees.map(id => {
                        const emp = employeeRows.find(e => e.id === id);
                        return emp ? (
                          <div key={id} className="flex items-center justify-between text-[10px] font-mono bg-blue-950/20 px-3 py-1.5 rounded">
                            <span className="text-slate-300">{emp.name}</span>
                            <span className="text-blue-400 text-[9px]">{emp.discipline?.split(':')[1]?.trim() || emp.discipline}</span>
                          </div>
                        ) : null;
                      })}
                    </div>}
              </div>
            </div>

            {/* PM Bias + Discipline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* PM Accuracy */}
              <div className="bg-slate-900 border border-slate-800 rounded-sm p-5">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">PM Forecast Accuracy (Actual Ã· Forecast)</div>
                {pmBias.length === 0
                  ? <p className="text-[11px] text-slate-600 font-mono">Not enough actuals data to compute PM bias.</p>
                  : <div className="space-y-2">
                      {pmBias.map(pm => {
                        const pct_ = pm.coefficient * 100;
                        const color = pct_ > 115 ? COLORS.burnout : pct_ < 85 ? COLORS.bench : COLORS.billable;
                        const label = pct_ > 115 ? 'OVER-RUNNING' : pct_ < 85 ? 'UNDER-UTILISED' : 'ON TARGET';
                        return (
                          <div key={pm.pmName}>
                            <div className="flex justify-between text-[10px] font-mono mb-1">
                              <span className="text-slate-400 truncate max-w-[60%]">{pm.pmName}</span>
                              <div className="flex items-center gap-2">
                                <span style={{ color }} className="font-bold">{pct_.toFixed(0)}%</span>
                                <span className="text-[8px] text-slate-600">{label}</span>
                              </div>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(pct_, 150) / 1.5}%`, background: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>}
              </div>

              {/* Discipline Utilization */}
              <div className="bg-slate-900 border border-slate-800 rounded-sm p-5">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Hours by Discipline (Forecast Total)</div>
                {disciplineData.length > 0
                  ? <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={disciplineData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 8, fill: '#94a3b8', fontFamily: 'monospace' }} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: '10px', fontFamily: 'monospace' }} formatter={(v: any) => `${fmt(v)}h`} />
                        <Bar dataKey="hours" fill={COLORS.billable} radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  : <div className="text-slate-600 text-xs font-mono flex items-center justify-center h-40">No discipline data</div>}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Strategic Architect Chat */}
      <aside className="w-72 bg-slate-950 border-l border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2">
            <BrainCircuit size={13} className="text-emerald-500" />
            <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Architect</span>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Messages — native div so we can imperatively scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth">
            {/* System status pill */}
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5">
                <BrainCircuit size={10} className="text-emerald-400" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg rounded-tl-none px-3 py-2 text-[11px] text-slate-400 leading-relaxed">
                Monitoring <span className="text-emerald-400 font-semibold">{headcount}</span> staff ·{' '}
                <span className="text-emerald-400 font-semibold">{assignments.length}</span> allocations ·{' '}
                <span className={burnoutRiskEmployees.length > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>{burnoutRiskEmployees.length} burnout</span> ·{' '}
                <span className={benchRiskEmployees.length > 0 ? 'text-blue-400 font-semibold' : 'text-slate-400'}>{benchRiskEmployees.length} bench</span>
              </div>
            </div>

            <AnimatePresence>
              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-emerald-900/50'}`}>
                    {msg.role === 'user'
                      ? <span className="text-[8px] text-slate-300 font-bold">ME</span>
                      : <BrainCircuit size={10} className="text-emerald-400" />}
                  </div>
                  {/* Bubble */}
                  <div className={`max-w-[85%] px-3 py-2 rounded-lg text-[12px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-800 text-slate-200 rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                    {/* blinking cursor while streaming this bubble */}
                    {msg.role === 'ai' && streamingIdx !== null && i === chatMessages.length - 1 && (
                      <span className="inline-block w-0.5 h-3 bg-emerald-400 ml-0.5 align-middle animate-pulse" />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isThinking && (
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0 mt-0.5">
                  <BrainCircuit size={10} className="text-emerald-400 animate-spin" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg rounded-tl-none px-3 py-2">
                  <div className="flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={chatBottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-slate-800 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              rows={2}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 resize-none transition-colors"
              placeholder="Ask a question..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isThinking}
              className="h-[52px] w-9 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[9px] text-slate-700 font-mono mt-1.5 text-right">Enter to send · Shift+Enter for newline</p>
        </div>
      </aside>
    </div>
  );
}
