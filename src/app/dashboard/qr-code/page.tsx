"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  QrCode,
  Download,
  Copy,
  Printer,
  Palette,
  Type,
  Check,
  Loader2,
  ImageDown,
} from "lucide-react";

export default function QRCodePage() {
  const [qrCode, setQrCode] = useState<string>("");
  const [pageUrl, setPageUrl] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrColor, setQrColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [showLogo, setShowLogo] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const generateQR = async () => {
    if (!businessSlug) return;
    const url = `${appUrl}/${businessSlug}`;
    setPageUrl(url);
    setIsLoading(true);

    try {
      const res = await fetch("/api/qr-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, color: qrColor, bgColor }),
      });
      const data = await res.json();
      if (data.qrCode) setQrCode(data.qrCode);
    } catch {
      // Fallback: générer un QR code basique
      setQrCode("");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/my-business")
      .then((r) => r.json())
      .then((b) => {
        if (b?.slug) {
          setBusinessSlug(b.slug);
          const url = `${appUrl}/${b.slug}`;
          setPageUrl(url);
          setIsLoading(true);
          fetch("/api/qr-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          })
            .then((r) => r.json())
            .then((data) => { if (data.qrCode) setQrCode(data.qrCode); })
            .finally(() => setIsLoading(false));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadQR = (format: "png" | "svg") => {
    if (!qrCode && !canvasRef.current) return;

    if (qrCode) {
      // Download from data URL
      const link = document.createElement("a");
      link.download = `qr-code-${businessSlug}.${format}`;
      link.href = qrCode;
      link.click();
    }
  };

  const copyUrl = async () => {
    if (!pageUrl) return;
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printQR = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${businessSlug}</title>
        <style>
          body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui; margin: 0; }
          img { max-width: 300px; }
          h1 { margin-bottom: 8px; }
          p { color: #666; margin: 0; }
          @media print { img { max-width: 250px; } }
        </style>
      </head>
      <body>
        <h1>Scannez pour accéder à notre page</h1>
        <img src="${qrCode}" alt="QR Code" />
        <p style="margin-top:16px; font-size:14px;">${pageUrl}</p>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const colors = [
    { dark: "#0f172a", label: "Slate" },
    { dark: "#1e40af", label: "Bleu" },
    { dark: "#7c3aed", label: "Violet" },
    { dark: "#be123c", label: "Rouge" },
    { dark: "#0d9488", label: "Teal" },
    { dark: "#000000", label: "Noir" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">QR Code</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Générez un QR code imprimable pour votre page professionnelle
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* QR Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Votre QR Code
            </CardTitle>
            <CardDescription>
              {pageUrl}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* URL */}
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800">
              <span className="flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{pageUrl || "..."}</span>
              <button
                onClick={copyUrl}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copié" : "Copier"}
              </button>
            </div>

            {/* QR Image */}
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-8 dark:bg-slate-900">
              {isLoading ? (
                <div className="flex h-64 w-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : qrCode ? (
                <div className="relative">
                  <img src={qrCode} alt="QR Code" className="h-64 w-64 rounded-2xl" />
                  {showLogo && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-2 shadow-lg">
                      <QrCode className="h-8 w-8 text-slate-900" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-400">Aperçu du QR code</p>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Actions */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Button variant="outline" className="w-full" onClick={() => downloadQR("png")} disabled={!qrCode}>
                <Download className="mr-2 h-4 w-4" />
                PNG
              </Button>
              <Button variant="outline" className="w-full" onClick={() => downloadQR("svg")} disabled={!qrCode}>
                <ImageDown className="mr-2 h-4 w-4" />
                SVG
              </Button>
              <Button variant="outline" className="w-full" onClick={printQR} disabled={!qrCode}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimer
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customization */}
        <div className="space-y-6">
          {/* Slug input */}
          <Card>
            <CardHeader>
              <CardTitle>Page cible</CardTitle>
              <CardDescription>L'URL de votre page professionnelle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Slug de votre page"
                placeholder="mon-entreprise"
                value={businessSlug}
                onChange={(e) => setBusinessSlug(e.target.value)}
                helperText={`monapp.fr/${businessSlug}`}
              />
              <Button className="w-full" onClick={generateQR} loading={isLoading}>
                <QrCode className="mr-2 h-4 w-4" />
                Générer le QR Code
              </Button>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personnalisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Couleur du QR</label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => setQrColor(c.dark)}
                      className={`h-10 w-10 rounded-xl border-2 transition-all hover:scale-110 ${
                        qrColor === c.dark ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.dark }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={qrColor}
                    onChange={(e) => setQrColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-xl border-0"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Couleur de fond</label>
                <div className="flex gap-2">
                  {["#ffffff", "#f8fafc", "#fefce8", "#ecfdf5", "#eff6ff"].map((bg) => (
                    <button
                      key={bg}
                      onClick={() => setBgColor(bg)}
                      className={`h-10 w-10 rounded-xl border-2 transition-all hover:scale-110 ${
                        bgColor === bg ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
                      }`}
                      style={{ backgroundColor: bg }}
                    />
                  ))}
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-xl border-0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Logo au centre</span>
                </div>
                <button
                  onClick={() => setShowLogo(!showLogo)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${showLogo ? "bg-slate-900 dark:bg-white" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <div
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-slate-900 ${
                      showLogo ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Conseils d'utilisation</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  Imprimez le QR code sur vos cartes de visite
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  Affichez-le dans votre vitrine ou véhicule
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  Ajoutez-le sur vos factures et devis
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  Intégrez-le dans vos publications réseaux sociaux
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  Utilisez le format PNG pour le web, SVG pour l'impression
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
