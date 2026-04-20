import { Platform } from 'react-native';

import type { Order, OrderItem } from '@/api/orders';

function formatCurrency(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '—';
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (Number.isNaN(n)) return String(raw);
  return `${n.toFixed(2)} ₾`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function escape(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderItemRow(item: OrderItem): string {
  const modifiers =
    item.modifiers && item.modifiers.length > 0
      ? `<div class="mods">${item.modifiers.map(m => escape(m.modifier_name)).join(', ')}</div>`
      : '';
  const notes = item.special_instructions
    ? `<div class="mods">${escape(item.special_instructions)}</div>`
    : '';
  return `
    <tr>
      <td class="qty">${item.quantity ?? 1}×</td>
      <td class="name">
        <div>${escape(item.item_name)}</div>
        ${modifiers}
        ${notes}
      </td>
      <td class="price">${formatCurrency(item.total_price)}</td>
    </tr>`;
}

export function buildReceiptHtml(order: Order, restaurantSlug: string | null): string {
  const items = (order.items ?? []).map(renderItemRow).join('');
  const hasTax = order.tax_amount && parseFloat(order.tax_amount) > 0;
  const hasService = order.service_charge && parseFloat(order.service_charge) > 0;
  const hasTip = order.tip_amount && parseFloat(order.tip_amount) > 0;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escape(order.order_number)}</title>
  <style>
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
    .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #555; }
  </style>
</head>
<body>
  <h1>${escape(restaurantSlug?.toUpperCase() ?? 'AiMenu POS')}</h1>
  <div class="meta">
    Order ${escape(order.order_number)}<br/>
    ${order.table_number ? `Table ${escape(order.table_number)} · ` : ''}${formatDateTime(order.created_at)}
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
    ${hasTax ? `<tr><td class="label">Tax</td><td class="val">${formatCurrency(order.tax_amount)}</td></tr>` : ''}
    ${hasService ? `<tr><td class="label">Service</td><td class="val">${formatCurrency(order.service_charge)}</td></tr>` : ''}
    ${hasTip ? `<tr><td class="label">Tip</td><td class="val">${formatCurrency(order.tip_amount)}</td></tr>` : ''}
    <tr class="grand">
      <td>Total</td>
      <td class="val">${formatCurrency(order.total)}</td>
    </tr>
  </table>

  <div class="footer">
    ${order.customer_name ? `${escape(order.customer_name)}<br/>` : ''}
    Thank you!
  </div>
</body>
</html>`;
}

export async function printReceipt(order: Order, restaurantSlug: string | null): Promise<void> {
  const html = buildReceiptHtml(order, restaurantSlug);

  if (Platform.OS === 'web') {
    printViaIframe(html);
    return;
  }

  // Native: lazy-import expo-print so the web bundle doesn't pull it.
  try {
    const Print = await import('expo-print');
    await Print.printAsync({ html });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Native print failed (install expo-print to enable on iPad):', err);
  }
}

function printViaIframe(html: string): void {
  const doc = globalThis.document;
  if (!doc) return;

  const iframe = doc.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
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
