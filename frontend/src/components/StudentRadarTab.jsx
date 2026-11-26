import React, { useEffect, useMemo, useState } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import {
  BookOpen,
  Users,
  Award,
  FolderGit2,
  Search,
  Layers,
  ArrowRight,
  Cpu,
  Zap,
  Wrench,
  RotateCcw,
  ExternalLink,
  Check,
} from 'lucide-react'
import { analyzeStudentProfile, fetchMajorCourses } from '../api/client'
import { QUICK_PROJECT_CHIPS } from '../data/staticEngine'

const MAJOR_ICONS = {
  IT: Cpu,
  SEEE: Zap,
  SME: Wrench,
}

const ROADMAP_TABS = [
  { id: 'courses', label: 'Môn kỳ tới', icon: BookOpen },
  { id: 'clubs', label: 'CLB phù hợp', icon: Users },
  { id: 'certs', label: 'Khóa học & Chứng chỉ', icon: Award },
  { id: 'projects', label: 'Ý tưởng Đồ án', icon: FolderGit2 },
]

function RadarTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg border border-slate-700 text-xs max-w-xs tabular-nums">
      <p className="font-semibold text-sm mb-1.5 text-white">{row.axis_name}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-sky-300">Năng lực hiện tại (Uₐ):</span>
          <span className="font-semibold">{row.student_score}/100</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-rose-300">Nhu cầu thị trường (Mₐ):</span>
          <span className="font-semibold">{row.market_demand}/100</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-700">
          <span className="text-slate-300">Khoảng cách (Gapₐ):</span>
          <span className="font-semibold">{row.gap} điểm</span>
        </div>
      </div>
      {row.top_jd_skills?.length > 0 && (
        <p className="mt-2 text-[11px] text-slate-300">
          Yêu cầu phổ biến: <span className="text-white">{row.top_jd_skills.slice(0, 3).join(', ')}</span>
        </p>
      )}
    </div>
  )
}

