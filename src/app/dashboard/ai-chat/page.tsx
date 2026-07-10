"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Send, Bot, User, Sparkles, Zap, Clock } from "lucide-react";
// F1 (Lot 29) : gate d'entitlement — la page entière est réservée aux Premium.
import { UpgradeGate } from "@/components/entitlements/UpgradeGate";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// Lot 18 B3 : message d'accueil dynamique fonction du business.
// Le composant construit `initialMessages` avec le vrai nom une fois le
// business chargé — plus jamais "Dupont Plomberie" hardcodé.
function buildInitialMessage(businessName: string | null): Message {
  const name = businessName?.trim() || "notre équipe";
  return {
    id: "1",
    role: "assistant",
    content: `Bonjour ! 👋 Je suis l'assistant virtuel de ${name}. Je peux vous aider à :\n\n• Prendre un rendez-vous\n• Obtenir des informations sur nos services\n• Vous renseigner sur nos tarifs\n• Répondre à vos questions\n\nComment puis-je vous aider ?`,
    timestamp: new Date(),
  };
}

const quickActions = [
  { label: "Prendre RDV", prompt: "Je voudrais prendre rendez-vous" },
  { label: "Tarifs", prompt: "Quels sont vos tarifs ?" },
  { label: "Urgence", prompt: "J'ai une urgence plomberie" },
  { label: "Zone d'intervention", prompt: "Quelle est votre zone d'intervention ?" },
];

const aiResponses: Record<string, string> = {
  rdv: "Je comprends ! Nous avons plusieurs créneaux disponibles cette semaine. Voici les prochaines disponibilités :\n\n📅 **Mardi 15 janvier** : 9h00, 14h00\n📅 **Mercredi 16 janvier** : 10h00, 15h30\n📅 **Jeudi 17 janvier** : 8h30, 11h00\n\nQuel créneau vous conviendrait le mieux ?",
  tarif:
    "Nos tarifs varient selon le type d'intervention :\n\n🔧 Déplacement : 30€ (offert à partir de 200€ de travaux)\n🔧 Intervention simple : à partir de 80€\n🔧 Rénovation salle de bain : à partir de 2 500€\n🔧 Installation chauffe-eau : à partir de 500€\n\nJe vous invite à nous contacter pour un devis gratuit et personnalisé !",
  urgence:
    "🚨 **Urgence plomberie**\n\nJe comprends votre urgence ! Voici ce que vous pouvez faire immédiatement :\n\n1. Coupez l'arrivée d'eau générale\n2. Appelez notre numéro d'urgence : **06 98 76 54 32**\n\nNous intervenons en moins de 30 minutes sur Paris. Le tarif d'urgence est de 120€ (déplacement inclus).",
  zone: "Notre zone d'intervention couvre :\n\n📍 **Paris** (tous les arrondissements)\n📍 **Banlieue proche** (dans un rayon de 10km)\n\nPour les interventions plus éloignées, contactez-nous pour vérifier la faisabilité.",
};

// F1 : wrapper de gate — un user Free/Pro qui atterrit ici voit un CTA upgrade,
// pas l'interface chat cassée. On garde le composant interne intouché.
export default function AIChatPage() {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <UpgradeGate feature="ai.chat">
        <AIChatInner />
      </UpgradeGate>
    </div>
  );
}

function AIChatInner() {
  // Lot 18 B2/B3 : on part sur un message d'accueil neutre ("notre équipe"),
  // puis on le remplace dès que le business est chargé pour afficher son vrai nom.
  const [messages, setMessages] = useState<Message[]>(() => [buildInitialMessage(null)]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/my-business")
      .then((r) => r.json())
      .then((b) => {
        if (b?.id) setBusinessId(b.id);
        if (b?.name) {
          setBusinessName(b.name);
          // Remplace le message d'accueil UNIQUEMENT s'il n'a pas encore été
          // remplacé par un vrai échange (évite d'écraser la conversation).
          setMessages((prev) =>
            prev.length === 1 && prev[0].id === "1" ? [buildInitialMessage(b.name)] : prev
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getAIResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();
    if (lower.includes("rdv") || lower.includes("rendez-vous") || lower.includes("créneau"))
      return aiResponses["rdv"];
    if (lower.includes("tarif") || lower.includes("prix") || lower.includes("coût"))
      return aiResponses["tarif"];
    if (lower.includes("urgence") || lower.includes("fuite") || lower.includes("cassé"))
      return aiResponses["urgence"];
    if (lower.includes("zone") || lower.includes("intervention") || lower.includes("déplacement"))
      return aiResponses["zone"];
    return "Merci pour votre message ! Je vais transmettre votre demande à notre équipe qui vous répondra dans les plus brefs délais. En attendant, n'hésitez pas à me poser d'autres questions sur nos services.";
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call real AI API
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          message: messageText,
          sessionId: "dashboard-session",
        }),
      });

      const data = await res.json();
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || data.error || "Désolé, je n'ai pas pu répondre.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (e) {
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Erreur de connexion. Veuillez réessayer.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Assistant IA</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Votre assistant intelligent disponible 24/7
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Chat */}
        <div className="lg:col-span-3">
          <Card className="h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  {/* Lot 18 B2 : nom du business dynamique, jamais "Dupont Plomberie" en dur */}
                  <CardTitle className="text-base">Assistant {businessName ?? "IA"}</CardTitle>
                  <CardDescription>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      En ligne
                    </span>
                  </CardDescription>
                </div>
              </div>
              <Badge variant="purple">
                <Sparkles className="mr-1 h-3 w-3" />
                IA Premium
              </Badge>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                      msg.role === "user"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Quick actions */}
            <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900 dark:border-slate-700 dark:hover:border-white dark:hover:text-slate-100"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Écrivez votre message..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capacités de l&apos;IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Zap, label: "Réponses instantanées", desc: "24/7" },
                { icon: Clock, label: "Prise de RDV", desc: "Automatique" },
                { icon: Bot, label: "Qualification", desc: "Des demandes" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <item.icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
