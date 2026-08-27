"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Shield, X } from "lucide-react";
import { ALL_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/permissions";
import { Card, EmptyState, Pill } from "./AdminPage";

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: "staff" | "admin";
  permissions: string[];
  twoFactorEnabled?: boolean;
  isBlocked?: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export function StaffManager({
  initialStaff,
  currentUserId,
}: {
  initialStaff: StaffMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    permissions: [...DEFAULT_STAFF_PERMISSIONS] as string[],
    twoFactorEnabled: true,
  });

  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create the account");
      setCreating(false);
      setForm({
        name: "",
        email: "",
        password: "",
        permissions: [...DEFAULT_STAFF_PERMISSIONS],
        twoFactorEnabled: true,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not remove the account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the account");
    } finally {
      setBusy(false);
    }
  }

  function togglePermission(list: string[], perm: string): string[] {
    return list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm];
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {creating ? <X size={15} /> : <Plus size={15} />}
          {creating ? "Cancel" : "Add staff member"}
        </button>
      </div>

      {creating && (
        <Card>
          <form onSubmit={createStaff} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-heading">Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-heading">Email</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-heading">
                  Temporary password
                </span>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                />
              </label>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-heading">Permissions</legend>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-sm text-body">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(perm)}
                      onChange={() =>
                        setForm({ ...form, permissions: togglePermission(form.permissions, perm) })
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {PERMISSION_LABELS[perm as Permission]}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm text-body">
              <input
                type="checkbox"
                checked={form.twoFactorEnabled}
                onChange={(e) => setForm({ ...form, twoFactorEnabled: e.target.checked })}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Require two-factor authentication at login
            </label>

            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create account"}
            </button>
          </form>
        </Card>
      )}

      {initialStaff.length === 0 ? (
        <EmptyState message="No staff accounts yet." />
      ) : (
        <div className="space-y-4">
          {initialStaff.map((member) => {
            const isSelf = member._id === currentUserId;
            const isAdmin = member.role === "admin";
            const isEditing = editing === member._id;

            return (
              <Card key={member._id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-heading">
                      {member.name}
                      {isAdmin && (
                        <Pill tone="info">
                          <Shield size={10} className="mr-1 inline" />
                          Administrator
                        </Pill>
                      )}
                      {isSelf && <Pill>You</Pill>}
                      {member.isBlocked && <Pill tone="error">Blocked</Pill>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {member.email}
                      {member.lastLoginAt
                        ? ` · last signed in ${new Date(member.lastLoginAt).toLocaleDateString("en-IN")}`
                        : " · never signed in"}
                      {member.twoFactorEnabled ? " · 2FA on" : " · 2FA off"}
                    </p>
                  </div>

                  {!isAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(isEditing ? null : member._id);
                          setDraftPermissions(member.permissions ?? []);
                        }}
                        className="rounded-lg border border-line px-3.5 py-2 text-sm text-heading"
                      >
                        {isEditing ? "Cancel" : "Edit access"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => patch(member._id, { isBlocked: !member.isBlocked })}
                        className="rounded-lg border border-line px-3.5 py-2 text-sm text-heading"
                      >
                        {member.isBlocked ? "Unblock" : "Block"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(member._id)}
                        className="rounded-lg border border-error px-3.5 py-2 text-sm text-error"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {isAdmin ? (
                  <p className="mt-3 text-xs text-muted">
                    Administrators hold every permission and cannot be restricted.
                  </p>
                ) : isEditing ? (
                  <div className="mt-4 border-t border-line pt-4">
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {ALL_PERMISSIONS.map((perm) => (
                        <label key={perm} className="flex items-center gap-2 text-sm text-body">
                          <input
                            type="checkbox"
                            checked={draftPermissions.includes(perm)}
                            onChange={() =>
                              setDraftPermissions((prev) => togglePermission(prev, perm))
                            }
                            className="h-4 w-4 accent-[var(--primary)]"
                          />
                          {PERMISSION_LABELS[perm as Permission]}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patch(member._id, { permissions: draftPermissions })}
                      className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      Save permissions
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(member.permissions ?? []).length === 0 ? (
                      <span className="text-xs text-muted">No sections granted yet.</span>
                    ) : (
                      member.permissions.map((perm) => (
                        <Pill key={perm}>{PERMISSION_LABELS[perm as Permission] ?? perm}</Pill>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
