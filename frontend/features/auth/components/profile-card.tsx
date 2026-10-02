"use client";

import { BadgeCheck, Mail, Phone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "../hooks/use-profile";
import { UserAvatar } from "./user-menu";

const ROLE_LABEL = { ADMIN: "Admin", MANAGER: "Manager", USER: "Member" } as const;

// "Your account": the details the server holds for the signed-in person (GET /auth/me).
export function ProfileCard() {
  const { data, isPending, isError, refetch, isFetching } = useProfile();

  if (isPending) {
    return (
      <Card aria-busy="true">
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-1 flex-col gap-2.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert
        tone="danger"
        title="We couldn’t load your account"
        action={
          <Button size="sm" variant="secondary" loading={isFetching} onClick={() => refetch()}>
            Try again
          </Button>
        }
      >
        Please check your connection.
      </Alert>
    );
  }

  return (
    <Card className="animate-fade-up">
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar firstName={data.firstName} lastName={data.lastName} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-xl font-bold text-ink">
              {data.firstName} {data.lastName}
            </h2>
            <Badge tone={data.role === "USER" ? "neutral" : "brand"}>{ROLE_LABEL[data.role]}</Badge>
            {data.isVerified && (
              <Badge tone="leaf">
                <BadgeCheck className="size-3" />
                Email verified
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1.5 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
            <span className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-subtle" /> <span className="truncate">{data.email}</span>
            </span>
            <span className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-subtle" /> {data.phone}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
