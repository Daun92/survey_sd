export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-48 bg-stone-200 rounded-lg" />
        <div className="h-4 w-64 bg-stone-100 rounded mt-2" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-16 bg-stone-100 rounded" />
              <div className="h-8 w-8 bg-stone-100 rounded-lg" />
            </div>
            <div className="h-8 w-20 bg-stone-200 rounded" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-5">
        <div className="h-5 w-32 bg-stone-200 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-stone-50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
