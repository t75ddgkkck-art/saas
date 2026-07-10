"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications || []));
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
        {unreadCount > 0 && (
          // Lot 18 B12 : badge repositionné À L'INTÉRIEUR du bouton (top-1.5 right-1.5)
          // + bordure blanche/slate pour séparer de l'icône et éviter le débordement
          // sur les bords du parent (sidebar / topbar mobile).
          // Cap visuel à 9+ pour éviter que le badge grossisse avec des grands nombres.
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white dark:border-slate-900"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed right-2 top-14 z-[9999] w-[calc(100vw-1rem)] max-w-[340px] rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 sm:right-4 sm:top-16">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`border-b border-slate-100 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${!notif.isRead ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                >
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                    {notif.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{notif.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(notif.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <Link
              href="/dashboard"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Voir toutes les notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
