"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { bookingEntrySchema, type BookingEntryFormValues } from "@/lib/validators";
import { formatCurrency } from "@/lib/calculations";
import type { BookingEntry, PayoutModel } from "@/types";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  Plus,
} from "lucide-react";

const PAGE_SIZE = 10;

type SortKey = "date" | "platform" | "estimated_revenue";
type SortDir = "asc" | "desc";

export default function DataPage() {
  const supabase = createClient();
  const [studioId, setStudioId] = useState<string | null>(null);
  const [entries, setEntries] = useState<BookingEntry[]>([]);
  const [payoutModels, setPayoutModels] = useState<PayoutModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Edit/Delete
  const [editEntry, setEditEntry] = useState<BookingEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingEntry | null>(null);

  const form = useForm<BookingEntryFormValues>({
    resolver: zodResolver(bookingEntrySchema),
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

    const [entriesRes, modelsRes] = await Promise.all([
      supabase
        .from("booking_entries")
        .select("*")
        .eq("studio_id", profile.studio_id)
        .order("date", { ascending: false }),
      supabase
        .from("payout_models")
        .select("*")
        .eq("studio_id", profile.studio_id),
    ]);

    setEntries(entriesRes.data ?? []);
    setPayoutModels(modelsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered + sorted entries
  const filtered = useMemo(() => {
    let result = [...entries];

    if (dateFrom) result = result.filter((e) => e.date >= dateFrom);
    if (dateTo) result = result.filter((e) => e.date <= dateTo);
    if (platformFilter !== "all")
      result = result.filter((e) => e.platform === platformFilter);

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "platform") cmp = a.platform.localeCompare(b.platform);
      else cmp = Number(a.estimated_revenue) - Number(b.estimated_revenue);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [entries, dateFrom, dateTo, platformFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageEntries = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const platforms = [...new Set(entries.map((e) => e.platform))];

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function openEdit(entry: BookingEntry) {
    setEditEntry(entry);
    form.reset({
      date: entry.date,
      platform: entry.platform,
      bookings: entry.bookings,
      paid_bookings: entry.paid_bookings ?? undefined,
      class_name: entry.class_name ?? "",
      trainer_name: entry.trainer_name ?? "",
    });
  }

  async function handleEdit(data: BookingEntryFormValues) {
    if (!editEntry || !studioId) return;

    const model = payoutModels.find((m) => m.platform === data.platform);
    const revenueBookings = data.paid_bookings ?? data.bookings;
    const estimatedRevenue = model
      ? revenueBookings * Number(model.avg_payout_per_booking)
      : 0;

    const { error } = await supabase
      .from("booking_entries")
      .update({
        date: data.date,
        platform: data.platform,
        bookings: data.bookings,
        paid_bookings: data.paid_bookings ?? null,
        class_name: data.class_name || null,
        trainer_name: data.trainer_name || null,
        estimated_revenue: estimatedRevenue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editEntry.id);

    if (error) {
      toast.error("Failed to update entry");
      return;
    }

    toast.success("Entry updated");
    setEditEntry(null);
    loadData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("booking_entries")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Failed to delete entry");
    } else {
      toast.success("Entry deleted");
      loadData();
    }
    setDeleteTarget(null);
  }

  function exportCsv() {
    const headers = [
      "Date",
      "Platform",
      "Bookings",
      "Paid Bookings",
      "Est. Revenue",
      "Class",
      "Trainer",
    ];
    const rows = filtered.map((e) => [
      e.date,
      e.platform,
      e.bookings,
      e.paid_bookings ?? "",
      Number(e.estimated_revenue).toFixed(2),
      e.class_name ?? "",
      e.trainer_name ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "booking-entries.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[#F2F3FF] rounded-lg animate-pulse" />
        <div className="h-96 bg-[#F2F3FF] rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
            Revenue Ledger
          </p>
          <h1 className="text-3xl font-bold text-[#113069] mt-1">
            Data Management
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportCsv}
            className="bg-[#F2F3FF] border-0 text-[#113069] hover:bg-[#DDE1FF] gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <a
            href="/data-input"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white text-sm font-medium rounded-lg"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-[0px_20px_40px_rgba(17,48,105,0.04)] mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
              Date Range
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                className="bg-white border-[#98B1F2]/20 h-9 text-sm w-36"
              />
              <span className="text-[#445D99] text-sm">–</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                className="bg-white border-[#98B1F2]/20 h-9 text-sm w-36"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
              Platform
            </Label>
            <Select
              value={platformFilter}
              onValueChange={(val) => {
                if (val) {
                  setPlatformFilter(val);
                  setPage(0);
                }
              }}
            >
              <SelectTrigger className="bg-white border-[#98B1F2]/20 h-9 text-sm w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-[#445D99] ml-auto">
            {filtered.length} Entries
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-[0px_20px_40px_rgba(17,48,105,0.04)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#445D99]">
            <p className="text-sm">
              No entries found. Try adjusting your filters or add a booking.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99] bg-[#FAF8FF]">
                    <th
                      className="text-left px-4 py-3 cursor-pointer hover:text-[#113069]"
                      onClick={() => toggleSort("date")}
                    >
                      <span className="flex items-center gap-1">
                        Date
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="text-left px-4 py-3 cursor-pointer hover:text-[#113069]"
                      onClick={() => toggleSort("platform")}
                    >
                      <span className="flex items-center gap-1">
                        Platform
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="text-right px-4 py-3">Bookings</th>
                    <th className="text-right px-4 py-3">Paid</th>
                    <th
                      className="text-right px-4 py-3 cursor-pointer hover:text-[#113069]"
                      onClick={() => toggleSort("estimated_revenue")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Est. Revenue
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="text-left px-4 py-3">Class</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageEntries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={`${
                        idx % 2 === 0 ? "bg-white" : "bg-[#FAF8FF]"
                      } hover:bg-[#F2F3FF] transition-colors`}
                    >
                      <td className="px-4 py-3 text-[#113069]">
                        {new Date(entry.date).toLocaleDateString("en-GB", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-[#113069]">
                        {entry.platform}
                      </td>
                      <td className="px-4 py-3 text-right text-[#113069]">
                        {entry.bookings}
                      </td>
                      <td className="px-4 py-3 text-right text-[#445D99]">
                        {entry.paid_bookings != null ? entry.paid_bookings : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#113069]">
                        {formatCurrency(Number(entry.estimated_revenue))}
                      </td>
                      <td className="px-4 py-3 text-[#445D99]">
                        {entry.class_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(entry)}
                            className="text-[#004CED] hover:text-[#0042D1]"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(entry)}
                            className="text-[#445D99] hover:text-[#9E3F4E]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#FAF8FF]">
              <p className="text-sm text-[#445D99]">
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length} entries
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg hover:bg-[#DDE1FF] disabled:opacity-30 text-[#113069]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium ${
                      page === i
                        ? "bg-[#004CED] text-white"
                        : "text-[#445D99] hover:bg-[#DDE1FF]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg hover:bg-[#DDE1FF] disabled:opacity-30 text-[#113069]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent className="bg-white border-0 shadow-[0px_20px_40px_rgba(17,48,105,0.12)] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#113069]">
              Edit Entry
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit(handleEdit)}
            className="space-y-4 mt-2"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Date
                </Label>
                <Input
                  type="date"
                  className="bg-white border-[#98B1F2]/20 h-10"
                  {...form.register("date")}
                />
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
                  <SelectTrigger className="bg-white border-[#98B1F2]/20 h-10">
                    <SelectValue />
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Total Bookings
                </Label>
                <Input
                  type="number"
                  min={0}
                  className="bg-white border-[#98B1F2]/20 h-10"
                  {...form.register("bookings", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Paid Bookings
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Optional"
                  className="bg-white border-[#98B1F2]/20 h-10"
                  {...form.register("paid_bookings", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Class Name
                </Label>
                <Input
                  className="bg-white border-[#98B1F2]/20 h-10"
                  {...form.register("class_name")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Trainer
                </Label>
                <Input
                  className="bg-white border-[#98B1F2]/20 h-10"
                  {...form.register("trainer_name")}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg"
            >
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-white border-0 shadow-[0px_20px_40px_rgba(17,48,105,0.12)] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#113069]">
              Delete entry
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#445D99]">
              Are you sure you want to delete this booking entry? This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#F2F3FF] text-[#113069] border-0 hover:bg-[#DDE1FF]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#9E3F4E] text-white hover:bg-[#8A3543]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
