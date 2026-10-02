import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import request from "supertest"
import { eq } from "drizzle-orm"
import { db } from "../../src/db/index.js"
import { usersTable } from "../../src/db/schema.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { clearOutbox, extractCode, failNextMail, mailsTo, waitForMail } from "../helpers/mailbox.js"

vi.mock("../../src/mail/mailer.js", () => import("../helpers/mailbox.js"))

const { createApp } = await import("../../src/app.js")
const app = createApp()

const validBody = {
    firstName: "Noor",
    lastName: "Alam",
    email: "noor@example.com",
    phone: "9876543210",
    password: "password123",
}

describe.skipIf(!hasTestDb)("POST /api/v1/auth/register", () => {
    beforeEach(async () => {
        await resetDb()
        clearOutbox()
    })
    afterAll(closeDb)

    it("creates the user and returns only public fields", async () => {
        const res = await request(app).post("/api/v1/auth/register").send(validBody)

        expect(res.status).toBe(201)
        expect(res.body).toEqual({
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            firstName: "Noor",
            lastName: "Alam",
            email: "noor@example.com",
        })
        expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i)
    })

    it("stores a bcrypt hash (never the password) with safe defaults", async () => {
        await request(app).post("/api/v1/auth/register").send(validBody)

        const [user] = await db.select().from(usersTable).where(eq(usersTable.email, "noor@example.com"))
        expect(user!.passwordHash).toMatch(/^\$2[aby]\$/)
        expect(user!.passwordHash).not.toContain("password123")
        expect(user).toMatchObject({ role: "USER", status: "ACTIVE", isVerified: false })
    })

    it("lowercases the email", async () => {
        const res = await request(app)
            .post("/api/v1/auth/register")
            .send({ ...validBody, email: "  Noor@EXAMPLE.com " })
        expect(res.status).toBe(201)
        expect(res.body.email).toBe("noor@example.com")
    })

    it("cannot be used to create an admin by sending a role", async () => {
        const res = await request(app)
            .post("/api/v1/auth/register")
            .send({ ...validBody, role: "ADMIN", isVerified: true })
        expect(res.status).toBe(201)

        const [user] = await db.select().from(usersTable)
        expect(user!.role).toBe("USER")
        expect(user!.isVerified).toBe(false)
    })

    it("rejects a duplicate email (case-insensitive) with 409", async () => {
        await request(app).post("/api/v1/auth/register").send(validBody)
        const res = await request(app)
            .post("/api/v1/auth/register")
            .send({ ...validBody, email: "NOOR@example.com", phone: "9000000001" })

        expect(res.status).toBe(409)
        expect(res.body.message).toBe("Email is already registered")
    })

    it("rejects a duplicate phone with 409", async () => {
        await request(app).post("/api/v1/auth/register").send(validBody)
        const res = await request(app)
            .post("/api/v1/auth/register")
            .send({ ...validBody, email: "other@example.com" })

        expect(res.status).toBe(409)
        expect(res.body.message).toBe("Phone number is already registered")
    })

    it("lets exactly one of 5 simultaneous identical registrations win", async () => {
        const responses = await Promise.all(
            Array.from({ length: 5 }, () => request(app).post("/api/v1/auth/register").send(validBody)),
        )

        expect(responses.filter((r) => r.status === 201)).toHaveLength(1)
        expect(responses.filter((r) => r.status === 409)).toHaveLength(4)
        expect(await db.select().from(usersTable)).toHaveLength(1)
    })

    it("names the invalid field in a 400 response", async () => {
        const res = await request(app).post("/api/v1/auth/register").send({ ...validBody, phone: "abc" })
        expect(res.status).toBe(400)
        expect(res.body.message).toContain("phone")
        expect(await db.select().from(usersTable)).toHaveLength(0)
    })

    it("returns 400 for a body with no fields", async () => {
        const res = await request(app).post("/api/v1/auth/register").send({})
        expect(res.status).toBe(400)
    })

    it("sends a verification email with a 6-digit code to the lowercased address", async () => {
        await request(app).post("/api/v1/auth/register").send({ ...validBody, email: "Noor@Example.com" })

        const mail = await waitForMail("noor@example.com")
        expect(extractCode(mail)).toMatch(/^\d{6}$/)
        expect(mail.subject).not.toMatch(/\d{6}/)
    })

    it("still succeeds when the email cannot be sent (user can request a new code)", async () => {
        failNextMail()
        const res = await request(app).post("/api/v1/auth/register").send(validBody)

        expect(res.status).toBe(201)
        expect(mailsTo("noor@example.com")).toHaveLength(0)
    })

    it("does not send any email when registration fails", async () => {
        await request(app).post("/api/v1/auth/register").send({ ...validBody, phone: "bad" })
        expect(mailsTo("noor@example.com")).toHaveLength(0)
    })
})