function stripAccents(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export default function StudentRadarTab({ majors, hustSchools = [], onApiStatus }) {
  const [selectedSchoolId, setSelectedSchoolId] = useState(hustSchools[0]?.school_id || 'SOICT')
  const [selectedProgramCode, setSelectedProgramCode] = useState(
    hustSchools[0]?.programs?.[0]?.program_code || 'IT1'
  )
  const [programQuery, setProgramQuery] = useState('')
  const [selectedMajorCode, setSelectedMajorCode] = useState(majors[0]?.major_code || 'IT')
  const [courses, setCourses] = useState([])
  const [selectedCourses, setSelectedCourses] = useState([])
  const [activePreset, setActivePreset] = useState(null)
  const [courseSearch, setCourseSearch] = useState('')
  const [projectsText, setProjectsText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [roadmapTab, setRoadmapTab] = useState('courses')

  const allPrograms = useMemo(() => {
    const items = []
    for (const sch of hustSchools) {
      for (const prog of sch.programs || []) {
        items.push({
          ...prog,
          school_id: sch.school_id,
          school_code: sch.school_code,
          school_name: sch.school_name,
        })
      }
    }
    return items
  }, [hustSchools])

  const selectedSchool = useMemo(
    () => hustSchools.find((s) => s.school_id === selectedSchoolId) || hustSchools[0],
    [hustSchools, selectedSchoolId]
  )

  const selectedProgram = useMemo(
    () =>
      allPrograms.find((p) => p.program_code === selectedProgramCode) ||
      allPrograms[0] || {
        program_code: 'IT1',
        program_name: 'Khoa học Máy tính',
        analysis_track: 'IT',
        is_direct_track: true,
      },
    [allPrograms, selectedProgramCode]
  )

  const filteredPrograms = useMemo(() => {
    const q = stripAccents(programQuery.trim())
    if (!q) {
      return (selectedSchool?.programs || []).map((p) => ({
        ...p,
        school_id: selectedSchool.school_id,
        school_code: selectedSchool.school_code,
        school_name: selectedSchool.school_name,
      }))
    }
    return allPrograms.filter((p) => {
      const hay = stripAccents(`${p.program_code} ${p.program_name} ${p.school_code} ${p.school_name} ${p.focus_hint || ''}`)
      return hay.includes(q)
    })
  }, [programQuery, selectedSchool, allPrograms])

  const handleSelectSchool = (sch) => {
    setSelectedSchoolId(sch.school_id)
    setProgramQuery('')
    const firstProg = sch.programs?.[0]
    if (firstProg) {
      setSelectedProgramCode(firstProg.program_code)
      setSelectedMajorCode(firstProg.analysis_track || 'IT')
    }
  }

  const handleSelectProgram = (prog) => {
    setSelectedSchoolId(prog.school_id)
    setSelectedProgramCode(prog.program_code)
    setSelectedMajorCode(prog.analysis_track || 'IT')
  }

  const currentMajor = useMemo(
    () => majors.find((m) => m.major_code === selectedMajorCode) || majors[0],
    [majors, selectedMajorCode]
  )

  const activePresets = useMemo(
    () =>
      selectedProgram?.year_presets?.length
        ? selectedProgram.year_presets
        : currentMajor?.presets || [],
    [selectedProgram, currentMajor]
  )

  useEffect(() => {
    if (!selectedMajorCode || !selectedProgramCode) return
    let cancelled = false
    async function loadProgramCoursesAndAnalyze() {
      const { data, live } = await fetchMajorCourses(selectedMajorCode, selectedProgramCode)
      if (cancelled) return
      onApiStatus?.(live)
      setCourses(data || [])

      const presetsList =
        selectedProgram?.year_presets?.length
          ? selectedProgram.year_presets
          : (majors.find((m) => m.major_code === selectedMajorCode)?.presets || [])
      const defaultPreset = presetsList[2] || presetsList[1] || presetsList[0]
      const initialCourses = defaultPreset?.courses || []

      if (defaultPreset) {
        setSelectedCourses(initialCourses)
        setActivePreset(defaultPreset.id || defaultPreset.preset_id)
      } else {
        setSelectedCourses([])
        setActivePreset(null)
      }
      setCourseSearch('')
      setProjectsText('')

      setAnalyzing(true)
      const analyzed = await analyzeStudentProfile({
        major_code: selectedMajorCode,
        program_code: selectedProgramCode,
        completed_courses: initialCourses,
        projects_text: '',
      })
      if (!cancelled) {
        onApiStatus?.(analyzed.live)
        setResult(analyzed.data)
        setAnalyzing(false)
      }
    }
    loadProgramCoursesAndAnalyze()
    return () => {
      cancelled = true
    }
  }, [selectedMajorCode, selectedProgramCode, selectedProgram, majors])

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase()
    if (!q) return courses
    return courses.filter(
      (c) =>
        (c.display_code || c.course_code).toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    )
  }, [courses, courseSearch])

  const toggleCourse = (code) => {
    setActivePreset(null)
    setSelectedCourses((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    )
  }

  const applyPreset = async (preset) => {
    const nextCourses = preset.courses || preset.completed_courses || []
    const nextProjects = preset.sample_tools_text || ''
    setActivePreset(preset.id || preset.preset_id)
    setSelectedCourses(nextCourses)
    setProjectsText(nextProjects)

    setAnalyzing(true)
    const { data, live } = await analyzeStudentProfile({
      major_code: selectedMajorCode,
      program_code: selectedProgramCode,
      completed_courses: nextCourses,
      projects_text: nextProjects,
    })
    onApiStatus?.(live)
    setResult(data)
    setAnalyzing(false)
  }

  const appendChip = (chip) => {
    setProjectsText((prev) => {
      if (prev.toLowerCase().includes(chip.toLowerCase())) return prev
      return prev.trim() ? `${prev.trim()}, ${chip}` : chip
    })
  }

  const handleAnalyze = async (e) => {
    e?.preventDefault()
    setAnalyzing(true)
    const { data, live } = await analyzeStudentProfile({
      major_code: selectedMajorCode,
      program_code: selectedProgramCode,
      completed_courses: selectedCourses,
      projects_text: projectsText,
    })
    onApiStatus?.(live)
    setResult(data)
    setAnalyzing(false)
  }

  const resetInputs = () => {
    setSelectedCourses([])
    setActivePreset(null)
    setProjectsText('')
  }

  const biggestGapAxis = useMemo(() => {
    if (!result?.radar_data?.length) return null
    return [...result.radar_data].sort((a, b) => b.gap - a.gap)[0]
  }, [result])

  return (
    <div className="space-y-6">
      {/* Personalized HUST School & Program Search / Selector */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            Chọn Trường và Ngành đào tạo thí điểm tại HUST
          </h2>
          <div className="relative w-full sm:w-80">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={programQuery}
              onChange={(e) => setProgramQuery(e.target.value)}
              placeholder="Tìm mã ngành, tên ngành (VD: IT-E10, EE2, TE1, HE1)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
        </div>

        {/* HUST Schools / Faculties Filter */}
        {!programQuery.trim() && (
          <div className="flex flex-wrap gap-1.5">
            {hustSchools.map((sch) => {
              const active = sch.school_id === selectedSchoolId
              return (
                <button
                  key={sch.school_id}
                  type="button"
                  onClick={() => handleSelectSchool(sch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sch.school_code} · {sch.school_name.replace('Trường ', '').replace('Khoa ', 'K. ')}
                </button>
              )
            })}
          </div>
        )}

        {/* Matching Majors / Programs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredPrograms.map((prog) => {
            const Icon = MAJOR_ICONS[prog.analysis_track] || Layers
            const active = prog.program_code === selectedProgramCode
            return (
              <button
                key={prog.program_code}
                type="button"
                onClick={() => handleSelectProgram(prog)}
                className={`text-left p-3.5 rounded-xl border transition-colors ${
                  active
                    ? 'border-hust-crimson bg-slate-50 ring-1 ring-hust-crimson'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-hust-crimson' : 'text-slate-500'
                      }`}
                      strokeWidth={1.75}
                    />
                    <span className="font-bold text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-900">
                      {prog.program_code}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">
                      {prog.school_code}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                    50 JD
                  </span>
                </div>
                <h3 className="mt-2 font-bold text-slate-900 text-sm line-clamp-1">
                  {prog.program_name}
                </h3>
                {prog.focus_hint && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                    {prog.focus_hint}
                  </p>
                )}
              </button>
            )
          })}
          {filteredPrograms.length === 0 && (
            <p className="col-span-full text-xs text-slate-500 py-4 text-center">
              Không tìm thấy ngành phù hợp với từ khóa "{programQuery}".
            </p>
          )}
        </div>

        {/* Selected Program Bar */}
        <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
          <span>
            Đang chọn: <strong className="text-slate-900">{selectedProgram.program_code} – {selectedProgram.program_name}</strong> ({selectedSchool?.school_name})
          </span>
        </div>
      </section>

      {/* Main Two-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Inputs (5 cols) */}
        <form onSubmit={handleAnalyze} className="lg:col-span-5 space-y-5">
          <div className="glass-card p-5 space-y-5">
            {/* Completed Courses */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Học phần đã hoàn thành
                </h2>
                <button
                  type="button"
                  onClick={resetInputs}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-hust-crimson font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Đặt lại</span>
                </button>
              </div>

              {/* 1-click Year Presets */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1.5">Chọn nhanh theo năm học ({selectedProgram.program_code}):</p>
                <div className="grid grid-cols-2 gap-2">
                  {activePresets.map((preset) => {
                    const pid = preset.id || preset.preset_id
                    const pcourses = preset.courses || preset.completed_courses || []
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-colors flex items-center justify-between ${
                          activePreset === pid
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{preset.label || preset.label_vi}</span>
                        <span className="text-[10px] opacity-75 ml-1 shrink-0 tabular-nums">
                          {pcourses.length} môn
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Search Courses */}
              <div className="relative mb-2.5">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Tìm mã học phần (VD: IT4015, EE4210, TE3010, HE4010)..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              {/* Course Checklist */}
              <div className="max-h-64 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                {filteredCourses.map((course) => {
                  const checked = selectedCourses.includes(course.course_code)
                  return (
                    <label
                      key={course.course_code}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-slate-100/80 border-slate-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCourse(course.course_code)}
                        className="mt-0.5 rounded border-slate-300 text-hust-crimson focus:ring-hust-crimson"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            {course.display_code || course.course_code}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              {course.type === 'core' ? 'Cốt lõi' : 'Tự chọn'}
                            </span>
                            {course.semester && (
                              <span className="text-slate-400 tabular-nums">
                                Kỳ {course.semester}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-0.5">{course.name}</p>
                      </div>
                    </label>
                  )
                })}
                {filteredCourses.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Không tìm thấy học phần phù hợp.
                  </p>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-2 tabular-nums">
                Đã chọn <strong className="text-slate-800">{selectedCourses.length}</strong> /{' '}
                {courses.length} học phần
              </p>
            </div>

            <hr className="border-slate-200" />

            {/* Projects & Tools */}
            <div>
              <label
                htmlFor="projects-input"
                className="text-sm font-bold text-slate-900 block mb-1.5"
              >
                Dự án, công cụ và ngoại ngữ
              </label>
              <textarea
                id="projects-input"
                rows={3}
                value={projectsText}
                onChange={(e) => setProjectsText(e.target.value)}
                placeholder="VD: React, FastAPI, Docker, Git, IELTS 6.5..."
                className="w-full p-3 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 resize-none"
              />

              {/* Quick Chips */}
              <div className="mt-2">
                <span className="text-[11px] text-slate-500 block mb-1.5">
                  Thêm nhanh công cụ hoặc chứng chỉ:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(QUICK_PROJECT_CHIPS[selectedMajorCode] || []).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => appendChip(chip)}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={analyzing}
              className="w-full py-2.5 px-4 rounded-lg bg-hust-crimson hover:bg-hust-red text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <span>{analyzing ? 'Đang phân tích...' : 'Phân tích khoảng cách kỹ năng'}</span>
              {!analyzing && <ArrowRight className="w-4 h-4" strokeWidth={1.75} />}
            </button>
          </div>
        </form>

        {/* Right Column: Radar Chart + Gaps + Roadmap (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                <div className="glass-card p-3.5">
                  <p className="text-[11px] font-medium text-slate-500">Độ sẵn sàng</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">
                    {result.overall_readiness}
                    <span className="text-xs font-normal text-slate-400">/100</span>
                  </p>
                </div>
                <div className="glass-card p-3.5">
                  <p className="text-[11px] font-medium text-slate-500">Chuẩn thị trường</p>
                  <p className="text-2xl font-bold text-hust-crimson mt-0.5">
                    {result.overall_market_avg}
                    <span className="text-xs font-normal text-slate-400">/100</span>
                  </p>
                </div>
                <div className="glass-card p-3.5">
                  <p className="text-[11px] font-medium text-slate-500">Thiếu hụt lớn nhất</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">
                    -{biggestGapAxis?.gap ?? result.overall_gap}
                    <span className="text-xs font-normal text-slate-400"> đ</span>
                  </p>
                  <p className="text-[11px] text-slate-500 truncate" title={biggestGapAxis?.axis_name}>
                    {biggestGapAxis?.short_name || 'Cân bằng'}
                  </p>
                </div>
                <div className="glass-card p-3.5">
                  <p className="text-[11px] font-medium text-slate-500">Kỹ năng đã phủ</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">
                    {result.detected_skills?.length || 0}
                  </p>
                </div>
              </div>

              {/* Radar Chart Card */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Biểu đồ Radar — {result.major_name}
                  </h3>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {result.jd_count} JD
                  </span>
                </div>

                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <RadarChart cx="50%" cy="50%" outerRadius="74%" data={result.radar_data}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis
                        dataKey="short_name"
                        tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                      />
                      <Radar
                        name={`Nhu cầu thị trường (${result.jd_count} JD)`}
                        dataKey="market_demand"
                        stroke="#C8102E"
                        strokeWidth={2}
                        fill="#C8102E"
                        fillOpacity={0.12}
                      />
                      <Radar
                        name="Năng lực sinh viên"
                        dataKey="student_score"
                        stroke="#2563EB"
                        strokeWidth={2}
                        fill="#2563EB"
                        fillOpacity={0.24}
                      />
                      <Tooltip content={<RadarTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {result.summary_insight && (
                  <p className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {result.summary_insight}
                  </p>
                )}

                {/* 6-Axis Breakdown */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 tabular-nums">
                  {result.radar_data.map((axis) => (
                    <div
                      key={axis.axis_id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {axis.short_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Sinh viên: <strong className="text-blue-600">{axis.student_score}</strong> · Thị trường:{' '}
                          <strong className="text-hust-crimson">{axis.market_demand}</strong>
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                          axis.gap >= 30
                            ? 'text-red-700 bg-red-50 border-red-200'
                            : axis.gap >= 15
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        {axis.gap > 0 ? `Thiếu ${axis.gap}` : 'Đạt'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing & Detected Skills */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Kỹ năng ưu tiên bổ sung
                </h3>
                <div className="flex flex-wrap gap-2 tabular-nums">
                  {(result.top_missing_skills || []).map((skill) => (
                    <div
                      key={skill.skill_id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                    >
                      <span className="font-semibold text-slate-900">{skill.name}</span>
                      <span className="text-[11px] font-semibold text-hust-crimson">
                        {skill.jd_frequency_pct}% JD
                      </span>
                    </div>
                  ))}
                </div>
                {result.detected_skills?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 mb-2">
                      Kỹ năng đã ghi nhận từ học phần và dự án:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.detected_skills.slice(0, 10).map((sk) => (
                        <span
                          key={sk.skill_id}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          <Check className="w-3 h-3 text-slate-500" strokeWidth={1.75} />
                          <span>{sk.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Roadmap Recommendations */}
              <div className="glass-card p-5">
                <h3 className="text-base font-bold text-slate-900 mb-3">
                  Lộ trình gợi ý
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {ROADMAP_TABS.map((tab) => {
                    const TabIcon = tab.icon
                    const active = roadmapTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRoadmapTab(tab.id)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <TabIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="space-y-3">
                  {roadmapTab === 'courses' && (
                    <>
                      {(result.roadmap?.next_semester_courses || []).map((item, idx) => (
                        <div
                          key={item.course_code || idx}
                          className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-xs font-semibold">
                                {item.course_code}
                              </span>
                              <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                            </div>
                            <p className="text-xs text-slate-600 mt-1.5">{item.reason}</p>
                            {item.matched_skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.matched_skills.map((s) => (
                                  <span
                                    key={s}
                                    className="text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.semester && (
                            <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 shrink-0 self-start tabular-nums">
                              Kỳ {item.semester}
                            </span>
                          )}
                        </div>
                      ))}
                      {(!result.roadmap?.next_semester_courses ||
                        result.roadmap.next_semester_courses.length === 0) && (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          Đã hoàn thành các học phần trọng tâm trong danh mục mẫu.
                        </p>
                      )}
                    </>
                  )}

                  {roadmapTab === 'clubs' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(result.roadmap?.matching_clubs || []).map((club, idx) => (
                        <div
                          key={club.club_name || idx}
                          className="p-4 rounded-lg border border-slate-200 bg-white"
                        >
                          <h4 className="font-bold text-sm text-slate-900">{club.club_name}</h4>
                          <p className="text-xs text-slate-600 mt-1">{club.focus}</p>
                          {club.activities && (
                            <p className="text-[11px] text-slate-500 mt-1.5">
                              Hoạt động: {club.activities}
                            </p>
                          )}
                          <p className="text-xs text-slate-800 font-medium mt-2">{club.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {roadmapTab === 'certs' && (
                    <div className="space-y-3">
                      {(result.roadmap?.courses_and_certs || []).map((cert, idx) => (
                        <div
                          key={cert.title || idx}
                          className="p-4 rounded-lg border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">{cert.title}</h4>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                {cert.provider}
                              </span>
                              {cert.cost && (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {cert.cost}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1.5">{cert.reason}</p>
                            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                              {cert.level || 'Phù hợp sinh viên'} · {cert.duration || '2–4 tuần'}
                            </p>
                          </div>
                          {cert.url && (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-hust-crimson hover:underline shrink-0"
                            >
                              <span>Chi tiết</span>
                              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {roadmapTab === 'projects' && (
                    <div className="space-y-3">
                      {(result.roadmap?.project_ideas || []).map((proj, idx) => (
                        <div
                          key={proj.title || idx}
                          className="p-4 rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-bold text-sm text-slate-900">{proj.title}</h4>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 tabular-nums">
                              {proj.difficulty && (
                                <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                                  {proj.difficulty}
                                </span>
                              )}
                              {proj.duration && (
                                <span className="px-2 py-0.5 rounded bg-white border border-slate-200">
                                  {proj.duration}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                            {proj.description}
                          </p>
                          {proj.deliverables?.length > 0 && (
                            <div className="mt-2.5">
                              <span className="text-[11px] font-semibold text-slate-700">
                                Kết quả đầu ra:
                              </span>
                              <ul className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {proj.deliverables.map((d) => (
                                  <li key={d} className="text-xs text-slate-600 flex items-center gap-1.5">
                                    <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                                    <span>{d}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card p-12 text-center text-slate-500 text-sm">
              Đang tải dữ liệu phân tích...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
