// Arrow-key movement on the seat map. Works from where seats ARE on screen (their centres), not from their
// numbers, so it stays right across aisles, rows of different lengths and gaps.

export interface SeatPoint {
  id: string;
  x: number; // centre, in pixels
  y: number;
}

// Seats whose centres are this close vertically are in the same row.
const SAME_ROW_PX = 14;

const sameRow = (a: SeatPoint, b: SeatPoint) => Math.abs(a.y - b.y) <= SAME_ROW_PX;

export type NavigationKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Home" | "End";

export const isNavigationKey = (key: string): key is NavigationKey =>
  key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" || key === "Home" || key === "End";

// The seat to move to from `current`, or null when there is nowhere to go (the edge of the map).
export function nextSeatId(current: SeatPoint, all: readonly SeatPoint[], key: NavigationKey): string | null {
  const others = all.filter((seat) => seat.id !== current.id);
  const rowMates = others.filter((seat) => sameRow(seat, current));

  switch (key) {
    case "ArrowLeft":
      return nearest(rowMates.filter((seat) => seat.x < current.x), (seat) => current.x - seat.x);
    case "ArrowRight":
      return nearest(rowMates.filter((seat) => seat.x > current.x), (seat) => seat.x - current.x);
    case "Home":
      return nearest(rowMates.filter((seat) => seat.x < current.x), (seat) => seat.x); // leftmost
    case "End":
      return nearest(rowMates.filter((seat) => seat.x > current.x), (seat) => -seat.x); // rightmost
    case "ArrowUp":
    case "ArrowDown": {
      const direction = key === "ArrowUp" ? -1 : 1;
      const inDirection = others.filter((seat) => (seat.y - current.y) * direction > SAME_ROW_PX);
      if (inDirection.length === 0) return null;
      // the nearest row in that direction...
      const rowY = inDirection.reduce((best, seat) => (Math.abs(seat.y - current.y) < Math.abs(best - current.y) ? seat.y : best), inDirection[0]!.y);
      // ...and in it, the seat straightest above/below
      return nearest(inDirection.filter((seat) => Math.abs(seat.y - rowY) <= SAME_ROW_PX), (seat) => Math.abs(seat.x - current.x));
    }
  }
}

function nearest(candidates: readonly SeatPoint[], distance: (seat: SeatPoint) => number): string | null {
  let best: SeatPoint | null = null;
  for (const seat of candidates) if (best === null || distance(seat) < distance(best)) best = seat;
  return best?.id ?? null;
}
