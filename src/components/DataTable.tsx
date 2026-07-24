"use client";

import { Associado } from "@/lib/types";
import StatusBadge from "./StatusBadge";

interface DataTableProps {
  records: Associado[];
  onEdit: (record: Associado) => void;
  onDelete: (record: Associado) => void;
  loading?: boolean;
}

export default function DataTable({
  records,
  onEdit,
  onDelete,
  loading,
}: DataTableProps) {
  if (!loading && records.length === 0) {
    return (
      <div className="card p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          Nenhum registro encontrado
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Adicione um novo associado ou altere os filtros de busca.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                Nome do Associado
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                Placa
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                Valor Parcela
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                Valor Pago
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                Consultor
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">
                Atendente
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((record) => (
              <tr
                key={record.id}
                className="hover:bg-gray-50 transition-colors duration-150"
              >
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  {record.nomeDoAssociado}
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono">
                  {record.placa}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {record.valorDaParcela}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {record.valorPago}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {record.consultor}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={record.statusAtual} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {record.atendente}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(record)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(record)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
