"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { User, UserPermissions } from "@/lib/types";
import { Plus, Edit3, X, Shield, UserCheck, UserX, Trash2 } from "lucide-react";

export default function UsuariosPage() {
  const { token, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);


  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    perfil: "User" as "Admin" | "User",
    permissoes: { cancelamentos: true, suspensos: true, dashboard: true } as UserPermissions,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUsers(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({ nome: "", email: "", senha: "", perfil: "User", permissoes: { cancelamentos: true, suspensos: true, dashboard: true } });
    setShowForm(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ nome: user.nome, email: user.email, senha: "", perfil: user.perfil, permissoes: { ...user.permissoes } });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editingUser.id, perfil: formData.perfil, permissoes: formData.permissoes }),
        });
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nome: formData.nome, email: formData.email, senha: formData.senha, perfil: formData.perfil, permissoes: formData.permissoes }),
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || "Erro ao criar usuario");
          setSubmitting(false);
          return;
        }
      }
      setShowForm(false);
      fetchUsers();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === "Ativo" ? "Inativo" : "Ativo";
    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: user.id, status: newStatus }),
      });
      fetchUsers();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (user: User) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja EXCLUIR permanentemente o usuario "${user.nome}" (${user.email})?\n\nEsta acao nao pode ser desfeita. O usuario sera removido do sistema e do Supabase Auth.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/users?id=${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || "Erro ao excluir usuario");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir usuario");
    }
  };

  if (!isAdmin) {
    return (
      <div className="card p-12 text-center">
        <Shield className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300">Acesso Restrito</h3>
        <p className="text-sm text-gray-500 mt-1">Apenas administradores podem gerenciar usuarios.</p>
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Usuarios</h2>
          <p className="text-sm text-gray-500 mt-1">Gerenciar acessos ao sistema</p>
        </div>
        <button onClick={handleCreate} className="btn-primary text-sm">
          <Plus className="w-4 h-4 mr-1" /> Novo Usuario
        </button>
      </div>

      {loading ? (
        <div className="card p-8"><div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}</div></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Perfil</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Permissoes</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-200 font-medium">{u.nome}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.perfil === "Admin" ? "bg-purple-900/30 text-purple-400 border border-purple-700/50" : "bg-gray-700 text-gray-300"
                      }`}>{u.perfil}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.status === "Ativo" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <div className="flex items-center justify-center gap-1 text-xs">
                        {u.permissoes.cancelamentos && <span className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">C</span>}
                        {u.permissoes.suspensos && <span className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">S</span>}
                        {u.permissoes.dashboard && <span className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">D</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEdit(u)} className="p-1.5 text-blue-400 hover:bg-blue-900/30 rounded-lg" title="Editar">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleStatus(u)} className={`p-1.5 rounded-lg ${u.status === "Ativo" ? "text-red-400 hover:bg-red-900/30" : "text-green-400 hover:bg-green-900/30"}`} title={u.status === "Ativo" ? "Desativar" : "Ativar"}>
                          {u.status === "Ativo" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleDelete(u)} className="p-1.5 text-red-500 hover:bg-red-900/30 rounded-lg" title="Excluir permanentemente">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-100">{editingUser ? "Editar Usuario" : "Novo Usuario"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nome</label>
                    <input type="text" value={formData.nome} onChange={(e) => setFormData((f) => ({ ...f, nome: e.target.value }))} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Senha de acesso</label>
                    <input type="password" value={formData.senha} onChange={(e) => setFormData((f) => ({ ...f, senha: e.target.value }))} className="input-field" placeholder="Minimo 6 caracteres" required minLength={6} />
                    <p className="text-xs text-gray-600 mt-1">O usuario usara este email e senha para entrar no sistema.</p>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Perfil</label>
                <select value={formData.perfil} onChange={(e) => setFormData((f) => ({ ...f, perfil: e.target.value as any }))} className="input-field">
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Permissoes</label>
                <div className="space-y-2">
                  {(["cancelamentos", "suspensos", "dashboard"] as const).map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={formData.permissoes[perm]}
                        onChange={(e) => setFormData((f) => ({ ...f, permissoes: { ...f.permissoes, [perm]: e.target.checked } }))}
                        className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
                      />
                      {perm.charAt(0).toUpperCase() + perm.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Salvando..." : editingUser ? "Atualizar" : "Cadastrar"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
