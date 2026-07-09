// Extension du type jsPDF pour la propriété `lastAutoTable`
// exposée par le plugin jspdf-autotable après un appel autoTable(doc, ...).
import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
      pageNumber: number;
      settings: unknown;
    };
  }
}
