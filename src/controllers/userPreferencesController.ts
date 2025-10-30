import { Request, Response, NextFunction } from "express";
import { getUserPreferences, upsertUserPreferences } from "../models/userPreferenceModel.js";

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const prefs = await getUserPreferences(req.user!.id);
    res.json({ preferences: prefs });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { receive_dues_reminders } = req.body as { receive_dues_reminders?: boolean };
    const updated = await upsertUserPreferences(req.user!.id, { receive_dues_reminders });
    res.json({ preferences: updated });
  } catch (err) {
    next(err);
  }
}


