"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function PdfTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState("standard");

  const templates = [
    {
      id: "standard",
      name: "Classique",
      description: "Simple et professionnel",
      color: "bg-slate-100",
    },
    {
      id: "moderne",
      name: "Moderne",
      description: "Avec bandeau coloré",
      color: "bg-blue-100",
    },
    {
      id: "minimaliste",
      name: "Minimaliste",
      description: "Épuré et élégant",
      color: "bg-white border",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Templates PDF
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choisissez le style de vos devis et factures
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all ${
              selectedTemplate === template.id
                ? "ring-2 ring-blue-500"
                : "hover:shadow-md"
            }`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <CardContent className="p-6">
              <div className={`h-32 ${template.color} rounded-lg mb-4 flex items-center justify-center`}>
                <span className="text-4xl">📄</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {template.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {template.description}
              </p>
              {selectedTemplate === template.id && (
                <div className="mt-3 text-xs font-medium text-blue-600">
                  ✓ Sélectionné
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button>Enregistrer le template</Button>
      </div>
    </div>
  );
}
