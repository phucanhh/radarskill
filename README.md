# SkillRadar

Ứng dụng web đối chiếu khoảng cách kỹ năng giữa học phần Đại học Bách khoa Hà Nội (HUST) và 150 tin tuyển dụng công khai thuộc 03 Trường trọng điểm: `SoICT` (CNTT&TT), `SEEE` (Điện - Điện tử) và `SME` (Cơ khí).

## Cấu trúc thư mục

```text
.
├── .github/workflows/deploy.yml   # Tự động kiểm tra dữ liệu và deploy GitHub Pages
├── .gitignore
├── backend/                       # FastAPI REST API (tùy chọn khi chạy có server Python)
│   ├── main.py
│   ├── scoring.py
│   └── requirements.txt
├── data/                          # Bộ dữ liệu JSON gốc (3 Trường, 18 ngành, 97 học phần, 150 JD)
│   ├── hust_catalog.json
│   ├── majors.json
│   ├── skill_taxonomy.json
│   ├── course_skill_matrix.json
│   ├── jds_dataset.json
│   ├── recommendations.json
│   ├── dashboard_cohort_sample.json
│   └── validate_data.py
└── frontend/                      # React + Vite + Tailwind CSS + Recharts
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
```

## Đẩy lên GitHub và Deploy GitHub Pages

Ứng dụng frontend tích hợp sẵn động cơ tính toán tĩnh (`src/data/staticEngine.js`) đọc trực tiếp bộ dữ liệu `data/*.json`, nên khi deploy lên GitHub Pages trang web vẫn chạy đầy đủ biểu đồ Radar, 97 học phần theo ngành, 150 JD và Dashboard ẩn danh mà không cần thuê server backend riêng.

1. Khởi tạo Git ngay trong thư mục dự án web này và đẩy lên GitHub:

```bash
git init -b main
git add .
git commit -m "Initial commit: SkillRadar HUST web demo"
git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git
git push -u origin main
```

2. Bật GitHub Pages trên repo vừa tạo:
   - Mở **Settings → Pages** trên GitHub.
   - Ở mục **Build and deployment → Source**, chọn **GitHub Actions**.
   - Workflow `.github/workflows/deploy.yml` sẽ tự động kiểm tra dữ liệu, build `frontend/dist` và phát hành trang web tại `https://<tai-khoan-cua-ban>.github.io/<ten-repo>/`.

## Chạy cục bộ (Local Development)

### Chạy giao diện độc lập (Static 150 JD)

```bash
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173/`.

### Chạy kèm FastAPI Backend (tùy chọn)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Nếu triển khai backend riêng (như Render/VPS) và muốn frontend gọi qua API đó, đặt biến môi trường `VITE_API_URL=https://<backend-domain>` khi build frontend.

## Kiểm tra dữ liệu và Build

```bash
python data/validate_data.py
cd frontend && npm run build
```
