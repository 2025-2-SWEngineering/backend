import OpenAI from "openai";

export type OcrResult = {
    amount?: number;
    date?: string; // ISO string (Asia/Seoul assumed if ambiguous)
    merchant?: string;
    description?: string;
    categorySuggestion?: string;
    currency?: string; // e.g., KRW, USD
};

function buildDataUrl(buffer: Buffer, mimeType: string): string {
    const b64 = buffer.toString("base64");
    return `data:${mimeType};base64,${b64}`;
}

export async function extractReceiptFieldsFromImage({
    buffer,
    mimeType,
}: {
    buffer: Buffer;
    mimeType: string;
}): Promise<OcrResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const err = new Error("OPENAI_API_KEY is not configured") as Error & { status: number };
        err.status = 503;
        throw err;
    }

    const client = new OpenAI({ apiKey });
    const imageUrl = buildDataUrl(buffer, mimeType);

    const system = [
        "You are a precise OCR and information extraction assistant for Korean receipts.",
        "Extract key fields and return strict JSON matching the schema.",
    ].join(" ");

    const instruction = [
        "이미지에 포함된 영수증/계산서 정보를 JSON으로 추출하세요.",
        "다음 스키마를 반드시 따르세요.",
        "{",
        "  \"amount\": number | null,            // 총 결제 금액 (쉼표 제거, 숫자만)",
        "  \"date\": string | null,              // ISO8601 (가능하면 Asia/Seoul 기준 yyyy-mm-ddThh:mm:ss.sssZ)",
        "  \"merchant\": string | null,          // 상호명",
        "  \"description\": string | null,       // 한줄짜리 간략 설명 (예: 품목명 요약)",
        "  \"categorySuggestion\": string | null,// 카테고리 제안 (예: 식비, 교통, 사무용품 등)",
        "  \"currency\": string | null           // 통화코드 (예: KRW)",
        "}",
        "규칙:",
        "- amount는 숫자만(소수점 허용), 통화 기호/쉼표 제거.",
        "- date는 가능한 한 정확한 시각 포함 ISO로 표기. 시각이 없으면 날짜만 ISO 날짜 형태 사용.",
        "- categorySuggestion은 한국 소규모 조직 지출 카테고리로 간결하게 한 단어 권장.",
        "- 반환은 JSON 단일 객체만, 추가 텍스트 금지.",
    ].join("\n");

    const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
            { role: "system", content: system },
            {
                role: "user",
                content: [
                    { type: "text", text: instruction },
                    { type: "image_url", image_url: { url: imageUrl } },
                ],
            },
        ],
        temperature: 0,
    });

    const content = resp.choices?.[0]?.message?.content || "{}";
    let parsed: OcrResult = {};
    try {
        parsed = JSON.parse(content) as OcrResult;
    } catch {
        parsed = {};
    }
    if (parsed && typeof parsed.amount === "string") {
        const normalized = String(parsed.amount).replace(/[^0-9.\-]/g, "");
        const num = Number(normalized);
        parsed.amount = Number.isFinite(num) ? num : undefined;
    }
    // date는 그대로 두되, 문자열 아닌 경우 제거
    if (parsed && parsed.date && typeof parsed.date !== "string") {
        delete (parsed as Record<string, unknown>)["date"];
    }
    return parsed;
}

