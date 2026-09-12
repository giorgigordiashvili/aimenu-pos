import { getPaymentReceipt } from "@/api/fiscal";
import type { Order } from "@/api/orders";
import type { PaymentRow } from "@/api/payments";
import { printReceiptJob, type PrinterRow } from "@/api/printing";
import { printReceipt, type ReceiptFiscal } from "@/lib/printReceipt";

/**
 * Print a receipt where it makes sense: on the restaurant's receipt printer
 * (server-rendered, through the bridge) when one is set up, otherwise
 * through the browser / expo-print dialog on this device.
 */
export async function printReceiptAnywhere(opts: {
  order: Order;
  payment?: PaymentRow | null;
  receiptPrinters: PrinterRow[];
  restaurantSlug: string | null;
  restaurantName: string | null;
  cashier?: string | null;
  /** Fiscal module on: fetch the numbered receipt (legal header, VAT lines) for the browser print. */
  fiscalOn?: boolean;
}): Promise<"printer" | "browser"> {
  if (opts.receiptPrinters.length > 0) {
    await printReceiptJob(
      opts.payment
        ? { payment_id: opts.payment.id }
        : { order_id: opts.order.id },
    );
    return "printer";
  }
  let fiscal: ReceiptFiscal | null = null;
  if (opts.fiscalOn && opts.payment) {
    const r = await getPaymentReceipt(opts.payment.id);
    if (r) {
      fiscal = {
        fiscal: r.fiscal,
        number: r.number,
        legal_name: r.restaurant?.legal_name,
        address: r.restaurant?.address,
        tax_id_line: r.restaurant?.tax_id_line,
        vat_breakdown: r.vat_breakdown ?? [],
        vat_note: r.labels?.vat_note,
        footer: r.footer,
      };
    }
  }
  await printReceipt(opts.order, opts.restaurantSlug, {
    payment: opts.payment ?? null,
    cashier: opts.cashier ?? opts.payment?.processed_by_name ?? null,
    restaurantName: opts.restaurantName,
    fiscal,
  });
  return "browser";
}
