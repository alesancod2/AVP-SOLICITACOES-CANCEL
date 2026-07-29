"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, Mail, AlertCircle, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Digite seu email");
      return;
    }

    setLoading(true);
    setError("");

    const result = await login(email.trim());
    if (result.magicLink) {
      setMagicLinkSent(true);
    } else if (!result.success) {
      setError(result.error || "Erro ao fazer login");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">AVP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">AVP System</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestao de Cancelamentos</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          {magicLinkSent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-900/30 rounded-full">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-100">Verifique seu email</h2>
              <p className="text-sm text-gray-400">
                Enviamos um link de acesso para{" "}
                <strong className="text-gray-200">{email}</strong>.
                Clique no link para entrar no sistema.
              </p>
              <p className="text-xs text-gray-600">
                Nao recebeu? Verifique a caixa de spam ou tente novamente.
              </p>
              <button
                onClick={() => {
                  setMagicLinkSent(false);
                  setEmail("");
                }}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Usar outro email
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-6">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-gray-100">Entrar no Sistema</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Email corporativo
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="seu.email@empresa.com"
                      className="input-field pl-10"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enviando...
                    </span>
                  ) : (
                    "Enviar link de acesso"
                  )}
                </button>
              </form>

              <p className="text-xs text-gray-600 text-center mt-6">
                Acesso restrito a usuarios cadastrados pelo administrador.
                Voce recebera um link no email para entrar.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
