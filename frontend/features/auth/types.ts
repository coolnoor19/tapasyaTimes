export type Role = "ADMIN" | "MANAGER" | "USER";

// What the backend returns after login / refresh
export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: "Bearer";
  // seconds until the access token stops working (15 minutes)
  expiresIn: number;
  user: SessionUser;
}

// GET /auth/me
export interface Profile extends SessionUser {
  phone: string;
  isVerified: boolean;
}

export interface RegisteredUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}
