import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import pool from "./config/database.js";
import { initUserModel } from "./models/userModel.js";
import { initGroupModel } from "./models/groupModel.js";
import {
  initInvitationModel,
  deleteExpiredInvitations,
} from "./models/invitationModel.js";
import { initTransactionModel } from "./models/transactionModel.js";
import { initUserPreferenceModel } from "./models/userPreferenceModel.js";
import {
  initNotificationLogModel,
  insertNotificationLog,
} from "./models/notificationLogModel.js";
import { sendDuesReminder } from "./services/notificationService.js";
import cron from "node-cron";
import swaggerUi from "swagger-ui-express";
import openapi from "./openapi.json" with { type: "json" };
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { validateEnv, awsConfigStatus } from "./utils/env.js";
import { initDuesModel } from "./models/duesModel.js";
import { LOCAL_UPLOAD_DIR } from "./config/storageConfig.js";

// 환경 변수 로드
dotenv.config();

const app = express();
const PORT: number = process.env.PORT ? Number(process.env.PORT) : 3001;
const HOST = process.env.HOST || '0.0.0.0';

// 미들웨어 설정
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const corsAllowAll = String(process.env.CORS_ALLOW_ALL || "false").toLowerCase() === "true";

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }))
  ;
app.use(
  cors({
    origin: corsAllowAll ? true : corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-requested-with"],
  })
);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi as unknown as Record<string, unknown>));

//hsts 비활성화
app.use(helmet({ hsts: false }));

// 로컬 파일 정적 서빙 (S3 미사용 개발 환경용)
app.use("/files", express.static(LOCAL_UPLOAD_DIR));

// API 라우트 마운트
app.use("/api", router);
// Swagger UI


// 기본 루트 및 헬스체크
app.get("/", (_req, res) => {
  res.json({ message: "우리회계 API 서버", version: "1.0.0", status: "running" });
});
app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});
// 에러 핸들러
app.use(errorHandler);

// 서버 시작 전 모델 초기화
async function start(): Promise<void> {
  try {
    validateEnv();
    await pool.connect().then((c) => c.release());
    await initUserModel();
    await initGroupModel();
    await initInvitationModel();
    await initTransactionModel();
    await initDuesModel();
    await initUserPreferenceModel();
    await initNotificationLogModel();
    app.listen(PORT, HOST, () => {
      console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`);
      const aws = awsConfigStatus();
      if (!aws.enabled) {
        console.warn("[경고] AWS 설정이 없어 업로드 프리사인 기능이 제한될 수 있습니다.");
      }
    });
    // 매시간 만료된 초대 삭제
    cron.schedule("0 * * * *", async () => {
      try {
        await deleteExpiredInvitations();
      } catch (e) {
        console.error("초대 만료 정리 실패", e);
      }
    });
    // 매일 오전 9시 미납자 알림 (Asia/Seoul)
    cron.schedule(
      "0 9 * * *",
      async () => {
        try {
          const { rows } = await pool.query<{
            group_id: number;
            group_name: string;
            user_id: number;
            user_name: string;
            email: string;
            unpaid_count: string | number;
            receive_dues_reminders?: boolean | null;
          }>(
            `SELECT ug.group_id, g.name AS group_name, u.id AS user_id, u.name AS user_name, u.email,
                    COUNT(*) FILTER (WHERE d.is_paid = false OR d.is_paid IS NULL) AS unpaid_count,
                    up.receive_dues_reminders
             FROM user_groups ug
             JOIN users u ON u.id = ug.user_id
             JOIN groups g ON g.id = ug.group_id
             LEFT JOIN dues d ON d.group_id = ug.group_id AND d.user_id = ug.user_id
             LEFT JOIN user_preferences up ON up.user_id = u.id
             GROUP BY ug.group_id, g.name, u.id, u.name, u.email, up.receive_dues_reminders`
          );
          for (const r of rows) {
            const allow = r.receive_dues_reminders !== false; // default true
            if (allow && Number(r.unpaid_count) > 0) {
              await sendDuesReminder({
                toEmail: r.email,
                userName: r.user_name,
                groupName: r.group_name,
                unpaidCount: Number(r.unpaid_count),
              });
              await insertNotificationLog({
                userId: r.user_id,
                groupId: r.group_id,
                type: "dues_reminder",
                message: `${r.group_name}: 미납 ${r.unpaid_count}건 안내 발송`,
              });
            }
          }
        } catch (e) {
          console.error("미납자 알림 작업 실패", e);
        }
      },
      { timezone: "Asia/Seoul" }
    );
  } catch (err) {
    console.error("서버 시작 실패:", err);
    process.exit(1);
  }
}

start();

export default app;
