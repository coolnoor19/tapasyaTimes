import { randomInt } from "node:crypto"

// Crockford base32 without I, L, O, U: no look-alike characters when read out over the phone.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const CODE_LENGTH = 8

// e.g. "TT-K7M2QX4P". Random (not sequential) so codes cannot be guessed or
// used to estimate how many bookings exist. 32^8 is about 1.1 trillion combinations;
// the unique constraint plus a retry covers the rare collision.
export function generateBookingCode(): string {
    let code = ""
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += ALPHABET[randomInt(ALPHABET.length)]
    }
    return `TT-${code}`
}
