"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { shipmentRef } from "@/lib/entityLabels";
import { notificationHref } from "@/lib/notificationLinks";
import { cn, formatDate } from "@/lib/utils";
import type { UserNotification } from "@/types";
import type { UserRole } from "@/types/auth";

const POLL_MS = 45_000;
/** Only the latest notification in the bell dropdown preview. */
const PREVIEW_LIMIT = 1;
const MODAL_LIMIT = 100;

function NotificationRow({
  notification,
  role,
  onClick,
  compact = false,
}: {
  notification: UserNotification;
  role: UserRole;
  onClick: () => void;
  compact?: boolean;
}) {
  const href = notificationHref(notification, role);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors",
        !notification.read_at && "bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{notification.title}</p>
        {!notification.read_at && (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-xs text-muted-foreground leading-relaxed",
          compact && "line-clamp-2"
        )}
      >
        {notification.body}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{formatDate(notification.created_at)}</span>
        {href && notification.order_id != null && (
          <span className="text-primary shrink-0">{shipmentRef(notification.order_id)}</span>
        )}
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<UserNotification[]>([]);
  const [allItems, setAllItems] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const bellRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const applyRead = useCallback((id: number, readAt: string) => {
    const mark = (list: UserNotification[]) =>
      list.map((n) => (n.id === id ? { ...n, read_at: readAt } : n));
    setPreviewItems((prev) => mark(prev));
    setAllItems((prev) => mark(prev));
  }, []);

  const applyAllRead = useCallback((readAt: string) => {
    const mark = (list: UserNotification[]) =>
      list.map((n) => ({ ...n, read_at: n.read_at ?? readAt }));
    setPreviewItems((prev) => mark(prev));
    setAllItems((prev) => mark(prev));
    setUnreadCount(0);
  }, []);

  const refreshPreview = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setPreviewLoading(true);
      try {
        const data = await listNotifications(PREVIEW_LIMIT);
        setPreviewItems(data.items);
        setUnreadCount(data.unread_count);
      } catch {
        /* keep last known state */
      } finally {
        if (!silent) setPreviewLoading(false);
      }
    },
    [user]
  );

  const loadAllNotifications = useCallback(async () => {
    if (!user) return;
    setModalLoading(true);
    try {
      const data = await listNotifications(MODAL_LIMIT);
      setAllItems(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      /* keep last known state */
    } finally {
      setModalLoading(false);
    }
  }, [user]);

  const updateDropdownPosition = useCallback(() => {
    const bell = bellRef.current;
    if (!bell) return;
    const rect = bell.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setDropdownStyle({ top: rect.bottom + 8, left, width });
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user) return;
    void refreshPreview(true);
    const id = window.setInterval(() => void refreshPreview(true), POLL_MS);
    return () => window.clearInterval(id);
  }, [user, refreshPreview]);

  useEffect(() => {
    if (!open) return;
    void refreshPreview(false);
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open, refreshPreview, updateDropdownPosition]);

  useEffect(() => {
    if (!modalOpen) return;
    void loadAllNotifications();
  }, [modalOpen, loadAllNotifications]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (bellRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  async function handleMarkRead(notification: UserNotification) {
    if (notification.read_at) return;
    try {
      await markNotificationRead(notification.id);
      const readAt = new Date().toISOString();
      applyRead(notification.id, readAt);
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      applyAllRead(new Date().toISOString());
    } catch {
      /* ignore */
    }
  }

  async function handleNotificationClick(notification: UserNotification) {
    await handleMarkRead(notification);
    const href = notificationHref(notification, user?.role);
    if (href) {
      setOpen(false);
      setModalOpen(false);
      router.push(href);
    }
  }

  function openAllModal() {
    setOpen(false);
    setModalOpen(true);
  }

  if (!user) return null;

  const hasNotifications = previewItems.length > 0 || unreadCount > 0 || allItems.length > 0;

  const dropdownPanel =
    open && dropdownStyle && mounted ? (
      <div
        ref={dropdownRef}
        className="fixed z-[150] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        style={{
          top: dropdownStyle.top,
          left: dropdownStyle.left,
          width: dropdownStyle.width,
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div>
          {previewLoading && previewItems.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : previewItems.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {previewItems.map((n) => (
                <li key={n.id}>
                  <NotificationRow
                    notification={n}
                    role={user.role}
                    compact
                    onClick={() => void handleNotificationClick(n)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasNotifications && (
          <div className="border-t border-border px-4 py-2.5">
            <button
              type="button"
              onClick={openAllModal}
              className="w-full rounded-lg py-2 text-center text-sm font-medium text-primary hover:bg-muted/50 transition-colors"
            >
              View all notifications
              {unreadCount > PREVIEW_LIMIT ? (
                <span className="text-muted-foreground font-normal"> ({unreadCount} unread)</span>
              ) : null}
            </button>
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
      <Button
        ref={bellRef}
        variant="outline"
        size="sm"
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) updateDropdownPosition();
            return next;
          });
        }}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {mounted && dropdownPanel ? createPortal(dropdownPanel, document.body) : null}

      {modalOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close notifications"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 flex max-h-[min(32rem,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 id="notifications-modal-title" className="text-base font-semibold">
                  All notifications
                </h2>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">{unreadCount} unread</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAllRead()}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Close"
                  onClick={() => setModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {modalLoading && allItems.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading notifications…
                </div>
              ) : allItems.length === 0 ? (
                <p className="px-5 py-16 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {allItems.map((n) => (
                    <li key={n.id}>
                      <NotificationRow
                        notification={n}
                        role={user.role}
                        onClick={() => void handleNotificationClick(n)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {allItems.length >= MODAL_LIMIT && (
              <p className="border-t border-border px-5 py-3 text-center text-xs text-muted-foreground">
                Showing the {MODAL_LIMIT} most recent notifications.
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
