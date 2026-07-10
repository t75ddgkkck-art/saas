import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PDFData {
  type: "devis" | "facture";
  number: string;
  date: string;
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
}

export function generateProfessionalPDF(data: PDFData) {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate-900

  // --- HEADER ---
  // Business Info (Left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text(data.business.name.toUpperCase(), 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const businessInfo = [
    data.business.address || "",
    data.business.siret ? `SIRET: ${data.business.siret}` : "",
    data.business.phone ? `Tél: ${data.business.phone}` : "",
    data.business.email ? `Email: ${data.business.email}` : "",
  ].filter((line) => line !== "");
  doc.text(businessInfo, 14, 30);

  // Document Title (Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  const title = data.type === "devis" ? "DEVIS" : "FACTURE";
  doc.text(title, 195, 20, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`N° ${data.number}`, 195, 30, { align: "right" });
  doc.text(`Date: ${data.date}`, 195, 37, { align: "right" });

  // Line separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 45, 196, 45);

  // --- CLIENT INFO ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text("FACTURÉ À :", 14, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(data.client.name, 14, 68);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const clientInfo = [
    data.client.address || "",
    data.client.phone ? `Tél: ${data.client.phone}` : "",
    data.client.email ? `Email: ${data.client.email}` : "",
  ].filter((line) => line !== "");
  if (clientInfo.length > 0) {
    doc.text(clientInfo, 14, 75);
  }

  // --- ITEMS TABLE ---
  autoTable(doc, {
    startY: 90,
    head: [["Description", "Qté", "Prix Unit. HT", "Total HT"]],
    body: data.items.map((item) => [
      item.description,
      item.quantity,
      `${item.unitPrice.toFixed(2)} €`,
      `${item.total.toFixed(2)} €`,
    ]),
    theme: "grid",
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      textColor: 50,
    },
    columnStyles: {
      0: { cellWidth: 100 }, // Description wide
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // --- TOTALS ---
  const finalY = (doc.lastAutoTable?.finalY ?? 40) + 10;

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Total HT:`, 140, finalY, { align: "right" });
  doc.text(`${data.totalHT.toFixed(2)} €`, 195, finalY, { align: "right" });

  doc.text(`TVA (20%):`, 140, finalY + 7, { align: "right" });
  doc.text(`${data.tva.toFixed(2)} €`, 195, finalY + 7, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text(`Total TTC:`, 140, finalY + 16, { align: "right" });
  doc.text(`${data.totalTTC.toFixed(2)} €`, 195, finalY + 16, { align: "right" });

  // --- FOOTER / PAIEMENT ---
  let footerY = 280;
  if (data.business.iban) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);
    doc.text("Informations de paiement (Virement) :", 14, footerY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`IBAN: ${data.business.iban}`, 14, footerY + 5);
    if (data.business.bic) {
      doc.text(`BIC: ${data.business.bic}`, 14, footerY + 10);
    }
    footerY += 15;
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Document généré automatiquement par Vitrix - www.vitrix.fr", 105, 292, {
    align: "center",
  });

  // Save
  const filename = `${data.type}_${data.number}_${data.client.name.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
