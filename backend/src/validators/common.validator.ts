import { z } from "zod"

export const idParamSchema = z.object({
    id: z.uuid("must be a valid id"),
})

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1, "must be at least 1").default(1),
    limit: z.coerce.number().int().min(1, "must be at least 1").max(50, "must be at most 50").default(20),
})
