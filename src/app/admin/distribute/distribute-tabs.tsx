'use client'

import { useState } from 'react'
import { QrCode, Link2 } from 'lucide-react'
import DistributeClient from './distribute-client'
import PersonalLinkClient from './personal-link-client'

interface ClassGroup {
  id: string
  name: string
  token: string
}

interface SurveyItem {
  id: string
  title: string
  token: string
  status: string
  classGroups: ClassGroup[]
}

type Tab = 'qr' | 'personal'

export default function DistributeTabs({ surveys }: { surveys: SurveyItem[] }) {
  const [tab, setTab] = useState<Tab>('qr')

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-800">배부 관리</h1>
        <p className="text-sm text-stone-500 mt-1">설문 배포 링크를 생성하고 관리하세요</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-stone-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('qr')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'qr'
              ? 'bg-white text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <QrCode size={15} />
          QR 배포
        </button>
        <button
          onClick={() => setTab('personal')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'personal'
              ? 'bg-white text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <Link2 size={15} />
          개인 링크
        </button>
      </div>

      {/* 탭 내용 */}
      {tab === 'qr' ? (
        <DistributeClient surveys={surveys} />
      ) : (
        <PersonalLinkClient surveys={surveys} />
      )}
    </div>
  )
}
