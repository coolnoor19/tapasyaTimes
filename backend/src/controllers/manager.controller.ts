import { handle } from "./handle.js"
import { getBoard } from "../services/manager/board.service.js"
import { getOccupancy } from "../services/manager/occupancy.service.js"
import { getBookingForStaff, getCustomer, searchBookings, searchCustomers } from "../services/manager/lookup.service.js"

// Read-only: nothing in this file changes data.

export const boardHandler = handle(async ({ query }) => ({
    body: await getBoard((query as { date?: string }).date),
}))

export const occupancyHandler = handle(async ({ query }) => ({
    body: await getOccupancy(query as Parameters<typeof getOccupancy>[0]),
}))

export const searchBookingsHandler = handle(async ({ query }) => {
    const { page, limit, ...filters } = query as unknown as { page: number; limit: number } & Parameters<typeof searchBookings>[0]
    return { body: await searchBookings(filters, page, limit) }
})

export const getBookingHandler = handle(async ({ params }) => ({ body: await getBookingForStaff(params.id!) }))

export const searchCustomersHandler = handle(async ({ query }) => {
    const { page, limit, ...filters } = query as { page: number; limit: number } & Parameters<typeof searchCustomers>[0]
    return { body: await searchCustomers(filters, page, limit) }
})

export const getCustomerHandler = handle(async ({ params }) => ({ body: await getCustomer(params.id!) }))
