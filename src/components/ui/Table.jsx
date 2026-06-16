export function Table({ columns, data, loading, emptyMessage = 'No data found', className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-secondary-200 bg-secondary-50">
            {columns.map((col, i) => (
              <th key={i} className={`px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wider whitespace-nowrap ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-secondary-100">
                {columns.map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-secondary-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))
          ) : !data?.length ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-secondary-400 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i} className="table-row">
                {columns.map((col, j) => (
                  <td key={j} className={`px-4 py-3 text-secondary-700 ${col.cellClassName || ''}`}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '–')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StatCard({ label, value, subValue, icon, color = 'blue', trend }) {
  const colors = {
    blue: 'bg-primary-50 text-primary-600',
    green: 'bg-accent-50 text-accent-600',
    yellow: 'bg-warning-50 text-warning-600',
    red: 'bg-error-50 text-error-600',
    purple: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-secondary-900 mt-1">{value}</p>
          {subValue && <p className="text-xs text-secondary-400 mt-0.5">{subValue}</p>}
          {trend && <p className={`text-xs font-medium mt-1 ${trend.positive ? 'text-success-600' : 'text-error-600'}`}>{trend.label}</p>}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl ${colors[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
