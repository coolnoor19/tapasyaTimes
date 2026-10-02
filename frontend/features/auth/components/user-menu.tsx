"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "../hooks/use-session";
import { useSignOut } from "../hooks/use-sign-out";

const ROLE_LABEL = { ADMIN: "Admin", MANAGER: "Manager", USER: "Member" } as const;

export const initialsOf = (firstName: string, lastName: string) =>
  `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || "?";

export function UserAvatar({ firstName, lastName, className = "size-9 text-sm" }: { firstName: string; lastName: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-600),var(--color-leaf-600))] font-display font-bold text-white ${className}`}
    >
      {initialsOf(firstName, lastName)}
    </span>
  );
}

// Avatar + name; opens a menu with the account details and "Sign out".
export function UserMenu() {
  const { user } = useSession();
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.firstName} ${user.lastName}`}
        className="group flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-brand-50 data-[state=open]:bg-brand-50 sm:pr-3"
      >
        <UserAvatar firstName={user.firstName} lastName={user.lastName} />
        <span className="hidden max-w-32 truncate text-sm font-semibold text-ink sm:block">{user.firstName}</span>
        <ChevronDown className="size-4 text-subtle transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <UserAvatar firstName={user.firstName} lastName={user.lastName} className="size-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs font-normal text-muted">{user.email}</p>
            </div>
          </div>
          <Badge tone={user.role === "USER" ? "neutral" : "brand"} className="mt-3">
            {ROLE_LABEL[user.role]}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          // Keep the menu open until the request finishes so the spinner is seen
          onSelect={async (event) => {
            event.preventDefault();
            setSigningOut(true);
            await signOut();
          }}
          disabled={signingOut}
          className="text-danger-700 data-[highlighted]:bg-danger-50 data-[highlighted]:text-danger-700"
        >
          {signingOut ? <Spinner className="size-4" label="Signing out" /> : <LogOut className="size-4" />}
          {signingOut ? "Signing out" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
