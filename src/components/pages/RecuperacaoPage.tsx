"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Recuperacao, RecuperacaoFilters, STATUS_COLORS } from "@/lib/types";
import {
  Search,
  Filter,
  RefreshCw,
  Download,
  MessageCircle,
  FileSpreadsheet,
  Phone,
  Play,
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle,
  UserCheck,
} from "lucide-react";

// Status disponiveis no modal de atendimento
// "Ativo" e "Recuperado" removem da fila apos salvar (regra de visibilidade)
// "Interessado" mantem na fila COM atendente vinculado
const STATUS_ATENDIMENTO_OPTIONS = [
  { value: "Contato Realizado", label: "Contato Realizado", color: "text-yellow-400" },
  { value: "Interessado", label: "Tem Interesse", color: "text-cyan-400" },
  { value: "Ativo", label: "Ativo (reativou)", color: "text-green-400" },
  { value: "Recuperado", label: "Recuperado", color: "text-emerald-400" },
  { value: "Recusa", label: "Recusa / Sem interesse", color: "text-red-400" },
  { value: "Nao Localizado", label: "Nao Localizado", color: "text-gray-400" },
] as const;

export default function RecuperacaoPage() {
  const { user, isAdmin } = useAuth();
  const [records, setRecords] = useState<Recuperacao[]>([]);
  const [totalReal, setTotalReal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAtendimento, setShowAtendimento] = useState<Recuperacao | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"aberto" | "recuperados" | "recusa" | "todos">("aberto");

  const [filters, setFilters] = useState<RecuperacaoFilters>({
    busca: "",
    statusRecuperacao: "",
    atendente: "",
    sede: "",
  });

  const [atendForm, setAtendForm] = useState({
    statusRecuperacao: "",
    observacoes: "",
  });

  // =============================================
  // FETCH - Busca dados da tabela 'recuperacao'
  // Populada pelo GitHub Actions (sync-aeasy-cancelados.yml)
  // =============================================
  const fetchRecuperacao = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recuperacao", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setRecords(data.data || []);
        if (data.totalReal) setTotalReal(data.totalReal);
      } else {
        setError(data.error || "Erro ao carregar dados");
      }
    } catch (e: any) {
      setError("Falha na conexao com o servidor.");
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecuperacao(); }, [fetchRecuperacao]);

  // Polling 10s com visibility check
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { interval = setInterval(() => fetchRecuperacao(true), 10000); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const handleVis = () => { document.hidden ? stop() : (fetchRecuperacao(true), start()); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVis);
    return () => { stop(); document.removeEventListener("visibilitychange", handleVis); };
  }, [fetchRecuperacao]);

  // =============================================
  // FILTROS CLIENT-SIDE + ABAS DE VISUALIZACAO
  // =============================================
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // FILTRO POR ABA (separa fila de trabalho do historico)
    if (activeTab === "aberto") {
      // Em Aberto: pendentes + contato + interessados (fila de trabalho diario)
      result = result.filter(r => {
        const s = r.statusRecuperacao;
        return !s || s === "Contato Realizado" || s === "Interessado";
      });
    } else if (activeTab === "recuperados") {
      // Recuperados: clientes convertidos com sucesso (historico de evolucao)
      result = result.filter(r => r.statusRecuperacao === "Ativo" || r.statusRecuperacao === "Recuperado");
    } else if (activeTab === "recusa") {
      // Recusa/Nao Localizado: insucesso
      result = result.filter(r => r.statusRecuperacao === "Recusa" || r.statusRecuperacao === "Nao Localizado");
    }
    // "todos" = sem filtro de aba (mostra tudo)

    // Filtros adicionais
    if (filters.busca) {
      const q = filters.busca.toLowerCase();
      result = result.filter(r =>
        r.associado.toLowerCase().includes(q) ||
        r.placa.toLowerCase().includes(q) ||
        (r.chassi || "").toLowerCase().includes(q) ||
        (r.telefone || "").includes(q)
      );
    }
    if (filters.statusRecuperacao) result = result.filter(r => r.statusRecuperacao === filters.statusRecuperacao);
    if (filters.atendente) result = result.filter(r => r.atendente === filters.atendente);
    if (filters.sede) result = result.filter(r => r.sede === filters.sede);
    result.sort((a, b) => (b.diasCancelado || 0) - (a.diasCancelado || 0));
    return result;
  }, [records, filters, activeTab]);

  useEffect(() => { setVisibleCount(100); }, [filters, activeTab]);
  const visibleRecords = useMemo(() => filteredRecords.slice(0, visibleCount), [filteredRecords, visibleCount]);

  const atendentes = useMemo(() => Array.from(new Set(records.map(r => r.atendente).filter(Boolean))).sort(), [records]);
  const sedes = useMemo(() => Array.from(new Set(records.map(r => r.sede).filter(Boolean))).sort(), [records]);

  // KPIs - Funil de evolucao COMPLETO (nada desaparece)
  const kpis = useMemo(() => {
    const totalRecebidos = totalReal || records.length;
    const emAberto = records.filter(r => !r.statusRecuperacao || r.statusRecuperacao === "Contato Realizado" || r.statusRecuperacao === "Interessado").length;
    const emAndamento = records.filter(r => r.statusRecuperacao === "Interessado" && r.atendente).length;
    const recuperados = records.filter(r => r.statusRecuperacao === "Ativo" || r.statusRecuperacao === "Recuperado").length;
    const naoRecuperados = records.filter(r => r.statusRecuperacao === "Recusa" || r.statusRecuperacao === "Nao Localizado").length;
    const taxaSucesso = totalRecebidos > 0 ? Math.round((recuperados / totalRecebidos) * 100) : 0;
    return { totalRecebidos, emAberto, emAndamento, recuperados, naoRecuperados, taxaSucesso };
  }, [records, totalReal]);

  // =============================================
  // HANDLERS
  // =============================================
  const openWhatsApp = (telefone: string) => {
    if (!telefone) return;
    const clean = telefone.replace(/[^\d]/g, "");
    if (clean.length >= 10) window.open(`https://wa.me/55${clean}`, "_blank");
  };

  const handleIniciarAtendimento = (record: Recuperacao) => {
    setShowAtendimento(record);
    setAtendForm({
      statusRecuperacao: record.statusRecuperacao || "",
      observacoes: record.observacoes || "",
    });
  };

  const handleSalvarAtendimento = async () => {
    if (!showAtendimento) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/recuperacao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: showAtendimento.id,
          atendente: user?.nome || "",
          statusRecuperacao: atendForm.statusRecuperacao,
          observacoes: atendForm.observacoes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAtendimento(null);
        fetchRecuperacao(true);
      }
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  // Devolver registro a fila (limpa atendente e status)
  const handleLiberarFila = async (record: Recuperacao) => {
    try {
      const res = await fetch("/api/recuperacao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          atendente: "",
          statusRecuperacao: "",
          observacoes: "",
        }),
      });
      const data = await res.json();
      if (data.success) fetchRecuperacao(true);
    } catch (e) { console.error(e); }
  };

  // Sync AEasy Cancelados (Admin only)
  const handleSyncAeasy = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync-aeasy-cancelados", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ success: true, message: data.message || "Sincronizacao disparada! Aguarde 2-5 min." });
        setTimeout(() => fetchRecuperacao(), 30000);
      } else {
        setSyncResult({ success: false, message: data.error || "Erro ao disparar sincronizacao" });
      }
    } catch (e: any) {
      setSyncResult({ success: false, message: `Erro: ${e.message}` });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 10000);
    }
  };

  // Export CSV
  const handleExport = async () => {
    try {
      const res = await fetch("/api/export?type=recuperacao&format=csv");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recuperacao_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  // =============================================
  // ERROR STATE
  // =============================================
  if (error && !loading && records.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-100">Recuperacao</h2>
        <div className="card p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">Erro ao carregar dados</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button onClick={() => fetchRecuperacao()} className="btn-primary mt-4">Tentar novamente</button>
        </div>
      </div>
    );
  }

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Recuperacao</h2>
          <p className="text-sm text-gray-500 mt-1">Clientes cancelados - gestao de recuperacao e reativacao</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleSyncAeasy}
              disabled={syncing}
              className="px-3 py-2 text-xs bg-orange-900/30 text-orange-400 border border-orange-700/50 rounded-lg hover:bg-orange-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
              title="Sincronizar cancelados da AEasy"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sync AEasy"}
            </button>
          )}
          <button onClick={handleExport} className="btn-ghost text-sm">
            <Download className="w-4 h-4 mr-1" /> Exportar
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

      {/* KPI Cards - Funil de Evolucao (metricas cumulativas) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="kpi-card border-l-2 border-l-red-500">
          <span className="text-xs text-gray-500 uppercase">Recebidos (API)</span>
          <span className="text-2xl font-bold text-red-400">{kpis.totalRecebidos.toLocaleString("pt-BR")}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-blue-500">
          <span className="text-xs text-gray-500 uppercase">Em Aberto</span>
          <span className="text-2xl font-bold text-blue-400">{kpis.emAberto}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-cyan-500">
          <span className="text-xs text-gray-500 uppercase">Em Andamento</span>
          <span className="text-2xl font-bold text-cyan-400">{kpis.emAndamento}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-green-500">
          <span className="text-xs text-gray-500 uppercase">Recuperados</span>
          <span className="text-2xl font-bold text-green-400">{kpis.recuperados}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-gray-500">
          <span className="text-xs text-gray-500 uppercase">Nao Recuperados</span>
          <span className="text-2xl font-bold text-gray-400">{kpis.naoRecuperados}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-emerald-500">
          <span className="text-xs text-gray-500 uppercase">Taxa Sucesso</span>
          <span className={`text-2xl font-bold ${kpis.taxaSucesso >= 20 ? "text-emerald-400" : kpis.taxaSucesso >= 10 ? "text-yellow-400" : "text-red-400"}`}>{kpis.taxaSucesso}%</span>
        </div>
      </div>

      {/* Abas de Visualizacao - separa fila de trabalho do historico */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { key: "aberto", label: "Em Aberto", count: kpis.emAberto },
          { key: "recuperados", label: "Recuperados", count: kpis.recuperados },
          { key: "recusa", label: "Recusa", count: kpis.naoRecuperados },
          { key: "todos", label: "Todos", count: records.length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-700/50"
                : "bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-200"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? "bg-emerald-700/50 text-emerald-300" : "bg-gray-700 text-gray-500"
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={filters.busca}
            onChange={(e) => setFilters(f => ({ ...f, busca: e.target.value }))}
            placeholder="Buscar por associado, placa, chassi ou telefone..."
            className="input-field pl-10"
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary text-sm ${showFilters ? "bg-gray-700" : ""}`}>
          <Filter className="w-4 h-4 mr-1" /> Filtros
        </button>
      </div>

      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={filters.statusRecuperacao} onChange={(e) => setFilters(f => ({ ...f, statusRecuperacao: e.target.value }))} className="input-field text-sm">
              <option value="">Todos</option>
              {STATUS_ATENDIMENTO_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Atendente</label>
            <select value={filters.atendente} onChange={(e) => setFilters(f => ({ ...f, atendente: e.target.value }))} className="input-field text-sm">
              <option value="">Todos</option>
              {atendentes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sede</label>
            <select value={filters.sede} onChange={(e) => setFilters(f => ({ ...f, sede: e.target.value }))} className="input-field text-sm">
              <option value="">Todas</option>
              {sedes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        {filteredRecords.length} registro(s)
        {visibleCount < filteredRecords.length && <span className="text-gray-600"> — exibindo {visibleCount}</span>}
      </div>

      {/* TABELA: Associado | Placa | Telefone | Plano | Status | Acoes */}
      {loading ? (
        <div className="card p-8"><div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div></div>
      ) : filteredRecords.length === 0 ? (
        <div className="card p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">Nenhum cancelado encontrado</h3>
          <p className="text-sm text-gray-500 mt-1">Aguarde a sincronizacao com AEasy ou ajuste filtros.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-full text-sm">
              <div className="border-b border-gray-800 bg-gray-800/50 flex">
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[22%] min-w-[160px]">Associado</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[10%] min-w-[80px]">Placa</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[15%] min-w-[120px]">Telefone</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[13%] min-w-[100px]">Plano</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[12%] min-w-[90px]">Status</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[10%] min-w-[80px] hidden md:block">Atendente</div>
                <div className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase w-[18%] min-w-[150px]">Acoes</div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
                {visibleRecords.map((record, index) => (
                  <div key={record.id} className={`flex items-center h-12 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${index % 2 === 0 ? "" : "bg-gray-800/10"}`}>
                    <div className="px-3 text-gray-200 font-medium w-[22%] min-w-[160px] truncate">{record.associado}</div>
                    <div className="px-3 text-gray-400 font-mono text-xs w-[10%] min-w-[80px]">{record.placa}</div>
                    <div className="px-3 text-gray-400 text-xs w-[15%] min-w-[120px] truncate">{record.telefone || "-"}</div>
                    <div className="px-3 w-[13%] min-w-[100px]">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/30 text-indigo-400 border border-indigo-700/50">
                        {record.plano || "N/A"}
                      </span>
                    </div>
                    <div className="px-3 w-[12%] min-w-[90px]">
                      {record.statusRecuperacao ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[record.statusRecuperacao] || "bg-gray-800 text-gray-400"}`}>
                          {record.statusRecuperacao}
                        </span>
                      ) : <span className="text-gray-600 text-xs">Pendente</span>}
                    </div>
                    <div className="px-3 text-gray-400 text-xs w-[10%] min-w-[80px] hidden md:block truncate">{record.atendente || "-"}</div>
                    <div className="px-3 w-[18%] min-w-[150px]">
                      <div className="flex items-center justify-center gap-2">
                        {/* Botao Atender ou Devolver a Fila */}
                        {!record.atendente ? (
                          <button
                            onClick={() => handleIniciarAtendimento(record)}
                            className="px-2.5 py-1 text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 rounded-lg hover:bg-emerald-900/50 transition-colors flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Atender
                          </button>
                        ) : record.atendente === user?.nome ? (
                          <button
                            onClick={() => handleLiberarFila(record)}
                            className="px-2.5 py-1 text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 rounded-lg hover:bg-yellow-900/50 transition-colors flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Fila
                          </button>
                        ) : (
                          <button
                            onClick={() => handleIniciarAtendimento(record)}
                            className="px-2.5 py-1 text-xs bg-gray-800 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Atender
                          </button>
                        )}
                        {/* Botao WhatsApp */}
                        {record.telefone && (
                          <button
                            onClick={() => openWhatsApp(record.telefone)}
                            className="px-2.5 py-1 text-xs bg-green-900/30 text-green-400 border border-green-700/50 rounded-lg hover:bg-green-900/50 transition-colors flex items-center gap-1"
                            title={`WhatsApp: ${record.telefone}`}
                          >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {visibleCount < filteredRecords.length && (
                  <div className="flex items-center justify-center py-3 border-t border-gray-800/50">
                    <button onClick={() => setVisibleCount(c => c + 100)} className="px-4 py-2 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors">
                      Mostrar mais ({filteredRecords.length - visibleCount} restantes)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================
          MODAL DE ATENDIMENTO
          Opcoes: Ativo, Recuperado (atualizam KPIs no topo)
          ============================================= */}
      {showAtendimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAtendimento(null)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">Atendimento - {showAtendimento.associado}</h3>
              <button onClick={() => setShowAtendimento(null)} className="p-1 text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Info do cliente */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-800/30 rounded-lg text-sm">
                <div><span className="text-gray-500">Placa:</span> <span className="text-gray-200 ml-1 font-medium">{showAtendimento.placa}</span></div>
                <div><span className="text-gray-500">Plano:</span> <span className="text-indigo-400 ml-1 font-medium">{showAtendimento.plano || "N/A"}</span></div>
                <div><span className="text-gray-500">Valor:</span> <span className="text-gray-200 ml-1">{showAtendimento.valorOriginal}</span></div>
                <div><span className="text-gray-500">Cancelado ha:</span> <span className="text-red-400 ml-1 font-semibold">{showAtendimento.diasCancelado}d</span></div>
              </div>

              {/* Contato WhatsApp */}
              {showAtendimento.telefone && (
                <div className="flex items-center gap-3 p-3 bg-emerald-900/20 border border-emerald-700/30 rounded-lg">
                  <Phone className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">Telefone</span>
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

              {/* Status do Atendimento - ATIVO / RECUPERADO atualizam os KPIs */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Resultado do Atendimento</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_ATENDIMENTO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAtendForm(f => ({ ...f, statusRecuperacao: opt.value }))}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                        atendForm.statusRecuperacao === opt.value
                          ? "bg-emerald-900/40 border-emerald-600 text-emerald-300 ring-1 ring-emerald-500"
                          : "bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                      }`}
                    >
                      <UserCheck className={`w-3.5 h-3.5 inline mr-1 ${atendForm.statusRecuperacao === opt.value ? "text-emerald-400" : ""}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Observacoes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Observacoes</label>
                <textarea
                  value={atendForm.observacoes}
                  onChange={(e) => setAtendForm(f => ({ ...f, observacoes: e.target.value }))}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Detalhes do contato, proposta feita..."
                />
              </div>

              {/* Botoes */}
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={handleSalvarAtendimento}
                  disabled={submitting || !atendForm.statusRecuperacao}
                  className="btn-primary flex-1"
                >
                  {submitting ? "Salvando..." : "Salvar Atendimento"}
                </button>
                <button onClick={() => setShowAtendimento(null)} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
