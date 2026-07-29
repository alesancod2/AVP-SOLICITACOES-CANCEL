"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogEntry } from "@/lib/types";
import { ScrollText, Shield, RefreshCw, Search } from "lucide-react";

export default function LogsPage() {
  const { token, isAdmin } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/logs?limit=500", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setLogs(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (!isAdmin) {
    return (
      <div className="card p-12 text-center">
        <Shield className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300">Acesso Restrito</h3>
        <p className="text-sm text-gray-500 mt-1">Apenas administradores podem ver logs.</p>
      </div>
    );
  }

  const filteredLogs = search
    ? logs.filter((l) =>
        l.usuario.toLowerCase().includes(search.toLowerCase()) ||
        l.acao.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase())
      )
    : logs;


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Auditoria</h2>
          <p className="text-sm text-gray-500 mt-1">Historico de acoes no sistema</p>
        </div>
        <button onClick={fetchLogs} className="btn-ghost text-sm">
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por usuario ou acao..."
          className="input-field pl-10"
        />
      </div>

      {loading ? (
        <div className="card p-8"><div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acao</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Campo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Antes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/20">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{log.data}</td>
                    <td className="px-4 py-3 text-gray-200 font-medium">{log.usuario}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{log.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300">{log.acao}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{log.campo || "-"}</td>
                    <td className="px-4 py-3 text-red-400/70 text-xs hidden lg:table-cell max-w-[100px] truncate">{log.antes || "-"}</td>
                    <td className="px-4 py-3 text-green-400/70 text-xs hidden lg:table-cell max-w-[100px] truncate">{log.depois || "-"}</td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Nenhum log encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
            {filteredLogs.length} registro(s)
          </div>
        </div>
      )}
    </div>
  );
}
