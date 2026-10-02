// Drizzle puts the SQL parameters (emails, password hashes, OTP hashes) in the
// wrapper error's message and stack. The underlying driver error (`cause`) does not.
// Use this whenever an error is logged.
export function toSafeError(err: unknown) {
    const source = err instanceof Error && err.cause instanceof Error ? err.cause : err
    if (!(source instanceof Error)) return { message: "Non-error value thrown" }
    const { code } = source as { code?: unknown }
    return { name: source.name, message: source.message, code, stack: source.stack }
}
