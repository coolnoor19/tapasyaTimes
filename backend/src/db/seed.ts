import "dotenv/config"
import { db } from "./index.js"
import { seatPricesTable, seatsTable, timeSlotsTable, usersTable } from "./schema.js"
import { hashPassword } from "../utils/hash.util.js"

// PLACEHOLDER DATA: the real operating hours, seat numbers/floors and prices
// must be confirmed with the workspace owner. Seed only inserts missing rows,
// so values edited later through the admin panel are never overwritten.

const TIME_SLOTS = [
    { startTime: "09:00", endTime: "10:00", displayName: "09:00 - 10:00" },
    { startTime: "10:00", endTime: "11:00", displayName: "10:00 - 11:00" },
    { startTime: "11:00", endTime: "12:00", displayName: "11:00 - 12:00" },
    { startTime: "12:00", endTime: "13:00", displayName: "12:00 - 13:00" },
    { startTime: "13:00", endTime: "14:00", displayName: "13:00 - 14:00" },
]

const SEATS = [
    { seatNumber: "A01", seatType: "EXECUTIVE", floor: 1 },
    { seatNumber: "A02", seatType: "EXECUTIVE", floor: 1 },
    { seatNumber: "A03", seatType: "EXECUTIVE", floor: 1 },
    { seatNumber: "B01", seatType: "PROFESSIONAL", floor: 1 },
    { seatNumber: "B02", seatType: "PROFESSIONAL", floor: 1 },
    { seatNumber: "B03", seatType: "PROFESSIONAL", floor: 1 },
    { seatNumber: "C01", seatType: "STUDY", floor: 1 },
    { seatNumber: "C02", seatType: "STUDY", floor: 1 },
    { seatNumber: "C03", seatType: "STUDY", floor: 1 },
] as const

// Hourly price in paise (15000 = Rs 150.00)
const SEAT_PRICES = [
    { seatType: "EXECUTIVE", pricePerHourPaise: 15000 },
    { seatType: "PROFESSIONAL", pricePerHourPaise: 10000 },
    { seatType: "STUDY", pricePerHourPaise: 6000 },
] as const

async function seedAdmin() {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE } = process.env

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_PHONE) {
        console.log("Admin: skipped (set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_PHONE in .env to create one)")
        return
    }
    if (ADMIN_PASSWORD.length < 8) {
        throw new Error("ADMIN_PASSWORD must be at least 8 characters")
    }

    const created = await db
        .insert(usersTable)
        .values({
            firstName: "Admin",
            lastName: "User",
            email: ADMIN_EMAIL.trim().toLowerCase(),
            phone: ADMIN_PHONE.trim(),
            passwordHash: await hashPassword(ADMIN_PASSWORD),
            role: "ADMIN",
            isVerified: true,
        })
        .onConflictDoNothing()
        .returning({ id: usersTable.id })

    console.log(created.length ? "Admin: created" : "Admin: already exists, left unchanged")
}

async function seed() {
    const slots = await db.insert(timeSlotsTable).values(TIME_SLOTS).onConflictDoNothing().returning({ id: timeSlotsTable.id })
    console.log(`Time slots: ${slots.length} added (${TIME_SLOTS.length - slots.length} already existed)`)

    const seats = await db.insert(seatsTable).values([...SEATS]).onConflictDoNothing().returning({ id: seatsTable.id })
    console.log(`Seats: ${seats.length} added (${SEATS.length - seats.length} already existed)`)

    const prices = await db.insert(seatPricesTable).values([...SEAT_PRICES]).onConflictDoNothing().returning({ seatType: seatPricesTable.seatType })
    console.log(`Seat prices: ${prices.length} added (${SEAT_PRICES.length - prices.length} already existed)`)

    await seedAdmin()
}

seed()
    .then(() => console.log("Seed complete"))
    .catch((err) => {
        console.error("Seed failed:", err)
        process.exitCode = 1
    })
    .finally(() => db.$client.end())
