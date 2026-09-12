import { api } from "./client";

export type PrinterKind = "kitchen" | "bar" | "receipt";

export interface PrinterRow {
  id: string;
  name: string;
  kind: PrinterKind;
  stations: "kitchen" | "bar" | "both";
  paper: "80" | "58";
  connection: "bridge" | "browser";
  copies: number;
  auto_print: boolean;
  open_drawer: boolean;
  is_active: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  last_error: string;
  queued_jobs: number;
}

export interface PrintJobRow {
  id: string;
  printer: string;
  printer_name: string;
  kind: "ticket" | "receipt" | "report" | "test";
  title: string;
  order: string | null;
  order_number?: string;
  status: "queued" | "printing" | "done" | "failed";
  attempts: number;
  error: string;
  created_at: string;
  printed_at: string | null;
}

interface Paginated<T> {
  count: number;
  results: T[];
}

const BASE = "/api/v1/dashboard/printing";

export async function listPrinters(): Promise<PrinterRow[]> {
  const res = await api.get<Paginated<PrinterRow> | PrinterRow[]>(
    `${BASE}/printers/`,
    {
      params: { page_size: 100 },
    },
  );
  const data = res.data as Paginated<PrinterRow> | PrinterRow[];
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** Active bridge printers of a kind (what "Print" buttons should be enabled for). */
export function bridgePrinters(
  rows: PrinterRow[],
  kinds: PrinterKind[],
): PrinterRow[] {
  return rows.filter(
    (p) => p.is_active && p.connection === "bridge" && kinds.includes(p.kind),
  );
}

export async function printTicket(
  orderId: string,
  station?: "kitchen" | "bar",
): Promise<PrintJobRow[]> {
  const res = await api.post<PrintJobRow[]>(`${BASE}/jobs/create/`, {
    kind: "ticket",
    order_id: orderId,
    station,
  });
  return res.data;
}

export async function printReceiptJob(body: {
  order_id?: string;
  payment_id?: string;
}): Promise<PrintJobRow[]> {
  const res = await api.post<PrintJobRow[]>(`${BASE}/jobs/create/`, {
    kind: "receipt",
    ...body,
  });
  return res.data;
}

export async function printShiftReport(
  shiftId: string,
): Promise<PrintJobRow[]> {
  const res = await api.post<PrintJobRow[]>(`${BASE}/jobs/create/`, {
    kind: "report",
    shift_id: shiftId,
  });
  return res.data;
}

export async function listPrintJobs(params?: {
  status?: string;
}): Promise<Paginated<PrintJobRow>> {
  const res = await api.get<Paginated<PrintJobRow>>(`${BASE}/jobs/`, {
    params: { ...params, page_size: 50 },
  });
  return res.data;
}

export async function retryPrintJob(id: string): Promise<PrintJobRow> {
  const res = await api.post<PrintJobRow>(`${BASE}/jobs/${id}/retry/`, {});
  return res.data;
}

export async function testPrinter(id: string): Promise<PrintJobRow> {
  const res = await api.post<PrintJobRow>(`${BASE}/printers/${id}/test/`, {});
  return res.data;
}
