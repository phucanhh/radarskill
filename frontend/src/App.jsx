import React, { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import StudentRadarTab from './components/StudentRadarTab'
import DashboardTab from './components/DashboardTab'
import { fetchHustCatalog, fetchMajors } from './api/client'
import { getStaticHustCatalog, getStaticMajors } from './data/staticEngine'

export default function App() {
  const [activeTab, setActiveTab] = useState('student')
  const [majors, setMajors] = useState(() => getStaticMajors())
  const [hustSchools, setHustSchools] = useState(() => getStaticHustCatalog())
  const [apiLive, setApiLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const [majorsRes, catalogRes] = await Promise.all([
        fetchMajors(),
        fetchHustCatalog(),
      ])
      if (!cancelled) {
        if (Array.isArray(majorsRes.data) && majorsRes.data.length > 0) {
          setMajors(majorsRes.data)
        }
        if (Array.isArray(catalogRes.data) && catalogRes.data.length > 0) {
          setHustSchools(catalogRes.data)
        }
        setApiLive(majorsRes.live || catalogRes.live)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} apiLive={apiLive} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'student' ? (
          <StudentRadarTab
            majors={majors}
            hustSchools={hustSchools}
            onApiStatus={setApiLive}
          />
        ) : (
          <DashboardTab onApiStatus={setApiLive} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-800">SkillRadar</span>
          <span className="tabular-nums">HUST · SoICT · SEEE · SME</span>
        </div>
      </footer>
    </div>
  )
}
