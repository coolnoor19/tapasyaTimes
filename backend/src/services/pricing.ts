const minutesOf = (time: string): number => {
    const [hours = "0", minutes = "0"] = time.split(":")
    return Number(hours) * 60 + Number(minutes)
}

// Price of ONE booking item (one seat, one date, one slot), in paise.
// The seat price is per hour; a 60-minute slot costs exactly that price, and a
// slot of another length is pro-rated and rounded to a whole paisa.
export function calculateItemAmountPaise(pricePerHourPaise: number, slotStart: string, slotEnd: string): number {
    const durationMinutes = minutesOf(slotEnd) - minutesOf(slotStart)
    return Math.round((pricePerHourPaise * durationMinutes) / 60)
}
