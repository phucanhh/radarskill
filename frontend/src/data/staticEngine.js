import majorsRaw from '../../../data/majors.json'
import taxonomyRaw from '../../../data/skill_taxonomy.json'
import coursesRaw from '../../../data/course_skill_matrix.json'
import jdsRaw from '../../../data/jds_dataset.json'
import recommendationsRaw from '../../../data/recommendations.json'
import dashboardRaw from '../../../data/dashboard_cohort_sample.json'
import hustCatalogRaw from '../../../data/hust_catalog.json'

export const QUICK_PROJECT_CHIPS = {
  IT: [
    'React + TypeScript + Tailwind',
    'Python FastAPI + PostgreSQL',
    'Docker + GitHub Actions CI/CD',
    'Git, Jira & Agile Scrum',
    'IELTS 6.5 / JLPT N3',
  ],
  SEEE: [
    'Altium Designer PCB 4 lớp',
    'PLC Siemens S7-1200 / TIA Portal',
    'STM32 / ESP32 + Embedded C',
    'Oscilloscope, Modbus & Datasheet',
    'Tiếng Anh kỹ thuật TOEIC 650+',
  ],
  SME: [
    'SolidWorks 3D & AutoCAD 2D',
    'ANSYS CAE / Mastercam CNC',
    'Đọc bản vẽ GD&T & Excel BOM',
    'QA/QC (FMEA, 7 QC Tools)',
    '5S/Kaizen & Tiếng Anh kỹ thuật',
  ],
}

const STOPWORDS = new Set([
  'va', 'và', 'cua', 'của', 'cho', 'voi', 'với', 'cac', 'các', 'trong',
  'bang', 'bằng', 'co', 'có', 'ban', 'bản', 'la', 'là', 'du', 'dự', 'an', 'án',
  'lam', 'làm', 'dung', 'dùng', 'su', 'sử', 'ky', 'kỹ', 'nang', 'năng',
  'co', 'cơ', 'and', 'or', 'the', 'for', 'with', 'using', 'in', 'of', 'to', 'a',
])

