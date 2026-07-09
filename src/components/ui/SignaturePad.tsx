"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Pen, Trash2, Check, Download } from "lucide-react";

interface SignaturePadProps {
  onSave: (signatureDataUrl: string, metadata: any) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
}

export function SignaturePad({ onSave, onCancel, width = 600, height = 250 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [timestamp, setTimestamp] = useState<Date | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set actual canvas dimensions (account for device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw signature line
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, height - 40);
    ctx.lineTo(width - 40, height - 40);
    ctx.stroke();

    // "Signez ici" text
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Signez ici", width / 2, height - 25);
  }, [width, height]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const pos = getPos(e);
    lastPos.current = pos;
    setTimestamp(new Date());

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;

    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, height - 40);
    ctx.lineTo(width - 40, height - 40);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Signez ici", width / 2, height - 25);

    setHasSignature(false);
    setTimestamp(null);
  };

  const handleSave = () => {
    if (!hasSignature || !timestamp) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const metadata = {
      signedAt: timestamp.toISOString(),
      timestamp: timestamp.toLocaleString("fr-FR"),
      userAgent: navigator.userAgent,
      ip: "client-side",
    };

    onSave(dataUrl, metadata);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-slate-200 overflow-hidden bg-white dark:border-slate-700">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair touch-none"
          style={{ width, maxWidth: "100%", height }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {hasSignature && timestamp && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Check className="h-3 w-3 text-emerald-500" />
          <span>Signé le {timestamp.toLocaleString("fr-FR")}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} disabled={!hasSignature}>
          <Trash2 className="mr-1 h-3 w-3" /> Effacer
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const link = document.createElement("a");
          link.download = "signature.png";
          link.href = canvas.toDataURL("image/png");
          link.click();
        }} disabled={!hasSignature}>
          <Download className="mr-1 h-3 w-3" /> Télécharger
        </Button>
        <div className="flex-1" />
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={!hasSignature}>
          <Pen className="mr-1 h-3 w-3" /> Valider la signature
        </Button>
      </div>
    </div>
  );
}
