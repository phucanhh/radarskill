#!/usr/bin/env python3
"""
Validation script for SkillRadar MVP JSON datasets in app/data/.
Verifies JSON syntax, schema completeness, counts, and 100% referential integrity.
"""

from pathlib import Path
import json
import sys


DATA_DIR = Path(__file__).resolve().parent


def load_json(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing required data file: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    errors: list[str] = []

    majors_data = load_json("majors.json")
    taxonomy_data = load_json("skill_taxonomy.json")
    courses_data = load_json("course_skill_matrix.json")
    jds_data = load_json("jds_dataset.json")
    recs_data = load_json("recommendations.json")
    dashboard_data = load_json("dashboard_cohort_sample.json")

    # 1. Validate majors & axes
    majors = majors_data.get("majors", [])
    expected_majors = {"IT", "SEEE", "SME"}
    major_codes = {m["major_code"] for m in majors}
    if major_codes != expected_majors:
        errors.append(f"Expected majors {expected_majors}, got {major_codes}")

    axes_by_id: dict[str, str] = {}
    for m in majors:
        mc = m["major_code"]
        axes = m.get("axes", [])
        if len(axes) != 6:
            errors.append(f"Major {mc} must have 6 axes, found {len(axes)}")
        for ax in axes:
            aid = ax["axis_id"]
            if aid in axes_by_id:
                errors.append(f"Duplicate axis_id: {aid}")
            axes_by_id[aid] = mc

    # 2. Validate skill taxonomy
    skills = taxonomy_data.get("skills", [])
    skills_by_id: dict[str, dict] = {}
    skills_per_major: dict[str, int] = {mc: 0 for mc in expected_majors}
    valid_categories = {"core", "tool", "soft", "language"}

    for sk in skills:
        sid = sk["skill_id"]
        mc = sk["major_code"]
        aid = sk["axis_id"]
        if sid in skills_by_id:
            errors.append(f"Duplicate skill_id: {sid}")
        skills_by_id[sid] = sk
        if mc not in expected_majors:
            errors.append(f"Skill {sid} has invalid major_code: {mc}")
        else:
            skills_per_major[mc] += 1
        if aid not in axes_by_id:
            errors.append(f"Skill {sid} references unknown axis_id: {aid}")
        elif axes_by_id[aid] != mc:
            errors.append(f"Skill {sid} major {mc} != axis {aid} major {axes_by_id[aid]}")
        if sk.get("category") not in valid_categories:
            errors.append(f"Skill {sid} has invalid category: {sk.get('category')}")
        if not sk.get("aliases"):
            errors.append(f"Skill {sid} has empty aliases")

    for mc, cnt in skills_per_major.items():
        if cnt < 30:
            errors.append(f"Major {mc} has only {cnt} skills (expected >= 30)")

    # 3. Validate course_skill_matrix & semester presets
    courses = courses_data.get("courses", [])
    courses_by_code: dict[str, dict] = {}
    courses_per_major: dict[str, int] = {mc: 0 for mc in expected_majors}

    for c in courses:
        code = c["course_code"]
        mc = c["major_code"]
        if code in courses_by_code:
            errors.append(f"Duplicate course_code: {code}")
        courses_by_code[code] = c
        if mc not in expected_majors:
            errors.append(f"Course {code} has invalid major_code: {mc}")
        else:
            courses_per_major[mc] += 1
        if c.get("course_type") not in {"core", "elective"}:
            errors.append(f"Course {code} has invalid course_type: {c.get('course_type')}")
        for s_item in c.get("skills", []):
            sid = s_item["skill_id"]
            w = s_item["weight"]
            if sid not in skills_by_id:
                errors.append(f"Course {code} references unknown skill_id: {sid}")
            elif skills_by_id[sid]["major_code"] != mc:
                errors.append(f"Course {code} ({mc}) references cross-major skill {sid}")
            if not (0.0 < float(w) <= 1.0):
                errors.append(f"Course {code} skill {sid} weight {w} out of (0, 1]")

    for m in majors:
        mc = m["major_code"]
        presets = m.get("semester_presets", [])
        if len(presets) < 4:
            errors.append(f"Major {mc} should have 4 semester presets, found {len(presets)}")
        for p in presets:
            for code in p.get("completed_courses", []):
                if code not in courses_by_code:
                    errors.append(f"Preset {p['preset_id']} references unknown course_code: {code}")
                elif courses_by_code[code]["major_code"] != mc:
                    errors.append(f"Preset {p['preset_id']} references cross-major course {code}")

    # 4. Validate jds_dataset.json (150 JDs, 50 per major)
    jds = jds_data.get("jds", [])
    if len(jds) != 150:
        errors.append(f"Expected 150 JDs, found {len(jds)}")
    jds_per_major: dict[str, int] = {mc: 0 for mc in expected_majors}
    seen_jd_ids: set[str] = set()

    for jd in jds:
        jid = jd["jd_id"]
        mc = jd["major_code"]
        if jid in seen_jd_ids:
            errors.append(f"Duplicate jd_id: {jid}")
        seen_jd_ids.add(jid)
        if mc not in expected_majors:
            errors.append(f"JD {jid} has invalid major_code: {mc}")
        else:
            jds_per_major[mc] += 1

        req = jd.get("required_skills", [])
        pref = jd.get("preferred_skills", [])
        if not req:
            errors.append(f"JD {jid} has no required_skills")
        if len(req) != len(set(req)):
            errors.append(f"JD {jid} has duplicate required_skills")
        if len(pref) != len(set(pref)):
            errors.append(f"JD {jid} has duplicate preferred_skills")
        overlap = set(req) & set(pref)
        if overlap:
            errors.append(f"JD {jid} has overlapping required & preferred skills: {overlap}")

        for sid in req + pref:
            if sid not in skills_by_id:
                errors.append(f"JD {jid} references unknown skill_id: {sid}")
            elif skills_by_id[sid]["major_code"] != mc:
                errors.append(f"JD {jid} ({mc}) references cross-major skill {sid}")

    for mc, cnt in jds_per_major.items():
        if cnt != 50:
            errors.append(f"Major {mc} has {cnt} JDs (expected 50)")

    # 5. Validate recommendations.json
    clubs = recs_data.get("clubs", [])
    clubs_by_id = {c["club_id"]: c for c in clubs}
    for c in clubs:
        for aid in c.get("target_axes", []):
            if aid not in axes_by_id:
                errors.append(f"Club {c['club_id']} references unknown axis_id: {aid}")
        for sid in c.get("target_skills", []):
            if sid not in skills_by_id:
                errors.append(f"Club {c['club_id']} references unknown skill_id: {sid}")

    by_axis = recs_data.get("by_axis", {})
    if set(by_axis.keys()) != set(axes_by_id.keys()):
        missing = set(axes_by_id.keys()) - set(by_axis.keys())
        extra = set(by_axis.keys()) - set(axes_by_id.keys())
        errors.append(f"recommendations.by_axis mismatch: missing={missing}, extra={extra}")

    for aid, rec in by_axis.items():
        mc = axes_by_id.get(aid)
        for el in rec.get("next_semester_electives", []):
            code = el["course_code"]
            if code not in courses_by_code:
                errors.append(f"by_axis[{aid}] references unknown course_code: {code}")
            elif courses_by_code[code]["major_code"] != mc:
                errors.append(f"by_axis[{aid}] references cross-major course {code}")
        for cl in rec.get("clubs", []):
            if cl["club_id"] not in clubs_by_id:
                errors.append(f"by_axis[{aid}] references unknown club_id: {cl['club_id']}")
        for cert in rec.get("courses_and_certs", []):
            for sid in cert.get("target_skills", []):
                if sid not in skills_by_id:
                    errors.append(f"by_axis[{aid}] cert references unknown skill_id: {sid}")
        for proj in rec.get("project_ideas", []):
            for sid in proj.get("target_skills", []):
                if sid not in skills_by_id:
                    errors.append(f"by_axis[{aid}] project references unknown skill_id: {sid}")

    for sid, srec in recs_data.get("by_skill", {}).items():
        if sid not in skills_by_id:
            errors.append(f"recommendations.by_skill has unknown skill_id: {sid}")
        for code in srec.get("elective_codes", []):
            if code not in courses_by_code:
                errors.append(f"by_skill[{sid}] references unknown course_code: {code}")
        for cid in srec.get("club_ids", []):
            if cid not in clubs_by_id:
                errors.append(f"by_skill[{sid}] references unknown club_id: {cid}")

    # 6. Validate dashboard_cohort_sample.json
    threshold = dashboard_data.get("metadata", {}).get("privacy_threshold_n", 20)
    for coh in dashboard_data.get("cohorts", []):
        cid = coh["cohort_id"]
        mc = coh["major_code"]
        if coh.get("student_count", 0) < threshold:
            errors.append(f"Cohort {cid} violates privacy threshold n >= {threshold}")
        if len(coh.get("axis_gaps", [])) != 6:
            errors.append(f"Cohort {cid} must have 6 axis_gaps")
        for ag in coh.get("axis_gaps", []):
            if ag["axis_id"] not in axes_by_id or axes_by_id[ag["axis_id"]] != mc:
                errors.append(f"Cohort {cid} has invalid axis_id: {ag['axis_id']}")
        for ms in coh.get("top_missing_skills", []):
            sid = ms["skill_id"]
            if sid not in skills_by_id or skills_by_id[sid]["major_code"] != mc:
                errors.append(f"Cohort {cid} has invalid top_missing_skill: {sid}")

    for ws in dashboard_data.get("suggested_club_workshops", []):
        if ws["host_club_id"] not in clubs_by_id:
            errors.append(f"Workshop {ws['workshop_id']} references unknown host_club_id: {ws['host_club_id']}")

    if errors:
        print(f"VALIDATION FAILED with {len(errors)} error(s):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("VALIDATION PASSED 100%!")
    print(f"  Majors: {len(majors)} ({', '.join(sorted(major_codes))})")
    print(f"  Axes: {len(axes_by_id)} (6 per major)")
    print(f"  Skills: {len(skills_by_id)} ({skills_per_major})")
    print(f"  Courses: {len(courses_by_code)} ({courses_per_major})")
    print(f"  JDs: {len(jds)} ({jds_per_major})")
    print(f"  Clubs: {len(clubs_by_id)}, Cohorts: {len(dashboard_data.get('cohorts', []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
