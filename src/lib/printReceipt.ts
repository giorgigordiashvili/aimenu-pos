import { Platform } from "react-native";

import type { Order, OrderItem } from "@/api/orders";
import type { CashShift, PaymentRow, ShiftReport } from "@/api/payments";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card_terminal: "Card",
  online_bog: "Online (BOG)",
  online_flitt: "Online (Flitt)",
  voucher: "Voucher",
  other: "Other",
  card: "Card",
  mobile: "Mobile",
};

function formatCurrency(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return "—";
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  if (Number.isNaN(n)) return String(raw);
  return `${n.toFixed(2)} ₾`;
}

function gt0(raw: string | number | undefined | null): boolean {
  if (raw === undefined || raw === null) return false;
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(n) && n > 0;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function escape(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_CSS = `
    @page { size: 80mm auto; margin: 4mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans Georgian', Roboto, sans-serif;
      color: #000;
      font-size: 12px;
      max-width: 280px;
      margin: 0 auto;
      padding: 8px 0;
    }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
    h2 { font-size: 13px; margin: 10px 0 4px; }
    .meta { text-align: center; font-size: 11px; color: #333; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 0; vertical-align: top; }
    td.qty { width: 32px; font-weight: 600; }
    td.price { text-align: right; white-space: nowrap; }
    .mods { font-size: 10px; color: #555; margin-top: 2px; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .totals td { padding: 2px 0; }
    .totals td.label { color: #333; }
    .totals td.val { text-align: right; font-weight: 500; }
    .totals tr.grand td {
      padding-top: 6px;
      border-top: 1px solid #000;
      font-size: 14px;
      font-weight: 700;
    }
    .comp { color: #555; font-style: italic; }
    .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #555; }
`;

function renderItemRow(item: OrderItem): string {
  const modifiers =
    item.modifiers && item.modifiers.length > 0
      ? `<div class="mods">${item.modifiers.map((m) => escape(m.modifier_name)).join(", ")}</div>`
      : "";
  const notes = item.special_instructions
    ? `<div class="mods">${escape(item.special_instructions)}</div>`
    : "";
  const discount = item.is_comped
    ? `<div class="mods comp">On the house</div>`
    : gt0(item.discount_amount)
      ? `<div class="mods">Discount −${formatCurrency(item.discount_amount)}${item.discount_reason_label ? ` (${escape(item.discount_reason_label)})` : ""}</div>`
      : "";
  const price = item.is_comped
    ? "0.00 ₾"
    : formatCurrency(item.net_price ?? item.total_price);
  return `
    <tr>
      <td class="qty">${item.quantity ?? 1}×</td>
      <td class="name">
        <div>${escape(item.item_name)}</div>
        ${modifiers}
        ${notes}
        ${discount}
      </td>
      <td class="price">${price}</td>
    </tr>`;
}

export interface ReceiptOptions {
  /** The payment just taken (tendered / change / receipt number). */
  payment?: PaymentRow | null;
  cashier?: string | null;
  restaurantName?: string | null;
}

export function buildReceiptHtml(
  order: Order,
  restaurantSlug: string | null,
  options: ReceiptOptions = {},
): string {
  const items = (order.items ?? [])
    .filter((i) => i.status !== "cancelled")
    .map(renderItemRow)
    .join("");
  const payments = order.payments ?? [];
  const pay = options.payment ?? null;
  const title =
    options.restaurantName ?? restaurantSlug?.toUpperCase() ?? "AiMenu POS";

  const paymentRows = payments
    .map(
      (p) =>
        `<tr><td class="label">${escape(METHOD_LABELS[p.payment_method] ?? p.payment_method)}${p.receipt_number ? ` · ${escape(p.receipt_number)}` : ""}</td><td class="val">${formatCurrency(p.amount)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escape(order.order_number)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <h1>${escape(title)}</h1>
  <div class="meta">
    Order ${escape(order.order_number)}<br/>
    ${order.table_number ? `Table ${escape(order.table_number)} · ` : ""}${formatDateTime(order.created_at)}
    ${pay?.receipt_number ? `<br/>Receipt ${escape(pay.receipt_number)}` : ""}
  </div>

  <div class="divider"></div>

  <table>
    ${items}
  </table>

  <div class="divider"></div>

  <table class="totals">
    <tr>
      <td class="label">Subtotal</td>
      <td class="val">${formatCurrency(order.subtotal)}</td>
    </tr>
    ${gt0(order.discount_amount) ? `<tr><td class="label">Discount</td><td class="val">−${formatCurrency(order.discount_amount)}</td></tr>` : ""}
    ${gt0(order.tax_amount) ? `<tr><td class="label">Tax</td><td class="val">${formatCurrency(order.tax_amount)}</td></tr>` : ""}
    ${gt0(order.service_charge) ? `<tr><td class="label">Service</td><td class="val">${formatCurrency(order.service_charge)}</td></tr>` : ""}
    ${gt0(order.tip_amount) ? `<tr><td class="label">Tip</td><td class="val">${formatCurrency(order.tip_amount)}</td></tr>` : ""}
    <tr class="grand">
      <td>Total</td>
      <td class="val">${formatCurrency(order.total)}</td>
    </tr>
    ${paymentRows}
    ${pay && gt0(pay.tip_amount) ? `<tr><td class="label">Tip</td><td class="val">${formatCurrency(pay.tip_amount)}</td></tr>` : ""}
    ${pay && gt0(pay.tendered) ? `<tr><td class="label">Cash received</td><td class="val">${formatCurrency(pay.tendered)}</td></tr>` : ""}
    ${pay && gt0(pay.change_given) ? `<tr><td class="label">Change</td><td class="val">${formatCurrency(pay.change_given)}</td></tr>` : ""}
    ${gt0(order.balance) ? `<tr><td class="label">Balance due</td><td class="val">${formatCurrency(order.balance)}</td></tr>` : ""}
  </table>

  <div class="footer">
    ${order.customer_name ? `${escape(order.customer_name)}<br/>` : ""}
    ${options.cashier ? `Cashier: ${escape(options.cashier)}<br/>` : ""}
    Thank you!
  </div>
</body>
</html>`;
}

export function buildZReportHtml(
  shift: CashShift,
  report: Partial<ShiftReport>,
  restaurantName: string | null,
): string {
  const row = (label: string, value: string | number | undefined, cls = "") =>
    `<tr class="${cls}"><td class="label">${escape(label)}</td><td class="val">${escape(String(value ?? "—"))}</td></tr>`;
  const methods = Object.entries(report.by_method ?? {})
    .map(([m, v]) =>
      row(
        `${METHOD_LABELS[m] ?? m} (${v.count})`,
        `${formatCurrency(v.amount)} + tips ${formatCurrency(v.tips)}`,
      ),
    )
    .join("");
  const movements = (report.movements ?? [])
    .map((m) =>
      row(
        `${m.kind === "paid_in" ? "In" : "Out"}: ${m.reason}`,
        formatCurrency(m.amount),
      ),
    )
    .join("");
  const isZ = shift.status === "closed";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${isZ ? "Z" : "X"} report · Shift #${shift.number}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <h1>${escape(restaurantName ?? "AiMenu POS")}</h1>
  <div class="meta">
    ${isZ ? "Z REPORT" : "X REPORT (open shift)"}<br/>
    Shift #${shift.number}${shift.register ? ` · ${escape(shift.register)}` : ""}<br/>
    Opened ${formatDateTime(shift.opened_at)} ${shift.opened_by_name ? `by ${escape(shift.opened_by_name)}` : ""}<br/>
    ${isZ ? `Closed ${formatDateTime(shift.closed_at)} ${shift.closed_by_name ? `by ${escape(shift.closed_by_name)}` : ""}` : `As of ${formatDateTime(report.until)}`}
  </div>
  <div class="divider"></div>
  <table class="totals">
    ${row("Sales", formatCurrency(report.sales))}
    ${row("Tips", formatCurrency(report.tips))}
    ${row("Refunds", `−${formatCurrency(report.refunds)}`)}
    ${row("Net sales", formatCurrency(report.net_sales), "grand")}
    ${row("Payments", report.payments_count)}
    ${row("Orders", report.orders_count)}
  </table>
  <h2>By method</h2>
  <table class="totals">${methods || row("—", "no payments")}</table>
  <h2>Cash drawer</h2>
  <table class="totals">
    ${row("Opening float", formatCurrency(report.opening_float))}
    ${row("Cash sales", formatCurrency(report.cash_sales))}
    ${row("Cash tips", formatCurrency(report.cash_tips))}
    ${row("Paid in", formatCurrency(report.paid_in))}
    ${row("Paid out", `−${formatCurrency(report.paid_out)}`)}
    ${row("Cash refunds", `−${formatCurrency(report.cash_refunds)}`)}
    ${row("Expected cash", formatCurrency(report.expected_cash), "grand")}
    ${isZ ? row("Counted cash", formatCurrency(report.counted_cash)) : ""}
    ${isZ ? row("Difference", formatCurrency(report.difference), "grand") : ""}
  </table>
  ${movements ? `<h2>Paid in / out</h2><table class="totals">${movements}</table>` : ""}
  <h2>Discounts &amp; voids</h2>
  <table class="totals">
    ${row(`Order discounts (${report.discounts?.orders_count ?? 0})`, formatCurrency(report.discounts?.orders_amount))}
    ${row(`Item discounts (${report.discounts?.items_count ?? 0})`, formatCurrency(report.discounts?.items_amount))}
    ${row(`Comps (${report.comps?.count ?? 0})`, formatCurrency(report.comps?.amount))}
    ${row(`Voids (${report.voids?.count ?? 0}, after kitchen ${report.voids?.after_kitchen_count ?? 0})`, formatCurrency(report.voids?.amount))}
  </table>
  <div class="footer">Printed ${formatDateTime(new Date().toISOString())}</div>
</body>
</html>`;
}

export async function printReceipt(
  order: Order,
  restaurantSlug: string | null,
  options: ReceiptOptions = {},
): Promise<void> {
  await printHtml(buildReceiptHtml(order, restaurantSlug, options));
}

/** Print any HTML: hidden iframe on web, expo-print on native. */
export async function printHtml(html: string): Promise<void> {
  if (Platform.OS === "web") {
    printViaIframe(html);
    return;
  }

  // Native: lazy-import expo-print so the web bundle doesn't pull it.
  try {
    const Print = await import("expo-print");
    await Print.printAsync({ html });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "Native print failed (install expo-print to enable on iPad):",
      err,
    );
  }
}

function printViaIframe(html: string): void {
  const doc = globalThis.document;
  if (!doc) return;

  const iframe = doc.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  doc.body.appendChild(iframe);

  const cleanup = () => {
    try {
      doc.body.removeChild(iframe);
    } catch {
      /* already gone */
    }
  };

  iframe.onload = () => {
    const w = iframe.contentWindow;
    if (!w) {
      cleanup();
      return;
    }
    try {
      w.focus();
      w.print();
    } finally {
      // Give the browser ~1s to open the dialog before we yank the iframe.
      setTimeout(cleanup, 1000);
    }
  };

  const idoc = iframe.contentDocument;
  if (!idoc) {
    cleanup();
    return;
  }
  idoc.open();
  idoc.write(html);
  idoc.close();
}
