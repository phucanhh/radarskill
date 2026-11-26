from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scoring import SkillRadarEngine

app = FastAPI(
    title="SkillRadar HUST API",
    description="API phân tích khoảng cách kỹ năng (Skill Gap) giữa CTĐT HUST và 150 JD Intern/Fresher công khai.",
    version="1.0.0",
)

# Enable CORS for local Vite dev server and preview builds
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SkillRadarEngine()


class AnalyzeRequest(BaseModel):
    major_code: str = Field(description="Mã nhóm phân tích: IT, LOGISTICS, hoặc EE_ME")
    program_code: str = Field(
        default="",
        description="Mã ngành cụ thể tại HUST (VD: IT-E6, EE2, EM-E14, CH1...)",
    )
    completed_courses: list[str] = Field(
        default_factory=list,
        description="Danh sách mã học phần HUST sinh viên đã hoàn thành",
    )
    projects_text: str = Field(
        default="",
        description="Mô tả tự do các dự án cá nhân, công cụ, chứng chỉ ngoại ngữ đã dùng",
    )


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "SkillRadar HUST Backend",
        "total_jds": engine.jds_raw.get("total_jds", 0),
        "majors": list(engine.majors_by_code.keys()),
    }


@app.get("/api/hust-catalog")
def get_hust_catalog():
    return {"schools": engine.list_hust_catalog()}


@app.get("/api/majors")
def get_majors():
    return {"majors": engine.list_majors()}


@app.get("/api/majors/{major_code}/courses")
def get_major_courses(major_code: str, program_code: str = ""):
    code = major_code.upper()
    try:
        courses = engine.list_courses(code, program_code=program_code)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ngành '{major_code}'")
    return {"major_code": code, "program_code": program_code.upper(), "courses": courses}


@app.post("/api/analyze")
def analyze_profile(payload: AnalyzeRequest):
    code = payload.major_code.upper()
    try:
        return engine.analyze(
            major_code=code,
            completed_courses=payload.completed_courses,
            projects_text=payload.projects_text,
            program_code=payload.program_code,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ngành '{payload.major_code}'")


@app.get("/api/dashboard")
def get_dashboard():
    return engine.get_dashboard()
