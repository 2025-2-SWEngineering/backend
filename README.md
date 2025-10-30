# 우리회계 백엔드

소규모 조직 회계 관리 서비스의 REST API 서버입니다.

## 기술 스택

- Node.js ≥ 20 (ESM)
- Express 4.x
- PostgreSQL 17 (pg Pool)
- JWT 인증, CORS, Helmet, Rate Limit, Joi
- AWS S3(영수증 저장, Presigned URL), Swagger(OpenAPI)

## 실행 방법

1. .env 설정

```bash
cp .env.example .env
```

필수 변수(예시):

```env
# 서버
PORT=3001
NODE_ENV=development

# 데이터베이스 (옵션 중 택1에 맞춰 설정)
DB_HOST=localhost
DB_PORT=5433   # Docker 사용 시 5433, 로컬(Postgres 앱/브루) 사용 시 5432
DB_NAME=woori_accounting
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# AWS (선택: 미설정 시 업로드 Presign 기능 제한)
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET_NAME=woori-accounting-receipts
```

2. 의존성 설치

```bash
npm install
```

3. DB 준비 (둘 중 하나)

- Docker 사용(권장):

  - `docker run -d --name woori-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=woori_accounting -p 5433:5432 postgres:17-alpine`
  - .env 의 `DB_PORT=5433` 로 설정

- 로컬 Postgres 사용(Homebrew 등):
  - `brew services start postgresql@17`
  - `createdb woori_accounting`
  - .env 의 `DB_PORT=5432` 로 설정

4. 개발 서버 실행

```bash
npm run dev
# 또는
npm start
```

서버: http://localhost:3001
API 문서: http://localhost:3001/api-docs

## 데이터베이스/마이그레이션

- 서버 부팅 시 각 모델(`users`, `groups`, `user_groups`, `invitations`, `transactions`, `dues`, `user_preferences`, `notification_logs`) 테이블을 자동 생성합니다.
- 주요 인덱스가 포함되어 있으며 성능을 고려해 `transactions`에 `group_id`, `date`, `created_by` 인덱스를 추가했습니다.

## 보안/검증

- JWT 인증 미들웨어로 보호
- Helmet, CORS, express-rate-limit 적용
- Joi 스키마로 요청 본문/쿼리/파라미터 검증

## 업로드(영수증) 정책

- 직접 업로드 대신 S3 Presigned URL을 사용합니다.
- 허용 MIME: `image/jpeg`, `image/png`, `application/pdf`
- 다운로드 Presign 시 트랜잭션-그룹 범위 검증으로 접근 통제

## 주요 엔드포인트 개요

- 인증: `POST /api/auth/register`, `POST /api/auth/login`
- 그룹: `GET/POST /api/groups`, 초대코드 생성 `POST /api/groups/:groupId/invitations`
- 초대: `POST /api/invitations/accept`
- 거래: `GET /api/transactions`, `GET /api/transactions/stats`, `GET /api/transactions/monthly`, `POST/PUT/DELETE /api/transactions`
- 회비: `GET /api/dues`, `PUT /api/dues`
- 리포트: `GET /api/reports/summary.pdf`, `GET /api/reports/summary.xlsx`
- 업로드: `POST /api/uploads/presign/put`, `GET /api/uploads/presign/get`

자세한 스펙은 Swagger에서 확인하세요: `/api-docs`

## 스크립트

- `npm run dev`: nodemon 개발 실행
- `npm start`: 프로덕션 실행

## 트러블슈팅

- 데이터베이스가 없다는 오류(3D000):
  - Docker 사용 시 컨테이너 기동 및 .env의 `DB_PORT=5433` 확인
  - 로컬 사용 시 `createdb woori_accounting` 후 재시작
- CORS 오류: `.env`의 `CORS_ORIGIN`(있다면) 또는 프런트 도메인 확인

## 라이선스/팀

MIT / 개발만하고싶어 팀 (강재민, 안재관, 김훈민, Ntwali Herve, 전성민)
