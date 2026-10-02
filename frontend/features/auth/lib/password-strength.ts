// Advisory only: the backend's rule is simply 8 to 72 characters. This helps people choose a better one.

export interface StrengthCheck {
  id: "length" | "case" | "number" | "symbol";
  label: string;
  ok: boolean;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  checks: StrengthCheck[];
}

export function passwordStrength(password: string): PasswordStrength {
  const checks: StrengthCheck[] = [
    { id: "length", label: "At least 8 characters", ok: password.length >= 8 },
    { id: "case", label: "Upper and lower case letters", ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: "number", label: "A number", ok: /\d/.test(password) },
    { id: "symbol", label: "A symbol, like ! or #", ok: /[^A-Za-z0-9]/.test(password) },
  ];

  // Below the backend's minimum there is no score to speak of.
  if (password.length < 8) return { score: 0, label: "Too short", checks };

  // Length beyond 12 counts as an extra point, so a long passphrase of plain words is not called weak.
  const points = checks.slice(1).filter((check) => check.ok).length + (password.length >= 12 ? 1 : 0);
  const score = Math.min(4, Math.max(1, points)) as 1 | 2 | 3 | 4;
  return { score, label: (["Weak", "Fair", "Good", "Strong"] as const)[score - 1]!, checks };
}
