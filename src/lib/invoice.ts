import { formatPrice } from "./utils";

interface InvoiceData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  businessAddress: string;
  businessSiret: string;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  tax: number;
  total: number;
  date: string;
  dueDate: string;
  paymentMethod: string;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Facture ${data.invoiceNumber}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #0f172a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
    .company { font-size: 24px; font-weight: bold; }
    .invoice-info { text-align: right; }
    .invoice-number { font-size: 28px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { text-align: left; padding: 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .totals { float: right; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals-row.total { font-size: 20px; font-weight: bold; border-top: 2px solid #0f172a; padding-top: 12px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${data.businessName}</div>
      <div>${data.businessAddress}</div>
      <div>SIRET: ${data.businessSiret}</div>
    </div>
    <div class="invoice-info">
      <div class="invoice-number">${data.invoiceNumber}</div>
      <div>Date: ${data.date}</div>
      <div>Échéance: ${data.dueDate}</div>
    </div>
  </div>

  <div style="margin: 30px 0;">
    <strong>Facturé à :</strong><br>
    ${data.clientName}<br>
    ${data.clientEmail}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Qté</th>
        <th class="text-right">Prix unit.</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map(item => `
      <tr>
        <td>${item.description}</td>
        <td class="text-right">${item.quantity}</td>
        <td class="text-right">${formatPrice(item.unitPrice)}</td>
        <td class="text-right">${formatPrice(item.total)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Sous-total</span>
      <span>${formatPrice(data.subtotal)}</span>
    </div>
    <div class="totals-row">
      <span>TVA (20%)</span>
      <span>${formatPrice(data.tax)}</span>
    </div>
    <div class="totals-row total">
      <span>Total TTC</span>
      <span>${formatPrice(data.total)}</span>
    </div>
  </div>

  <div style="clear: both; margin-top: 40px;">
    <p><strong>Moyen de paiement :</strong> ${data.paymentMethod}</p>
  </div>

  <div class="footer">
    ${data.businessName} — SIRET ${data.businessSiret}<br>
    Facture générée automatiquement via Vitrix
  </div>
</body>
</html>`;
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000 + 10000);
  return `FAC-${year}-${random}`;
}
