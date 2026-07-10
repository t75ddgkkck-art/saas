import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/Card";

/**
 * EmptyState réutilisable (Lot 20).
 *
 * À utiliser dès qu'une liste est vide : bien mieux qu'une div "Aucun X" en
 * texte plat. Améliore la découvrabilité (CTA visible) et l'esthétique.
 *
 * Usage :
 *   <EmptyState
 *     icon={<Calendar className="h-10 w-10" />}
 *     title="Aucun rendez-vous"
 *     description="Créez votre premier RDV pour commencer."
 *     action={<Button onClick={...}>Nouveau RDV</Button>}
 *   />
 */
interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center sm:p-12">
        <div className="text-slate-400 dark:text-slate-500" aria-hidden="true">
          {icon}
        </div>
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
