"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { getQuoteConfig, QuoteField } from "@/lib/quote-configs";
import {
  X,
  Upload,
  FileImage,
  FileVideo,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface QuoteFormProps {
  businessId: string;
  businessName: string;
  category: string;
  customFields?: QuoteField[] | null;
  enableStripe?: boolean;
  onClose: () => void;
}

interface Attachment {
  file: File;
  preview: string;
  type: "image" | "video" | "document";
}

export function QuoteForm({
  businessId,
  businessName,
  category,
  customFields,
  enableStripe,
  onClose,
}: QuoteFormProps) {
  const config = getQuoteConfig(category);
  const fields = customFields && customFields.length > 0 ? customFields : config.fields;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Record<string, string>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    paymentMethod: "other",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = [];
    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError("Les fichiers ne doivent pas dépasser 10 Mo");
        return;
      }
      const type = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "document";
      const preview = type === "image" ? URL.createObjectURL(file) : "";
      newAttachments.push({ file, preview, type });
    });
    setAttachments((prev) => [...prev, ...newAttachments].slice(0, 6));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const item = prev[index];
      if (item.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateFields = (): boolean => {
    if (!formData.firstName || !formData.lastName) {
      setError("Veuillez renseigner votre nom et prénom");
      return false;
    }
    if (!formData.phone) {
      setError("Le téléphone est requis pour vous recontacter");
      return false;
    }
    if (!formData.email || !formData.email.includes("@")) {
      setError("L'email est requis pour recevoir votre devis");
      return false;
    }
    for (const field of fields) {
      if (field.required && !formData[field.id]) {
        setError(`Le champ "${field.label}" est requis`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateFields()) return;
    setIsLoading(true);
    setError("");

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("businessId", businessId);
      formDataToSend.append("category", category);
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) formDataToSend.append(key, String(value));
      });
      attachments.forEach((att, i) => formDataToSend.append(`attachment_${i}`, att.file));

      const res = await fetch("/api/quote-request", { method: "POST", body: formDataToSend });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi de la demande");
    } finally {
      setIsLoading(false);
    }
  };

  const renderField = (field: QuoteField) => {
    const val = formData[field.id] || "";
    const commonProps = {
      value: val,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      ) => updateField(field.id, e.target.value),
    };

    switch (field.type) {
      case "select":
        return (
          <Select
            key={field.id}
            label={field.label}
            placeholder={`Choisir...`}
            options={field.options || []}
            value={val}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );
      case "textarea":
        return (
          <Textarea
            key={field.id}
            label={field.label}
            placeholder={field.placeholder}
            className="min-h-[100px]"
            value={val}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );
      case "number":
        return (
          <Input
            key={field.id}
            label={field.label}
            type="number"
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            value={val}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );
      case "date":
        return (
          <Input
            key={field.id}
            label={field.label}
            type="date"
            value={val}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );
      case "checkbox":
        return (
          <label
            key={field.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            <input
              type="checkbox"
              checked={!!val}
              onChange={(e) => updateField(field.id, e.target.checked ? "true" : "")}
              className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {field.label}
            </span>
          </label>
        );
      default:
        return (
          <Input
            key={field.id}
            label={field.label}
            placeholder={field.placeholder}
            value={val}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Demande envoyée !</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {businessName} vous recontactera dans les plus brefs délais.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Un récapitulatif a été envoyé à {formData.email || "votre email"}.
        </p>
        <Button className="mt-6" onClick={onClose}>
          Fermer
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{config.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Contact info */}
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prénom"
            value={formData.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
            placeholder="Jean"
          />
          <Input
            label="Nom"
            value={formData.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
            placeholder="Dupont"
          />
        </div>
        <Input
          label="Téléphone"
          value={formData.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          placeholder="+336 12 34 56 78"
        />
        <Input
          label="Email (pour recevoir votre devis)"
          type="email"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="jean@email.fr"
          required
        />
      </div>

      {/* Dynamic fields */}
      <div className="space-y-3 mb-4">{fields.map((field) => renderField(field))}</div>

      {/* Address */}
      <div className="mb-4">
        <Input
          label="Adresse (optionnel)"
          value={formData.address}
          onChange={(e) => updateField("address", e.target.value)}
          placeholder="12 Rue de la Paix, Paris"
        />
      </div>

      {/* Attachments */}
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {config.attachmentLabel} (max 6)
        </label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx"
          multiple
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= 6}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 transition-colors hover:border-slate-900 hover:text-slate-900 dark:border-slate-700 dark:hover:border-white dark:hover:text-slate-100"
        >
          <Upload className="h-5 w-5" />
          {attachments.length >= 6 ? "Maximum atteint" : "Ajouter des fichiers"}
        </button>
        {attachments.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                {att.type === "image" ? (
                  <img src={att.preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1">
                    {att.type === "video" ? (
                      <FileVideo className="h-6 w-6 text-slate-400" />
                    ) : (
                      <FileText className="h-6 w-6 text-slate-400" />
                    )}
                    <span className="truncate max-w-[80px] text-[10px] text-slate-500">
                      {att.file.name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Method (if Stripe enabled) */}
      {enableStripe && (
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Mode de paiement souhaité
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, paymentMethod: "stripe" })}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${formData.paymentMethod === "stripe" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"}`}
            >
              💳 Carte bancaire (Stripe)
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, paymentMethod: "other" })}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${formData.paymentMethod === "other" ? "border-slate-900 bg-slate-50 text-slate-900 dark:border-white dark:bg-slate-800 dark:text-slate-100" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400"}`}
            >
              💵 Espèces / Autre
            </button>
          </div>
        </div>
      )}

      <Button className="w-full" onClick={handleSubmit} loading={isLoading}>
        <Send className="mr-2 h-4 w-4" />
        {config.submitLabel}
      </Button>
    </div>
  );
}
