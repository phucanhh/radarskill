from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

STOPWORDS = {
    "va", "và", "cua", "của", "cho", "voi", "với", "cac", "các", "trong",
    "bang", "bằng", "co", "có", "ban", "bản", "la", "là", "du", "dự", "an", "án",
    "lam", "làm", "dung", "dùng", "su", "sử", "ky", "kỹ", "nang", "năng",
    "co", "cơ", "and", "or", "the", "for", "with", "using", "in", "of", "to", "a",
}


def _strip_accents(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch)).replace("đ", "d").replace("Đ", "D")


def _normalize_text(text: str) -> tuple[str, str]:
    lower = text.lower().strip()
    ascii_ver = _strip_accents(lower)
    return lower, ascii_ver


def _tokenize(text: str) -> set[str]:
    ascii_text = _strip_accents(text.lower())
    tokens = re.findall(r"[a-z0-9\+\#\.\/]+", ascii_text)
    return {t for t in tokens if len(t) >= 2 and t not in STOPWORDS}


def _contains_phrase(haystack: str, needle: str) -> bool:
    needle = needle.strip().lower()
    if not needle:
        return False
    # For short tokens (<=3 chars) or tokens with symbols (c++, .net, go, r), use boundary checks
    escaped = re.escape(needle)
    pattern = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
    return re.search(pattern, haystack) is not None


