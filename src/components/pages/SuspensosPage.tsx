"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Suspenso, SuspensoFilters, STATUS_COLORS } from "@/lib/types";
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
} from "lucide-react";

export default function SuspensosPage() {
  const { user, token, isAdmin } = useAuth();
  const [records, setRecords] = useState<Suspenso[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showAtendimento, setShowAtendimento] = useState<Suspenso | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);


  const [filters, setFilters] = useState<SuspensoFilters>({
    busca: "",
    vencimentoDe: "",
    vencimentoAte: "",
    situacao: "",
    formaPagamento: "",
    atendente: "",
    conferencia: "",
  });

  // Atendimento form
  const [atendForm, setAtendForm] = useState({
    situacao: "",
    formaPagamento: "",
    valorRecebido: "",
    observacoes: "",
    dtRecebimento: new Date().toLocaleDateString("pt-BR"),
  });

  const fetchSuspensos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suspensos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setRecords(data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSuspensos(); }, [fetchSuspensos]);


  // Client-side filtering
  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (filters.busca) {
      const q = filters.busca.toLowerCase();
      result = result.filter(
        (r) => r.associado.toLowerCase().includes(q) || r.placa.toLowerCase().includes(q)
      );
    }
    if (filters.situacao) result = result.filter((r) => r.situacao === filters.situacao);
    if (filters.formaPagamento) result = result.filter((r) => r.formaPagamento === filters.formaPagamento);
    if (filters.atendente) result = result.filter((r) => r.atendente === filters.atendente);
    if (filters.conferencia) result = result.filter((r) => r.conferencia === filters.conferencia);
    return result;
  }, [records, filters]);

  // KPI cards for suspensos
  const kpis = useMemo(() => {
    const totalPlacas = records.length;
    const valorReceber = records.reduce((sum, r) => {
      const val = parseFloat(r.valorOriginal.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      return sum + val;
    }, 0);
    const valorRecebidoOk = records
      .filter((r) => r.conferencia === "OK")
      .reduce((sum, r) => {
        const val = parseFloat(r.valorRecebido.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        return sum + val;
      }, 0);
    return { totalPlacas, valorReceber, valorRecebidoOk };
  }, [records]);

  // Unique atendentes for filter
  const atendentes = useMemo(() => {
    const set = new Set(records.map((r) => r.atendente).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);


  // Handlers
  const handleIniciarAtendimento = async (record: Suspenso) => {
    if (record.atendente && record.atendente !== user?.nome) {
      alert(`Registro travado por: ${record.atendente}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/suspensos/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: record.id, action: "iniciar" }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAtendimento({ ...record, atendente: user?.nome || "" });
        fetchSuspensos();
      }
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleSalvarAtendimento = async () => {
    if (!showAtendimento) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/suspensos/atendimento", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: showAtendimento.id, action: "salvar", dados: atendForm }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAtendimento(null);
        setAtendForm({ situacao: "", formaPagamento: "", valorRecebido: "", observacoes: "", dtRecebimento: new Date().toLocaleDateString("pt-BR") });
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: record.id, action: "liberar" }),
      });
      if ((await res.json()).success) fetchSuspensos();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleConferencia = async (record: Suspenso, value: string) => {
    try {
      await fetch("/api/suspensos", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: record.id, conferencia: value }),
      });
      fetchSuspensos();
    } catch (e) { console.error(e); }
  };


  const handleImport = async (importData: any[]) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/suspensos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      const res = await fetch("/api/export?type=suspensos&format=csv", {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  // Sincronizar com AEasy (Admin only)
  const handleSyncAeasy = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ckdmsbfwgkhagraamsyj.supabase.co";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-aeasy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ success: true, message: `${data.synced} registros sincronizados da AEasy` });
        fetchSuspensos();
      } else {
        setSyncResult({ success: false, message: data.error || "Erro na sincronizacao" });
      }
    } catch (e: any) {
      setSyncResult({ success: false, message: `Erro de conexao: ${e.message || "verifique o console"}` });
      console.error("Sync AEasy error:", e);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 8000);
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="kpi-card border-l-2 border-l-blue-500">
          <span className="text-xs text-gray-500 uppercase">Qtd. Placas</span>
          <span className="text-2xl font-bold text-blue-400">{kpis.totalPlacas}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-yellow-500">
          <span className="text-xs text-gray-500 uppercase">Valores a Receber</span>
          <span className="text-2xl font-bold text-yellow-400">{formatCurrency(kpis.valorReceber)}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-green-500">
          <span className="text-xs text-gray-500 uppercase">Valor Recebido (OK)</span>
          <span className="text-2xl font-bold text-green-400">{formatCurrency(kpis.valorRecebidoOk)}</span>
        </div>
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
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary text-sm ${showFilters ? "bg-gray-700" : ""}`}>
          <Filter className="w-4 h-4 mr-1" /> Filtros
        </button>
      </div>


      {/* Advanced Filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-fade-in">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Situacao</label>
            <select value={filters.situacao} onChange={(e) => setFilters((f) => ({ ...f, situacao: e.target.value }))} className="input-field text-sm">
              <option value="">Todas</option>
              <option value="Pago">Pago</option>
              <option value="Parcial">Parcial</option>
              <option value="Pendente">Pendente</option>
              <option value="Nao localizado">Nao localizado</option>
              <option value="Recusa">Recusa</option>
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
        </div>
      )}

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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Associado</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Placa</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Vencimento</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Valor Orig.</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Situacao</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Atendente</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Conferencia</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-3 py-3 text-gray-200 font-medium max-w-[150px] truncate">{record.associado}</td>
                    <td className="px-3 py-3 text-gray-400 font-mono text-xs">{record.placa}</td>
                    <td className="px-3 py-3 text-gray-400 hidden md:table-cell">{record.dtVencimento}</td>
                    <td className="px-3 py-3 text-gray-400 hidden lg:table-cell">{record.valorOriginal}</td>
                    <td className="px-3 py-3">
                      {record.situacao ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[record.situacao] || "bg-gray-800 text-gray-400"}`}>{record.situacao}</span>
                      ) : <span className="text-gray-600 text-xs">-</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-400 hidden md:table-cell">{record.atendente || "-"}</td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      {isAdmin ? (
                        <select
                          value={record.conferencia}
                          onChange={(e) => handleConferencia(record, e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                        >
                          <option value="">-</option>
                          <option value="OK">OK</option>
                          <option value="Verificar">Verificar</option>
                        </select>
                      ) : (
                        <span className={`text-xs ${record.conferencia ? STATUS_COLORS[record.conferencia] || "" : "text-gray-600"} px-2 py-0.5 rounded-full`}>
                          {record.conferencia || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Situacao</label>
                <select value={atendForm.situacao} onChange={(e) => setAtendForm((f) => ({ ...f, situacao: e.target.value }))} className="input-field">
                  <option value="">Selecione...</option>
                  <option value="Pago">Pago</option>
                  <option value="Parcial">Parcial</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Nao localizado">Nao localizado</option>
                  <option value="Recusa">Recusa</option>
                </select>
              </div>
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
                <button onClick={handleSalvarAtendimento} disabled={submitting || !atendForm.situacao} className="btn-primary">
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
