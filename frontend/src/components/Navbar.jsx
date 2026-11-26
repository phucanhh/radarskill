import React from 'react'
import { Wifi, Database } from 'lucide-react'

export default function Navbar({ activeTab, onTabChange, apiLive }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-3">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt="SkillRadar"
              className="w-9 h-9 rounded-lg shrink-0"
            />
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Skill<span className="text-hust-crimson">Radar</span>
            </h1>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <nav
              aria-label="Chế độ xem"
              className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200"
            >
              <button
                type="button"
                onClick={() => onTabChange('student')}
                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'student'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                La bàn Sinh viên
              </button>
              <button
                type="button"
                onClick={() => onTabChange('dashboard')}
                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Dashboard CLB &amp; Trường
              </button>
            </nav>

            <div
              title={
                apiLive
                  ? 'Đang kết nối FastAPI Backend'
                  : 'Chạy trực tiếp trên bộ dữ liệu 150 JD trong trình duyệt'
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${apiLive
                  ? 'bg-slate-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
            >
              {apiLive ? (
                <Wifi className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <Database className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
              <span>{apiLive ? 'Live API' : '150 JD'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
