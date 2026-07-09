"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { Users, Eye, MousePointer, TrendingUp, Globe, RotateCcw } from "lucide-react";

const visitorData = [
  { name: "Lun", visitors: 45, unique: 38, pageViews: 92 },
  { name: "Mar", visitors: 62, unique: 51, pageViews: 134 },
  { name: "Mer", visitors: 78, unique: 64, pageViews: 178 },
  { name: "Jeu", visitors: 55, unique: 47, pageViews: 112 },
  { name: "Ven", visitors: 90, unique: 73, pageViews: 201 },
  { name: "Sam", visitors: 120, unique: 95, pageViews: 267 },
  { name: "Dim", visitors: 30, unique: 25, pageViews: 58 },
];

const sourceData = [
  { name: "Google", value: 42, color: "#4285F4" },
  { name: "Direct", value: 28, color: "#34A853" },
  { name: "Réseaux sociaux", value: 18, color: "#FBBC05" },
  { name: "Recommandation", value: 12, color: "#EA4335" },
];

const deviceData = [
  { name: "Mobile", value: 68, color: "#3b82f6" },
  { name: "Desktop", value: 25, color: "#8b5cf6" },
  { name: "Tablette", value: 7, color: "#ec4899" },
];

export default function AnalyticsPage() {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (confirm("Voulez-vous vraiment réinitialiser toutes les statistiques de visites ?")) {
      setResetting(true);
      try {
        await fetch("/api/my-availability", { method: "DELETE" });
        alert("Statistiques réinitialisées avec succès !");
        window.location.reload();
      } catch (e) {
        alert("Erreur lors de la réinitialisation.");
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Statistiques</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Analysez les performances de votre page</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} loading={resetting} className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900/20">
          <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser les visites
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Visiteurs (7j)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">480</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Uniques</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">393</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                <MousePointer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Taux de conversion</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">5.2%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Provenance</p>
                <Badge variant="info">Google #1</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visiteurs</CardTitle>
            <CardDescription>7 derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visitorData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "rgb(15 23 42)", border: "none", borderRadius: "12px", color: "white", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="visitors" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provenance</CardTitle>
            <CardDescription>D'où viennent vos visiteurs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {sourceData.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-slate-600 dark:text-slate-400">{s.name} ({s.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appareils</CardTitle>
            <CardDescription>Répartition par type d'appareil</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={80} />
                  <Tooltip contentStyle={{ backgroundColor: "rgb(15 23 42)", border: "none", borderRadius: "12px", color: "white", fontSize: "12px" }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pages vues</CardTitle>
            <CardDescription>7 derniers jours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visitorData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "rgb(15 23 42)", border: "none", borderRadius: "12px", color: "white", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="pageViews" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