class SkillRadarEngine:
    def __init__(self, data_dir: Path = DATA_DIR) -> None:
        self.data_dir = data_dir
        self._load_all()

    def _load_json(self, filename: str) -> dict[str, Any]:
        path = self.data_dir / filename
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _load_all(self) -> None:
        self.majors_raw = self._load_json("majors.json")
        self.taxonomy_raw = self._load_json("skill_taxonomy.json")
        self.courses_raw = self._load_json("course_skill_matrix.json")
        self.jds_raw = self._load_json("jds_dataset.json")
        self.recs_raw = self._load_json("recommendations.json")
        self.dashboard_raw = self._load_json("dashboard_cohort_sample.json")
        self.hust_catalog_raw = self._load_json("hust_catalog.json")

        self.programs_by_code: dict[str, dict[str, Any]] = {}
        for sch in self.hust_catalog_raw.get("schools", []):
            for prog in sch.get("programs", []):
                self.programs_by_code[prog["program_code"].upper()] = {
                    **prog,
                    "school_id": sch["school_id"],
                    "school_code": sch["school_code"],
                    "school_name": sch["school_name"],
                }

        self.majors_by_code: dict[str, dict[str, Any]] = {
            m["major_code"]: m for m in self.majors_raw["majors"]
        }
        self.skills_by_id: dict[str, dict[str, Any]] = {
            s["skill_id"]: s for s in self.taxonomy_raw["skills"]
        }
        self.skills_by_major: dict[str, list[dict[str, Any]]] = {}
        for s in self.taxonomy_raw["skills"]:
            self.skills_by_major.setdefault(s["major_code"], []).append(s)

        self.courses_by_major: dict[str, list[dict[str, Any]]] = {}
        self.courses_by_code: dict[str, dict[str, Any]] = {}
        for c in self.courses_raw["courses"]:
            self.courses_by_major.setdefault(c["major_code"], []).append(c)
            self.courses_by_code[c["course_code"]] = c

        self.jds_by_major: dict[str, list[dict[str, Any]]] = {}
        for jd in self.jds_raw["jds"]:
            self.jds_by_major.setdefault(jd["major_code"], []).append(jd)

        self.clubs_by_id: dict[str, dict[str, Any]] = {
            c["club_id"]: c for c in self.recs_raw["clubs"]
        }

        # Precompute JD skill demand stats per major
        self.jd_stats_by_major: dict[str, dict[str, dict[str, float]]] = {}
        for major_code, jds in self.jds_by_major.items():
            n = max(1, len(jds))
            stats: dict[str, dict[str, float]] = {}
            for s in self.skills_by_major.get(major_code, []):
                sid = s["skill_id"]
                req = sum(1 for jd in jds if sid in jd.get("required_skills", []))
                pref = sum(1 for jd in jds if sid in jd.get("preferred_skills", []))
                weighted_freq = (req * 1.0 + pref * 0.5) / n
                raw_pct = round(((req + pref) / n) * 100, 1)
                stats[sid] = {
                    "required_count": req,
                    "preferred_count": pref,
                    "weighted_freq": weighted_freq,
                    "jd_frequency_pct": raw_pct,
                }
            self.jd_stats_by_major[major_code] = stats

    def list_hust_catalog(self) -> list[dict[str, Any]]:
        return self.hust_catalog_raw.get("schools", [])

    def list_majors(self) -> list[dict[str, Any]]:
        result = []
        for m in self.majors_raw["majors"]:
            code = m["major_code"]
            result.append(
                {
                    "major_code": code,
                    "name": m["name_vi"],
                    "name_en": m.get("name_en", ""),
                    "short_name": f"{m['name_vi']} ({' / '.join(m.get('program_codes', [])[:2])})",
                    "school": m.get("school_vi", ""),
                    "hust_codes": m.get("program_codes", []),
                    "description": m.get("description_vi", ""),
                    "jd_count": len(self.jds_by_major.get(code, [])),
                    "clubs_involved": m.get("lead_clubs", []),
                    "axes": [
                        {
                            "axis_id": ax["axis_id"],
                            "name": ax["name_vi"],
                            "short_name": ax["short_label"],
                            "description": ax.get("description_vi", ""),
                        }
                        for ax in m.get("axes", [])
                    ],
                    "presets": [
                        {
                            "id": p["preset_id"],
                            "label": p["label_vi"],
                            "year": p["year"],
                            "courses": p["completed_courses"],
                            "sample_tools_text": p.get("sample_tools_text", ""),
                        }
                        for p in m.get("semester_presets", [])
                    ],
                }
            )
        return result

    def list_courses(self, major_code: str, program_code: str = "") -> list[dict[str, Any]]:
        if major_code not in self.majors_by_code:
            raise KeyError(f"Unknown major_code: {major_code}")
        courses = self.courses_by_major.get(major_code, [])
        pcode = program_code.strip().upper()
        if pcode:
            filtered = [
                c
                for c in courses
                if not c.get("applicable_programs")
                or pcode in [p.upper() for p in c.get("applicable_programs", [])]
            ]
            if filtered:
                courses = filtered
        return [
            {
                "course_code": c["course_code"],
                "display_code": c["course_code"].replace("_SME", ""),
                "name": c["course_name_vi"],
                "semester": c.get("recommended_year", 1) * 2 - (1 if c.get("course_type") == "core" else 0),
                "recommended_year": c.get("recommended_year", 1),
                "credits": c.get("credits", 3),
                "type": c.get("course_type", "core"),
                "has_project": c.get("has_project", False),
                "applicable_programs": c.get("applicable_programs", []),
                "skills": c.get("skills", []),
                "common_gap_note": c.get("common_gap_note_vi", ""),
            }
            for c in courses
        ]

    def _match_projects_text(self, major_code: str, projects_text: str) -> dict[str, float]:
        """Match free-text projects/tools against canonical skills via alias + semantic token overlap."""
        if not projects_text or not projects_text.strip():
            return {}

        lower_text, ascii_text = _normalize_text(projects_text)
        input_tokens = _tokenize(projects_text)
        matched: dict[str, float] = {}

        for skill in self.skills_by_major.get(major_code, []):
            sid = skill["skill_id"]
            best_boost = 0.0

            # 1. Exact alias / canonical name phrase matching (highest confidence)
            candidates = list(skill.get("aliases", [])) + [skill.get("name_vi", ""), skill.get("name_en", "")]
            for alias in candidates:
                a_lower, a_ascii = _normalize_text(alias)
                if not a_lower:
                    continue
                if _contains_phrase(lower_text, a_lower) or _contains_phrase(ascii_text, a_ascii):
                    best_boost = max(best_boost, 0.45)
                    break

            # 2. Semantic token overlap matching for Vietnamese/English descriptive sentences
            if best_boost == 0.0 and input_tokens:
                skill_tokens = _tokenize(
                    " ".join([skill.get("name_vi", ""), skill.get("name_en", "")] + skill.get("aliases", []))
                )
                overlap = input_tokens & skill_tokens
                if len(overlap) >= 2:
                    ratio = len(overlap) / max(2, min(len(skill_tokens), 6))
                    if ratio >= 0.30:
                        best_boost = max(best_boost, min(0.38, 0.25 + ratio * 0.20))

            if best_boost > 0.0:
                matched[sid] = round(best_boost, 3)

        return matched

    def analyze(
        self,
        major_code: str,
        completed_courses: list[str],
        projects_text: str = "",
        program_code: str = "",
    ) -> dict[str, Any]:
        if major_code not in self.majors_by_code:
            raise KeyError(f"Unknown major_code: {major_code}")

        major = self.majors_by_code[major_code]
        prog_info = self.programs_by_code.get(program_code.strip().upper()) if program_code else None
        jds = self.jds_by_major.get(major_code, [])
        jd_count = len(jds)
        jd_stats = self.jd_stats_by_major.get(major_code, {})
        major_skills = self.skills_by_major.get(major_code, [])
        completed_set = {c.strip().upper() for c in completed_courses if c and c.strip()}

        # 1. Course-based coverage per skill (theory max 0.60, project-based course max 0.75)
        course_cov: dict[str, float] = {}
        for code in completed_set:
            course = self.courses_by_code.get(code)
            if not course or course["major_code"] != major_code:
                continue
            cap = 0.75 if course.get("has_project", False) else 0.60
            for sk in course.get("skills", []):
                sid = sk["skill_id"]
                contrib = min(cap, float(sk["weight"]))
                course_cov[sid] = max(course_cov.get(sid, 0.0), contrib)

        # 2. Free-text project/tools coverage boost
        project_cov = self._match_projects_text(major_code, projects_text)

        # 3. Combine Coverage(s) in [0, 1]
        combined_cov: dict[str, float] = {}
        detected_skills: list[dict[str, Any]] = []
        axes_by_id = {ax["axis_id"]: ax for ax in major["axes"]}

        for s in major_skills:
            sid = s["skill_id"]
            c_val = course_cov.get(sid, 0.0)
            p_val = project_cov.get(sid, 0.0)
            # If user demonstrates skill in project without formal course, give realistic practical credit
            if p_val > 0 and c_val == 0:
                total = min(0.85, p_val + 0.15)
            else:
                total = min(1.0, c_val + p_val)
            combined_cov[sid] = round(total, 3)

            if total > 0:
                src = "both" if (c_val > 0 and p_val > 0) else ("course" if c_val > 0 else "project")
                detected_skills.append(
                    {
                        "skill_id": sid,
                        "name": s["name_vi"],
                        "source": src,
                        "coverage": round(total, 2),
                        "axis_name": axes_by_id[s["axis_id"]]["short_label"],
                    }
                )

        detected_skills.sort(key=lambda x: (-x["coverage"], x["name"]))

        # 4. Compute Market Demand M_a, Student Score U_a, and Gap_a across 6 axes
        radar_data: list[dict[str, Any]] = []
        for ax in major["axes"]:
            ax_id = ax["axis_id"]
            ax_skills = [s for s in major_skills if s["axis_id"] == ax_id]

            # Proportion of JDs that mention at least one skill on this axis
            ax_skill_ids = {s["skill_id"] for s in ax_skills}
            jds_requiring_axis = sum(
                1
                for jd in jds
                if (set(jd.get("required_skills", [])) | set(jd.get("preferred_skills", []))) & ax_skill_ids
            )
            axis_jd_presence = jds_requiring_axis / max(1, jd_count)

            # Weighted skill frequencies on this axis
            skill_freqs = [
                (s, jd_stats.get(s["skill_id"], {}).get("weighted_freq", 0.05))
                for s in ax_skills
            ]
            skill_freqs.sort(key=lambda x: -x[1])
            top3_avg_freq = (
                sum(f for _, f in skill_freqs[:3]) / max(1, min(3, len(skill_freqs)))
            )

            # Market Demand M_a in [68, 92], strictly derived from the 50 JDs of this major
            market_demand = int(
                round(min(94, max(65, 58 + axis_jd_presence * 22 + top3_avg_freq * 28)))
            )

            # Student Score U_a weighted by JD skill demand w_{s,a}
            total_freq = sum(max(0.05, f) for _, f in skill_freqs)
            if total_freq > 0:
                weighted_student = sum(
                    (max(0.05, f) / total_freq) * combined_cov.get(s["skill_id"], 0.0)
                    for s, f in skill_freqs
                )
            else:
                weighted_student = 0.0
            student_score = int(round(min(100.0, weighted_student * 100.0)))
            gap = max(0, market_demand - student_score)

            radar_data.append(
                {
                    "axis_id": ax_id,
                    "axis_name": ax["name_vi"],
                    "short_name": ax["short_label"],
                    "student_score": student_score,
                    "market_demand": market_demand,
                    "gap": gap,
                    "top_jd_skills": [s["name_vi"] for s, _ in skill_freqs[:3]],
                }
            )

        overall_readiness = int(
            round(sum(r["student_score"] for r in radar_data) / max(1, len(radar_data)))
        )
        overall_market_avg = int(
            round(sum(r["market_demand"] for r in radar_data) / max(1, len(radar_data)))
        )
        overall_gap = max(0, overall_market_avg - overall_readiness)

        # 5. Rank top missing skills by (1 - Coverage(s)) * weighted_freq * 100
        missing_candidates: list[dict[str, Any]] = []
        for s in major_skills:
            sid = s["skill_id"]
            st = jd_stats.get(sid, {"required_count": 0, "preferred_count": 0, "weighted_freq": 0.0, "jd_frequency_pct": 0.0})
            cov = combined_cov.get(sid, 0.0)
            if cov >= 0.85 or st["jd_frequency_pct"] <= 0:
                continue
            priority = round((1.0 - cov) * st["weighted_freq"] * 100.0, 1)
            missing_candidates.append(
                {
                    "skill_id": sid,
                    "name": s["name_vi"],
                    "axis_id": s["axis_id"],
                    "axis_name": axes_by_id[s["axis_id"]]["short_label"],
                    "jd_frequency_pct": int(round(st["jd_frequency_pct"])),
                    "required_count": int(st["required_count"]),
                    "preferred_count": int(st["preferred_count"]),
                    "current_coverage": round(cov, 2),
                    "priority_score": priority,
                    "category": s.get("category", "core"),
                }
            )
        missing_candidates.sort(key=lambda x: (-x["priority_score"], -x["jd_frequency_pct"]))
        top_missing_skills = missing_candidates[:6]

        # 6. Build 4-part personalized Roadmap
        roadmap = self._build_roadmap(major_code, completed_set, radar_data, top_missing_skills, program_code=program_code)

        # 7. Executive summary insight in Vietnamese
        sorted_axes = sorted(radar_data, key=lambda r: -r["gap"])
        top_gap_ax = sorted_axes[0]
        strongest_ax = max(radar_data, key=lambda r: r["student_score"])
        display_name = (
            f"{prog_info['program_code']} – {prog_info['program_name']}"
            if prog_info
            else major["name_vi"]
        )
        benchmark_note = ""
        if prog_info and not prog_info.get("is_direct_track", True):
            benchmark_note = (
                f" Lưu ý: Đang đối chiếu theo bộ {jd_count} JD gần nhất thuộc nhóm {major['name_vi']}; "
                f"dữ liệu JD chuyên biệt cho ngành {prog_info['program_code']} sẽ được bổ sung ở giai đoạn mở rộng."
            )

        summary_insight = (
            f"Hồ sơ ngành {display_name} đạt {overall_readiness}/100 so với chuẩn {overall_market_avg}/100 "
            f"từ {jd_count} JD nhóm {major['name_vi']}. "
            f"Trục vững nhất là \"{strongest_ax['short_name']}\" ({strongest_ax['student_score']}/100); "
            f"trục cần ưu tiên bổ sung là \"{top_gap_ax['short_name']}\" (thiếu {top_gap_ax['gap']} điểm).{benchmark_note}"
        )

        return {
            "major_code": major_code,
            "major_name": display_name,
            "school_name": prog_info["school_name"] if prog_info else major.get("school_vi", ""),
            "program_code": prog_info["program_code"] if prog_info else "",
            "is_direct_track": prog_info.get("is_direct_track", True) if prog_info else True,
            "jd_count": jd_count,
            "overall_readiness": overall_readiness,
            "overall_market_avg": overall_market_avg,
            "overall_gap": overall_gap,
            "radar_data": radar_data,
            "detected_skills": detected_skills,
            "top_missing_skills": top_missing_skills,
            "roadmap": roadmap,
            "summary_insight": summary_insight,
        }

    def _build_roadmap(
        self,
        major_code: str,
        completed_set: set[str],
        radar_data: list[dict[str, Any]],
        top_missing_skills: list[dict[str, Any]],
        program_code: str = "",
    ) -> dict[str, list[dict[str, Any]]]:
        by_axis = self.recs_raw.get("by_axis", {})
        by_skill = self.recs_raw.get("by_skill", {})
        pcode = program_code.strip().upper()

        top_gap_axes = [r["axis_id"] for r in sorted(radar_data, key=lambda x: -x["gap"])[:3]]
        missing_skill_ids = {s["skill_id"] for s in top_missing_skills}

        # (a) Next-semester HUST courses (uncompleted, filtered by program_code)
        next_courses: list[dict[str, Any]] = []
        seen_courses: set[str] = set()

        def _course_matches_program(c: dict[str, Any]) -> bool:
            if not pcode or not c.get("applicable_programs"):
                return True
            return pcode in [p.upper() for p in c.get("applicable_programs", [])]

        def _add_course(code: str, reason: str, check_program: bool = True) -> None:
            if code in completed_set or code in seen_courses:
                return
            c = self.courses_by_code.get(code)
            if not c or c["major_code"] != major_code:
                return
            if check_program and not _course_matches_program(c):
                return
            seen_courses.add(code)
            matched_sk_names = [
                self.skills_by_id[sk["skill_id"]]["name_vi"]
                for sk in c.get("skills", [])
                if sk["skill_id"] in self.skills_by_id
            ][:3]
            next_courses.append(
                {
                    "course_code": c["course_code"].replace("_SME", ""),
                    "name": c["course_name_vi"],
                    "semester": c.get("recommended_year", 3) * 2 - (1 if c.get("course_type") == "core" else 0),
                    "type": c.get("course_type", "elective"),
                    "reason": reason,
                    "matched_skills": matched_sk_names,
                }
            )

        for ax_id in top_gap_axes:
            for item in by_axis.get(ax_id, {}).get("next_semester_electives", []):
                _add_course(item["course_code"], item["reason_vi"])

        for sk in top_missing_skills:
            rec_sk = by_skill.get(sk["skill_id"], {})
            for code in rec_sk.get("elective_codes", []):
                _add_course(code, f"Bổ sung trực tiếp kỹ năng đang thiếu: {sk['name']} ({sk['jd_frequency_pct']}% JD yêu cầu).")

        # Fallback: any uncompleted course in this program/major covering top missing skills
        if len(next_courses) < 3:
            for c in self.courses_by_major.get(major_code, []):
                if c["course_code"] in completed_set or c["course_code"] in seen_courses or not _course_matches_program(c):
                    continue
                overlap = [sk["skill_id"] for sk in c.get("skills", []) if sk["skill_id"] in missing_skill_ids]
                if overlap:
                    _add_course(c["course_code"], c.get("common_gap_note_vi") or "Bổ sung nền tảng cho các kỹ năng JD yêu cầu.")

        # (b) Matching HUST clubs (prioritize 4 partner clubs + relevant clubs)
        matching_clubs: list[dict[str, Any]] = []
        seen_clubs: set[str] = set()

        def _add_club(club_id: str, reason: str) -> None:
            if club_id in seen_clubs or club_id not in self.clubs_by_id:
                return
            seen_clubs.add(club_id)
            cl = self.clubs_by_id[club_id]
            matching_clubs.append(
                {
                    "club_name": cl["name_vi"],
                    "short_name": cl["short_name"],
                    "focus": cl["focus_vi"],
                    "activities": " · ".join(cl.get("activities_vi", [])[:2]),
                    "reason": reason,
                    "matched_skills": [
                        self.skills_by_id[sid]["name_vi"]
                        for sid in cl.get("target_skills", [])
                        if sid in self.skills_by_id and (sid in missing_skill_ids or self.skills_by_id[sid]["major_code"] == major_code)
                    ][:3],
                    "is_core_partner": bool(cl.get("is_partner_club", False)),
                }
            )

        for ax_id in top_gap_axes:
            for cl_rec in by_axis.get(ax_id, {}).get("clubs", []):
                _add_club(cl_rec["club_id"], cl_rec["reason_vi"])

        for sk in top_missing_skills:
            for cid in by_skill.get(sk["skill_id"], {}).get("club_ids", []):
                _add_club(cid, f"Phù hợp rèn luyện thực tế kỹ năng {sk['name']} qua workshop & dự án CLB.")

        # Ensure relevant HUST clubs for this major are surfaced
        for cid, cl in self.clubs_by_id.items():
            if len(matching_clubs) >= 4:
                break
            if major_code in cl.get("target_majors", []):
                _add_club(cid, "CLB học thuật tại HUST hỗ trợ rèn luyện kỹ năng thực hành theo ngành.")

        matching_clubs.sort(key=lambda c: c["club_name"])

        # (c) Courses & Certificates
        certs: list[dict[str, Any]] = []
        seen_certs: set[str] = set()
        for ax_id in top_gap_axes:
            for cert in by_axis.get(ax_id, {}).get("courses_and_certs", []):
                title = cert["title"]
                if title in seen_certs:
                    continue
                seen_certs.add(title)
                certs.append(
                    {
                        "title": title,
                        "provider": cert.get("provider", "Online"),
                        "level": cert.get("type", "Khóa học / Chứng chỉ"),
                        "duration": cert.get("duration", "3–6 tuần"),
                        "cost": cert.get("cost_note", "Miễn phí / Hỗ trợ SV"),
                        "url": cert.get("url", ""),
                        "reason": f"Thu hẹp khoảng cách trục kỹ năng trọng tâm bằng chứng chỉ/khóa học được doanh nghiệp công nhận.",
                        "matched_skills": [
                            self.skills_by_id[sid]["name_vi"]
                            for sid in cert.get("target_skills", [])
                            if sid in self.skills_by_id
                        ],
                    }
                )

        # (d) Project Ideas
        projects: list[dict[str, Any]] = []
        seen_proj: set[str] = set()
        for ax_id in top_gap_axes:
            for proj in by_axis.get(ax_id, {}).get("project_ideas", []):
                title = proj["title_vi"]
                if title in seen_proj:
                    continue
                seen_proj.add(title)
                projects.append(
                    {
                        "title": title,
                        "difficulty": proj.get("difficulty", "Trung bình"),
                        "duration": f"{proj.get('duration_weeks', 4)} tuần",
                        "description": proj.get("description_vi", ""),
                        "deliverables": proj.get("deliverables_vi", []),
                        "matched_skills": [
                            self.skills_by_id[sid]["name_vi"]
                            for sid in proj.get("target_skills", [])
                            if sid in self.skills_by_id
                        ],
                    }
                )

        return {
            "next_semester_courses": next_courses[:4],
            "matching_clubs": matching_clubs[:4],
            "courses_and_certs": certs[:4],
            "project_ideas": projects[:3],
        }

    def get_dashboard(self) -> dict[str, Any]:
        meta = self.dashboard_raw["metadata"]
        cohorts = self.dashboard_raw["cohorts"]

        majors_summary: list[dict[str, Any]] = []
        all_missing_skills: list[dict[str, Any]] = []

        for m in self.majors_raw["majors"]:
            code = m["major_code"]
            major_cohorts = [c for c in cohorts if c["major_code"] == code]
            all_cohort = next((c for c in major_cohorts if c["cohort_id"].endswith("_ALL")), major_cohorts[0])
            sub_cohorts = [c for c in major_cohorts if not c["cohort_id"].endswith("_ALL")]

            axes_short = {ax["axis_id"]: ax["short_label"] for ax in m["axes"]}
            axes_breakdown = [
                {
                    "axis_id": ag["axis_id"],
                    "axis_name": axes_short.get(ag["axis_id"], ag["axis_name_vi"]),
                    "avg_student": ag["avg_student_score"],
                    "market_demand": ag["market_score"],
                    "avg_gap": ag["avg_gap"],
                }
                for ag in all_cohort["axis_gaps"]
            ]
            top_gap = max(axes_breakdown, key=lambda x: x["avg_gap"])

            cohort_breakdown = [
                {
                    "cohort": sc["year_group"],
                    "n": sc["student_count"],
                    "gaps": [ag["avg_gap"] for ag in sc["axis_gaps"]],
                }
                for sc in sub_cohorts
                if sc["student_count"] >= meta.get("privacy_threshold_n", 20)
            ]
            # Include overall cohort row too
            cohort_breakdown.append(
                {
                    "cohort": "Toàn ngành (TB)",
                    "n": all_cohort["student_count"],
                    "gaps": [ag["avg_gap"] for ag in all_cohort["axis_gaps"]],
                }
            )

            majors_summary.append(
                {
                    "major_code": code,
                    "major_name": m["name_vi"],
                    "sample_size": all_cohort["student_count"],
                    "avg_readiness": round(all_cohort["avg_readiness_score"]),
                    "avg_market_demand": round(
                        sum(a["market_demand"] for a in axes_breakdown) / max(1, len(axes_breakdown))
                    ),
                    "top_gap_axis": top_gap["axis_name"],
                    "axes_breakdown": axes_breakdown,
                    "cohort_breakdown": cohort_breakdown,
                }
            )

            for sk in all_cohort.get("top_missing_skills", [])[:2]:
                all_missing_skills.append(
                    {
                        "skill_name": sk["skill_name_vi"],
                        "major_name": m["name_vi"],
                        "missing_rate_pct": sk["missing_rate_pct"],
                        "jd_demand_pct": sk["jd_demand_pct"],
                    }
                )

        all_missing_skills.sort(key=lambda x: -x["missing_rate_pct"])

        workshops = [
            {
                "workshop_id": w["workshop_id"],
                "title": w["title_vi"],
                "host_club": w["host_club_name"],
                "target_major": ", ".join(w.get("target_majors", [])),
                "target_cohort": "Năm 2 – Năm 4",
                "addressing_gap": w["triggered_by_gap_vi"],
                "expected_impact": w["expected_impact_vi"],
                "format": "Hands-on Workshop / Bootcamp",
            }
            for w in self.dashboard_raw.get("suggested_club_workshops", [])
        ]

        return {
            "privacy_notice": meta["anonymization_note_vi"],
            "privacy_threshold_n": meta.get("privacy_threshold_n", 20),
            "survey_period": meta.get("survey_period", ""),
            "total_students_analyzed": meta["total_students"],
            "total_jds_indexed": self.jds_raw.get("total_jds", len(self.jds_raw.get("jds", []))),
            "majors_summary": majors_summary,
            "top_missing_skills_overall": all_missing_skills[:6],
            "suggested_club_workshops": workshops,
        }
