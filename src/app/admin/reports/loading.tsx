export default function ReportsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-32 bg-stone-200 rounded-lg" />
        <div className="h-4 w-56 bg-stone-100 rounded mt-2" />
      </div>

      {/* 탭 스켈레톤 */}
      <div className="flex gap-2 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-stone-100 rounded-lg" />
        ))}
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-20 bg-stone-100 rounded mb-3" />
            <div className="h-10 w-24 bg-stone-200 rounded" />
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-36 bg-stone-200 rounded mb-4" />
        <div className="h-64 bg-stone-50 rounded" />
      </div>
    </div>
  );
}
