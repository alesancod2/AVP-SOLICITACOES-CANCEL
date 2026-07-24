"use client";

import { useState, useEffect } from "react";
import { Associado, FORM_FIELDS } from "@/lib/types";

interface RecordFormProps {
  record?: Associado | null;
  onSubmit: (data: Omit<Associado, "id">) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function RecordForm({
  record,
  onSubmit,
  onCancel,
  loading,
}: RecordFormProps) {
  const isEditing = !!record;

  const [formData, setFormData] = useState<Omit<Associado, "id">>({
    nomeDoAssociado: "",
    placa: "",
    valorDaParcela: "",
    valorPago: "",
    consultor: "",
    motivoDoCancelamento: "-",
    statusAtual: "-",
    observacao: "-",
    atendente: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (record) {
      const { id, ...rest } = record;
      setFormData(rest);
    }
  }, [record]);

  const handleChange = (
    key: keyof Omit<Associado, "id">,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Limpar erro ao editar
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    FORM_FIELDS.forEach((field) => {
      if (field.required && (!formData[field.key] || formData[field.key].trim() === "")) {
        newErrors[field.key] = `${field.label} e obrigatorio`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">
          {isEditing ? "Editar Associado" : "Novo Associado"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {isEditing
            ? "Atualize as informacoes do associado abaixo."
            : "Preencha os dados para cadastrar um novo associado."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORM_FIELDS.map((field) => (
            <div
              key={field.key}
              className={field.type === "textarea" ? "md:col-span-2" : ""}
            >
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>

              {field.type === "select" ? (
                <select
                  value={formData[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="input-field"
                  disabled={loading}
                >
                  <option value="">Selecione...</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  value={formData[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field resize-none"
                  rows={3}
                  disabled={loading}
                />
              ) : (
                <input
                  type={field.type}
                  value={formData[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="input-field"
                  disabled={loading}
                />
              )}

              {errors[field.key] && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors[field.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Salvando...
              </>
            ) : isEditing ? (
              "Atualizar"
            ) : (
              "Cadastrar"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
