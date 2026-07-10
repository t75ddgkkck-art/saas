/**
 * Design system doc — page statique listant les composants UI (Lot 28).
 *
 * Alternative pragmatique à Storybook :
 *  - 0 dep NPM ajoutée (Storybook = +200 MB deps + config Vite complexe)
 *  - Rendu réel dans le contexte de l'app (dark mode, i18n, styles Tailwind)
 *  - Chaque exemple sert AUSSI de test visuel manuel
 *
 * Accessible en dev ET prod : les designers/développeurs peuvent voir toutes
 * les variantes d'un coup. Bloquée par middleware ou robots ? Non, publique
 * (aucun secret) mais bloquée du sitemap car pas orientée SEO.
 *
 * Pour l'étendre : ajouter une section par nouveau composant.
 */

import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonListItem } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Store,
  Plus,
  Check,
  Star,
  Trash2,
  Loader2,
  Calendar,
  Info,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Design System",
  description: "Composants UI Vitrix — exemples visuels.",
  // Pas dans le sitemap, pas d'indexation
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Design System
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Composants UI Vitrix. Chaque section montre les variantes disponibles avec leur code.
          </p>
        </header>

        {/* Buttons */}
        <Section title="Button" description="Variants + tailles + loading + icons">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="success">Success</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="icône">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button loading>Loading</Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Left icon</Button>
            <Button rightIcon={<Check className="h-4 w-4" />}>Right icon</Button>
            <Button disabled>Disabled</Button>
          </div>
          <Code>{`<Button variant="primary" size="md" loading={false}>Texte</Button>`}</Code>
        </Section>

        {/* Badge */}
        <Section title="Badge" description="Statuts et labels courts">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="purple">Purple</Badge>
          </div>
          <Code>{`<Badge variant="success">Signé</Badge>`}</Code>
        </Section>

        {/* Inputs */}
        <Section title="Inputs & Forms" description="Input, Textarea, Select avec labels + états">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nom" placeholder="Jean Dupont" />
            <Input
              label="Email"
              type="email"
              placeholder="vous@exemple.fr"
              defaultValue="test@vitrix.fr"
            />
            <Input label="Requis" placeholder="Obligatoire" required />
            <Input label="Désactivé" placeholder="Non modifiable" disabled />
            <Select
              label="Catégorie"
              options={[
                { value: "plomberie", label: "Plomberie" },
                { value: "electricite", label: "Électricité" },
                { value: "coiffure", label: "Coiffure" },
              ]}
              placeholder="Choisir…"
            />
            <Textarea label="Description" placeholder="Décrivez votre activité…" rows={3} />
          </div>
          <Code>{`<Input label="Email" type="email" required />`}</Code>
        </Section>

        {/* Card */}
        <Section title="Card" description="Container standard avec header/body/footer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Titre carte</CardTitle>
                <CardDescription>Sous-titre / description courte</CardDescription>
              </CardHeader>
              <CardContent>
                Contenu principal. Peut contenir n'importe quel JSX — texte, form, liste, etc.
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                      Configuration OK
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Tous les checks passent.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Code>{`<Card><CardHeader><CardTitle>...</CardTitle></CardHeader></Card>`}</Code>
        </Section>

        {/* Skeleton */}
        <Section title="Skeleton" description="Loading placeholders animés">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-24 w-full" />
            <SkeletonListItem />
          </div>
          <Code>{`<Skeleton className="h-24 w-full" />`}</Code>
        </Section>

        {/* EmptyState */}
        <Section title="EmptyState" description="Listes vides avec CTA">
          <EmptyState
            icon={<Calendar className="h-10 w-10" />}
            title="Aucun rendez-vous"
            description="Créez votre premier RDV pour commencer à organiser votre agenda."
            action={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau RDV
              </Button>
            }
          />
          <Code>{`<EmptyState icon={<Icon />} title="..." description="..." action={<Button/>} />`}</Code>
        </Section>

        {/* Palette colors */}
        <Section title="Palette" description="Tokens Tailwind principaux + états">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Swatch className="bg-slate-900 text-white" label="slate-900 (primary)" />
            <Swatch className="bg-slate-600 text-white" label="slate-600 (text)" />
            <Swatch
              className="bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              label="slate-100 (bg)"
            />
            <Swatch className="bg-emerald-500 text-white" label="emerald (success)" />
            <Swatch className="bg-amber-500 text-white" label="amber (warning)" />
            <Swatch className="bg-red-500 text-white" label="red (danger)" />
            <Swatch className="bg-blue-500 text-white" label="blue (info)" />
            <Swatch className="bg-purple-500 text-white" label="purple (premium)" />
          </div>
        </Section>

        {/* Icons */}
        <Section title="Icons" description="lucide-react — cohérent partout">
          <div className="flex flex-wrap gap-4 text-slate-700 dark:text-slate-300">
            <IconSample icon={<Store className="h-5 w-5" />} label="Store" />
            <IconSample icon={<Calendar className="h-5 w-5" />} label="Calendar" />
            <IconSample icon={<Star className="h-5 w-5" />} label="Star" />
            <IconSample icon={<Trash2 className="h-5 w-5" />} label="Trash" />
            <IconSample icon={<Loader2 className="h-5 w-5 animate-spin" />} label="Loading" />
            <IconSample icon={<Info className="h-5 w-5" />} label="Info" />
            <IconSample icon={<AlertTriangle className="h-5 w-5" />} label="Warning" />
            <IconSample icon={<Sparkles className="h-5 w-5" />} label="AI" />
          </div>
          <Code>{`import { Store } from "lucide-react";\n<Store className="h-5 w-5" />`}</Code>
        </Section>

        {/* Typography */}
        <Section title="Typography" description="Titres + corps de texte">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              H1 - Titre principal
            </h1>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">H2 - Section</h2>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              H3 - Sous-section
            </h3>
            <p className="text-base text-slate-700 dark:text-slate-300">
              Paragraphe standard : slate-700 sur fond clair, slate-300 sur fond sombre. Contraste
              AA 7.5:1.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Petit texte (description, meta). slate-500 dark:slate-400 = contraste AA 4.6:1.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Micro-texte (labels, timestamps).
            </p>
          </div>
        </Section>

        <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>
            Design system Vitrix • Lot 28 (DevEx). Pour ajouter un composant : éditez{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
              src/app/design-system/page.tsx
            </code>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100 dark:bg-slate-800">
      <code>{children}</code>
    </pre>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div
      className={`flex h-16 items-end rounded-lg p-2 text-xs font-medium ${className}`}
      title={label}
    >
      {label}
    </div>
  );
}

function IconSample({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {icon}
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
