"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, Phone, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { joinedOn } from "@/features/staff/components/customers-screen";
import { isNotFound, QueryProblem } from "@/features/staff/components/query-problem";
import { fullName } from "@/features/staff/lib/board-math";
import { useSetUserRole, useSetUserStatus } from "../hooks/use-admin-mutations";
import { useAdminUser, useAuditLog } from "../hooks/use-admin-queries";
import { describeAdminError } from "../lib/errors";
import { AuditList } from "./audit-list";
import { ConfirmDialog } from "./shared";
import { UserBadges } from "./users-screen";

type Action = "suspend" | "reactivate" | "make-manager" | "make-customer";

// One account: who they are, what they may do, and every change an admin made to them. Changing a role or suspending is done
// here, on purpose: the admin has opened this exact person and read who they are before a change that affects them.
export function UserDetail({ id }: { id: string }) {
  const query = useAdminUser(id);
  const history = useAuditLog({ targetType: "USER", targetId: id }, 1, 10);
  const { user: me } = useSession();
  const user = query.data;

  const setStatus = useSetUserStatus();
  const setRole = useSetUserRole();
  const [action, setAction] = useState<Action | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const busy = setStatus.isPending || setRole.isPending;
  const close = () => {
    setAction(null);
    setProblem(null);
  };

  const confirm = () => {
    if (!action || !user) return;
    setProblem(null);
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        close();
      },
      onError: (error: unknown) => setProblem(describeAdminError(error)),
    });
    const name = user.firstName;
    if (action === "suspend") setStatus.mutate({ id, status: "SUSPENDED" }, done(`${name} is suspended`));
    else if (action === "reactivate") setStatus.mutate({ id, status: "ACTIVE" }, done(`${name} is active again`));
    else if (action === "make-manager") setRole.mutate({ id, role: "MANAGER" }, done(`${name} is now a manager`));
    else setRole.mutate({ id, role: "USER" }, done(`${name} is a customer again`));
  };

  const isAdmin = user?.role === "ADMIN";
  const isMe = user?.id === me?.id;
  const canBeManager = user ? user.isVerified && user.status === "ACTIVE" : false;

  const copy: Record<Action, { title: string; text: string; label: string; tone: "primary" | "danger" }> = {
    suspend: {
      title: `Suspend ${user?.firstName ?? "this account"}?`,
      text: "They are signed out right away and can’t sign in until you reactivate them. Their bookings stay as they are.",
      label: "Suspend",
      tone: "danger",
    },
    reactivate: { title: `Reactivate ${user?.firstName ?? "this account"}?`, text: "They can sign in again straight away.", label: "Reactivate", tone: "primary" },
    "make-manager": {
      title: `Make ${user?.firstName ?? "this person"} a manager?`,
      text: "Managers see every booking, and every customer’s name, email and phone number. They can’t change seats, prices or other accounts.",
      label: "Make manager",
      tone: "primary",
    },
    "make-customer": {
      title: `Make ${user?.firstName ?? "this person"} a customer again?`,
      text: "They lose access to the staff portal. Their own bookings stay.",
      label: "Make customer",
      tone: "danger",
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={user ? fullName(user) : "Account"}
        description={user ? `Joined ${joinedOn(user.createdAt)}` : undefined}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/users">
              <ArrowLeft className="size-4" />
              All users
            </Link>
          </Button>
        }
      />

      {query.isError && isNotFound(query.error) && (
        <Alert tone="warn" title="We can’t find that account" action={<Button asChild size="sm" variant="secondary"><Link href="/admin/users">Search users</Link></Button>}>
          The link may be wrong.
        </Alert>
      )}
      {query.isError && !isNotFound(query.error) && !user && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="this account" />}
      {query.isPending && !query.isError && <Skeleton className="h-44 rounded-lg" />}

      {user && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-3">
                  <UserBadges user={user} />
                  <ul className="flex flex-col gap-2 text-sm">
                    <li>
                      <a href={`tel:${user.phone}`} className="tabular flex items-center gap-2 text-brand-700 hover:text-brand-800 hover:underline">
                        <Phone className="size-4 shrink-0" aria-hidden="true" />
                        {user.phone}
                      </a>
                    </li>
                    <li className="min-w-0">
                      <a href={`mailto:${user.email}`} className="flex items-center gap-2 text-brand-700 hover:text-brand-800 hover:underline">
                        <Mail className="size-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{user.email}</span>
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm text-muted">Bookings</p>
                  {user.bookingCount === undefined ? <Skeleton className="mt-1 h-9 w-12 sm:ml-auto" /> : <p className="tabular font-display text-3xl font-bold text-ink">{user.bookingCount}</p>}
                  {user.bookingCount !== undefined && user.bookingCount > 0 && (
                    <Link href={`/manager/bookings?customerId=${user.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline">
                      See them
                      <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              {isAdmin ? (
                <p className="flex items-start gap-2.5 rounded-md bg-canvas px-4 py-3 text-sm text-muted ring-1 ring-inset ring-line">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {isMe ? "This is your own account." : "This is an admin account."} Admin accounts can’t be suspended or changed through the portal. They are created only by the setup script.
                </p>
              ) : (
                <div className="flex flex-col gap-3 border-t border-line pt-5">
                  <div className="flex flex-wrap gap-3">
                    {user.status === "ACTIVE" ? (
                      <Button variant="danger" onClick={() => setAction("suspend")}>
                        Suspend account
                      </Button>
                    ) : (
                      <Button onClick={() => setAction("reactivate")}>Reactivate account</Button>
                    )}
                    {user.role === "USER" ? (
                      <Button variant="secondary" disabled={!canBeManager} onClick={() => setAction("make-manager")}>
                        Make manager
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => setAction("make-customer")}>
                        Make customer again
                      </Button>
                    )}
                  </div>
                  {user.role === "USER" && !canBeManager && (
                    <p className="text-[0.8125rem] text-muted">{!user.isVerified ? "This person hasn’t verified their email yet, so they can’t become a manager." : "Reactivate this account before making them a manager."}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="user-history" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 id="user-history" className="text-lg font-bold text-ink">
                Changes to this account
              </h2>
              {history.data && history.data.total > history.data.data.length && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/audit-log?targetType=USER&targetId=${user.id}`}>
                    See all {history.data.total}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
            {history.isError && !history.data ? (
              <QueryProblem error={history.error} onRetry={() => history.refetch()} retrying={history.isFetching} what="the history" />
            ) : !history.data ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : history.data.data.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center text-sm text-muted">Nobody has changed this account’s role or status.</p>
            ) : (
              <AuditList entries={history.data.data} showTarget={false} />
            )}
          </section>
        </>
      )}

      {action && (
        <ConfirmDialog
          open
          onClose={close}
          title={copy[action].title}
          description={copy[action].text}
          confirmLabel={copy[action].label}
          tone={copy[action].tone}
          loading={busy}
          error={problem ? <Alert tone="danger">{problem}</Alert> : undefined}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}
