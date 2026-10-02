import { and, count, desc, eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import type { Tx } from "../../db/types.js"
import { auditLogsTable as audit, usersTable } from "../../db/schema.js"

export interface AuditEntry {
    actorId: string
    action: string
    targetType: string
    targetId: string
    // Only the fields that changed, and only non-sensitive ones (never passwords or tokens).
    before?: Record<string, unknown>
    after?: Record<string, unknown>
}

// Call INSIDE the same transaction as the change: either both are saved or neither is.
export async function recordAudit(tx: Tx, entry: AuditEntry): Promise<void> {
    await tx.insert(audit).values({
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        before: entry.before ?? null,
        after: entry.after ?? null,
    })
}

export async function listAuditLogs(
    filters: { action?: string | undefined; targetType?: string | undefined; targetId?: string | undefined; actorId?: string | undefined },
    page: number,
    limit: number,
) {
    const where = and(
        filters.action ? eq(audit.action, filters.action) : undefined,
        filters.targetType ? eq(audit.targetType, filters.targetType) : undefined,
        filters.targetId ? eq(audit.targetId, filters.targetId) : undefined,
        filters.actorId ? eq(audit.actorId, filters.actorId) : undefined,
    )

    const [rows, [totalRow]] = await Promise.all([
        db
            .select({
                id: audit.id,
                action: audit.action,
                targetType: audit.targetType,
                targetId: audit.targetId,
                before: audit.before,
                after: audit.after,
                createdAt: audit.createdAt,
                actorId: audit.actorId,
                actorFirstName: usersTable.firstName,
                actorLastName: usersTable.lastName,
                actorEmail: usersTable.email,
            })
            .from(audit)
            .leftJoin(usersTable, eq(usersTable.id, audit.actorId))
            .where(where)
            .orderBy(desc(audit.createdAt), desc(audit.id))
            .limit(limit)
            .offset((page - 1) * limit),
        db.select({ total: count() }).from(audit).where(where),
    ])

    return {
        data: rows.map((row) => ({
            id: row.id,
            action: row.action,
            targetType: row.targetType,
            targetId: row.targetId,
            before: row.before,
            after: row.after,
            createdAt: row.createdAt.toISOString(),
            actor: row.actorId
                ? { id: row.actorId, name: `${row.actorFirstName ?? ""} ${row.actorLastName ?? ""}`.trim(), email: row.actorEmail }
                : null,
        })),
        page,
        limit,
        total: totalRow?.total ?? 0,
    }
}
