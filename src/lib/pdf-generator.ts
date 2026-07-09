import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

export interface InvoiceData {
  type: "devis" | "facture";
  number: string;
  date: string;
  dueDate?: string;
  business: {
    name: string;
    address: string;
    siret: string;
    phone: string;
    email: string;
    iban?: string;
    bic?: string;
  };
  client: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totalHT: number;
  tva: number;
  totalTTC: number;
  notes?: string;
  conditions?: string;
}

export type PdfTemplate = "standard" | "moderne" | "minimaliste";

export function generateInvoicePDF(data: InvoiceData, template: PdfTemplate = "standard"): jsPDF {
  const doc = new jsPDF();

  switch (template) {
    case "moderne":
      return generateModerneTemplate(doc, data);
    case "minimaliste":
      return generateMinimalisteTemplate(doc, data);
    case "standard":
    default:
      return generateStandardTemplate(doc, data);
  }
}

function generateStandardTemplate(doc: jsPDF, data: InvoiceData): jsPDF {
  // En-tête
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(data.business.name, 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.business.address, 14, 28);
  doc.text(`SIRET: ${data.business.siret}`, 14, 33);
  doc.text(`Tél: ${data.business.phone}`, 14, 38);
  doc.text(data.business.email, 14, 43);

  // Titre document
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const title = data.type === "devis" ? "DEVIS" : "FACTURE";
  doc.text(title, 140, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${data.number}`, 140, 28);
  doc.text(`Date: ${data.date}`, 140, 33);
  if (data.dueDate) {
    doc.text(`Échéance: ${data.dueDate}`, 140, 38);
  }

  // Client
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURÉ À:", 14, 60);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.client.name, 14, 66);
  if (data.client.address) doc.text(data.client.address, 14, 71);
  if (data.client.phone) doc.text(`Tél: ${data.client.phone}`, 14, 76);
  if (data.client.email) doc.text(data.client.email, 14, 81);

  // Tableau des prestations
  const tableData = data.items.map(item => [
    item.description,
    item.quantity.toString(),
    `${item.unitPrice.toFixed(2)} €`,
    `${item.total.toFixed(2)} €`,
  ]);

  autoTable(doc, {
    startY: 90,
    head: [["Description", "Qté", "Prix unit.", "Total"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
  });

  // Totaux
  const finalY = (doc.lastAutoTable?.finalY ?? 40) + 10;
  doc.setFontSize(10);
  doc.text(`Total HT:`, 140, finalY);
  doc.text(`${data.totalHT.toFixed(2)} €`, 195, finalY);

  doc.text(`TVA (20%):`, 140, finalY + 6);
  doc.text(`${data.tva.toFixed(2)} €`, 195, finalY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total TTC:`, 140, finalY + 14);
  doc.text(`${data.totalTTC.toFixed(2)} €`, 195, finalY + 14);

  // IBAN si présent
  if (data.business.iban) {
    const ibanY = finalY + 25;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Coordonnées bancaires:", 14, ibanY);
    doc.setFont("helvetica", "normal");
    doc.text(`IBAN: ${data.business.iban}`, 14, ibanY + 5);
    if (data.business.bic) {
      doc.text(`BIC: ${data.business.bic}`, 14, ibanY + 10);
    }
  }

  // Notes et conditions
  if (data.notes) {
    const notesY = data.business.iban ? finalY + 40 : finalY + 20;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 14, notesY);
    doc.setFont("helvetica", "normal");
    doc.text(data.notes, 14, notesY + 5);
  }

  // Pied de page
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text("Document généré par Vitrix - www.vitrix.fr", 105, 280, { align: "center" });

  return doc;
}

function generateModerneTemplate(doc: jsPDF, data: InvoiceData): jsPDF {
  // En-tête avec bandeau coloré
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, 210, 40, "F");

  doc.setTextColor(255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(data.business.name, 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.business.email, 14, 28);
  doc.text(data.business.phone, 14, 33);

  // Titre document
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  const title = data.type === "devis" ? "DEVIS" : "FACTURE";
  doc.text(title, 140, 20);

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${data.number}`, 140, 30);
  doc.text(`Date: ${data.date}`, 140, 35);

  // Client
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(14, 50, 80, 35, 3, 3, "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURÉ À:", 18, 57);
  doc.setFont("helvetica", "normal");
  doc.text(data.client.name, 18, 63);
  if (data.client.address) doc.text(data.client.address, 18, 68);
  if (data.client.email) doc.text(data.client.email, 18, 73);

  // Tableau
  const tableData = data.items.map(item => [
    item.description,
    item.quantity.toString(),
    `${item.unitPrice.toFixed(2)} €`,
    `${item.total.toFixed(2)} €`,
  ]);

  autoTable(doc, {
    startY: 95,
    head: [["Description", "Qté", "Prix unit.", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
  });

  // Totaux
  const finalY = (doc.lastAutoTable?.finalY ?? 40) + 10;
  doc.setFontSize(10);
  doc.text(`Total HT: ${data.totalHT.toFixed(2)} €`, 140, finalY);
  doc.text(`TVA: ${data.tva.toFixed(2)} €`, 140, finalY + 6);
  doc.setFont("helvetica", "bold");
  doc.text(`Total TTC: ${data.totalTTC.toFixed(2)} €`, 140, finalY + 12);

  // IBAN
  if (data.business.iban) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`IBAN: ${data.business.iban}`, 14, finalY + 5);
    if (data.business.bic) doc.text(`BIC: ${data.business.bic}`, 14, finalY + 10);
  }

  // Pied de page
  doc.setTextColor(128);
  doc.setFontSize(8);
  doc.text("Document généré par Vitrix", 105, 280, { align: "center" });

  return doc;
}

function generateMinimalisteTemplate(doc: jsPDF, data: InvoiceData): jsPDF {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.business.name, 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.business.address} | SIRET: ${data.business.siret}`, 14, 26);

  const title = data.type === "devis" ? "DEVIS" : "FACTURE";
  doc.setFontSize(14);
  doc.text(`${title} N° ${data.number}`, 140, 20);
  doc.setFontSize(9);
  doc.text(`Date: ${data.date}`, 140, 26);

  // Client
  doc.setFontSize(9);
  doc.text(data.client.name, 14, 40);
  if (data.client.email) doc.text(data.client.email, 14, 45);

  // Tableau simple
  const tableData = data.items.map(item => [
    item.description,
    item.quantity.toString(),
    `${item.unitPrice.toFixed(2)} €`,
    `${item.total.toFixed(2)} €`,
  ]);

  autoTable(doc, {
    startY: 55,
    head: [["Description", "Qté", "Prix", "Total"]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20 },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
  });

  const finalY = (doc.lastAutoTable?.finalY ?? 40) + 8;
  doc.setFontSize(10);
  doc.text(`Total TTC: ${data.totalTTC.toFixed(2)} €`, 140, finalY);

  if (data.business.iban) {
    doc.setFontSize(8);
    doc.text(`IBAN: ${data.business.iban}`, 14, finalY + 5);
  }

  return doc;
}
