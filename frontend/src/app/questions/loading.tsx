export default function QuestionsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header skeleton */}
      <div className="h-7 w-48 bg-muted rounded animate-pulse mb-6" />

      {/* Filters skeleton */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 h-9 bg-muted rounded-lg animate-pulse" />
          <div className="w-56 h-9 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-16 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      </div>

      {/* Question cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <div className="flex gap-2">
                <div className="h-5 w-12 bg-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
