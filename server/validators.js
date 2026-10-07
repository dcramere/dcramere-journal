import { z } from "zod";

const finite = z.number().finite();
const ms = z.number().int().min(0).max(4e12);

export const emailSchema = z.email().max(254);

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(80),
  consent: z.boolean().optional(),
  lang: z.enum(["nl", "en"]).optional(),
  setupToken: z.string().max(200).optional(),
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

export const accountSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  broker: z.string().max(40).default(""),
  type: z.enum(["LIVE", "PROP", "PAPER", "BACKTEST"]),
  startBalance: finite.min(0).max(1e10),
  riskMode: z.enum(["FIXED", "COMPOUNDING"]),
  riskUnit: z.enum(["%", "$"]),
  riskValue: finite.min(0).max(1e10),
  commission: finite.min(0).max(1e5).default(0),
  adjustments: z
    .array(
      z.object({
        id: z.string().max(64),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: finite,
        note: z.string().max(200).default(""),
      })
    )
    .max(500)
    .default([]),
});

export const tradeSchema = z.object({
  id: z.string().min(1).max(64),
  accountId: z.string().min(1).max(64),
  symbol: z.string().trim().min(1).max(30),
  direction: z.enum(["Long", "Short"]),
  qty: finite.positive().max(1e6),
  entryPrice: finite.nullish(),
  exitPrice: finite.nullish(),
  openedAt: ms,
  closedAt: ms,
  pnl: finite,
  fees: finite.default(0),
  r: finite.nullish(),
  setup: z.string().max(60).default(""),
  mood: z.string().max(30).default(""),
  lesson: z.string().max(2000).default(""),
  hasScreenshot: z.boolean().default(false),
  source: z.string().max(20).default("manual"),
  fills: z.number().int().min(0).max(100000).nullish(),
  positionSize: z.string().max(40).default(""),
});

export const settingsSchema = z.object({
  timezone: z.string().max(60).optional(),
  unit: z.enum(["$", "%", "R"]).optional(),
  period: z.string().max(20).optional(),
  accountId: z.string().max(64).optional(),
  lang: z.enum(["nl", "en"]).optional(),
  imports: z.array(z.looseObject({})).max(50).optional(),
});

export const bulkTradesSchema = z.object({ trades: z.array(tradeSchema).max(500) });

export const importSchema = z.object({
  accounts: z.array(accountSchema).max(50).optional(),
  trades: z.array(tradeSchema).max(500).optional(),
  settings: settingsSchema.optional(),
});

export const screenshotSchema = z.object({
  data: z
    .string()
    .max(700_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
});

export const statusSchema = z.object({ status: z.enum(["active", "disabled"]) });
