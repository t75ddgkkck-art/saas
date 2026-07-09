"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CreditCard, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";

const mockPayments = [
  { id: 1, client: "Sophie Bernard", amount: 1050, type: "deposit" as const, status: "completed" as const, date: "2025-01-12", method: "Stripe" },
  { id: 2, client: "Marie Dupont", amount: 250, type: "full" as const, status: "completed" as const, date: "2025-01-10", method: "Stripe" },
  { id: 3, client: "Jean Martin", amount: 222, type: "deposit" as const, status: "pending" as const, date: "2025-01-09", method: "Stripe" },
  { id: 4, client: "Claire Petit", amount: 500, type: "subscription" as const, status: "completed" as const, date: "2025-01-01", method: "Stripe" },
];

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }> = {
  pending: { label: "En attente", variant: "warning" },
  completed: { label: "Complété", variant: "success" },
  failed: { label: "Échoué", variant: "danger" },
  refunded: { label: "Remboursé", variant: "info" },
};

const typeConfig: Record<string, string> = {
  deposit: "Acompte",
  full: "Paiement total",
  subscription: "Abonnement",
};

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Paiements</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Suivez vos paiements et factures</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total encaissé</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatPrice(2022)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ce mois</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatPrice(1550)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">En attente</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatPrice(222)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {mockPayments.map((payment) => (
          <Card key={payment.id}>
            <CardContent className="flex items-center gap-4 p-4 sm:p-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${payment.status === "completed" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" : "bg-amber-50 text-amber-600 dark:bg-amber-900/30"}`}>
                {payment.status === "completed" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">{payment.client}</h3>
                  <Badge variant={statusConfig[payment.status]?.variant}>{statusConfig[payment.status]?.label}</Badge>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{typeConfig[payment.type]} — {payment.method}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatPrice(payment.amount)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{payment.date}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
