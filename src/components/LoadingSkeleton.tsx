"use client";

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <th key={i} className="px-4 py-3">
                  <div className="skeleton h-4 w-20 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-100">
                {[1, 2, 3, 4, 5, 6, 7].map((colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    <div
                      className="skeleton h-4 rounded"
                      style={{ width: `${Math.random() * 40 + 60}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <div className="skeleton h-10 w-24 rounded-lg" />
        <div className="skeleton h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}
