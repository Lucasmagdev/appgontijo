type PaginationControlsProps = {
  page: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}

export default function PaginationControls({
  page,
  total,
  limit,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(total, page * limit)

  return (
    <div className="pagination-bar">
      <div className="pagination-summary">
        Mostrando {start} a {end} de {total} registros
      </div>

      <div className="inline-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Anterior
        </button>
        <span className="pagination-chip">
          Pagina {page} de {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Proxima
        </button>
      </div>
    </div>
  )
}
