/**
 * Lot 37 — <SectionOrderEditor> : réordonne les sections de la vitrine.
 *
 * Drag & drop natif HTML5 (0 dep), boutons ↑/↓ en fallback (a11y + mobile).
 * Les sections `required: true` ne peuvent pas être supprimées mais peuvent
 * être déplacées.
 */

"use client";

import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, GripVertical, Lock } from "lucide-react";
import {
  VITRINE_SECTIONS,
  type VitrineSectionId,
  normalizeSectionOrder,
} from "@/lib/vitrine-personalization";

interface SectionOrderEditorProps {
  value: string[] | null | undefined;
  onChange: (order: VitrineSectionId[]) => void;
}

export function SectionOrderEditor({ value, onChange }: SectionOrderEditorProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const order = normalizeSectionOrder(value);

  const move = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= order.length) return;
      const next = [...order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
    },
    [order, onChange]
  );

  return (
    <div className="space-y-1">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Glissez-déposez pour changer l&apos;ordre des sections affichées sur votre vitrine publique.
        Les sections marquées <Lock className="inline h-3 w-3" aria-hidden /> sont obligatoires.
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {order.map((sectionId, index) => {
          const meta = VITRINE_SECTIONS.find((s) => s.id === sectionId);
          if (!meta) return null;
          const isDragging = dragIndex === index;
          return (
            <li
              key={sectionId}
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                if (!Number.isFinite(from)) return;
                move(from, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex items-center gap-2 p-3 transition ${
                isDragging ? "opacity-40 bg-slate-50 dark:bg-slate-800" : ""
              } hover:bg-slate-50 dark:hover:bg-slate-800/50`}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-white">
                  {meta.label}
                  {meta.required && (
                    <Lock className="h-3 w-3 text-slate-400" aria-label="Section obligatoire" />
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Monter"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === order.length - 1}
                  aria-label="Descendre"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