function stripAccents(text = '') {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

function normalizeText(text = '') {
  const lower = text.toLowerCase().trim()
  return [lower, stripAccents(lower)]
}

function tokenize(text = '') {
  const ascii = stripAccents(text.toLowerCase())
  const tokens = ascii.match(/[a-z0-9+#./]+/g) || []
  return new Set(tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t)))
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsPhrase(haystack, needle) {
  const n = needle.trim().toLowerCase()
  if (!n) return false
  const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(n)}(?![a-z0-9])`)
  return pattern.test(haystack)
}

// Pre-index static datasets once on module load
const programsByCode = {}
for (const sch of hustCatalogRaw.schools || []) {
  for (const prog of sch.programs || []) {
    programsByCode[prog.program_code.toUpperCase()] = {
      ...prog,
      school_id: sch.school_id,
      school_code: sch.school_code,
      school_name: sch.school_name,
    }
  }
}

const majorsByCode = Object.fromEntries(
  (majorsRaw.majors || []).map((m) => [m.major_code, m])
)

const skillsById = Object.fromEntries(
  (taxonomyRaw.skills || []).map((s) => [s.skill_id, s])
)

const skillsByMajor = {}
for (const s of taxonomyRaw.skills || []) {
  if (!skillsByMajor[s.major_code]) skillsByMajor[s.major_code] = []
  skillsByMajor[s.major_code].push(s)
}

const coursesByMajor = {}
const coursesByCode = {}
for (const c of coursesRaw.courses || []) {
  if (!coursesByMajor[c.major_code]) coursesByMajor[c.major_code] = []
  coursesByMajor[c.major_code].push(c)
  coursesByCode[c.course_code] = c
}

const jdsByMajor = {}
for (const jd of jdsRaw.jds || []) {
  if (!jdsByMajor[jd.major_code]) jdsByMajor[jd.major_code] = []
  jdsByMajor[jd.major_code].push(jd)
}

const clubsById = Object.fromEntries(
  (recommendationsRaw.clubs || []).map((c) => [c.club_id, c])
)

const jdStatsByMajor = {}
for (const [majorCode, jds] of Object.entries(jdsByMajor)) {
  const n = Math.max(1, jds.length)
  const stats = {}
  for (const s of skillsByMajor[majorCode] || []) {
    const sid = s.skill_id
    const req = jds.filter((jd) => (jd.required_skills || []).includes(sid)).length
    const pref = jds.filter((jd) => (jd.preferred_skills || []).includes(sid)).length
    const weightedFreq = (req * 1.0 + pref * 0.5) / n
    const rawPct = Math.round(((req + pref) / n) * 1000) / 10
    stats[sid] = {
      required_count: req,
      preferred_count: pref,
      weighted_freq: weightedFreq,
      jd_frequency_pct: rawPct,
    }
  }
  jdStatsByMajor[majorCode] = stats
}

export function getStaticHustCatalog() {
  return hustCatalogRaw.schools || []
}

export function getStaticMajors() {
  return (majorsRaw.majors || []).map((m) => {
    const code = m.major_code
    return {
      major_code: code,
      name: m.name_vi,
      name_en: m.name_en || '',
      short_name: `${m.name_vi} (${(m.program_codes || []).slice(0, 2).join(' / ')})`,
      school: m.school_vi || '',
      hust_codes: m.program_codes || [],
      description: m.description_vi || '',
      jd_count: (jdsByMajor[code] || []).length,
      clubs_involved: m.lead_clubs || [],
      axes: (m.axes || []).map((ax) => ({
        axis_id: ax.axis_id,
        name: ax.name_vi,
        short_name: ax.short_label,
        description: ax.description_vi || '',
      })),
      presets: (m.semester_presets || []).map((p) => ({
        id: p.preset_id,
        label: p.label_vi,
        year: p.year,
        courses: p.completed_courses,
        sample_tools_text: p.sample_tools_text || '',
      })),
    }
  })
}

export function getStaticMajorCourses(majorCode, programCode = '') {
  const mc = (majorCode || 'IT').toUpperCase()
  const list = coursesByMajor[mc] || []
  const pcode = programCode.trim().toUpperCase()
  const filtered = pcode
    ? list.filter(
        (c) =>
          !c.applicable_programs?.length ||
          c.applicable_programs.some((p) => p.toUpperCase() === pcode)
      )
    : list
  const finalCourses = filtered.length ? filtered : list
  return finalCourses.map((c) => ({
    course_code: c.course_code,
    display_code: c.course_code.replace('_SME', ''),
    name: c.course_name_vi,
    semester: (c.recommended_year || 1) * 2 - (c.course_type === 'core' ? 1 : 0),
    recommended_year: c.recommended_year || 1,
    credits: c.credits || 3,
    type: c.course_type || 'core',
    has_project: Boolean(c.has_project),
    applicable_programs: c.applicable_programs || [],
    skills: c.skills || [],
    common_gap_note: c.common_gap_note_vi || '',
  }))
}

function matchProjectsText(majorCode, projectsText = '') {
  if (!projectsText || !projectsText.trim()) return {}
  const [lowerText, asciiText] = normalizeText(projectsText)
  const inputTokens = tokenize(projectsText)
  const matched = {}

  for (const skill of skillsByMajor[majorCode] || []) {
    const sid = skill.skill_id
    let bestBoost = 0.0
    const candidates = [
      ...(skill.aliases || []),
      skill.name_vi || '',
      skill.name_en || '',
    ]
    for (const alias of candidates) {
      const [aLower, aAscii] = normalizeText(alias)
      if (!aLower) continue
      if (containsPhrase(lowerText, aLower) || containsPhrase(asciiText, aAscii)) {
        bestBoost = Math.max(bestBoost, 0.45)
        break
      }
    }
    if (bestBoost === 0.0 && inputTokens.size > 0) {
      const skillTokens = tokenize(
        [skill.name_vi || '', skill.name_en || '', ...(skill.aliases || [])].join(' ')
      )
      let overlapCount = 0
      for (const tok of inputTokens) {
        if (skillTokens.has(tok)) overlapCount += 1
      }
      if (overlapCount >= 2) {
        const ratio = overlapCount / Math.max(2, Math.min(skillTokens.size, 6))
        if (ratio >= 0.3) {
          bestBoost = Math.max(bestBoost, Math.min(0.38, 0.25 + ratio * 0.2))
        }
      }
    }
    if (bestBoost > 0.0) {
      matched[sid] = Math.round(bestBoost * 1000) / 1000
    }
  }
  return matched
}

function buildRoadmap(majorCode, completedSet, radarData, topMissingSkills, programCode = '') {
  const byAxis = recommendationsRaw.by_axis || {}
  const bySkill = recommendationsRaw.by_skill || {}
  const pcode = programCode.trim().toUpperCase()

  const topGapAxes = [...radarData]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map((r) => r.axis_id)
  const missingSkillIds = new Set(topMissingSkills.map((s) => s.skill_id))

  const nextCourses = []
  const seenCourses = new Set()

  const courseMatchesProgram = (c) => {
    if (!pcode || !c.applicable_programs?.length) return true
    return c.applicable_programs.some((p) => p.toUpperCase() === pcode)
  }

  const addCourse = (code, reason) => {
    if (completedSet.has(code) || seenCourses.has(code)) return
    const c = coursesByCode[code]
    if (!c || c.major_code !== majorCode || !courseMatchesProgram(c)) return
    seenCourses.add(code)
    nextCourses.push({
      course_code: c.course_code.replace('_SME', ''),
      name: c.course_name_vi,
      semester: (c.recommended_year || 3) * 2 - (c.course_type === 'core' ? 1 : 0),
      type: c.course_type || 'elective',
      reason,
      matched_skills: (c.skills || [])
        .map((sk) => skillsById[sk.skill_id]?.name_vi)
        .filter(Boolean)
        .slice(0, 3),
    })
  }

  for (const axId of topGapAxes) {
    for (const item of byAxis[axId]?.next_semester_electives || []) {
      addCourse(item.course_code, item.reason_vi)
    }
  }
  for (const sk of topMissingSkills) {
    for (const code of bySkill[sk.skill_id]?.elective_codes || []) {
      addCourse(
        code,
        `Bổ sung trực tiếp kỹ năng đang thiếu: ${sk.name} (${sk.jd_frequency_pct}% JD yêu cầu).`
      )
    }
  }
  if (nextCourses.length < 3) {
    for (const c of coursesByMajor[majorCode] || []) {
      if (completedSet.has(c.course_code) || seenCourses.has(c.course_code) || !courseMatchesProgram(c)) {
        continue
      }
      if ((c.skills || []).some((sk) => missingSkillIds.has(sk.skill_id))) {
        addCourse(c.course_code, c.common_gap_note_vi || 'Bổ sung nền tảng cho các kỹ năng JD yêu cầu.')
      }
    }
  }

  const matchingClubs = []
  const seenClubs = new Set()
  const addClub = (clubId, reason) => {
    if (seenClubs.has(clubId) || !clubsById[clubId]) return
    seenClubs.add(clubId)
    const cl = clubsById[clubId]
    matchingClubs.push({
      club_name: cl.name_vi,
      short_name: cl.short_name,
      focus: cl.focus_vi,
      activities: (cl.activities_vi || []).slice(0, 2).join(' · '),
      reason,
      matched_skills: (cl.target_skills || [])
        .filter((sid) => skillsById[sid] && (missingSkillIds.has(sid) || skillsById[sid].major_code === majorCode))
        .map((sid) => skillsById[sid].name_vi)
        .slice(0, 3),
      is_core_partner: Boolean(cl.is_partner_club),
    })
  }

  for (const axId of topGapAxes) {
    for (const clRec of byAxis[axId]?.clubs || []) {
      addClub(clRec.club_id, clRec.reason_vi)
    }
  }
  for (const sk of topMissingSkills) {
    for (const cid of bySkill[sk.skill_id]?.club_ids || []) {
      addClub(cid, `Phù hợp rèn luyện thực tế kỹ năng ${sk.name} qua workshop & dự án CLB.`)
    }
  }
  for (const [cid, cl] of Object.entries(clubsById)) {
    if (matchingClubs.length >= 4) break
    if ((cl.target_majors || []).includes(majorCode)) {
      addClub(cid, 'CLB học thuật tại HUST hỗ trợ rèn luyện kỹ năng thực hành theo ngành.')
    }
  }
  matchingClubs.sort((a, b) => a.club_name.localeCompare(b.club_name, 'vi'))

  const certs = []
  const seenCerts = new Set()
  for (const axId of topGapAxes) {
    for (const cert of byAxis[axId]?.courses_and_certs || []) {
      if (seenCerts.has(cert.title)) continue
      seenCerts.add(cert.title)
      certs.push({
        title: cert.title,
        provider: cert.provider || 'Online',
        level: cert.type || 'Khóa học / Chứng chỉ',
        duration: cert.duration || '3–6 tuần',
        cost: cert.cost_note || 'Miễn phí / Hỗ trợ SV',
        url: cert.url || '',
        reason: 'Thu hẹp khoảng cách trục kỹ năng trọng tâm bằng chứng chỉ/khóa học được doanh nghiệp công nhận.',
        matched_skills: (cert.target_skills || [])
          .map((sid) => skillsById[sid]?.name_vi)
          .filter(Boolean),
      })
    }
  }

  const projects = []
  const seenProj = new Set()
  for (const axId of topGapAxes) {
    for (const proj of byAxis[axId]?.project_ideas || []) {
      if (seenProj.has(proj.title_vi)) continue
      seenProj.add(proj.title_vi)
      projects.push({
        title: proj.title_vi,
        difficulty: proj.difficulty || 'Trung bình',
        duration: `${proj.duration_weeks || 4} tuần`,
        description: proj.description_vi || '',
        deliverables: proj.deliverables_vi || [],
        matched_skills: (proj.target_skills || [])
          .map((sid) => skillsById[sid]?.name_vi)
          .filter(Boolean),
      })
    }
  }

  return {
    next_semester_courses: nextCourses.slice(0, 4),
    matching_clubs: matchingClubs.slice(0, 4),
    courses_and_certs: certs.slice(0, 4),
    project_ideas: projects.slice(0, 3),
  }
}

export function runStaticAnalyze({ major_code, program_code = '', completed_courses = [], projects_text = '' }) {
  const mc = (major_code || 'IT').toUpperCase()
  const major = majorsByCode[mc] || majorsRaw.majors[0]
  const progInfo = program_code ? programsByCode[program_code.trim().toUpperCase()] : null
  const jds = jdsByMajor[mc] || []
  const jdCount = jds.length
  const jdStats = jdStatsByMajor[mc] || {}
  const majorSkills = skillsByMajor[mc] || []
  const completedSet = new Set(
    (completed_courses || []).filter(Boolean).map((c) => c.trim().toUpperCase())
  )

  const courseCov = {}
  for (const code of completedSet) {
    const course = coursesByCode[code]
    if (!course || course.major_code !== mc) continue
    const cap = course.has_project ? 0.75 : 0.6
    for (const sk of course.skills || []) {
      const contrib = Math.min(cap, Number(sk.weight))
      courseCov[sk.skill_id] = Math.max(courseCov[sk.skill_id] || 0, contrib)
    }
  }

  const projectCov = matchProjectsText(mc, projects_text)
  const combinedCov = {}
  const detectedSkills = []
  const axesById = Object.fromEntries((major.axes || []).map((ax) => [ax.axis_id, ax]))

  for (const s of majorSkills) {
    const sid = s.skill_id
    const cVal = courseCov[sid] || 0
    const pVal = projectCov[sid] || 0
    const total = pVal > 0 && cVal === 0 ? Math.min(0.85, pVal + 0.15) : Math.min(1.0, cVal + pVal)
    combinedCov[sid] = Math.round(total * 1000) / 1000
    if (total > 0) {
      detectedSkills.push({
        skill_id: sid,
        name: s.name_vi,
        source: cVal > 0 && pVal > 0 ? 'both' : cVal > 0 ? 'course' : 'project',
        coverage: Math.round(total * 100) / 100,
        axis_name: axesById[s.axis_id]?.short_label || '',
      })
    }
  }
  detectedSkills.sort((a, b) => b.coverage - a.coverage || a.name.localeCompare(b.name, 'vi'))

  const radarData = (major.axes || []).map((ax) => {
    const axId = ax.axis_id
    const axSkills = majorSkills.filter((s) => s.axis_id === axId)
    const axSkillIds = new Set(axSkills.map((s) => s.skill_id))
    const jdsRequiringAxis = jds.filter((jd) =>
      [...(jd.required_skills || []), ...(jd.preferred_skills || [])].some((id) => axSkillIds.has(id))
    ).length
    const axisJdPresence = jdsRequiringAxis / Math.max(1, jdCount)

    const skillFreqs = axSkills
      .map((s) => [s, jdStats[s.skill_id]?.weighted_freq ?? 0.05])
      .sort((a, b) => b[1] - a[1])
    const top3AvgFreq =
      skillFreqs.slice(0, 3).reduce((acc, [, f]) => acc + f, 0) / Math.max(1, Math.min(3, skillFreqs.length))

    const marketDemand = Math.round(Math.min(94, Math.max(65, 58 + axisJdPresence * 22 + top3AvgFreq * 28)))
    const totalFreq = skillFreqs.reduce((acc, [, f]) => acc + Math.max(0.05, f), 0)
    const weightedStudent =
      totalFreq > 0
        ? skillFreqs.reduce((acc, [s, f]) => acc + (Math.max(0.05, f) / totalFreq) * (combinedCov[s.skill_id] || 0), 0)
        : 0
    const studentScore = Math.round(Math.min(100, weightedStudent * 100))
    const gap = Math.max(0, marketDemand - studentScore)

    return {
      axis_id: axId,
      axis_name: ax.name_vi,
      short_name: ax.short_label,
      student_score: studentScore,
      market_demand: marketDemand,
      gap,
      top_jd_skills: skillFreqs.slice(0, 3).map(([s]) => s.name_vi),
    }
  })

  const overallReadiness = Math.round(
    radarData.reduce((s, r) => s + r.student_score, 0) / Math.max(1, radarData.length)
  )
  const overallMarketAvg = Math.round(
    radarData.reduce((s, r) => s + r.market_demand, 0) / Math.max(1, radarData.length)
  )
  const overallGap = Math.max(0, overallMarketAvg - overallReadiness)

  const missingCandidates = []
  for (const s of majorSkills) {
    const sid = s.skill_id
    const st = jdStats[sid] || { required_count: 0, preferred_count: 0, weighted_freq: 0, jd_frequency_pct: 0 }
    const cov = combinedCov[sid] || 0
    if (cov >= 0.85 || st.jd_frequency_pct <= 0) continue
    missingCandidates.push({
      skill_id: sid,
      name: s.name_vi,
      axis_id: s.axis_id,
      axis_name: axesById[s.axis_id]?.short_label || '',
      jd_frequency_pct: Math.round(st.jd_frequency_pct),
      required_count: st.required_count,
      preferred_count: st.preferred_count,
      current_coverage: Math.round(cov * 100) / 100,
      priority_score: Math.round((1.0 - cov) * st.weighted_freq * 1000) / 10,
      category: s.category || 'core',
    })
  }
  missingCandidates.sort((a, b) => b.priority_score - a.priority_score || b.jd_frequency_pct - a.jd_frequency_pct)
  const topMissingSkills = missingCandidates.slice(0, 6)

  const roadmap = buildRoadmap(mc, completedSet, radarData, topMissingSkills, program_code)
  const topGapAx = [...radarData].sort((a, b) => b.gap - a.gap)[0]
  const strongestAx = [...radarData].sort((a, b) => b.student_score - a.student_score)[0]
  const displayName = progInfo ? `${progInfo.program_code} – ${progInfo.program_name}` : major.name_vi

  return {
    major_code: mc,
    major_name: displayName,
    school_name: progInfo ? progInfo.school_name : major.school_vi || '',
    program_code: progInfo ? progInfo.program_code : '',
    is_direct_track: true,
    jd_count: jdCount,
    overall_readiness: overallReadiness,
    overall_market_avg: overallMarketAvg,
    overall_gap: overallGap,
    radar_data: radarData,
    detected_skills: detectedSkills,
    top_missing_skills: topMissingSkills,
    roadmap,
    summary_insight: `Hồ sơ ngành ${displayName} đạt ${overallReadiness}/100 so với chuẩn ${overallMarketAvg}/100 từ ${jdCount} JD nhóm ${major.name_vi}. Trục vững nhất là "${strongestAx.short_name}" (${strongestAx.student_score}/100); trục cần ưu tiên bổ sung là "${topGapAx.short_name}" (thiếu ${topGapAx.gap} điểm).`,
  }
}

export function getStaticDashboard() {
  const meta = dashboardRaw.metadata
  const cohorts = dashboardRaw.cohorts || []
  const majorsSummary = []
  const allMissingSkills = []
  const threshold = meta.privacy_threshold_n ?? 20

  for (const m of majorsRaw.majors || []) {
    const code = m.major_code
    const majorCohorts = cohorts.filter((c) => c.major_code === code)
    const allCohort = majorCohorts.find((c) => c.cohort_id.endsWith('_ALL')) || majorCohorts[0]
    const subCohorts = majorCohorts.filter((c) => !c.cohort_id.endsWith('_ALL'))
    const axesShort = Object.fromEntries((m.axes || []).map((ax) => [ax.axis_id, ax.short_label]))

    const axesBreakdown = (allCohort.axis_gaps || []).map((ag) => ({
      axis_id: ag.axis_id,
      axis_name: axesShort[ag.axis_id] || ag.axis_name_vi,
      avg_student: ag.avg_student_score,
      market_demand: ag.market_score,
      avg_gap: ag.avg_gap,
    }))
    const topGap = [...axesBreakdown].sort((a, b) => b.avg_gap - a.avg_gap)[0]

    const cohortBreakdown = subCohorts
      .filter((sc) => sc.student_count >= threshold)
      .map((sc) => ({
        cohort: sc.year_group,
        n: sc.student_count,
        gaps: (sc.axis_gaps || []).map((ag) => ag.avg_gap),
      }))
    cohortBreakdown.push({
      cohort: 'Toàn ngành (TB)',
      n: allCohort.student_count,
      gaps: (allCohort.axis_gaps || []).map((ag) => ag.avg_gap),
    })

    majorsSummary.push({
      major_code: code,
      major_name: m.name_vi,
      sample_size: allCohort.student_count,
      avg_readiness: Math.round(allCohort.avg_readiness_score),
      avg_market_demand: Math.round(
        axesBreakdown.reduce((s, a) => s + a.market_demand, 0) / Math.max(1, axesBreakdown.length)
      ),
      top_gap_axis: topGap.axis_name,
      axes_breakdown: axesBreakdown,
      cohort_breakdown: cohortBreakdown,
    })

    for (const sk of (allCohort.top_missing_skills || []).slice(0, 2)) {
      allMissingSkills.push({
        skill_name: sk.skill_name_vi,
        major_name: m.name_vi,
        missing_rate_pct: sk.missing_rate_pct,
        jd_demand_pct: sk.jd_demand_pct,
      })
    }
  }

  allMissingSkills.sort((a, b) => b.missing_rate_pct - a.missing_rate_pct)

  return {
    privacy_notice: meta.anonymization_note_vi,
    privacy_threshold_n: threshold,
    survey_period: meta.survey_period || '',
    total_students_analyzed: meta.total_students,
    total_jds_indexed: jdsRaw.total_jds || (jdsRaw.jds || []).length,
    majors_summary: majorsSummary,
    top_missing_skills_overall: allMissingSkills.slice(0, 6),
    suggested_club_workshops: (dashboardRaw.suggested_club_workshops || []).map((w) => ({
      workshop_id: w.workshop_id,
      title: w.title_vi,
      host_club: w.host_club_name,
      target_major: (w.target_majors || []).join(', '),
      target_cohort: 'Năm 2 – Năm 4',
      addressing_gap: w.triggered_by_gap_vi,
      expected_impact: w.expected_impact_vi,
      format: 'Hands-on Workshop / Bootcamp',
    })),
  }
}
