export function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      {/* Poster */}
      <div className="skeleton w-full aspect-[2/3]" />
      {/* Content */}
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="flex gap-1 mt-2">
          <div className="skeleton h-5 w-14 rounded-full" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
      </div>
    </div>
  )
}
