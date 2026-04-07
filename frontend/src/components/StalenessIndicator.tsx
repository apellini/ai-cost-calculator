import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Clock } from 'lucide-react'
import { api } from '@/lib/api'

export default function StalenessIndicator() {
  const { data } = useQuery({
    queryKey: ['staleness'],
    queryFn: api.snapshots.staleness,
    staleTime: 60_000,
    retry: false,
  })

  if (!data || data.last_updated === null) return null

  const label = data.days_since_update === 0
    ? 'Prices updated today'
    : data.days_since_update === 1
      ? 'Prices updated yesterday'
      : `Prices updated ${data.days_since_update} days ago`

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
        data.is_stale
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-[#f0f4ff] border-[#d0dcff] text-[#4f7dff]'
      }`}
    >
      {data.is_stale ? <RefreshCw size={11} /> : <Clock size={11} />}
      {label}
      {data.is_stale && <span className="font-medium"> · refresh recommended</span>}
    </div>
  )
}
