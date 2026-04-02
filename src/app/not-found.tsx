"use client";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center max-w-md px-6">
        <p className="text-7xl font-bold text-stone-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-stone-900 mb-2">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <button
          onClick={() => typeof window !== 'undefined' && window.history.length > 1 ? window.history.back() : window.location.assign('/')}
          className="inline-block px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors cursor-pointer"
        >
          처음으로 돌아가기
        </button>
      </div>
    </div>
  );
}
