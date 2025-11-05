import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { extractReceiptFieldsFromImage } from "../services/ocrService.js";

export const ocrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export async function parseReceipt(req: Request, res: Response, next: NextFunction) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(503).json({ message: "OCR 서비스가 구성되지 않았습니다. OPENAI_API_KEY를 설정하세요." });
        }
        const file = (req as unknown as { file?: Express.Multer.File }).file;
        if (!file) {
            return res.status(400).json({ message: "파일이 필요합니다." });
        }
        const mime = file.mimetype || "";
        let result;
        if (/^image\//i.test(mime) || /^application\/(pdf|x-pdf|acrobat)$/i.test(mime)) {
            result = await extractReceiptFieldsFromImage({ buffer: file.buffer, mimeType: mime });
        } else {
            return res.status(415).json({ message: "지원하지 않는 파일 형식입니다. 이미지 또는 PDF를 업로드하세요." });
        }
        return res.json({ result });
    } catch (err) {
        next(err);
    }
}


