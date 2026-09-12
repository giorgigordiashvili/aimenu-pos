import type { Order } from "@/api/orders";
import type { PaymentRow } from "@/api/payments";
import { printReceiptJob, type PrinterRow } from "@/api/printing";
import { printReceipt } from "@/lib/printReceipt";

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
}): Promise<"printer" | "browser"> {
  if (opts.receiptPrinters.length > 0) {
    await printReceiptJob(
      opts.payment
        ? { payment_id: opts.payment.id }
        : { order_id: opts.order.id },
    );
    return "printer";
  }
  await printReceipt(opts.order, opts.restaurantSlug, {
    payment: opts.payment ?? null,
    cashier: opts.cashier ?? opts.payment?.processed_by_name ?? null,
    restaurantName: opts.restaurantName,
  });
  return "browser";
}
