import { handle } from "./handle.js"
import { listAuditLogs } from "../services/admin/audit.service.js"
import { setSeatPrice, listSeatPrices } from "../services/admin/prices.service.js"
import { createSeat, listSeats, updateSeat } from "../services/admin/seats.service.js"
import { createTimeSlot, listTimeSlots, updateTimeSlot } from "../services/admin/timeSlots.service.js"
import { getUser, listUsers, setUserRole, setUserStatus } from "../services/admin/users.service.js"

// ---- Seats ----
export const listSeatsHandler = handle(async ({ query }) => ({
    body: await listSeats(query as Parameters<typeof listSeats>[0]),
}))
export const createSeatHandler = handle(async ({ actorId, body }) => ({
    status: 201,
    body: await createSeat(actorId, body as Parameters<typeof createSeat>[1]),
}))
export const updateSeatHandler = handle(async ({ actorId, params, body }) => ({
    body: await updateSeat(actorId, params.id!, body as Parameters<typeof updateSeat>[2]),
}))

// ---- Time slots ----
export const listTimeSlotsHandler = handle(async () => ({ body: await listTimeSlots() }))
export const createTimeSlotHandler = handle(async ({ actorId, body }) => ({
    status: 201,
    body: await createTimeSlot(actorId, body as Parameters<typeof createTimeSlot>[1]),
}))
export const updateTimeSlotHandler = handle(async ({ actorId, params, body }) => ({
    body: await updateTimeSlot(actorId, params.id!, body as Parameters<typeof updateTimeSlot>[2]),
}))

// ---- Prices ----
export const listPricesHandler = handle(async () => ({ body: await listSeatPrices() }))
export const setPriceHandler = handle(async ({ actorId, params, body }) => ({
    body: await setSeatPrice(
        actorId,
        params.seatType as Parameters<typeof setSeatPrice>[1],
        (body as { pricePerHourPaise: number }).pricePerHourPaise,
    ),
}))

// ---- Users ----
export const listUsersHandler = handle(async ({ query }) => {
    const { page, limit, ...filters } = query as { page: number; limit: number } & Parameters<typeof listUsers>[0]
    return { body: await listUsers(filters, page, limit) }
})
export const getUserHandler = handle(async ({ params }) => ({ body: await getUser(params.id!) }))
export const setUserStatusHandler = handle(async ({ actorId, params, body }) => ({
    body: await setUserStatus(actorId, params.id!, (body as { status: "ACTIVE" | "SUSPENDED" }).status),
}))
export const setUserRoleHandler = handle(async ({ actorId, params, body }) => ({
    body: await setUserRole(actorId, params.id!, (body as { role: "USER" | "MANAGER" }).role),
}))

// ---- Audit log ----
export const listAuditLogsHandler = handle(async ({ query }) => {
    const { page, limit, ...filters } = query as { page: number; limit: number } & Parameters<typeof listAuditLogs>[0]
    return { body: await listAuditLogs(filters, page, limit) }
})
