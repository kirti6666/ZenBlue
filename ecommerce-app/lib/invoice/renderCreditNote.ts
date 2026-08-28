import { PdfDoc } from "./pdf";

const LINE: [number, number, number] = [0.78, 0.78, 0.8];
const HEAD: [number, number, number] = [0.94, 0.95, 0.97];
const MUTED: [number, number, number] = [0.42, 0.45, 0.5];
const DARK: [number, number, number] = [0.07, 0.09, 0.15];

const money = (value: number) => (Number(value) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value: string | Date) => new Date(value).toLocaleDateString("en-IN");

export function renderCreditNotePdf(snap: any): Buffer {
  const doc = new PdfDoc();
  const left = 36;
  const width = doc.width - 72;
  let y = 36;

  doc.rect(left, y, width, 28, { fill: HEAD, stroke: LINE });
  doc.text("CREDIT NOTE", left, y + 8, { font: "bold", size: 14, align: "center", width, color: DARK });
  y += 28;

  const seller = snap.seller ?? {};
  const metaX = left + width - 220;
  doc.rect(left, y, width, 112, { stroke: LINE });
  doc.line(metaX, y, metaX, y + 112, { color: LINE });
  let sy = y + 10;
  doc.text(seller.tradeName || seller.legalName || "", left + 8, sy, { font: "bold", size: 11, color: DARK });
  sy += 15;
  for (const line of [seller.legalName, seller.addressLine1, seller.addressLine2, [seller.city, seller.state, seller.pincode].filter(Boolean).join(", "), seller.gstin && `GSTIN: ${seller.gstin}`].filter(Boolean)) {
    doc.text(String(line), left + 8, sy, { size: 8.5, color: MUTED });
    sy += 11;
  }
  const meta: Array<[string, string]> = [
    ["Credit Note No.", snap.creditNoteNumber],
    ["Date", date(snap.issuedAt)],
    ["Original Invoice", snap.reference?.invoiceNumber || ""],
    ["Invoice Date", date(snap.reference?.invoiceDate)],
    ["Order No.", snap.reference?.orderNumber || ""],
    ["Place of Supply", snap.placeOfSupply || ""],
  ];
  meta.forEach(([label, value], index) => {
    const rowY = y + 10 + index * 15;
    doc.text(label, metaX + 8, rowY, { size: 8, color: MUTED });
    doc.text(doc.truncate(value, 116, "bold", 8.5), metaX + 96, rowY, { size: 8.5, font: "bold", color: DARK });
  });
  y += 112;

  const buyer = snap.buyer ?? {};
  doc.rect(left, y, width, 92, { stroke: LINE });
  doc.text("CREDIT TO", left + 8, y + 8, { font: "bold", size: 9, color: DARK });
  let by = y + 23;
  for (const line of [buyer.name, ...(buyer.addressLines ?? []), [buyer.city, buyer.state, buyer.pincode].filter(Boolean).join(", "), buyer.email, buyer.phone].filter(Boolean)) {
    doc.text(String(line), left + 8, by, { size: 8.5, color: MUTED });
    by += 11;
  }
  y += 92;

  doc.rect(left, y, width, 22, { fill: HEAD, stroke: LINE });
  doc.text("Reason", left + 8, y + 6, { font: "bold", size: 8.5, color: DARK });
  doc.text(doc.truncate(snap.reference?.reason || "Return / cancellation", width - 90, "regular", 8.5), left + 82, y + 6, { size: 8.5, color: DARK });
  y += 36;

  const totals = snap.totals ?? {};
  const rows: Array<[string, string, boolean]> = [
    ["Taxable Value", money(totals.taxableValue), false],
    ...(snap.isInterState ? [["IGST", money(totals.igst), false] as [string, string, boolean]] : [["CGST", money(totals.cgst), false] as [string, string, boolean], ["SGST", money(totals.sgst), false] as [string, string, boolean]]),
    ["Total Tax", money(totals.totalTax), false],
    ["Credit Amount", `Rs. ${money(totals.grandTotal)}`, true],
  ];
  const boxX = left + width - 250;
  rows.forEach(([label, value, strong], index) => {
    const rowY = y + index * 20;
    if (strong) doc.rect(boxX, rowY - 3, 250, 22, { fill: HEAD, stroke: LINE });
    doc.text(label, boxX + 8, rowY + 2, { size: strong ? 10 : 9, font: strong ? "bold" : "regular", color: strong ? DARK : MUTED });
    doc.text(value, boxX, rowY + 2, { size: strong ? 10 : 9, font: strong ? "bold" : "regular", color: DARK, align: "right", width: 242 });
  });
  doc.text("Amount in Words", left, y + 2, { size: 8, color: MUTED });
  for (const [index, line] of doc.wrap(snap.amountInWords || "", width - 280, "bold", 9).entries()) {
    doc.text(line, left, y + 16 + index * 12, { size: 9, font: "bold", color: DARK });
  }
  y += rows.length * 20 + 28;

  doc.text(snap.document?.declaration || "", left, y, { size: 8, color: MUTED });
  doc.text(seller.tradeName || seller.legalName || "", left + width - 180, y, { size: 9, font: "bold", color: DARK, align: "right", width: 180 });
  doc.line(left + width - 180, y + 48, left + width, y + 48, { color: LINE });
  doc.text("Authorised Signatory", left + width - 180, y + 52, { size: 8, color: MUTED, align: "right", width: 180 });

  const footerY = doc.height - 50;
  doc.line(left, footerY, left + width, footerY, { color: LINE });
  doc.text(snap.document?.footerText || "This is a computer-generated document.", left, footerY + 8, { size: 7.5, color: MUTED });
  doc.text("Page 1", left + width - 50, footerY + 8, { size: 7.5, color: MUTED, align: "right", width: 50 });
  return doc.build();
}
