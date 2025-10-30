# 우리회계 백엔드

## 빠른 시작

1. 의존성 설치

```bash
npm install
```

2. 데이터베이스 준비

- aws에 올려져있습니다(s3,rds)

3. 실행

```bash
npm run dev      # 개발(핫리로드)
npm run build && npm start  # 프로덕션
```

서버: http://localhost:3001
문서: http://localhost:3001/api-docs

## 엔드포인트 개요

- 인증: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`
- 그룹: `GET/POST /api/groups`, `POST /api/groups/:groupId/invitations`
- 초대: `POST /api/invitations/accept`
- 거래: `GET /api/transactions`, `/stats`, `/monthly`, `POST/PUT/DELETE /api/transactions`
- 회비: `GET /api/dues`, `PUT /api/dues`
- 리포트: `GET /api/reports/summary.pdf`, `GET /api/reports/summary.xlsx`
- 업로드: `GET /api/uploads/mode`, `POST /api/uploads/presign/put`, `POST /api/uploads/direct`, `GET /api/uploads/presign/get`

자세한 스펙은 Swagger `/api-docs` 참고
