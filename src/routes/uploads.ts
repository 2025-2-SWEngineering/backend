import express, { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import * as uploads from "../controllers/uploadsController.js";

const router = express.Router();

const upload = uploads.upload;

router.use(authenticateToken);

// 현재 저장 모드 조회
router.get("/mode", uploads.mode);

// Presign: PUT (upload)
router.post("/presign/put", validate(schemas.uploads.presignPut), uploads.presignPut);

// Local direct upload (for development without S3)
router.post("/direct", upload.single("file"), uploads.direct);

// Presign: GET (download)
router.get("/presign/get", uploads.presignGet);

export default router;
