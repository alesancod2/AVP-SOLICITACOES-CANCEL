"use client";

import { useState, useEffect, useCallback } from "react";
import { Associado, SheetTab, ApiResponse } from "@/lib/types";
import TabSelector from "@/components/TabSelector";
import SearchBar from "@/components/SearchBar";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import RecordForm from "@/components/RecordForm";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import Toast, { ToastMessage } from "@/components/Toast";
import { TableSkeleton } from "@/components/LoadingSkeleton";

type ViewMode = "table" | "form";

export default function HomePage() {
  // Estado principal
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [records, setRecords] = useState<Associado[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [editingRecord, setEditingRecord] = useState<Associado | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<Associado | null>(null);

  // Paginacao
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Loading states
  const [loadingTabs, setLoadingTabs] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Busca
  const [searchQuery, setSearchQuery] = useState("");

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // =============================================
  // FUNCOES AUXILIARES
  // =============================================

  const addToast = useCallback(
    (type: ToastMessage["type"], message: string) => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, type, message }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // =============================================
  // FETCH DE DADOS
  // =============================================

  // Carregar abas
  useEffect(() => {
    async function fetchTabs() {
      try {
        setLoadingTabs(true);
        const response = await fetch("/api/sheets");
        const data: ApiResponse<SheetTab[]> = await response.json();

        if (data.success && data.data) {
          setTabs(data.data);
          if (data.data.length > 0) {
            setActiveTab(data.data[0].name);
          }
        } else {
          addToast("error", data.error || "Erro ao carregar abas");
        }
      } catch (error) {
        addToast("error", "Erro de conexao ao carregar abas");
      } finally {
        setLoadingTabs(false);
      }
    }
    fetchTabs();
  }, [addToast]);

  // Carregar registros quando muda aba ou pagina
  const fetchRecords = useCallback(async () => {
    if (!activeTab) return;

    try {
      setLoadingRecords(true);
      const params = new URLSearchParams({
        tab: activeTab,
        page: currentPage.toString(),
        pageSize: "20",
      });

      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await fetch(`/api/sheets?${params}`);
      const data: ApiResponse<Associado[]> = await response.json();

      if (data.success && data.data) {
        setRecords(data.data);
        setTotalPages(data.meta?.pages || 1);
        setTotalRecords(data.meta?.total || 0);
      } else {
        addToast("error", data.error || "Erro ao carregar registros");
        setRecords([]);
      }
    } catch (error) {
      addToast("error", "Erro de conexao ao carregar registros");
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [activeTab, currentPage, searchQuery, addToast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // =============================================
  // HANDLERS DE ACOES
  // =============================================

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    setCurrentPage(1);
    setSearchQuery("");
    setViewMode("table");
  };

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleNewRecord = () => {
    setEditingRecord(null);
    setViewMode("form");
  };

  const handleEditRecord = (record: Associado) => {
    setEditingRecord(record);
    setViewMode("form");
  };

  const handleDeleteRecord = (record: Associado) => {
    setDeletingRecord(record);
  };

  const handleFormSubmit = async (data: Omit<Associado, "id">) => {
    try {
      setSubmitting(true);

      if (editingRecord) {
        // UPDATE
        const response = await fetch(`/api/sheets/${editingRecord.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tab: activeTab, data }),
        });
        const result: ApiResponse<Associado> = await response.json();

        if (result.success) {
          addToast("success", "Registro atualizado com sucesso!");
          setViewMode("table");
          setEditingRecord(null);
          fetchRecords();
        } else {
          addToast("error", result.error || "Erro ao atualizar registro");
        }
      } else {
        // CREATE
        const response = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tab: activeTab, data }),
        });
        const result: ApiResponse<Associado> = await response.json();

        if (result.success) {
          addToast("success", "Associado cadastrado com sucesso!");
          setViewMode("table");
          fetchRecords();
        } else {
          addToast("error", result.error || "Erro ao cadastrar associado");
        }
      }
    } catch (error) {
      addToast("error", "Erro de conexao ao salvar registro");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/sheets/${deletingRecord.id}?tab=${encodeURIComponent(activeTab)}`,
        { method: "DELETE" }
      );
      const result: ApiResponse<any> = await response.json();

      if (result.success) {
        addToast("success", "Registro excluido com sucesso!");
        setDeletingRecord(null);
        fetchRecords();
      } else {
        addToast("error", result.error || "Erro ao excluir registro");
      }
    } catch (error) {
      addToast("error", "Erro de conexao ao excluir registro");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormCancel = () => {
    setViewMode("table");
    setEditingRecord(null);
  };

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="space-y-6">
      {/* Titulo e Botao de Acao */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Dashboard de Associados
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie os dados dos associados organizados por mes.
          </p>
        </div>
        {viewMode === "table" && (
          <button onClick={handleNewRecord} className="btn-primary">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Novo Associado
          </button>
        )}
      </div>

      {/* Seletor de Abas (Meses) */}
      <TabSelector
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        loading={loadingTabs}
      />

      {/* Conteudo Principal */}
      {viewMode === "table" ? (
        <div className="space-y-4">
          {/* Barra de Busca + Estatísticas */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 w-full sm:max-w-md">
              <SearchBar onSearch={handleSearch} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-primary-500 rounded-full" />
                {activeTab && `Aba: ${activeTab}`}
              </span>
              {!loadingRecords && (
                <span>{totalRecords} registros</span>
              )}
            </div>
          </div>

          {/* Tabela */}
          {loadingRecords ? (
            <TableSkeleton rows={8} />
          ) : (
            <DataTable
              records={records}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
            />
          )}

          {/* Paginacao */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalRecords}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        /* Formulário */
        <RecordForm
          record={editingRecord}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          loading={submitting}
        />
      )}

      {/* Modal de Confirmacao de Exclusao */}
      {deletingRecord && (
        <DeleteConfirmModal
          record={deletingRecord}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingRecord(null)}
          loading={submitting}
        />
      )}

      {/* Toasts */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
