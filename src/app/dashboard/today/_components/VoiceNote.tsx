/**
 * F6 (Lot 35) — <VoiceNote> : dictée vocale via Web Speech API.
 *
 * Fonctionnement :
 *  - Bouton micro → démarre `SpeechRecognition` (fr-FR)
 *  - Transcription en direct
 *  - Bouton "Ajouter à ce RDV" → PATCH /api/appointments/[id] append description
 *
 * Support :
 *  - Chrome/Edge/Safari récent (webkitSpeechRecognition ou SpeechRecognition)
 *  - Firefox : PAS supporté (affiche un fallback "non disponible")
 *  - Mobile : Chrome Android OK, iOS Safari OK à partir de 14.5+
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

// Types Web Speech API (pas dans DOM lib TS standard)
interface SpeechRecognitionEvent {
  results: {
    length: number;
    item: (index: number) => {
      isFinal: boolean;
      length: number;
      item: (index: number) => { transcript: string };
    };
  };
  resultIndex: number;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface VoiceNoteProps {
  appointmentId: string;
  currentDescription: string | null;
  onSaved?: (newDescription: string) => void;
}

export function VoiceNote({ appointmentId, currentDescription, onSaved }: VoiceNoteProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const toast = useToast();

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  function start() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "fr-FR";
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results.item(i);
        const alt = r.item(0);
        if (r.isFinal) {
          finalText += alt.transcript + " ";
        } else {
          interim += alt.transcript;
        }
      }
      setTranscript(finalText + interim);
    };
    rec.onerror = () => {
      setRecording(false);
      toast.error("Erreur reconnaissance vocale");
    };
    rec.onend = () => {
      setRecording(false);
    };
    recognitionRef.current = rec;
    setTranscript("");
    setRecording(true);
    try {
      rec.start();
    } catch {
      // "start already called" → ignore
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function save() {
    if (!transcript.trim()) return;
    setSaving(true);
    try {
      const newDescription = currentDescription
        ? `${currentDescription}\n\n[Note vocale ${new Date().toLocaleTimeString("fr-FR")}]\n${transcript.trim()}`
        : `[Note vocale ${new Date().toLocaleTimeString("fr-FR")}]\n${transcript.trim()}`;
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newDescription }),
      });
      if (!res.ok) throw new Error("save");
      toast.success("Note vocale ajoutée");
      onSaved?.(newDescription);
      setTranscript("");
    } catch {
      toast.error("Impossible d'enregistrer la note");
    } finally {
      setSaving(false);
    }
  }

  // Nettoyage à l'unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (supported === null) return null;
  if (!supported) {
    return (
      <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-500">
        Dictée vocale non disponible sur ce navigateur (utilisez Chrome, Edge ou Safari).
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        {recording ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <MicOff className="h-3.5 w-3.5" aria-hidden />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
            Arrêter
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90"
          >
            <Mic className="h-3.5 w-3.5" aria-hidden />
            Note vocale
          </button>
        )}
        <span className="text-xs text-slate-500">Dictée en français</span>
      </div>
      {transcript && (
        <>
          <p className="rounded bg-slate-50 dark:bg-slate-800 p-2 text-sm text-slate-700 dark:text-slate-200 max-h-32 overflow-y-auto">
            {transcript}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            Ajouter à ce RDV
          </button>
        </>
      )}
    </div>
  );
}
