import { z } from "zod/v4"

/** Activity type for tax calculations. */
export const ActivityTypeSchema = z.enum(["services", "sales", "mixed"])

/** Tax regime for French freelancers. */
export const TaxRegimeSchema = z.enum(["micro", "reel"])

/** Export format. */
export const ExportFormatSchema = z.enum(["csv", "json"])

/** Validates query parameters for the tax report endpoint. */
export const taxReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  regime: TaxRegimeSchema.default("micro"),
  activityType: ActivityTypeSchema.default("services"),
  format: ExportFormatSchema.default("json"),
})

export type TaxReportQuery = z.infer<typeof taxReportQuerySchema>
export type ActivityType = z.infer<typeof ActivityTypeSchema>
export type TaxRegime = z.infer<typeof TaxRegimeSchema>
export type ExportFormat = z.infer<typeof ExportFormatSchema>
