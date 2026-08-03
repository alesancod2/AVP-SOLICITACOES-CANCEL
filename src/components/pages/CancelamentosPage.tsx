"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Cancelamento,
  CancelamentoFilters,
  CANCELAMENTO_STATUS_OPTIONS,
  KPIData,
  FORM_FIELDS,
  STATUS_COLORS,
} from "@/lib/types";
import {
  Plus,
  Search,
  Filter,
  Download,
  Edit3,
  Trash2,
  X,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function CancelamentosPage() {
  const { user, token, isAdmin } = useAuth();

  // Data
  const [records, setRecords] = useState<Cancelamento[]>([]);
  const [allRecords, setAllRecords] = useState<Cancelamento[]>([]);
  const [activeTab, setActiveTab] = useState("");

  // UI States
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Cancelamento | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<Cancelamento | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Filters (client-side)
  const [filters, setFilters] = useState<CancelamentoFilters>({
    mes: "",
    ano: "",
    status: "",
    dataInicio: "",
    dataFim: "",
    busca: "",
  });

  // No longer need to fetch tabs from Google Sheets - use fixed reference
  useEffect(() => {
    setActiveTab("cancelamentos");
  }, []);

  // Fetch records from Supabase
  const fetchRecords = useCallback(async () => {
    if (!activeTab) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cancelamentos?page=1&pageSize=5000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAllRecords(data.data);
      } else {
        setAllRecords([]);
      }
    } catch {
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, token]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Client-side filtering
  const filteredRecords = useMemo(() => {
    let result = [...allRecords];

    if (filters.busca) {
      const q = filters.busca.toLowerCase();
      result = result.filter(
        (r) =>
          r.nomeDoAssociado.toLowerCase().includes(q) ||
          r.placa.toLowerCase().includes(q) ||
          r.consultor.toLowerCase().includes(q) ||
          r.atendente.toLowerCase().includes(q)
      );
    }

    if (filters.status) {
      result = result.filter((r) => r.statusAtual === filters.status);
    }

    if (filters.dataInicio) {
      result = result.filter((r) => {
        if (!r.dataCriacao) return false;
        const [d, m, y] = r.dataCriacao.split("/").map(Number);
        const recordDate = new Date(y, m - 1, d);
        const filterDate = new Date(filters.dataInicio);
        return recordDate >= filterDate;
      });
    }

    if (filters.dataFim) {
      result = result.filter((r) => {
        if (!r.dataCriacao) return false;
        const [d, m, y] = r.dataCriacao.split("/").map(Number);
        const recordDate = new Date(y, m - 1, d);
        const filterDate = new Date(filters.dataFim);
        return recordDate <= filterDate;
      });
    }

    return result;
  }, [allRecords, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, activeTab]);

  // KPIs
  const kpi: KPIData = useMemo(() => ({
    total: allRecords.length,
    ativos: allRecords.filter((r) => r.statusAtual === "Ativo").length,
    emNegociacao: allRecords.filter((r) => r.statusAtual === "Em negociacao").length,
    cancelados: allRecords.filter((r) => r.statusAtual === "Cancelado").length,
    retidos: allRecords.filter((r) => r.statusAtual === "Retido").length,
    pendentes: allRecords.filter((r) => r.statusAtual === "Pendente").length,
    inadimplentes: allRecords.filter((r) => r.statusAtual === "Inadimplente").length,
  }), [allRecords]);

  // Form state
  const [formData, setFormData] = useState<Omit<Cancelamento, "id">>({
    nomeDoAssociado: "",
    placa: "",
    valorDaParcela: "",
    valorPago: "",
    consultor: "",
    motivoDoCancelamento: "",
    statusAtual: "Ativo",
    observacao: "",
    atendente: user?.nome || "",
  });

  // CRUD handlers
  const handleCreate = () => {
    setEditingRecord(null);
    setFormData({
      nomeDoAssociado: "",
      placa: "",
      valorDaParcela: "",
      valorPago: "",
      consultor: "",
      motivoDoCancelamento: "",
      statusAtual: "Ativo",
      observacao: "",
      atendente: user?.nome || "",
    });
    setShowForm(true);
  };

  const handleEdit = (record: Cancelamento) => {
    setEditingRecord(record);
    const { id, ...rest } = record;
    setFormData(rest);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nomeDoAssociado || !formData.placa) return;

    setSubmitting(true);
    try {
      if (editingRecord) {
        const res = await fetch(`/api/cancelamentos/${editingRecord.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: formData }),
        });
        const data = await res.json();
        if (data.success) {
          setShowForm(false);
          fetchRecords();
        }
      } else {
        const res = await fetch("/api/cancelamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: { ...formData, atendente: user?.nome || formData.atendente } }),
        });
        const data = await res.json();
        if (data.success) {
          setShowForm(false);
          fetchRecords();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRecord) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/cancelamentos/${deletingRecord.id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setDeletingRecord(null);
        fetchRecords();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(
        `/api/export?type=cancelamentos&format=csv`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cancelamentos_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Cancelamentos</h2>
          <p className="text-sm text-gray-500 mt-1">Gestao de solicitacoes de cancelamento</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-ghost text-sm">
            <Download className="w-4 h-4 mr-1" /> Exportar
          </button>
          <button onClick={handleCreate} className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Solicitacao
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="kpi-card">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Total</span>
          <span className="text-2xl font-bold text-gray-100">{kpi.total}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-green-500">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Ativos</span>
          <span className="text-2xl font-bold text-green-400">{kpi.ativos}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-blue-500">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Em Negociacao</span>
          <span className="text-2xl font-bold text-blue-400">{kpi.emNegociacao}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-gray-500">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Cancelados</span>
          <span className="text-2xl font-bold text-gray-400">{kpi.cancelados}</span>
        </div>
        <div className="kpi-card border-l-2 border-l-purple-500">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Retidos</span>
          <span className="text-2xl font-bold text-purple-400">{kpi.retidos}</span>
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
            placeholder="Buscar por nome, placa, consultor..."
            className="input-field pl-10"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary text-sm ${showFilters ? "bg-gray-700" : ""}`}
        >
          <Filter className="w-4 h-4 mr-1" /> Filtros
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="input-field text-sm"
            >
              <option value="">Todos</option>
              {CANCELAMENTO_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data inicio</label>
            <input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))}
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input
              type="date"
              value={filters.dataFim}
              onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))}
              className="input-field text-sm"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              onClick={() => setFilters({ mes: "", ano: "", status: "", dataInicio: "", dataFim: "", busca: "" })}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{filteredRecords.length} registro(s) encontrado(s)</span>
        {totalPages > 1 && <span>Pagina {currentPage} de {totalPages}</span>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-8">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        </div>
      ) : paginatedRecords.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">Nenhum registro encontrado</h3>
          <p className="text-sm text-gray-500 mt-1">Adicione uma nova solicitacao ou ajuste os filtros.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Placa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Parcela</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden lg:table-cell">Consultor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden lg:table-cell">Atendente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden xl:table-cell">Data</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {paginatedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-200 font-medium max-w-[180px] truncate">{record.nomeDoAssociado}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{record.placa}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{record.valorDaParcela}</td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{record.consultor}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[record.statusAtual] || "bg-gray-800 text-gray-400"}`}>
                        {record.statusAtual}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{record.atendente}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">{record.dataCriacao}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeletingRecord(record)}
                            className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn-ghost disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
            const page = start + i;
            if (page > totalPages) return null;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  page === currentPage
                    ? "bg-emerald-600 text-white"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                {page}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn-ghost disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">
                {editingRecord ? "Editar Solicitacao" : "Nova Solicitacao"}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FORM_FIELDS.map((field) => (
                  <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                    <label className="block text-sm text-gray-400 mb-1">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    {field.type === "select" ? (
                      <select
                        value={(formData as any)[field.key]}
                        onChange={(e) => setFormData((f) => ({ ...f, [field.key]: e.target.value }))}
                        className="input-field"
                        disabled={submitting}
                      >
                        <option value="">Selecione...</option>
                        {field.options?.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        value={(formData as any)[field.key]}
                        onChange={(e) => setFormData((f) => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="input-field resize-none"
                        rows={3}
                        disabled={submitting}
                      />
                    ) : (
                      <input
                        type="text"
                        value={(formData as any)[field.key]}
                        onChange={(e) => setFormData((f) => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="input-field"
                        disabled={submitting || (field.key === "atendente" && !isAdmin)}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Salvando..." : editingRecord ? "Atualizar" : "Cadastrar"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeletingRecord(null)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Confirmar Exclusao</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Excluir registro de <strong className="text-gray-200">{deletingRecord.nomeDoAssociado}</strong>?
                  Esta acao nao pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeletingRecord(null)} className="btn-secondary" disabled={submitting}>
                Cancelar
              </button>
              <button onClick={handleDelete} className="btn-danger" disabled={submitting}>
                {submitting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
