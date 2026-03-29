"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  actualPayoutSchema,
  type ActualPayoutFormValues,
} from "@/lib/validators";
import { formatCurrency } from "@/lib/calculations";
import type { BookingEntry, ActualPayout, PayoutModel } from "@/types";
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
import { format, subMonths } from "date-fns";
import { Sparkles, Upload, FileSpreadsheet, CheckCircle2, FileText, Table2 } from "lucide-react";
import Papa from "papaparse";

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, i);
    return {
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy"),
    };
  });
}

interface ReconciliationRow {
  platform: string;
  estimatedRevenue: number;
  actualPayout: number | null;
  varianceEur: number | null;
  variancePct: number | null;
  status: "good" | "warning" | "critical" | "pending";
}

export default function ReconciliationPage() {
  const supabase = createClient();
  const [studioId, setStudioId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const [entries, setEntries] = useState<BookingEntry[]>([]);
  const [payouts, setPayouts] = useState<ActualPayout[]>([]);
  const [payoutModels, setPayoutModels] = useState<PayoutModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Bank statement import
  interface BankMatch {
    description: string;
    amount: number;
    date: string;
    platform: string | null;
    month: string;
  }
  const [bankMatches, setBankMatches] = useState<BankMatch[]>([]);
  const [bankImporting, setBankImporting] = useState(false);

  // Platform payout file upload
  interface PayoutFileResult {
    platform: string;
    month: string;
    amount: number;
    label: string;
  }
  const [payoutFileResults, setPayoutFileResults] = useState<PayoutFileResult[]>([]);
  const [payoutFileParsing, setPayoutFileParsing] = useState(false);
  const [payoutFileImporting, setPayoutFileImporting] = useState(false);

  const monthOptions = getMonthOptions();

  const form = useForm<ActualPayoutFormValues>({
    resolver: zodResolver(actualPayoutSchema),
    defaultValues: {
      month: selectedMonth,
      platform: "",
      actual_payout_total: 0,
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

    const [entriesRes, payoutsRes, modelsRes] = await Promise.all([
      supabase
        .from("booking_entries")
        .select("*")
        .eq("studio_id", profile.studio_id),
      supabase
        .from("actual_payouts")
        .select("*")
        .eq("studio_id", profile.studio_id),
      supabase
        .from("payout_models")
        .select("*")
        .eq("studio_id", profile.studio_id),
    ]);

    const loadedEntries = entriesRes.data ?? [];
    setEntries(loadedEntries);
    setPayouts(payoutsRes.data ?? []);
    setPayoutModels(modelsRes.data ?? []);

    // Default to the most recent month with data
    if (loadedEntries.length > 0) {
      const months = [...new Set(loadedEntries.map((e: BookingEntry) => e.date.substring(0, 7)))].sort().reverse();
      if (months[0] && months[0] !== selectedMonth) {
        setSelectedMonth(months[0]);
        form.setValue("month", months[0]);
      }
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate reconciliation rows
  const monthEntries = entries.filter(
    (e) => e.date.substring(0, 7) === selectedMonth
  );
  const monthPayouts = payouts.filter((p) => p.month === selectedMonth);

  const platforms = [
    ...new Set([
      ...monthEntries.map((e) => e.platform),
      ...monthPayouts.map((p) => p.platform),
    ]),
  ];

  const rows: ReconciliationRow[] = platforms.map((platform) => {
    const platformEntries = monthEntries.filter(
      (e) => e.platform === platform
    );
    const estimatedRevenue = platformEntries.reduce(
      (sum, e) => sum + Number(e.estimated_revenue),
      0
    );
    const payout = monthPayouts.find((p) => p.platform === platform);
    const actualPayout = payout ? Number(payout.actual_payout_total) : null;

    let varianceEur: number | null = null;
    let variancePct: number | null = null;
    let status: ReconciliationRow["status"] = "pending";

    if (actualPayout !== null) {
      varianceEur = actualPayout - estimatedRevenue;
      variancePct =
        estimatedRevenue > 0 ? (varianceEur / estimatedRevenue) * 100 : null;

      const absPct = Math.abs(variancePct ?? 0);
      if (absPct <= 10) status = "good";
      else if (absPct <= 25) status = "warning";
      else status = "critical";
    }

    return {
      platform,
      estimatedRevenue,
      actualPayout,
      varianceEur,
      variancePct,
      status,
    };
  });

  const totalEstimated = rows.reduce((s, r) => s + r.estimatedRevenue, 0);
  const totalActual = rows.reduce(
    (s, r) => s + (r.actualPayout ?? 0),
    0
  );
  const hasActuals = rows.some((r) => r.actualPayout !== null);
  const totalVariance = hasActuals ? totalActual - totalEstimated : null;

  const statusColors = {
    good: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    critical: "bg-red-100 text-red-700",
    pending: "bg-[#F2F3FF] text-[#445D99]",
  };

  const statusLabels = {
    good: "On Track",
    warning: "Review",
    critical: "Investigate",
    pending: "Pending",
  };

  // Platform keyword matching for bank statements
  const platformKeywords: Record<string, string[]> = {
    "Urban Sports Club": ["urban sports", "urbansportsclub", "usc"],
    "ClassPass": ["classpass", "class pass"],
    "WellPass": ["wellpass", "well pass", "qualitrain"],
    "Direct / Eversports": ["eversports", "direct"],
  };

  function matchPlatform(description: string): string | null {
    const lower = description.toLowerCase();
    for (const [platform, keywords] of Object.entries(platformKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) return platform;
    }
    return null;
  }

  // ── Platform Payout File Parsing ─────────────────────────────

  type PdfTextItem = { str: string; x: number; y: number; page: number };

  async function handlePayoutFile(file: File) {
    setPayoutFileParsing(true);
    setPayoutFileResults([]);

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      await parsePayoutPdf(file);
    } else if (ext === "csv") {
      parsePayoutCsv(file);
    } else if (ext === "xlsx" || ext === "xls") {
      await parsePayoutExcel(file);
    } else {
      toast.error("Unsupported file type. Use CSV, PDF, or Excel.");
      setPayoutFileParsing(false);
    }
  }

  async function parsePayoutPdf(file: File) {
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
        setPayoutFileParsing(false);
        return;
      }

      const fullText = allItems.map((i) => i.str).join(" ");

      if (
        fullText.includes("URBAN SPORTS CLUB") ||
        fullText.includes("Urban Sports") ||
        fullText.includes("URBANSPORTSCLUB")
      ) {
        extractUrbanSportsPayout(allItems);
        return;
      }

      if (
        (fullText.includes("classpass") || fullText.includes("ClassPass")) &&
        fullText.includes("Earnings")
      ) {
        extractClassPassPayout(allItems);
        return;
      }

      toast.error("Could not detect platform from this PDF. Supported: Urban Sports Club, ClassPass.");
      setPayoutFileParsing(false);
    } catch (err) {
      console.error("PDF parse error:", err);
      toast.error("Failed to parse PDF file");
      setPayoutFileParsing(false);
    }
  }

  function extractUrbanSportsPayout(items: PdfTextItem[]) {
    // Extract service period
    let month = "";
    for (let i = 0; i < items.length; i++) {
      if (items[i].str.includes("Leistungszeitraum")) {
        for (let j = i; j < Math.min(i + 8, items.length); j++) {
          const match = items[j].str.match(/(\d{2})\s*(\d{4})/);
          if (match) {
            month = `${match[2]}-${match[1]}`;
            break;
          }
        }
        if (month) break;
      }
    }
    if (!month) month = selectedMonth;

    // Extract Gesamtbetrag (brutto)
    let amount = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].str === "Gesamtbetrag (brutto)") {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          if (items[j].str.includes("€")) {
            const cleaned = items[j].str
              .replace(/[€\s]/g, "")
              .replace(/\./g, "")
              .replace(",", ".");
            amount = parseFloat(cleaned);
            break;
          }
        }
        if (amount) break;
      }
    }

    // Fallback: try Betrag
    if (!amount) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].str === "Betrag") {
          for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
            if (items[j].str.includes("€")) {
              const cleaned = items[j].str
                .replace(/[€\s]/g, "")
                .replace(/\./g, "")
                .replace(",", ".");
              amount = parseFloat(cleaned);
              break;
            }
          }
          if (amount) break;
        }
      }
    }

    if (!amount || isNaN(amount)) {
      toast.error("Could not extract payout amount from Urban Sports PDF");
      setPayoutFileParsing(false);
      return;
    }

    setPayoutFileResults([{
      platform: "Urban Sports Club",
      month,
      amount,
      label: `Urban Sports Club — ${month} — Gesamtbetrag (brutto)`,
    }]);
    setPayoutFileParsing(false);
    toast.success(`Detected Urban Sports Club payout: €${amount.toFixed(2)} for ${month}`);
  }

  function extractClassPassPayout(items: PdfTextItem[]) {
    // Extract month
    const monthNames: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12",
    };

    let month = "";
    for (let i = 0; i < items.length; i++) {
      for (const [name, num] of Object.entries(monthNames)) {
        if (items[i].str.includes(name)) {
          for (let j = Math.max(0, i - 2); j < Math.min(i + 3, items.length); j++) {
            const yearMatch = items[j].str.match(/\b(20\d{2})\b/);
            if (yearMatch) {
              month = `${yearMatch[1]}-${num}`;
              break;
            }
          }
          if (month) break;
        }
      }
      if (month) break;
    }
    if (!month) month = selectedMonth;

    // Extract Earnings
    let amount = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].str === "Earnings" || items[i].str === "Earnings*") {
        for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
          const match = items[j].str.match(/€\s*([\d.,]+)/);
          if (match) {
            amount = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
            break;
          }
        }
        if (amount) break;
      }
    }

    if (!amount || isNaN(amount)) {
      toast.error("Could not extract earnings from ClassPass PDF");
      setPayoutFileParsing(false);
      return;
    }

    setPayoutFileResults([{
      platform: "ClassPass",
      month,
      amount,
      label: `ClassPass — ${month} — Earnings`,
    }]);
    setPayoutFileParsing(false);
    toast.success(`Detected ClassPass payout: €${amount.toFixed(2)} for ${month}`);
  }

  function parsePayoutCsv(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const data = results.data as Record<string, string>[];
        if (data.length === 0) {
          toast.error("No data found in CSV");
          setPayoutFileParsing(false);
          return;
        }

        const headers = results.meta.fields ?? [];
        // Try to find platform, month, and amount columns
        const amountCol = headers.find((h) =>
          /amount|betrag|payout|total|earnings|revenue|sum/i.test(h)
        );
        const platformCol = headers.find((h) =>
          /platform|provider|source|channel/i.test(h)
        );
        const monthCol = headers.find((h) =>
          /month|period|date|monat/i.test(h)
        );

        if (!amountCol) {
          toast.error("Could not detect an amount column in the CSV.");
          setPayoutFileParsing(false);
          return;
        }

        const results2: PayoutFileResult[] = [];
        for (const row of data) {
          const rawAmount = (row[amountCol] ?? "")
            .replace(/[€$\s]/g, "")
            .replace(",", ".");
          const amount = parseFloat(rawAmount);
          if (isNaN(amount) || amount <= 0) continue;

          const platform = platformCol
            ? matchPlatform(row[platformCol] ?? "") || row[platformCol] || "Unknown"
            : "Unknown";
          const rawMonth = monthCol ? (row[monthCol] ?? "") : "";
          let month = selectedMonth;
          const dateMatch = rawMonth.match(
            /(\d{4})[.\-/](\d{1,2})|(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/
          );
          if (dateMatch) {
            if (dateMatch[1] && dateMatch[2]) {
              month = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}`;
            } else if (dateMatch[5] && dateMatch[4]) {
              month = `${dateMatch[5]}-${dateMatch[4].padStart(2, "0")}`;
            }
          }

          results2.push({
            platform,
            month,
            amount,
            label: `${platform} — ${month}`,
          });
        }

        if (results2.length === 0) {
          toast.error("No valid payout rows found in CSV.");
          setPayoutFileParsing(false);
          return;
        }

        setPayoutFileResults(results2);
        setPayoutFileParsing(false);
        toast.success(`Found ${results2.length} payout${results2.length !== 1 ? "s" : ""} in CSV`);
      },
      error() {
        toast.error("Failed to parse CSV file");
        setPayoutFileParsing(false);
      },
    });
  }

  async function parsePayoutExcel(file: File) {
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
        setPayoutFileParsing(false);
        return;
      }

      const headers = Object.keys(json[0]);
      const amountCol = headers.find((h) =>
        /amount|betrag|payout|total|earnings|revenue|sum/i.test(h)
      );
      const platformCol = headers.find((h) =>
        /platform|provider|source|channel/i.test(h)
      );
      const monthCol = headers.find((h) =>
        /month|period|date|monat/i.test(h)
      );

      if (!amountCol) {
        toast.error("Could not detect an amount column in the Excel file.");
        setPayoutFileParsing(false);
        return;
      }

      const results2: PayoutFileResult[] = [];
      for (const row of json) {
        const rawAmount = String(row[amountCol] ?? "")
          .replace(/[€$\s]/g, "")
          .replace(",", ".");
        const amount = parseFloat(rawAmount);
        if (isNaN(amount) || amount <= 0) continue;

        const platform = platformCol
          ? matchPlatform(String(row[platformCol] ?? "")) || String(row[platformCol]) || "Unknown"
          : "Unknown";
        const rawMonth = monthCol ? String(row[monthCol] ?? "") : "";
        let month = selectedMonth;
        const dateMatch = rawMonth.match(
          /(\d{4})[.\-/](\d{1,2})|(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/
        );
        if (dateMatch) {
          if (dateMatch[1] && dateMatch[2]) {
            month = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}`;
          } else if (dateMatch[5] && dateMatch[4]) {
            month = `${dateMatch[5]}-${dateMatch[4].padStart(2, "0")}`;
          }
        }

        results2.push({
          platform,
          month,
          amount,
          label: `${platform} — ${month}`,
        });
      }

      if (results2.length === 0) {
        toast.error("No valid payout rows found in Excel file.");
        setPayoutFileParsing(false);
        return;
      }

      setPayoutFileResults(results2);
      setPayoutFileParsing(false);
      toast.success(`Found ${results2.length} payout${results2.length !== 1 ? "s" : ""} in Excel`);
    } catch {
      toast.error("Failed to parse Excel file");
      setPayoutFileParsing(false);
    }
  }

  async function importPayoutFileResults() {
    if (!studioId || payoutFileResults.length === 0) return;
    setPayoutFileImporting(true);

    let imported = 0;
    for (const result of payoutFileResults) {
      const { error } = await supabase.from("actual_payouts").upsert(
        {
          studio_id: studioId,
          month: result.month,
          platform: result.platform,
          actual_payout_total: result.amount,
        },
        { onConflict: "studio_id,month,platform" }
      );
      if (!error) imported++;
    }

    toast.success(`Imported ${imported} payout${imported !== 1 ? "s" : ""}`);
    setPayoutFileResults([]);
    setPayoutFileImporting(false);
    loadData();
  }

  function parseBankCsv(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const data = results.data as Record<string, string>[];
        if (data.length === 0) {
          toast.error("No data found in CSV");
          return;
        }

        const headers = results.meta.fields ?? [];

        // Try to identify amount, description, and date columns
        const amountCol = headers.find((h) =>
          /amount|betrag|value|credit|sum/i.test(h)
        );
        const descCol = headers.find((h) =>
          /description|verwendungszweck|purpose|reference|beschreibung|text|memo/i.test(h)
        );
        const dateCol = headers.find((h) =>
          /date|datum|booking|valuta/i.test(h)
        );

        if (!amountCol || !descCol) {
          toast.error(
            "Could not detect amount and description columns. Make sure your CSV has clearly labeled columns."
          );
          return;
        }

        const matches: BankMatch[] = [];
        for (const row of data) {
          const desc = row[descCol] ?? "";
          const platform = matchPlatform(desc);
          if (!platform) continue;

          const rawAmount = (row[amountCol] ?? "")
            .replace(/[€$\s]/g, "")
            .replace(",", ".");
          const amount = parseFloat(rawAmount);
          if (isNaN(amount) || amount <= 0) continue;

          const rawDate = dateCol ? (row[dateCol] ?? "") : "";
          // Try to extract month from date, fallback to selected month
          let month = selectedMonth;
          const dateMatch = rawDate.match(
            /(\d{4})[.\-/](\d{1,2})|(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/
          );
          if (dateMatch) {
            if (dateMatch[1] && dateMatch[2]) {
              month = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}`;
            } else if (dateMatch[5] && dateMatch[4]) {
              month = `${dateMatch[5]}-${dateMatch[4].padStart(2, "0")}`;
            }
          }

          matches.push({ description: desc, amount, date: rawDate, platform, month });
        }

        if (matches.length === 0) {
          toast.error(
            "No platform payouts found. Make sure your bank statement contains transactions from your configured platforms."
          );
          return;
        }

        setBankMatches(matches);
        toast.success(
          `Found ${matches.length} platform transaction${matches.length !== 1 ? "s" : ""}`
        );
      },
      error() {
        toast.error("Failed to parse bank CSV");
      },
    });
  }

  async function importBankMatches() {
    if (!studioId || bankMatches.length === 0) return;
    setBankImporting(true);

    let imported = 0;
    for (const match of bankMatches) {
      if (!match.platform) continue;

      const { error } = await supabase.from("actual_payouts").upsert(
        {
          studio_id: studioId,
          month: match.month,
          platform: match.platform,
          actual_payout_total: match.amount,
        },
        { onConflict: "studio_id,month,platform" }
      );

      if (!error) imported++;
    }

    toast.success(`Imported ${imported} payout${imported !== 1 ? "s" : ""}`);
    setBankMatches([]);
    setBankImporting(false);
    loadData();
  }

  async function onSubmit(data: ActualPayoutFormValues) {
    if (!studioId) return;

    const { error } = await supabase.from("actual_payouts").upsert(
      {
        studio_id: studioId,
        month: data.month,
        platform: data.platform,
        actual_payout_total: data.actual_payout_total,
      },
      { onConflict: "studio_id,month,platform" }
    );

    if (error) {
      toast.error("Failed to save payout");
      return;
    }

    toast.success("Actual payout saved");
    form.reset({ month: selectedMonth, platform: "", actual_payout_total: 0 });
    loadData();
  }

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
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
            Payout Verification
          </p>
          <h1 className="text-3xl font-bold text-[#113069] mt-1">
            Payouts
          </h1>
        </div>
        <Select
          value={selectedMonth}
          onValueChange={(val) => {
            if (val) {
              setSelectedMonth(val);
              form.setValue("month", val);
            }
          }}
        >
          <SelectTrigger className="bg-white border-[#98B1F2]/20 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
            Estimated Revenue
          </p>
          <p className="text-[2.75rem] font-bold text-[#113069] mt-1 leading-tight">
            {formatCurrency(totalEstimated)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
            Actual Payouts
          </p>
          <p className="text-[2.75rem] font-bold text-[#113069] mt-1 leading-tight">
            {hasActuals ? formatCurrency(totalActual) : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
            Difference
          </p>
          <p
            className={`text-[2.75rem] font-bold mt-1 leading-tight ${
              totalVariance !== null
                ? totalVariance >= 0
                  ? "text-green-600"
                  : "text-[#9E3F4E]"
                : "text-[#113069]"
            }`}
          >
            {totalVariance !== null
              ? `${totalVariance >= 0 ? "+" : ""}${formatCurrency(totalVariance)}`
              : "—"}
          </p>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)] mb-10">
        <h2 className="text-lg font-bold text-[#113069] mb-5">
          Platform Breakdown
        </h2>

        {rows.length === 0 ? (
          <p className="text-sm text-[#445D99] py-4">
            No data for this month yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  <th className="text-left px-4 py-2">Platform</th>
                  <th className="text-right px-4 py-2">Estimated</th>
                  <th className="text-right px-4 py-2">Actual Payout</th>
                  <th className="text-right px-4 py-2">Difference</th>
                  <th className="text-right px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.platform}
                    className={idx % 2 === 0 ? "bg-[#FAF8FF]" : "bg-white"}
                  >
                    <td className="px-4 py-3 font-medium text-[#113069]">
                      {row.platform}
                    </td>
                    <td className="px-4 py-3 text-right text-[#113069]">
                      {formatCurrency(row.estimatedRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-[#113069]">
                      {row.actualPayout !== null
                        ? formatCurrency(row.actualPayout)
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        row.varianceEur !== null
                          ? row.varianceEur >= 0
                            ? "text-green-600"
                            : "text-[#9E3F4E]"
                          : "text-[#445D99]"
                      }`}
                    >
                      {row.varianceEur !== null
                        ? `${row.varianceEur >= 0 ? "+" : ""}${formatCurrency(
                            row.varianceEur
                          )}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                          statusColors[row.status]
                        }`}
                      >
                        {statusLabels[row.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Reconciliation Entry */}
      <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)] mb-10">
        <h2 className="text-lg font-bold text-[#113069] mb-5">
          Record Actual Payout
        </h2>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-wrap items-end gap-4"
        >
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
              <SelectTrigger className="bg-white border-[#98B1F2]/20 h-10 w-48">
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
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
              Month
            </Label>
            <Select
              value={form.watch("month")}
              onValueChange={(val) => {
                if (val) form.setValue("month", val);
              }}
            >
              <SelectTrigger className="bg-white border-[#98B1F2]/20 h-10 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
              Actual Payout (€)
            </Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              className="bg-white border-[#98B1F2]/20 h-10 w-36"
              {...form.register("actual_payout_total", { valueAsNumber: true })}
            />
          </div>

          <Button
            type="submit"
            className="bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg h-10"
          >
            Submit Entry
          </Button>
        </form>
      </div>

      {/* Platform Payout Upload */}
      <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)] mb-10">
        <h2 className="text-lg font-bold text-[#113069] mb-1">
          Import from Platform Report
        </h2>
        <p className="text-sm text-[#445D99] mb-5">
          Upload a payout PDF, CSV, or Excel from your platform — we'll auto-extract the amount.
        </p>

        {payoutFileResults.length === 0 ? (
          <label className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-[#98B1F2]/30 rounded-xl cursor-pointer hover:border-[#004CED]/40 hover:bg-[#F2F3FF]/50 transition-colors">
            {payoutFileParsing ? (
              <div className="flex items-center gap-2 text-[#445D99]">
                <div className="w-5 h-5 border-2 border-[#004CED] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Parsing file...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-[#98B1F2]" />
                  <Table2 className="w-6 h-6 text-[#98B1F2]" />
                  <FileSpreadsheet className="w-6 h-6 text-[#98B1F2]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#113069]">
                    Upload platform payout report
                  </p>
                  <p className="text-xs text-[#445D99] mt-1">
                    Supports Urban Sports Club PDF, ClassPass PDF, CSV, Excel
                  </p>
                </div>
              </>
            )}
            <input
              type="file"
              accept=".pdf,.csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePayoutFile(file);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <div>
            <div className="space-y-2 mb-4">
              {payoutFileResults.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#FAF8FF]"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#113069]">
                      {result.platform}
                    </p>
                    <p className="text-xs text-[#445D99]">{result.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#113069]">
                      €{result.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#445D99]">{result.month}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={importPayoutFileResults}
                disabled={payoutFileImporting}
                className="bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg"
              >
                {payoutFileImporting
                  ? "Importing..."
                  : `Record ${payoutFileResults.length} payout${payoutFileResults.length !== 1 ? "s" : ""}`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPayoutFileResults([])}
                className="border-[#98B1F2]/20 text-[#445D99]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bank Statement Import */}
      <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
        <h2 className="text-lg font-bold text-[#113069] mb-1">
          Import from Bank Statement
        </h2>
        <p className="text-sm text-[#445D99] mb-5">
          Upload a bank CSV export — we'll auto-match transactions to your platforms.
        </p>

        {bankMatches.length === 0 ? (
          <label className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-[#98B1F2]/30 rounded-xl cursor-pointer hover:border-[#004CED]/40 hover:bg-[#F2F3FF]/50 transition-colors">
            <Upload className="w-8 h-8 text-[#98B1F2]" />
            <div className="text-center">
              <p className="text-sm font-medium text-[#113069]">
                Drop your bank statement CSV here
              </p>
              <p className="text-xs text-[#445D99] mt-1">
                Works with most German banks (Sparkasse, N26, DKB, etc.)
              </p>
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) parseBankCsv(file);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <div>
            <div className="space-y-2 mb-4">
              {bankMatches.map((match, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#FAF8FF]"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#113069] truncate">
                      {match.platform}
                    </p>
                    <p className="text-xs text-[#445D99] truncate">
                      {match.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#113069]">
                      €{match.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#445D99]">{match.month}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={importBankMatches}
                disabled={bankImporting}
                className="bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg"
              >
                {bankImporting
                  ? "Importing..."
                  : `Import ${bankMatches.length} payout${bankMatches.length !== 1 ? "s" : ""}`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setBankMatches([])}
                className="border-[#98B1F2]/20 text-[#445D99]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
