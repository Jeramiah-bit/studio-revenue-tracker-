"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { bookingEntrySchema, type BookingEntryFormValues } from "@/lib/validators";
import type { PayoutModel } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, FileText, Table2 } from "lucide-react";
import Papa from "papaparse";

export default function DataInputPage() {
  const supabase = createClient();
  const [studioId, setStudioId] = useState<string | null>(null);
  const [payoutModels, setPayoutModels] = useState<PayoutModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Import state
  const [fileData, setFileData] = useState<Record<string, string>[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{
    imported: number;
    rejected: { row: number; reason: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const form = useForm<BookingEntryFormValues>({
    resolver: zodResolver(bookingEntrySchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      platform: "",
      bookings: 0,
      paid_bookings: undefined,
      class_name: "",
      trainer_name: "",
    },
  });

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    setStudioId(profile.studio_id);

    const { data: models } = await supabase
      .from("payout_models")
      .select("*")
      .eq("studio_id", profile.studio_id)
      .order("platform");

    setPayoutModels(models ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function onSubmit(data: BookingEntryFormValues) {
    if (!studioId) return;

    const model = payoutModels.find((m) => m.platform === data.platform);
    // Use paid_bookings for revenue calc if provided, otherwise total bookings
    const revenueBookings = data.paid_bookings ?? data.bookings;
    const estimatedRevenue = model
      ? revenueBookings * Number(model.avg_payout_per_booking)
      : 0;

    const { error } = await supabase.from("booking_entries").insert({
      studio_id: studioId,
      date: data.date,
      platform: data.platform,
      bookings: data.bookings,
      paid_bookings: data.paid_bookings ?? null,
      class_name: data.class_name || null,
      trainer_name: data.trainer_name || null,
      estimated_revenue: estimatedRevenue,
    });

    if (error) {
      toast.error("Failed to save entry");
      return;
    }

    toast.success(
      `Entry saved — €${estimatedRevenue.toFixed(2)} estimated revenue`
    );
    form.reset({
      date: new Date().toISOString().split("T")[0],
      platform: "",
      bookings: 0,
      paid_bookings: undefined,
      class_name: "",
      trainer_name: "",
    });
  }

  function setDataFromRows(
    data: Record<string, string>[],
    headers: string[],
    name: string,
    type: string,
    autoMap?: Record<string, string>
  ) {
    setFileData(data);
    setFileHeaders(headers);
    setFileName(name);
    setFileType(type);
    setColumnMap(autoMap ?? {});
    setImportResult(null);
    setParsing(false);
  }

  function parseCsv(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const data = results.data as Record<string, string>[];
        const headers = results.meta.fields ?? [];
        setDataFromRows(data, headers, file.name, "CSV");
      },
      error() {
        toast.error("Failed to parse CSV file");
        setParsing(false);
      },
    });
  }

  async function parseExcel(file: File) {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      if (json.length === 0) {
        toast.error("No data found in Excel file");
        setParsing(false);
        return;
      }

      // Convert all values to strings for consistent handling
      const data = json.map((row) => {
        const stringRow: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
          stringRow[key] = String(value ?? "");
        }
        return stringRow;
      });

      const headers = Object.keys(json[0]);
      setDataFromRows(data, headers, file.name, "Excel");
    } catch {
      toast.error("Failed to parse Excel file");
      setParsing(false);
    }
  }

  // ── PDF Parsing ──────────────────────────────────────────────

  type PdfTextItem = { str: string; x: number; y: number; page: number };

  /** Extract all text items with position data from the PDF */
  async function parsePdf(file: File) {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

      const allItems: PdfTextItem[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if ("str" in item && item.str.trim()) {
            allItems.push({
              str: item.str.trim(),
              x: Math.round(item.transform[4]),
              y: Math.round(item.transform[5]),
              page: i,
            });
          }
        }
      }

      if (allItems.length === 0) {
        toast.error("No readable text found in PDF");
        setParsing(false);
        return;
      }

      // Detect format by scanning text
      const fullText = allItems.map((i) => i.str).join(" ");

      if (
        fullText.includes("URBAN SPORTS CLUB") ||
        fullText.includes("Urban Sports") ||
        fullText.includes("URBANSPORTSCLUB")
      ) {
        parseUrbanSportsPdf(allItems, file.name);
        return;
      }

      if (
        fullText.includes("classpass") ||
        fullText.includes("ClassPass") ||
        fullText.includes("Monthly Report")
      ) {
        // Verify it's ClassPass (Monthly Report alone could match other things)
        const hasReservations = fullText.includes("Reservations") || fullText.includes("Reservation Breakdown");
        const hasEarnings = fullText.includes("Earnings");
        if (hasReservations && hasEarnings) {
          parseClassPassPdf(allItems, file.name);
          return;
        }
      }

      // Generic position-based table extraction
      parseGenericPdf(allItems, file.name);
    } catch (err) {
      console.error("PDF parse error:", err);
      toast.error("Failed to parse PDF file");
      setParsing(false);
    }
  }

  /** Group text items into rows based on y-coordinate proximity */
  function groupIntoRows(items: PdfTextItem[], tolerance = 4): PdfTextItem[][] {
    const yBuckets = new Map<number, PdfTextItem[]>();

    for (const item of items) {
      let matched = false;
      for (const [bucketY, bucket] of yBuckets) {
        if (Math.abs(item.y - bucketY) <= tolerance) {
          bucket.push(item);
          matched = true;
          break;
        }
      }
      if (!matched) {
        yBuckets.set(item.y, [item]);
      }
    }

    // Sort rows top-to-bottom (PDF y-axis: higher = higher on page)
    return [...yBuckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x));
  }

  /** Assign text items in a row to columns based on header x-positions */
  function assignToColumns(
    row: PdfTextItem[],
    colPositions: { name: string; x: number }[]
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const col of colPositions) result[col.name] = "";

    for (const item of row) {
      // Find the nearest column to the left of this item
      let bestCol = colPositions[0];
      let bestDist = Infinity;
      for (const col of colPositions) {
        const dist = item.x - col.x;
        // Allow items slightly to the left of column header (-20px tolerance)
        if (dist >= -20 && dist < bestDist) {
          bestDist = dist;
          bestCol = col;
        }
      }
      result[bestCol.name] = result[bestCol.name]
        ? result[bestCol.name] + " " + item.str
        : item.str;
    }

    return result;
  }

  /** Parse ClassPass Monthly Report PDF */
  function parseClassPassPdf(items: PdfTextItem[], fileName: string) {
    const fullText = items.map((i) => i.str).join(" ");

    // 1. Extract month and year from the report title (e.g. "January 2026")
    const monthNames: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12",
    };

    let serviceDate = "";
    for (let i = 0; i < items.length; i++) {
      for (const [name, num] of Object.entries(monthNames)) {
        if (items[i].str.includes(name)) {
          // Look for a year nearby
          for (let j = Math.max(0, i - 2); j < Math.min(i + 3, items.length); j++) {
            const yearMatch = items[j].str.match(/\b(20\d{2})\b/);
            if (yearMatch) {
              const year = yearMatch[1];
              const month = num;
              const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
              serviceDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
              break;
            }
          }
          if (serviceDate) break;
        }
      }
      if (serviceDate) break;
    }

    if (!serviceDate) {
      serviceDate = new Date().toISOString().split("T")[0];
    }

    // 2. Extract Earnings (e.g. "€157")
    let earnings = "";
    for (let i = 0; i < items.length; i++) {
      if (items[i].str === "Earnings" || items[i].str === "Earnings*") {
        // Look for the euro amount nearby (usually the next item with €)
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          const match = items[j].str.match(/€\s*([\d.,]+)/);
          if (match) {
            earnings = match[1].replace(/\./g, "").replace(",", ".");
            break;
          }
        }
        if (earnings) break;
      }
    }

    // 3. Extract total Reservations
    let totalReservations = "";
    for (let i = 0; i < items.length; i++) {
      if (items[i].str === "Reservations") {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.match(/^\d+$/)) {
            totalReservations = items[j].str;
            break;
          }
        }
        if (totalReservations) break;
      }
    }

    // 4. Extract Attended count from Reservation Breakdown
    let attended = "";
    for (let i = 0; i < items.length; i++) {
      if (items[i].str === "Attended") {
        // Look for the count — it's usually after the percentage
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          // Skip percentage values like "75%"
          if (items[j].str.match(/^\d+%$/)) continue;
          if (items[j].str.match(/^\d+$/)) {
            attended = items[j].str;
            break;
          }
        }
        if (attended) break;
      }
    }

    // 5. Extract Missed Sessions and Late Cancels for context
    let missedSessions = "0";
    let lateCancels = "0";
    for (let i = 0; i < items.length; i++) {
      if (items[i].str === "Missed Sessions") {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.match(/^\d+%$/)) continue;
          if (items[j].str.match(/^\d+$/)) {
            missedSessions = items[j].str;
            break;
          }
        }
      }
      if (items[i].str === "Late Cancels") {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.match(/^\d+%$/)) continue;
          if (items[j].str.match(/^\d+$/)) {
            lateCancels = items[j].str;
            break;
          }
        }
      }
    }

    // ClassPass pays per reservation — all reservations generate revenue
    // (attended, missed, and late cancels all count)
    const totalBookings = totalReservations || "0";
    const paidBookings = totalBookings;

    const data = [
      {
        Date: serviceDate,
        Platform: "ClassPass",
        "Class Name": "All classes (monthly report)",
        "Total Bookings": totalBookings,
        "Paid Bookings": paidBookings,
        "Missed Sessions": missedSessions,
        "Late Cancels": lateCancels,
        "Revenue (€)": earnings || "0",
      },
    ];

    const headers = [
      "Date",
      "Platform",
      "Class Name",
      "Total Bookings",
      "Paid Bookings",
      "Missed Sessions",
      "Late Cancels",
      "Revenue (€)",
    ];

    setDataFromRows(data, headers, fileName, "PDF", {
      date: "Date",
      platform: "Platform",
      bookings: "Total Bookings",
      paid_bookings: "Paid Bookings",
      class_name: "Class Name",
      estimated_revenue: "Revenue (€)",
    });

    toast.success(
      `ClassPass monthly report detected — ${serviceDate.substring(0, 7)}: ${paidBookings} attended of ${totalBookings} reservations, €${earnings || "0"} earnings`
    );
  }

  /** Parse Urban Sports Club Gutschrift (credit note) PDF */
  function parseUrbanSportsPdf(items: PdfTextItem[], fileName: string) {
    // 1. Extract service period (Leistungszeitraum: MM YYYY)
    let serviceDate = "";
    for (let i = 0; i < items.length; i++) {
      if (items[i].str.includes("Leistungszeitraum")) {
        // Scan nearby items for "MM YYYY" pattern
        for (let j = i; j < Math.min(i + 8, items.length); j++) {
          const match = items[j].str.match(/(\d{2})\s*(\d{4})/);
          if (match) {
            const month = parseInt(match[1], 10);
            const year = parseInt(match[2], 10);
            const lastDay = new Date(year, month, 0).getDate();
            serviceDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            break;
          }
        }
        if (serviceDate) break;
      }
    }

    if (!serviceDate) {
      serviceDate = new Date().toISOString().split("T")[0];
    }

    // 2. Find pages with the line items table (has "Position" + "Leistung" headers)
    const lineItemPages = new Set<number>();
    for (const item of items) {
      if (item.str === "Position") {
        // Check if "Leistung" exists on the same page
        const hasLeistung = items.some(
          (other) => other.page === item.page && other.str === "Leistung"
        );
        if (hasLeistung) lineItemPages.add(item.page);
      }
    }

    if (lineItemPages.size === 0) {
      // Fallback: extract summary data from page 1
      parseUrbanSportsSummary(items, serviceDate, fileName);
      return;
    }

    // 3. Extract line items using position-based column detection
    const pageItems = items.filter((i) => lineItemPages.has(i.page));
    const rows = groupIntoRows(pageItems);

    // Find header row and extract column positions
    let headerIdx = -1;
    let colPositions: { name: string; x: number }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowStrs = rows[i].map((item) => item.str);
      if (rowStrs.includes("Position") && rowStrs.includes("Leistung")) {
        headerIdx = i;
        colPositions = rows[i].map((item) => ({
          name: item.str,
          x: item.x,
        }));
        break;
      }
    }

    if (headerIdx === -1) {
      parseUrbanSportsSummary(items, serviceDate, fileName);
      return;
    }

    // 4. Parse data rows after header
    const dataRows = rows.slice(headerIdx + 1);
    const parsedData: Record<string, string>[] = [];

    for (const row of dataRows) {
      const assigned = assignToColumns(row, colPositions);

      // Valid data rows start with a number in Position
      const position = assigned["Position"]?.trim();
      if (!position || !position.match(/^\d+$/)) continue;

      // Clean Euro values: "7,42 €" → "7.42"
      const cleanEuro = (s: string) =>
        s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");

      const anzahl = assigned["Anzahl"]?.trim() || "0";
      const bookings = parseInt(anzahl, 10);

      // Skip rows with 0 bookings
      if (isNaN(bookings) || bookings === 0) continue;

      // In line items, Anzahl = paid bookings (Erstbesuch rows are separate & filtered out)
      parsedData.push({
        Date: serviceDate,
        Platform: "Urban Sports Club",
        "Class Name": assigned["Leistung"]?.trim() || "",
        "Paid Bookings": String(bookings),
        "Unit Price (€)": cleanEuro(assigned["Einzelpreis"] || "0"),
        "Revenue gross (€)": cleanEuro(assigned["Betrag (netto)"] || assigned["Betrag"] || "0"),
      });
    }

    if (parsedData.length === 0) {
      parseUrbanSportsSummary(items, serviceDate, fileName);
      return;
    }

    // Extract total bookings from page 1 summary for context
    let totalBookingsFromSummary = 0;
    for (let i = 0; i < items.length; i++) {
      if (
        items[i].str.includes("Gesamtanzahl Buchungen") ||
        (items[i].str === "Gesamtanzahl" &&
          i + 1 < items.length &&
          items[i + 1].str === "Buchungen")
      ) {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.match(/^\d+$/)) {
            totalBookingsFromSummary = parseInt(items[j].str, 10);
            break;
          }
        }
        break;
      }
    }

    // Sum paid bookings across line items
    const totalPaidFromLines = parsedData.reduce(
      (sum, row) => sum + parseInt(row["Paid Bookings"] || "0", 10),
      0
    );

    // Add total bookings to each row for the import
    // Each line gets a proportional share of total bookings
    for (const row of parsedData) {
      const linePaid = parseInt(row["Paid Bookings"] || "0", 10);
      const proportion = totalPaidFromLines > 0 ? linePaid / totalPaidFromLines : 0;
      const lineTotal = totalBookingsFromSummary > 0
        ? Math.round(totalBookingsFromSummary * proportion)
        : linePaid;
      row["Total Bookings"] = String(lineTotal);
    }

    const headers = ["Date", "Platform", "Class Name", "Total Bookings", "Paid Bookings", "Unit Price (€)", "Revenue gross (€)"];

    setDataFromRows(parsedData, headers, fileName, "PDF", {
      date: "Date",
      platform: "Platform",
      bookings: "Total Bookings",
      paid_bookings: "Paid Bookings",
      class_name: "Class Name",
      estimated_revenue: "Revenue gross (€)",
    });
    toast.success(
      `Urban Sports Club invoice detected — ${parsedData.length} line items for ${serviceDate.substring(0, 7)}`
    );
  }

  /** Fallback: extract summary totals from Urban Sports page 1 */
  function parseUrbanSportsSummary(
    items: PdfTextItem[],
    serviceDate: string,
    fileName: string
  ) {
    // Extract total bookings (Gesamtanzahl Buchungen: 437)
    let allBookings = "";
    for (let i = 0; i < items.length; i++) {
      // Match "Gesamtanzahl Buchungen" but NOT "ausgezahlter Buchungen"
      if (
        items[i].str.includes("Gesamtanzahl Buchungen") ||
        (items[i].str === "Gesamtanzahl" &&
          i + 1 < items.length &&
          items[i + 1].str === "Buchungen")
      ) {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.match(/^\d+$/)) {
            allBookings = items[j].str;
            break;
          }
        }
        if (allBookings) break;
      }
    }

    // Extract paid bookings (Gesamtanzahl ausgezahlter Buchungen: 175)
    let paidBookings = "";
    for (let i = 0; i < items.length; i++) {
      if (
        items[i].str.includes("ausgezahlter Buchungen") ||
        items[i].str.includes("Gesamtanzahl ausgezahlter")
      ) {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.match(/^\d+$/)) {
            paidBookings = items[j].str;
            break;
          }
        }
        if (paidBookings) break;
      }
    }

    // Look for gross revenue (Gesamtbetrag brutto — what actually hits the bank)
    let totalRevenue = "";
    for (let i = 0; i < items.length; i++) {
      if (items[i].str === "Gesamtbetrag (brutto)") {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.includes("€")) {
            totalRevenue = items[j].str
              .replace(/[€\s]/g, "")
              .replace(/\./g, "")
              .replace(",", ".");
            break;
          }
        }
        if (totalRevenue) break;
      }
    }

    // Fallback: try Standort Betrag if brutto not found
    if (!totalRevenue) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].str === "Betrag") {
          for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
            if (items[j].str.includes("€")) {
              totalRevenue = items[j].str
                .replace(/[€\s]/g, "")
                .replace(/\./g, "")
                .replace(",", ".");
              break;
            }
          }
          if (totalRevenue) break;
        }
      }
    }

    const data = [
      {
        Date: serviceDate,
        Platform: "Urban Sports Club",
        "Class Name": "All classes (summary)",
        "Total Bookings": allBookings || "0",
        "Paid Bookings": paidBookings || "0",
        "Revenue gross (€)": totalRevenue || "0",
      },
    ];

    const headers = [
      "Date",
      "Platform",
      "Class Name",
      "Total Bookings",
      "Paid Bookings",
      "Revenue gross (€)",
    ];

    setDataFromRows(data, headers, fileName, "PDF", {
      date: "Date",
      platform: "Platform",
      bookings: "Total Bookings",
      paid_bookings: "Paid Bookings",
      class_name: "Class Name",
      estimated_revenue: "Revenue gross (€)",
    });
    toast.info("Extracted summary totals from Urban Sports Club invoice");
  }

  /** Generic position-based PDF table extraction */
  function parseGenericPdf(items: PdfTextItem[], fileName: string) {
    const rows = groupIntoRows(items);

    // Build rows as string arrays
    const stringRows = rows.map((row) => {
      const cells: string[] = [];
      let currentCell = "";
      let lastX = -999;

      for (const item of row) {
        // If gap > 30px, start a new cell
        if (item.x - lastX > 30 && currentCell) {
          cells.push(currentCell.trim());
          currentCell = item.str;
        } else {
          currentCell = currentCell ? currentCell + " " + item.str : item.str;
        }
        lastX = item.x + item.str.length * 5; // rough estimate of text end position
      }
      if (currentCell) cells.push(currentCell.trim());
      return cells;
    });

    // Find the row with the most columns — likely the header
    let headerIdx = 0;
    let maxCols = 0;
    for (let i = 0; i < Math.min(10, stringRows.length); i++) {
      if (stringRows[i].length > maxCols) {
        maxCols = stringRows[i].length;
        headerIdx = i;
      }
    }

    if (maxCols < 2) {
      // Fallback to raw text
      const headers = ["Line", "Content"];
      const data = stringRows.map((row, idx) => ({
        Line: String(idx + 1),
        Content: row.join(" | "),
      }));
      setDataFromRows(data, headers, fileName, "PDF");
      toast.info("PDF parsed as raw text — manual column mapping needed");
      return;
    }

    const headers = stringRows[headerIdx];
    const dataRows = stringRows.slice(headerIdx + 1).filter((r) => r.length >= 2);

    const data = dataRows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] ?? "";
      });
      return obj;
    });

    setDataFromRows(data, headers, fileName, "PDF");
    toast.success(`Extracted ${data.length} rows from PDF`);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setImportResult(null);
    setFileData([]);
    setFileHeaders([]);

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      parseCsv(file);
    } else if (ext === "xlsx" || ext === "xls") {
      parseExcel(file);
    } else if (ext === "pdf") {
      parsePdf(file);
    } else {
      toast.error("Unsupported file type. Please upload a CSV, Excel, or PDF file.");
      setParsing(false);
    }

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function handleImport() {
    if (!studioId || fileData.length === 0) return;
    setImporting(true);

    // Fetch existing entries to detect duplicates (match on date + platform + bookings)
    const { data: existingEntries } = await supabase
      .from("booking_entries")
      .select("date, platform, bookings, class_name")
      .eq("studio_id", studioId);

    const existingKeys = new Set(
      (existingEntries ?? []).map(
        (e) => `${e.date}|${e.platform}|${e.bookings}|${e.class_name ?? ""}`
      )
    );

    const imported: number[] = [];
    const rejected: { row: number; reason: string }[] = [];
    let skippedDuplicates = 0;

    for (let i = 0; i < fileData.length; i++) {
      const row = fileData[i];
      const date = row[columnMap.date];
      const platform = row[columnMap.platform];
      const bookingsRaw = row[columnMap.bookings];

      if (!date) {
        rejected.push({ row: i + 1, reason: "Missing date" });
        continue;
      }
      if (!platform) {
        rejected.push({ row: i + 1, reason: "Missing platform" });
        continue;
      }

      const bookings = parseInt(bookingsRaw, 10);
      if (isNaN(bookings) || bookings < 0) {
        rejected.push({ row: i + 1, reason: "Invalid bookings value" });
        continue;
      }

      const className = columnMap.class_name ? row[columnMap.class_name] || "" : "";

      // Check for duplicate
      const key = `${date}|${platform}|${bookings}|${className}`;
      if (existingKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }

      // Parse paid_bookings if mapped
      let paidBookings: number | null = null;
      if (columnMap.paid_bookings && row[columnMap.paid_bookings]) {
        const parsed = parseInt(row[columnMap.paid_bookings], 10);
        if (!isNaN(parsed) && parsed >= 0) paidBookings = parsed;
      }

      // Use mapped revenue column if available, otherwise calculate from payout model
      let estimatedRevenue = 0;
      if (columnMap.estimated_revenue && row[columnMap.estimated_revenue]) {
        const parsed = parseFloat(row[columnMap.estimated_revenue].replace(/[€\s]/g, "").replace(",", "."));
        if (!isNaN(parsed)) estimatedRevenue = parsed;
      } else {
        const model = payoutModels.find((m) => m.platform === platform);
        const revenueBookings = paidBookings ?? bookings;
        estimatedRevenue = model
          ? revenueBookings * Number(model.avg_payout_per_booking)
          : 0;
      }

      const { error } = await supabase.from("booking_entries").insert({
        studio_id: studioId,
        date,
        platform,
        bookings,
        paid_bookings: paidBookings,
        class_name: className || null,
        trainer_name: columnMap.trainer_name
          ? row[columnMap.trainer_name] || null
          : null,
        estimated_revenue: estimatedRevenue,
      });

      if (error) {
        rejected.push({ row: i + 1, reason: error.message });
      } else {
        imported.push(i);
        existingKeys.add(key); // prevent duplicates within the same import batch
      }
    }

    setImportResult({ imported: imported.length, rejected });
    setImporting(false);

    if (skippedDuplicates > 0 && imported.length > 0) {
      toast.success(`${imported.length} rows imported, ${skippedDuplicates} duplicate${skippedDuplicates !== 1 ? "s" : ""} skipped`);
    } else if (skippedDuplicates > 0 && imported.length === 0) {
      toast.info(`All ${skippedDuplicates} row${skippedDuplicates !== 1 ? "s" : ""} already exist — nothing to import`);
    } else {
      toast.success(`${imported.length} rows imported`);
    }
  }

  const requiredMappings = ["date", "platform", "bookings"];
  const optionalMappings = ["paid_bookings", "class_name", "trainer_name", "estimated_revenue"];
  const allMappings = [...requiredMappings, ...optionalMappings];
  const canImport =
    requiredMappings.every((key) => columnMap[key]) && fileData.length > 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[#F2F3FF] rounded-lg animate-pulse" />
        <div className="h-64 bg-[#F2F3FF] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
        Revenue Ledger
      </p>
      <h1 className="text-3xl font-bold text-[#113069] mt-1">Data Input</h1>
      <p className="text-[#445D99] mt-1 mb-10">
        Log bookings manually or import from CSV, Excel, or PDF.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Manual Entry Form */}
        <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
          <h2 className="text-xl font-bold text-[#113069] mb-1">
            Manual Entry
          </h2>
          <p className="text-sm text-[#445D99] mb-6">
            Add a single booking record.
          </p>

          {payoutModels.length === 0 ? (
            <div className="text-center py-8 text-[#445D99]">
              <p className="text-sm">
                No payout models configured yet.
              </p>
              <p className="text-sm mt-1">
                Go to{" "}
                <a href="/settings" className="text-[#004CED] hover:underline">
                  Settings
                </a>{" "}
                to add your platforms first.
              </p>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                    Date
                  </Label>
                  <Input
                    type="date"
                    className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                    {...form.register("date")}
                  />
                  {form.formState.errors.date && (
                    <p className="text-sm text-[#9E3F4E]">
                      {form.formState.errors.date.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                    Platform
                  </Label>
                  <Select
                    value={form.watch("platform")}
                    onValueChange={(val) => {
                      if (val) form.setValue("platform", val);
                    }}
                  >
                    <SelectTrigger className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {payoutModels.map((m) => (
                        <SelectItem key={m.id} value={m.platform}>
                          {m.platform}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.platform && (
                    <p className="text-sm text-[#9E3F4E]">
                      {form.formState.errors.platform.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                    Total Bookings
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                    {...form.register("bookings", { valueAsNumber: true })}
                  />
                  {form.formState.errors.bookings && (
                    <p className="text-sm text-[#9E3F4E]">
                      {form.formState.errors.bookings.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                    Paid Bookings
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Optional"
                    className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                    {...form.register("paid_bookings", { valueAsNumber: true })}
                  />
                  <p className="text-[10px] text-[#445D99]/60">
                    Revenue-generating bookings only (e.g. excl. first-timers)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                    Class Name (optional)
                  </Label>
                  <Input
                    className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                    placeholder="e.g. Morning Flow"
                    {...form.register("class_name")}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                    Trainer (optional)
                  </Label>
                  <Input
                    className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                    placeholder="e.g. Sarah K."
                    {...form.register("trainer_name")}
                  />
                </div>
              </div>

              {/* Live revenue estimate */}
              {(() => {
                const platform = form.watch("platform");
                const bookings = form.watch("bookings");
                const paidBookings = form.watch("paid_bookings");
                const model = payoutModels.find((m) => m.platform === platform);
                if (!model || !bookings || bookings <= 0) return null;
                const revenueBookings = paidBookings && paidBookings > 0 ? paidBookings : bookings;
                const estimate = revenueBookings * Number(model.avg_payout_per_booking);
                return (
                  <div className="bg-[#F2F3FF] rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-[#445D99]">Estimated revenue</span>
                    <span className="text-lg font-bold text-[#113069]">
                      ≈ €{estimate.toFixed(2)}
                    </span>
                  </div>
                );
              })()}

              <Button
                type="submit"
                className="w-full bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg"
              >
                Add Entry
              </Button>
            </form>
          )}
        </div>

        {/* File Import */}
        <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
          <h2 className="text-xl font-bold text-[#113069] mb-1">
            Import Revenue Data
          </h2>
          <p className="text-sm text-[#445D99] mb-6">
            Upload CSV, Excel, or PDF files from Mindbody, Eversports, or custom exports.
          </p>

          {/* Supported formats */}
          <div className="flex gap-3 mb-5">
            {[
              { icon: Table2, label: "CSV", ext: ".csv" },
              { icon: FileSpreadsheet, label: "Excel", ext: ".xlsx" },
              { icon: FileText, label: "PDF", ext: ".pdf" },
            ].map((fmt) => (
              <div
                key={fmt.label}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F2F3FF] rounded-lg text-xs font-medium text-[#445D99]"
              >
                <fmt.icon className="w-3.5 h-3.5 text-[#004CED]" />
                {fmt.label}
              </div>
            ))}
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-[#98B1F2]/30 rounded-xl p-8 text-center mb-6 hover:border-[#004CED]/30 transition-colors">
            <Upload className="w-8 h-8 text-[#445D99] mx-auto mb-3" />
            <p className="text-sm text-[#445D99] mb-1">
              Drag and drop your revenue report here
            </p>
            <p className="text-xs text-[#445D99]/60 mb-3">
              Supports CSV, Excel (.xlsx/.xls), and PDF files
            </p>
            <label className="inline-block">
              <span className="px-4 py-2 bg-[#F2F3FF] text-[#113069] text-sm font-medium rounded-lg cursor-pointer hover:bg-[#DDE1FF] transition-colors">
                Browse Files
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Parsing indicator */}
          {parsing && (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-[#004CED] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-[#445D99]">Parsing file...</p>
            </div>
          )}

          {/* File info badge */}
          {fileName && fileHeaders.length > 0 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#F2F3FF] rounded-lg">
              {fileType === "CSV" && <Table2 className="w-4 h-4 text-[#004CED]" />}
              {fileType === "Excel" && <FileSpreadsheet className="w-4 h-4 text-[#004CED]" />}
              {fileType === "PDF" && <FileText className="w-4 h-4 text-[#004CED]" />}
              <span className="text-sm font-medium text-[#113069]">{fileName}</span>
              <span className="text-xs text-[#445D99]">
                ({fileType} · {fileData.length} rows · {fileHeaders.length} columns)
              </span>
            </div>
          )}

          {/* Column Mapping */}
          {fileHeaders.length > 0 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileSpreadsheet className="w-4 h-4 text-[#004CED]" />
                  <h3 className="text-sm font-semibold text-[#113069]">
                    Column Mapping
                  </h3>
                </div>
                <div className="space-y-3">
                  {allMappings.map((field) => (
                    <div
                      key={field}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-sm text-[#445D99] w-32 capitalize">
                        {field.replace("_", " ")}
                        {requiredMappings.includes(field) && (
                          <span className="text-[#9E3F4E]"> *</span>
                        )}
                      </span>
                      <Select
                        value={columnMap[field] ?? ""}
                        onValueChange={(val) => {
                          if (val)
                            setColumnMap((prev) => ({ ...prev, [field]: val }));
                        }}
                      >
                        <SelectTrigger className="flex-1 bg-white border-[#98B1F2]/20 h-9 text-sm">
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {fileHeaders.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-sm font-semibold text-[#113069] mb-3">
                  Data Preview
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {fileHeaders.map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fileData.slice(0, 5).map((row, i) => (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? "bg-[#FAF8FF]" : ""}
                        >
                          {fileHeaders.map((h) => (
                            <td
                              key={h}
                              className="px-3 py-2 text-[#113069]"
                            >
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-[#445D99] mt-2">
                  Showing {Math.min(5, fileData.length)} of {fileData.length} rows
                </p>
              </div>

              {/* Import Button */}
              <Button
                onClick={handleImport}
                disabled={!canImport || importing}
                className="w-full bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg"
              >
                {importing
                  ? "Importing..."
                  : `Validate & Import ${fileData.length} rows`}
              </Button>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-[#113069]">
                  {importResult.imported} rows imported successfully
                </span>
              </div>
              {importResult.rejected.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <AlertCircle className="w-4 h-4 text-[#9E3F4E]" />
                    <span className="text-[#9E3F4E]">
                      {importResult.rejected.length} rows rejected
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResult.rejected.map((r, i) => (
                      <p key={i} className="text-xs text-[#445D99]">
                        Row {r.row}: {r.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
