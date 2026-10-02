"use client";

import { useEffect } from "react";
import { bootstrapSession } from "../session/session-store";

// Mounted once at the top of the app: works out whether this browser already has a session.
export function SessionBootstrap() {
  useEffect(() => {
    bootstrapSession();
  }, []);
  return null;
}
