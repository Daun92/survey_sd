export default function HrdLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="h-8 w-40 bg-stone-200 rounded-lg" />
          <div className="h-4 w-56 bg-stone-100 rounded mt-2" />
        </div>
        <div className="h-9 w-28 bg-stone-200 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-16 bg-stone-100 rounded" />
              <div className="h-8 w-8 bg-stone-100 rounded-lg" />
            </div>
            <div className="h-7 w-20 bg-stone-200 rounded" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <div className="h-5 w-32 bg-stone-200 rounded" />
        </div>
        <div className="divide-y divide-stone-100">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-5 w-12 bg-stone-100 rounded" />
                <div className="h-4 w-40 bg-stone-200 rounded" />
              </div>
              <div className="h-4 w-16 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
