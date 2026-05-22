"use client";

import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, userInitials } from "@/lib/utils";

export function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <DashboardShell title="Settings" subtitle="Manage your account and session.">
      <div className="px-6 pb-8 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user && (
              <>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                    {userInitials(user.full_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    {user.company_name && (
                      <p className="text-sm text-muted-foreground truncate">{user.company_name}</p>
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="font-medium capitalize">{user.role}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">{user.is_active ? "Active" : "Disabled"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="font-medium">{user.phone || "—"}</dd>
                  </div>
                  {user.role === "driver" && (
                    <div>
                      <dt className="text-muted-foreground">Trustworthiness</dt>
                      <dd className="font-medium">{user.trustworthiness}</dd>
                    </div>
                  )}
                  {(user.role === "sender" || user.role === "receiver") && (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Address</dt>
                      <dd className="font-medium">{user.address || "—"}</dd>
                    </div>
                  )}
                  {(user.lat != null || user.lng != null) && (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Coordinates</dt>
                      <dd className="font-medium font-mono text-xs">
                        {user.lat ?? "—"}, {user.lng ?? "—"}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">Member since</dt>
                    <dd className="font-medium">{formatDate(user.created_at)}</dd>
                  </div>
                </dl>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Sign out on this device. Your refresh token will be revoked.
            </p>
            <Button variant="outline" onClick={() => logout()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
