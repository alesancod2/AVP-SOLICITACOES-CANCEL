"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Recuperacao, RecuperacaoFilters, STATUS_COLORS } from "@/lib/types";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  MessageCircle,
  FileSpreadsheet,
  Phone,
  UserCheck,
  X,
  AlertCircle,
} from "lucide-react";

const RECUPERACAO_STATUS_OPTIONS = [
  "Contato Realizado",
  "Interessado",
  "Recusa",
  "Nao Localizado",
  "Recuperado",
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

  const [filters, setFilters] = useState<RecuperacaoFilters>({
    busca: "",
    statusRecuperacao: "",
    atendente: "",
    sede: "",
  });

  // Atendimento form
  const [atendForm, setAtendForm] = useState({
    statusRecuperacao: "",
    observacoes: "",
  });


  // Fetch data
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
      setError("Falha na conexao com o servidor. Tente novamente.");
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecuperacao(); }, [fetchRecuperacao]);

  // Polling 10s (menos agressivo que suspensos pois nao eh fila real-time)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { interval = setInterval(() => fetchRecuperacao(true), 10000); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const handleVis = () => { document.hidden ? stop() : (fetchRecuperacao(true), start()); };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVis);
    return () => { stop(); document.removeEventListener("visibilitychange", handleVis); };
  }, [fetchRecuperacao]);

  // Client-side filtering
  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (filters.busca) {
      const q = filters.busca.toLowerCase();
      result = result.filter(r =>
        r.associado.toLowerCase().includes(q) ||
        r.placa.toLowerCase().includes(q) ||
        r.documento.toLowerCase().includes(q)
      );
    }
    if (filters.statusRecuperacao) result = result.filter(r => r.statusRecuperacao === filters.statusRecuperacao);
    if (filters.atendente) result = result.filter(r => r.atendente === filters.atendente);
    if (filters.sede) result = result.filter(r => r.sede === filters.sede);
    // Sort: mais dias cancelado primeiro
    result.sort((a, b) => (b.diasCancelado || 0) - (a.diasCancelado || 0));
    return result;
  }, [records, filters]);

  // Reset visible count on filter change
  useEffect(() => { setVisibleCount(100); }, [filters]);
  const visibleRecords = useMemo(() => filteredRecords.slice(0, visibleCount), [filteredRecords, visibleCount]);


  // Unique values for filters
  const atendentes = useMemo(() => Array.from(new Set(records.map(r => r.atendente).filter(Boolean))).sort(), [records]);
  const sedes = useMemo(() => Array.from(new Set(records.map(r => r.sede).filter(Boolean))).sort(), [records]);

  // KPIs
  const kpis = useMemo(() => {
    const total = totalReal || records.length;
    const semAtendente = records.filter(r => !r.atendente).length;
    const meusAtendimentos = records.filter(r => r.atendente === user?.nome).length;
    const recuperados = records.filter(r => r.statusRecuperacao === "Recuperado").length;
    const contatoRealizado = records.filter(r => r.statusRecuperacao === "Contato Realizado").length;
    const interessados = records.filter(r => r.statusRecuperacao === "Interessado").length;
    return { total, semAtendente, meusAtendimentos, recuperados, contatoRealizado, interessados };
  }, [records, totalReal, user?.nome]);

  // Handlers
  const openWhatsApp = (telefone: string) => {
    if (!telefone) return;
    const clean = telefone.replace(/[^\d]/g, "");
    if (clean.length >= 10) window.open(`https://wa.me/55${clean}`, "_blank");
  };

  const handleIniciarAtendimento = (record: Recuperacao) => {
    setShowAtendimento(record);
    setAtendForm({ statusRecuperacao: record.statusRecuperacao || "", observacoes: record.observacoes || "" });
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


  // Error state
  if (error && !loading && records.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div><h2 className="text-2xl font-bold text-gray-100">Recuperacao</h2></div>
        <div className="card p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">Erro ao carregar dados</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button onClick={() => fetchRecuperacao()} className="btn-primary mt-4">Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Recuperacao</h2>
          <p className="text-sm text-gray-500 mt-1">Carteira de clientes cancelados - gestao de recuperacao</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchRecuperacao()} className="btn-ghost text-sm">
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </button>
          <button onClick={handleExport} className="btn-ghost text-sm">
            <Download className="w-4 h-4 mr-1" /> Exportar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="kpi-card border-l-2 border-l-red-500">
          <span className="text-xs text-gray-500 uppercase">Total Cancelados</span>
          <span className="text-2xl font-bold text-red-400">{kpis.total.toLocaleString("pt-BR")}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-blue-500">
          <span className="text-xs text-gray-500 uppercase">Sem Atendente</span>
          <span className="text-2xl font-bold text-blue-400">{kpis.semAtendente.toLocaleString("pt-BR")}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-purple-500">
          <span className="text-xs text-gray-500 uppercase">Meus</span>
          <span className="text-2xl font-bold text-purple-400">{kpis.meusAtendimentos}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-yellow-500">
          <span className="text-xs text-gray-500 uppercase">Contato Feito</span>
          <span className="text-2xl font-bold text-yellow-400">{kpis.contatoRealizado}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-cyan-500">
          <span className="text-xs text-gray-500 uppercase">Interessados</span>
          <span className="text-2xl font-bold text-cyan-400">{kpis.interessados}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-green-500">
          <span className="text-xs text-gray-500 uppercase">Recuperados</span>
          <span className="text-2xl font-bold text-green-400">{kpis.recuperados}</span>
        </div>
      </div>


      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={filters.busca}
            onChange={(e) => setFilters(f => ({ ...f, busca: e.target.value }))}
            placeholder="Buscar por nome, placa ou documento..."
            className="input-field pl-10"
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary text-sm ${showFilters ? "bg-gray-700" : ""}`}>
          <Filter className="w-4 h-4 mr-1" /> Filtros
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status Recuperacao</label>
            <select value={filters.statusRecuperacao} onChange={(e) => setFilters(f => ({ ...f, statusRecuperacao: e.target.value }))} className="input-field text-sm">
              <option value="">Todos</option>
              {RECUPERACAO_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
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

      {/* Results count */}
      <div className="text-xs text-gray-500">
        {filteredRecords.length} registro(s)
        {visibleCount < filteredRecords.length && <span className="text-gray-600"> — exibindo {visibleCount}</span>}
      </div>


      {/* Table */}
      {loading ? (
        <div className="card p-8"><div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div></div>
      ) : filteredRecords.length === 0 ? (
        <div className="card p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">Nenhum registro encontrado</h3>
          <p className="text-sm text-gray-500 mt-1">Aguarde a sincronizacao ou ajuste os filtros.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-full text-sm">
              {/* Header */}
              <div className="border-b border-gray-800 bg-gray-800/50 flex">
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[18%] min-w-[140px]">Associado</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[8%] min-w-[70px]">Placa</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[6%] min-w-[50px]">Dias</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[10%] min-w-[80px] hidden md:block">Valor</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[12%] min-w-[90px] hidden lg:block">Sede</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[12%] min-w-[90px]">Status</div>
                <div className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-[10%] min-w-[80px] hidden md:block">Atendente</div>
                <div className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase w-[12%] min-w-[100px]">Acoes</div>
              </div>
              {/* Rows */}
              <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
                {visibleRecords.map((record, index) => (
                  <div
                    key={record.id}
                    className={`flex items-center h-12 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${index % 2 === 0 ? "" : "bg-gray-800/10"}`}
                  >
                    <div className="px-3 text-gray-200 font-medium w-[18%] min-w-[140px] truncate">{record.associado}</div>
                    <div className="px-3 text-gray-400 font-mono text-xs w-[8%] min-w-[70px]">{record.placa}</div>
                    <div className="px-3 w-[6%] min-w-[50px]">
                      <span className={`text-xs font-semibold ${
                        (record.diasCancelado || 0) > 90 ? "text-red-400" :
                        (record.diasCancelado || 0) > 30 ? "text-orange-400" :
                        "text-yellow-400"
                      }`}>{record.diasCancelado || 0}d</span>
                    </div>
                    <div className="px-3 text-gray-400 w-[10%] min-w-[80px] hidden md:block">{record.valorOriginal}</div>
                    <div className="px-3 text-gray-400 text-xs w-[12%] min-w-[90px] hidden lg:block truncate">{record.sede}</div>
                    <div className="px-3 w-[12%] min-w-[90px]">
                      {record.statusRecuperacao ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[record.statusRecuperacao] || "bg-gray-800 text-gray-400"}`}>
                          {record.statusRecuperacao}
                        </span>
                      ) : <span className="text-gray-600 text-xs">Pendente</span>}
                    </div>
                    <div className="px-3 text-gray-400 text-xs w-[10%] min-w-[80px] hidden md:block truncate">{record.atendente || "-"}</div>
                    <div className="px-3 w-[12%] min-w-[100px]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleIniciarAtendimento(record)}
                          className="px-2 py-1 text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/50 rounded-lg hover:bg-emerald-900/50 transition-colors"
                        >
                          <UserCheck className="w-3 h-3 inline mr-1" />Atender
                        </button>
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
                  </div>
                ))}
                {/* Show more */}
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


      {/* Atendimento Modal */}
      {showAtendimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAtendimento(null)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">Recuperacao - {showAtendimento.associado}</h3>
              <button onClick={() => setShowAtendimento(null)} className="p-1 text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Info do cliente */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Placa:</span> <span className="text-gray-200 ml-1">{showAtendimento.placa}</span></div>
                <div><span className="text-gray-500">Valor:</span> <span className="text-gray-200 ml-1">{showAtendimento.valorOriginal}</span></div>
                <div><span className="text-gray-500">Plano:</span> <span className="text-gray-200 ml-1">{showAtendimento.plano}</span></div>
                <div><span className="text-gray-500">Dias cancelado:</span> <span className="text-red-400 ml-1 font-semibold">{showAtendimento.diasCancelado}d</span></div>
              </div>
              {/* WhatsApp */}
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
              {/* Status */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status da Recuperacao</label>
                <select value={atendForm.statusRecuperacao} onChange={(e) => setAtendForm(f => ({ ...f, statusRecuperacao: e.target.value }))} className="input-field">
                  <option value="">Pendente</option>
                  {RECUPERACAO_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Observacoes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Observacoes</label>
                <textarea value={atendForm.observacoes} onChange={(e) => setAtendForm(f => ({ ...f, observacoes: e.target.value }))} className="input-field resize-none" rows={3} placeholder="Detalhes do contato..." />
              </div>
              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button onClick={handleSalvarAtendimento} disabled={submitting} className="btn-primary">
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
