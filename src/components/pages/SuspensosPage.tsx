"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Suspenso, SuspensoFilters, STATUS_COLORS, SituacaoAeasy } from "@/lib/types";
import {
  Upload,
  Play,
  RotateCcw,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  X,
  FileSpreadsheet,
  RefreshCw,
  ChevronRight,
  MessageCircle,
  ArrowUpDown,
  Zap,
} from "lucide-react";

export default function SuspensosPage() {
  const { user, isAdmin } = useAuth();
  const [records, setRecords] = useState<Suspenso[]>([]);
  const [totalReal, setTotalReal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showAtendimento, setShowAtendimento] = useState<Suspenso | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeVencimento, setActiveVencimento] = useState<string>("todos");
  const [sortAsc, setSortAsc] = useState(false); // false = desc (most overdue first)


  const [filters, setFilters] = useState<SuspensoFilters>({
    busca: "",
    vencimentoDe: "",
    vencimentoAte: "",
    situacao: "",
    formaPagamento: "",
    atendente: "",
    conferencia: "",
    valorSegmento: "",
  });

  // Atendimento form
  const [atendForm, setAtendForm] = useState({
    formaPagamento: "",
    valorRecebido: "",
    observacoes: "",
    dtRecebimento: new Date().toLocaleDateString("pt-BR"),
  });

  const fetchSuspensos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/suspensos", {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        setRecords(data.data || []);
        if (data.totalReal) setTotalReal(data.totalReal);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchSuspensos(); }, [fetchSuspensos]);

  // Polling every 3 seconds for real-time sync between operators
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSuspensos(true); // silent refresh (no loading spinner)
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchSuspensos]);


  // Client-side filtering
  const filteredRecords = useMemo(() => {
    let result = [...records];
    // Filtro por aba de vencimento
    if (activeVencimento !== "todos") {
      result = result.filter((r) => r.diaVencimento === activeVencimento);
    }
    if (filters.busca) {
      const q = filters.busca.toLowerCase();
      result = result.filter(
        (r) => r.associado.toLowerCase().includes(q) || r.placa.toLowerCase().includes(q)
      );
    }
    if (filters.situacao) result = result.filter((r) => r.situacaoAeasy === filters.situacao);
    if (filters.formaPagamento) result = result.filter((r) => r.formaPagamento === filters.formaPagamento);
    if (filters.atendente) result = result.filter((r) => r.atendente === filters.atendente);
    if (filters.conferencia) result = result.filter((r) => r.conferencia === filters.conferencia);
    // Value segmentation filter
    if (filters.valorSegmento) {
      result = result.filter((r) => {
        const val = parseFloat(r.valorOriginal.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        if (filters.valorSegmento === "alto") return val > 200;
        if (filters.valorSegmento === "medio") return val >= 100 && val <= 200;
        if (filters.valorSegmento === "baixo") return val < 100;
        return true;
      });
    }
    // Priority queue: sort by diasAtraso
    result.sort((a, b) => {
      const atrA = a.diasAtraso || 0;
      const atrB = b.diasAtraso || 0;
      return sortAsc ? atrA - atrB : atrB - atrA;
    });
    return result;
  }, [records, filters, activeVencimento, sortAsc]);

  // Contadores por vencimento (para badges nas abas)
  const vencimentoCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: records.length };
    for (const r of records) {
      const v = r.diaVencimento || "?";
      counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  }, [records]);

  // KPI cards for suspensos - responsivos ao filtro de vencimento
  const kpis = useMemo(() => {
    const totalPlacas = totalReal || records.length;

    // Fila e Meus calculam sobre TODOS os records (nao afetados por filtro de atendente)
    // Aplicar apenas filtro de vencimento para estes contadores
    const recordsPorVencimento = activeVencimento !== "todos"
      ? records.filter((r) => r.diaVencimento === activeVencimento)
      : records;

    const filaDisponivel = recordsPorVencimento.filter((r) => !r.atendente).length;
    const meusAtendimentos = records.filter((r) => r.atendente === user?.nome).length;
    const convertidosHoje = recordsPorVencimento.filter((r) => r.conferencia === "OK").length;

    // Valores monetarios calculam sobre registros FILTRADOS (respondem a todos os filtros ativos)
    const valorReceber = filteredRecords.reduce((sum, r) => {
      const val = parseFloat((r.valorOriginal ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      return sum + val;
    }, 0);
    const valorRecebidoOk = filteredRecords
      .filter((r) => r.conferencia === "OK")
      .reduce((sum, r) => {
        const val = parseFloat((r.valorRecebido ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        return sum + val;
      }, 0);

    return { totalPlacas, valorReceber, valorRecebidoOk, filaDisponivel, meusAtendimentos, convertidosHoje };
  }, [records, totalReal, filteredRecords, activeVencimento, user?.nome]);

  // Unique atendentes for filter
  const atendentes = useMemo(() => {
    const set = new Set(records.map((r) => r.atendente).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);


  // Handlers
  const openWhatsApp = (telefone: string) => {
    if (!telefone) return;
    const cleanPhone = telefone.replace(/[^\d]/g, "");
    if (cleanPhone.length >= 10) {
      window.open(`https://wa.me/55${cleanPhone}`, "_blank");
    }
  };

  const handleIniciarAtendimento = async (record: Suspenso) => {
    if (record.atendente && record.atendente !== user?.nome) {
      alert(`Registro travado por: ${record.atendente}`);
      return;
    }
    // Optimistic UI: update state immediately
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, atendente: user?.nome || "" } : r));
    setSubmitting(true);
    try {
      const res = await fetch("/api/suspensos/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, action: "iniciar" }),
        cache: "no-store",
      });
      const data = await res.json();

      if (res.status === 409) {
        // CONFLICT: outro operador pegou este registro
        alert(`Conflito: ${data.error || "Registro ja em atendimento por outro operador."}`);
        fetchSuspensos(true); // refresh para mostrar estado real
        return;
      }

      if (data.success) {
        setShowAtendimento({ ...record, atendente: user?.nome || "" });
        fetchSuspensos(true);
      } else {
        fetchSuspensos(true);
      }
    } catch (e) { console.error(e); fetchSuspensos(true); }
    finally { setSubmitting(false); }
  };

  const handleSalvarAtendimento = async () => {
    if (!showAtendimento) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/suspensos/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: showAtendimento.id, action: "salvar", dados: atendForm }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAtendimento(null);
        setAtendForm({ formaPagamento: "", valorRecebido: "", observacoes: "", dtRecebimento: new Date().toLocaleDateString("pt-BR") });
        fetchSuspensos();
      }
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleLiberarFila = async (record: Suspenso) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/suspensos/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, action: "liberar" }),
      });
      if ((await res.json()).success) fetchSuspensos();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleConferencia = async (record: Suspenso, value: string) => {
    // Optimistic UI: update immediately
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, conferencia: value as any } : r));
    try {
      await fetch("/api/suspensos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, conferencia: value }),
        cache: "no-store",
      });
      fetchSuspensos(true); // silent refresh
    } catch (e) { console.error(e); fetchSuspensos(true); }
  };

  const handleUndoConferencia = async (record: Suspenso) => {
    // Optimistic UI: revert to empty
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, conferencia: "" as any } : r));
    try {
      await fetch("/api/suspensos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, conferencia: "" }),
        cache: "no-store",
      });
      fetchSuspensos(true);
    } catch (e) { console.error(e); fetchSuspensos(true); }
  };

  // Auto-distribution: pick highest priority (most overdue) record without atendente
  const handleProximoDaFila = async () => {
    const disponivel = [...records]
      .filter((r) => !r.atendente)
      .sort((a, b) => (b.diasAtraso || 0) - (a.diasAtraso || 0));
    if (disponivel.length === 0) {
      alert("Nenhum registro disponivel na fila.");
      return;
    }
    const proximo = disponivel[0];
    await handleIniciarAtendimento(proximo);
  };


  const handleImport = async (importData: any[]) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/suspensos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: importData }),
      });
      const data = await res.json();
      if (data.success) {
        setShowImport(false);
        fetchSuspensos();
      }
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/export?type=suspensos&format=csv");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `suspensos_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Sincronizar com AEasy (Admin only) - dispara GitHub Actions workflow
  const handleSyncAeasy = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      // Disparar workflow via GitHub Actions API
      const res = await fetch("/api/sync-aeasy", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ success: true, message: data.message || "Sincronizacao disparada! Aguarde 1-2 min e recarregue." });
        // Recarregar dados apos 30 segundos (tempo para o workflow executar)
        setTimeout(() => fetchSuspensos(), 30000);
      } else {
        setSyncResult({ success: false, message: data.error || "Erro ao disparar sincronizacao" });
      }
    } catch (e: any) {
      setSyncResult({ success: false, message: `Erro: ${e.message || "verifique o console"}` });
      console.error("Sync AEasy error:", e);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 10000);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Suspensos</h2>
          <p className="text-sm text-gray-500 mt-1">Gestao de pagamentos suspensos</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleSyncAeasy}
              disabled={syncing}
              className="px-3 py-2 text-xs bg-orange-900/30 text-orange-400 border border-orange-700/50 rounded-lg hover:bg-orange-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
              title="Sincronizar dados da AEasy (suspensos)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sync AEasy"}
            </button>
          )}
          <button onClick={handleExport} className="btn-ghost text-sm">
            <Download className="w-4 h-4 mr-1" /> Exportar
          </button>
          <button onClick={() => setShowImport(true)} className="btn-primary text-sm">
            <Upload className="w-4 h-4 mr-1" /> Importar
          </button>
        </div>
      </div>

      {/* Sync Result Notification */}
      {syncResult && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          syncResult.success
            ? "bg-emerald-900/30 text-emerald-400 border border-emerald-700/50"
            : "bg-red-900/30 text-red-400 border border-red-700/50"
        }`}>
          {syncResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {syncResult.message}
        </div>
      )}

      {/* KPI Cards - 6 mini-cards in 2 rows */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Row 1 */}
        <div className="kpi-card border-l-2 border-l-cyan-500">
          <span className="text-xs text-gray-500 uppercase">Total Suspensos</span>
          <span className="text-2xl font-bold text-cyan-400">{(totalReal || records.length).toLocaleString("pt-BR")}</span>
        </div>
        <div
          className="kpi-card border-l-2 border-l-blue-500 cursor-pointer hover:bg-gray-800/50 transition-colors"
          onClick={() => setFilters((f) => ({ ...f, atendente: "" }))}
          title="Clique para ver fila disponivel"
        >
          <span className="text-xs text-gray-500 uppercase">Fila Disponivel</span>
          <span className="text-2xl font-bold text-blue-400">{kpis.filaDisponivel.toLocaleString("pt-BR")}</span>
        </div>
        <div
          className="kpi-card border-l-2 border-l-purple-500 cursor-pointer hover:bg-gray-800/50 transition-colors"
          onClick={() => setFilters((f) => ({ ...f, atendente: user?.nome || "" }))}
          title="Clique para ver meus atendimentos"
        >
          <span className="text-xs text-gray-500 uppercase">Meus Atendimentos</span>
          <span className="text-2xl font-bold text-purple-400">{kpis.meusAtendimentos.toLocaleString("pt-BR")}</span>
        </div>
        {/* Row 2 */}
        <div className="kpi-card border-l-2 border-l-yellow-500">
          <span className="text-xs text-gray-500 uppercase">Valores a Receber</span>
          <span className="text-2xl font-bold text-yellow-400">{formatCurrency(kpis.valorReceber)}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-green-500">
          <span className="text-xs text-gray-500 uppercase">Valor Recebido (OK)</span>
          <span className="text-2xl font-bold text-green-400">{formatCurrency(kpis.valorRecebidoOk)}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-emerald-500">
          <span className="text-xs text-gray-500 uppercase">Convertidos Hoje</span>
          <span className="text-2xl font-bold text-emerald-400">{kpis.convertidosHoje.toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* Vencimento Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["todos", "5", "10", "15", "20", "25", "30"].map((v) => (
          <button
            key={v}
            onClick={() => setActiveVencimento(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
              activeVencimento === v
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-700/50"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {v === "todos" ? "Todos" : `Dia ${v}`}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeVencimento === v ? "bg-emerald-700/50 text-emerald-300" : "bg-gray-700 text-gray-500"
            }`}>
              {vencimentoCounts[v] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={filters.busca}
            onChange={(e) => setFilters((f) => ({ ...f, busca: e.target.value }))}
            placeholder="Buscar por associado ou placa..."
            className="input-field pl-10"
          />
        </div>
        <button
          onClick={handleProximoDaFila}
          disabled={submitting}
          className="px-3 py-2 text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 rounded-lg hover:bg-emerald-900/50 transition-colors disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
          title="Atribuir automaticamente o proximo registro mais atrasado"
        >
          <Zap className="w-3.5 h-3.5" />
          Proximo da Fila
        </button>
        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="px-3 py-2 text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1 whitespace-nowrap"
          title={sortAsc ? "Ordenar: menos atrasado primeiro" : "Ordenar: mais atrasado primeiro"}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortAsc ? "Menor Atraso" : "Maior Atraso"}
        </button>
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary text-sm ${showFilters ? "bg-gray-700" : ""}`}>
          <Filter className="w-4 h-4 mr-1" /> Filtros
        </button>
      </div>


      {/* Advanced Filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 animate-fade-in">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Situacao</label>
            <select value={filters.situacao} onChange={(e) => setFilters((f) => ({ ...f, situacao: e.target.value }))} className="input-field text-sm">
              <option value="">Todas</option>
              <option value="Suspenso">Suspenso</option>
              <option value="Inadimplente">Inadimplente</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Forma Pgto</label>
            <select value={filters.formaPagamento} onChange={(e) => setFilters((f) => ({ ...f, formaPagamento: e.target.value }))} className="input-field text-sm">
              <option value="">Todas</option>
              <option value="PIX">PIX</option>
              <option value="Boleto">Boleto</option>
              <option value="Cartao">Cartao</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Atendente</label>
            <select value={filters.atendente} onChange={(e) => setFilters((f) => ({ ...f, atendente: e.target.value }))} className="input-field text-sm">
              <option value="">Todos</option>
              {atendentes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Conferencia</label>
            <select value={filters.conferencia} onChange={(e) => setFilters((f) => ({ ...f, conferencia: e.target.value }))} className="input-field text-sm">
              <option value="">Todas</option>
              <option value="OK">OK</option>
              <option value="Verificar">Verificar</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valor (Segmento)</label>
            <select value={filters.valorSegmento} onChange={(e) => setFilters((f) => ({ ...f, valorSegmento: e.target.value }))} className="input-field text-sm">
              <option value="">Todos</option>
              <option value="alto">Alto Valor (&gt;R$200)</option>
              <option value="medio">Medio (R$100-200)</option>
              <option value="baixo">Baixo (&lt;R$100)</option>
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-gray-500">
        {filteredRecords.length} registro(s) {activeVencimento !== "todos" ? `(vencimento dia ${activeVencimento})` : "(todos)"}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-8"><div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div></div>
      ) : filteredRecords.length === 0 ? (
        <div className="card p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">Nenhum registro encontrado</h3>
          <p className="text-sm text-gray-500 mt-1">Importe dados ou ajuste os filtros.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            {/* Sticky header */}
            <div className="w-full text-sm">
              <div className="border-b border-gray-800 bg-gray-800/50 flex">
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[16%] min-w-[120px]">Associado</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[8%] min-w-[70px]">Placa</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[6%] min-w-[50px]">Atraso</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[10%] min-w-[80px] hidden md:block">Vencimento</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[10%] min-w-[80px] hidden lg:block">Valor Orig.</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[8%] min-w-[70px] hidden lg:block">Valor Pago</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[9%] min-w-[70px]">Situacao</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[9%] min-w-[70px] hidden md:block">Atendente</div>
                <div className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase w-[12%] min-w-[100px]">Acoes</div>
                <div className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase w-[12%] min-w-[100px]">Conferencia</div>
              </div>
              {/* Virtualized rows */}
              {/* Scrollable virtualized rows (CSS-based, no external deps) */}
              <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
                {filteredRecords.map((record, index) => (
                  <div
                    key={record.id}
                    className={`flex items-center h-12 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${index % 2 === 0 ? "" : "bg-gray-800/10"}`}
                  >
                    <div className="px-3 text-gray-200 font-medium w-[16%] min-w-[120px] truncate">{record.associado}</div>
                    <div className="px-3 text-gray-400 font-mono text-xs w-[8%] min-w-[70px]">{record.placa}</div>
                    <div className="px-3 w-[6%] min-w-[50px]">
                      <span className={`text-xs font-semibold ${
                        (record.diasAtraso || 0) > 30 ? "text-red-400" :
                        (record.diasAtraso || 0) > 15 ? "text-orange-400" :
                        "text-yellow-400"
                      }`}>
                        {record.diasAtraso || 0}d
                      </span>
                    </div>
                    <div className="px-3 text-gray-400 w-[10%] min-w-[80px] hidden md:block">{record.dtVencimento}</div>
                    <div className="px-3 text-gray-400 w-[10%] min-w-[80px] hidden lg:block">{record.valorOriginal}</div>
                    <div className="px-3 text-gray-400 w-[8%] min-w-[70px] hidden lg:block">
                      {record.valorRecebido ? (
                        <span className="text-emerald-400">{record.valorRecebido.startsWith("R$") ? record.valorRecebido : `R$ ${record.valorRecebido}`}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </div>
                    <div className="px-3 w-[9%] min-w-[70px]">
                      {record.situacaoAeasy ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[record.situacaoAeasy] || "bg-gray-800 text-gray-400"}`}>{record.situacaoAeasy}</span>
                      ) : <span className="text-gray-600 text-xs">-</span>}
                    </div>
                    <div className="px-3 text-gray-400 w-[9%] min-w-[70px] hidden md:block truncate">{record.atendente || "-"}</div>
                    <div className="px-3 w-[12%] min-w-[100px]">
                      <div className="flex items-center justify-center gap-1">
                        {!record.atendente ? (
                          <button
                            onClick={() => handleIniciarAtendimento(record)}
                            className="px-2 py-1 text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 rounded-lg hover:bg-emerald-900/50 transition-colors"
                            disabled={submitting}
                          >
                            <Play className="w-3 h-3 inline mr-1" />Iniciar
                          </button>
                        ) : record.atendente === user?.nome ? (
                          <button
                            onClick={() => handleLiberarFila(record)}
                            className="px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 rounded-lg hover:bg-yellow-900/50 transition-colors"
                            disabled={submitting}
                          >
                            <RotateCcw className="w-3 h-3 inline mr-1" />Fila
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">Travado</span>
                        )}
                        {record.telefone && (
                          <button
                            onClick={() => openWhatsApp(record.telefone)}
                            className="p-1 text-xs text-green-400 hover:bg-green-900/30 rounded transition-colors"
                            title={`WhatsApp: ${record.telefone}`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-3 w-[12%] min-w-[100px]">
                      <SwipeConfirm
                        isConfirmed={record.conferencia === "OK"}
                        onConfirm={() => handleConferencia(record, "OK")}
                        onUndo={() => handleUndoConferencia(record)}
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
          loading={submitting}
        />
      )}

      {/* Atendimento Modal */}
      {showAtendimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAtendimento(null)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">Atendimento - {showAtendimento.associado}</h3>
              <button onClick={() => setShowAtendimento(null)} className="p-1 text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Contato WhatsApp */}
              {showAtendimento.telefone && (
                <div className="flex items-center gap-3 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">Telefone do Associado</span>
                    <span className="text-sm text-gray-200 font-medium">{showAtendimento.telefone}</span>
                  </div>
                  <a
                    href={`https://wa.me/55${(showAtendimento.telefone ?? "").replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Forma de Pagamento</label>
                <select value={atendForm.formaPagamento} onChange={(e) => setAtendForm((f) => ({ ...f, formaPagamento: e.target.value }))} className="input-field">
                  <option value="">Selecione...</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Cartao">Cartao</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Valor Recebido</label>
                <input type="text" value={atendForm.valorRecebido} onChange={(e) => setAtendForm((f) => ({ ...f, valorRecebido: e.target.value }))} placeholder="R$ 0,00" className="input-field" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Observacoes</label>
                <textarea value={atendForm.observacoes} onChange={(e) => setAtendForm((f) => ({ ...f, observacoes: e.target.value }))} className="input-field resize-none" rows={3} />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button onClick={handleSalvarAtendimento} disabled={submitting} className="btn-primary">
                  {submitting ? "Salvando..." : "Salvar Atendimento"}
                </button>
                <button
                  onClick={() => {
                    if (showAtendimento) handleLiberarFila(showAtendimento);
                    setShowAtendimento(null);
                    setAtendForm({ formaPagamento: "", valorRecebido: "", observacoes: "", dtRecebimento: new Date().toLocaleDateString("pt-BR") });
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// Swipe to Confirm Component with Undo support
function SwipeConfirm({ isConfirmed, onConfirm, onUndo, disabled }: { isConfirmed: boolean; onConfirm: () => void; onUndo: () => void; disabled: boolean }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showUndoPopup, setShowUndoPopup] = useState(false);
  const trackWidth = 110;
  const thumbWidth = 28;
  const maxDrag = trackWidth - thumbWidth;

  if (isConfirmed || confirmed) {
    return (
      <div className="flex items-center justify-center relative">
        <span
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 cursor-pointer hover:bg-emerald-900/60 transition-colors"
          onClick={() => !disabled && setShowUndoPopup(true)}
          title={disabled ? "" : "Clique para desfazer"}
        >
          <CheckCircle className="w-3 h-3" /> OK
          {!disabled && <X className="w-3 h-3 ml-0.5 opacity-50 hover:opacity-100" />}
        </span>
        {/* Undo Confirmation Popup */}
        {showUndoPopup && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowUndoPopup(false)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 w-56 animate-fade-in">
              <p className="text-sm text-gray-200 mb-3 text-center font-medium">Remover conferencia?</p>
              <p className="text-xs text-gray-500 mb-3 text-center">O status voltara para pendente.</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => { setShowUndoPopup(false); setConfirmed(false); onUndo(); }}
                  className="px-4 py-1.5 text-xs font-medium bg-red-900/40 text-red-400 border border-red-700/50 rounded-md hover:bg-red-900/60 transition-colors"
                >
                  Sim, remover
                </button>
                <button
                  onClick={() => setShowUndoPopup(false)}
                  className="px-4 py-1.5 text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="flex items-center justify-center">
        <span className="text-xs text-gray-600">-</span>
      </div>
    );
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left - thumbWidth / 2;
    setDragX(Math.max(0, Math.min(x, maxDrag)));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (dragX >= maxDrag * 0.9) {
      setConfirmed(true);
      onConfirm();
    } else {
      setDragX(0);
    }
  };

  const progress = dragX / maxDrag;

  return (
    <div className="flex items-center justify-center">
      <div
        className="relative h-7 rounded-full overflow-hidden select-none"
        style={{ width: trackWidth }}
      >
        {/* Track background */}
        <div
          className="absolute inset-0 rounded-full border transition-colors"
          style={{
            backgroundColor: progress > 0.5 ? `rgba(16, 185, 129, ${0.1 + progress * 0.3})` : "rgba(55, 65, 81, 0.5)",
            borderColor: progress > 0.5 ? `rgba(16, 185, 129, ${0.3 + progress * 0.4})` : "rgba(75, 85, 99, 0.5)",
          }}
        />
        {/* Label text */}
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-medium pointer-events-none transition-opacity"
          style={{ opacity: 1 - progress, color: "rgba(156, 163, 175, 0.8)" }}
        >
          Deslize p/ OK
        </span>
        {/* Thumb */}
        <div
          className="absolute top-0.5 h-6 w-7 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow"
          style={{
            left: dragX,
            backgroundColor: progress > 0.7 ? "#10b981" : "#4b5563",
            boxShadow: isDragging ? "0 0 8px rgba(16, 185, 129, 0.5)" : "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <ChevronRight className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    </div>
  );
}


// Import Modal Component
function ImportModal({ onClose, onImport, loading }: { onClose: () => void; onImport: (data: any[]) => void; loading: boolean }) {
  const [importData, setImportData] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          setError("Arquivo deve ter pelo menos um cabecalho e uma linha de dados");
          return;
        }

        // Parse CSV (skip header)
        const separator = lines[0].includes(";") ? ";" : ",";
        const rows = lines.slice(1).map((line) => {
          const cols = line.split(separator).map((c) => c.replace(/"/g, "").trim());
          return {
            associado: cols[0] || "",
            placa: cols[1] || "",
            dtVencimento: cols[2] || "",
            valorOriginal: cols[3] || "",
          };
        }).filter((r) => r.associado && r.placa);

        setImportData(rows);
      } catch (err) {
        setError("Erro ao processar arquivo. Verifique o formato.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">Importar Dados</h3>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-400">
            Formato esperado (CSV): <strong className="text-gray-200">Associado; Placa; Vencimento; Valor Original</strong>
          </p>
          <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center">
            <input type="file" accept=".csv,.txt,.xlsx" onChange={handleFileChange} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{fileName || "Clique para selecionar arquivo CSV"}</p>
            </label>
          </div>
          {error && <p className="text-sm text-red-400 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
          {importData.length > 0 && (
            <p className="text-sm text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />{importData.length} registros prontos para importar
            </p>
          )}
          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <button
              onClick={() => onImport(importData)}
              disabled={loading || importData.length === 0}
              className="btn-primary"
            >
              {loading ? "Importando..." : `Importar ${importData.length} registros`}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
