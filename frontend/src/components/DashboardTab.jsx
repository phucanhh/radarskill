import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ShieldCheck } from 'lucide-react'
import { fetchDashboard } from '../api/client'

function gapHeatClass(gap) {
  if (gap >= 45) return 'bg-red-700 text-white'
  if (gap >= 30) return 'bg-red-100 text-red-900 border border-red-200'
  if (gap >= 18) return 'bg-amber-100 text-amber-900 border border-amber-200'
  return 'bg-emerald-100 text-emerald-900 border border-emerald-200'
}

export default function DashboardTab({ onApiStatus }) {
  const [dashboard, setDashboard] = useState(null)
  const [selectedMajor, setSelectedMajor] = useState('IT')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, live } = await fetchDashboard()
      if (cancelled) return
      onApiStatus?.(live)
      setDashboard(data)
      if (data?.majors_summary?.length) {
        setSelectedMajor(data.majors_summary[0].major_code)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const activeMajorData = useMemo(() => {
    if (!dashboard?.majors_summary?.length) return null
    return (
      dashboard.majors_summary.find((m) => m.major_code === selectedMajor) ||
      dashboard.majors_summary[0]
    )
  }, [dashboard, selectedMajor])

  if (!dashboard) {
    return (
      <div className="glass-card p-12 text-center text-slate-500 text-sm">
        Đang tải dữ liệu tổng hợp...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Anonymization Summary Bar */}
      <div className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Thống kê tổng hợp ẩn danh cho CLB và Nhà trường
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                Ngưỡng ẩn danh n ≥ 20
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl">
              {dashboard.privacy_notice}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 shrink-0 tabular-nums">
          <div className="text-right">
            <p className="text-xs text-slate-500">Hồ sơ mẫu</p>
            <p className="text-xl font-bold text-slate-900">
              {dashboard.total_students_analyzed}
            </p>
          </div>
          <div className="w-px h-9 bg-slate-200" />
          <div className="text-right">
            <p className="text-xs text-slate-500">Tin tuyển dụng</p>
            <p className="text-xl font-bold text-hust-crimson">
              {dashboard.total_jds_indexed}
            </p>
          </div>
        </div>
      </div>

      {/* Major Filter */}
      <div className="flex flex-wrap gap-2 tabular-nums">
        {dashboard.majors_summary.map((m) => (
          <button
            key={m.major_code}
            type="button"
            onClick={() => setSelectedMajor(m.major_code)}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
              selectedMajor === m.major_code
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {m.major_name} (n={m.sample_size})
          </button>
        ))}
      </div>

      {activeMajorData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bar Chart: Avg Student vs Market Demand */}
          <div className="lg:col-span-7 glass-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Khoảng cách kỹ năng trung bình — {activeMajorData.major_name}
              </h3>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Thiếu nhiều nhất: {activeMajorData.top_gap_axis}
              </span>
            </div>

            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={activeMajorData.axes_breakdown}
                  margin={{ top: 10, right: 16, left: -12, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="axis_name"
                    tick={{ fontSize: 11, fill: '#334155' }}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="avg_student"
                    name="TB Sinh viên (Uₐ)"
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="market_demand"
                    name="Nhu cầu JD (Mₐ)"
                    fill="#C8102E"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Missing Skills Overall */}
          <div className="lg:col-span-5 glass-card p-5">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              Kỹ năng thiếu hụt phổ biến
            </h3>

            <div className="space-y-3.5 tabular-nums">
              {(dashboard.top_missing_skills_overall || []).map((item, idx) => (
                <div key={item.skill_name || idx}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800">{item.skill_name}</span>
                    <span className="text-slate-500">
                      {item.major_name} ·{' '}
                      <strong className="text-hust-crimson">{item.missing_rate_pct}% thiếu</strong>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-hust-crimson"
                      style={{ width: `${Math.min(100, item.missing_rate_pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cohort Skill-Gap Heatmap */}
      {activeMajorData?.cohort_breakdown?.length > 0 && (
        <section className="glass-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-base font-bold text-slate-900">
              Bảng mức độ thiếu hụt theo khóa (Mₐ − Uₐ) — {activeMajorData.major_name}
            </h3>
            <div className="flex items-center gap-2 text-[11px] font-medium tabular-nums">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">&lt;18</span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">18–29</span>
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-900">30–44</span>
              <span className="px-2 py-0.5 rounded bg-red-700 text-white">≥45</span>
            </div>
          </div>

          <div className="overflow-x-auto tabular-nums">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="text-left py-2.5 px-3 font-semibold">Khóa / Nhóm</th>
                  <th className="text-center py-2.5 px-2 font-semibold">Cỡ mẫu</th>
                  {activeMajorData.axes_breakdown.map((ax) => (
                    <th key={ax.axis_name} className="text-center py-2.5 px-2 font-semibold">
                      {ax.axis_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeMajorData.cohort_breakdown.map((row) => (
                  <tr key={row.cohort} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {row.cohort}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500">
                      n={row.n}
                    </td>
                    {row.gaps.map((g, i) => (
                      <td key={i} className="py-2 px-1.5 text-center">
                        <span
                          className={`inline-block w-14 py-1 rounded font-semibold ${gapHeatClass(
                            g
                          )}`}
                        >
                          -{g}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Suggested Club Workshops */}
      <section className="glass-card p-5">
        <h3 className="text-base font-bold text-slate-900 mb-4">
          Đề xuất chuyên đề đào tạo cho các CLB học thuật
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(dashboard.suggested_club_workshops || []).map((ws, idx) => (
            <div
              key={ws.title || idx}
              className="p-4 rounded-lg border border-slate-200 bg-slate-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200">
                  {ws.host_club}
                </span>
                <span className="text-[11px] text-slate-500">
                  {ws.target_cohort} · {ws.format}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900">{ws.title}</h4>
              <p className="text-xs text-slate-600 mt-1.5">
                Lỗ hổng mục tiêu: {ws.addressing_gap}
              </p>
              <p className="text-xs text-slate-800 font-medium mt-1">
                Mục tiêu: {ws.expected_impact}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
