"use client";

import { usePWA } from "@/hooks/usePWA";
import { Bell, Download, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export function PWAInstallBanner() {
  const { canInstall, installApp, pushEnabled, requestPushPermission } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">Vitrix</h4>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Installez l&apos;application et activez les notifications pour ne rien manquer.
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          {canInstall && (
            <Button size="sm" onClick={installApp}>
              <Download className="mr-1 h-4 w-4" />
              Installer
            </Button>
          )}
          {!pushEnabled && (
            <Button variant="outline" size="sm" onClick={requestPushPermission}>
              <Bell className="mr-1 h-4 w-4" />
              Notifications
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
