import Joi, { ObjectSchema } from "joi";
import { Request, Response, NextFunction } from "express";

type SchemaDef = {
    body?: ObjectSchema;
    query?: ObjectSchema;
};

export function validate(schema: SchemaDef) {
    return (req: Request, res: Response, next: NextFunction) => {
        const target: { body?: unknown; query?: unknown } = {};
        if (schema.body) target.body = req.body;
        if (schema.query) target.query = req.query;
        const composed = Joi.object({
            body: schema.body || Joi.any().strip(),
            query: schema.query || Joi.any().strip(),
        });
        const { error, value } = composed.validate(target, {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
        });
        if (error) {
            try {
                console.warn("[validate] schema validation failed", {
                    method: req.method,
                    url: req.originalUrl,
                    details: error.details?.map((d) => d.message),
                });
            } catch { }
            return res.status(400).json({
                message: "유효성 검사 실패",
                details: error.details.map((d) => d.message),
            });
        }
        const v = value as { body?: unknown; query?: unknown };
        if (v.body !== undefined && req.body && typeof req.body === "object") {
            const current = req.body as Record<string, unknown>;
            const nextBody = v.body as Record<string, unknown>;
            for (const key of Object.keys(current)) {
                if (!(key in nextBody)) delete (current as Record<string, unknown>)[key];
            }
            Object.assign(current, nextBody);
        }
        if (v.query !== undefined && req.query && typeof req.query === "object") {
            const currentQ = req.query as Record<string, unknown>;
            const nextQ = v.query as Record<string, unknown>;
            for (const key of Object.keys(currentQ)) {
                if (!(key in nextQ)) delete (currentQ as Record<string, unknown>)[key];
            }
            Object.assign(currentQ, nextQ);
        }
        next();
    };
}

export const schemas = {
    transactions: {
        list: {
            query: Joi.object({
                groupId: Joi.number().integer().required(),
                limit: Joi.number().integer().min(1).max(200).default(50),
                page: Joi.number().integer().min(1).default(1),
            }),
        },
        create: {
            body: Joi.object({
                groupId: Joi.number().integer().required(),
                type: Joi.string().valid("income", "expense").required(),
                amount: Joi.number().min(1).required(),
                description: Joi.string().min(1).required(),
                date: Joi.alternatives()
                    .try(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/), Joi.string().isoDate())
                    .required(),
                receiptUrl: Joi.string().optional(),
            }),
        },
        update: {
            body: Joi.object({
                groupId: Joi.number().integer().required(),
                type: Joi.string().valid("income", "expense").optional(),
                amount: Joi.number().min(1).optional(),
                description: Joi.string().min(1).optional(),
                date: Joi.alternatives()
                    .try(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/), Joi.string().isoDate())
                    .optional(),
                receiptUrl: Joi.string().optional(),
            }),
        },
        delete: {
            query: Joi.object({ groupId: Joi.number().integer().required() }),
        },
    },
    uploads: {
        presignPut: {
            body: Joi.object({
                filename: Joi.string().min(1).required(),
                contentType: Joi.string().min(1).required(),
            }),
        },
        presignGet: {
            query: Joi.object({ key: Joi.string().min(1).required() }),
        },
    },
    dues: {
        list: { query: Joi.object({ groupId: Joi.number().integer().required() }) },
        update: {
            body: Joi.object({
                groupId: Joi.number().integer().required(),
                userId: Joi.number().integer().required(),
                isPaid: Joi.boolean().required(),
            }),
        },
    },
    invitations: {
        accept: { body: Joi.object({ code: Joi.string().min(4).required() }) },
    },
    groups: {
        create: { body: Joi.object({ name: Joi.string().min(1).required() }) },
    },
};
