export default function ResponsesLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-40 bg-stone-200 rounded-lg" />
        <div className="h-4 w-64 bg-stone-100 rounded mt-2" />
      </div>

      {/* 설문 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-8 w-8 bg-stone-100 rounded-lg" />
              <div className="h-5 w-14 bg-stone-100 rounded-full" />
            </div>
            <div className="h-5 w-3/4 bg-stone-200 rounded mb-2" />
            <div className="h-3 w-24 bg-stone-100 rounded mb-4" />
            <div className="h-4 w-full bg-stone-50 rounded mb-4" />
            <div className="h-9 w-full bg-stone-100 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
