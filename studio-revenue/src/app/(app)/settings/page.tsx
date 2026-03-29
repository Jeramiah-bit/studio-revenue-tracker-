"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  payoutModelSchema,
  studioSettingsSchema,
  type PayoutModelFormValues,
  type StudioSettingsFormValues,
} from "@/lib/validators";
import { DEFAULT_PLATFORMS, type PayoutModel, type Studio } from "@/types";
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
import { Pencil, Trash2, Plus } from "lucide-react";

export default function SettingsPage() {
  const supabase = createClient();
  const [studioId, setStudioId] = useState<string | null>(null);
  const [payoutModels, setPayoutModels] = useState<PayoutModel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<PayoutModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayoutModel | null>(null);
  const [loading, setLoading] = useState(true);

  // Studio settings form
  const studioForm = useForm<StudioSettingsFormValues>({
    resolver: zodResolver(studioSettingsSchema),
  });

  // Payout model form
  const payoutForm = useForm<PayoutModelFormValues>({
    resolver: zodResolver(payoutModelSchema),
    defaultValues: { platform: "", avg_payout_per_booking: 0 },
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

    const { data: studio } = await supabase
      .from("studios")
      .select("*")
      .eq("id", profile.studio_id)
      .single();

    if (studio) {
      studioForm.reset({
        name: studio.name,
        currency: studio.currency ?? "EUR",
        timezone: studio.timezone ?? "",
        week_start: studio.week_start ?? "Monday",
        monthly_revenue_goal: studio.monthly_revenue_goal ?? undefined,
      });
    }

    const { data: models } = await supabase
      .from("payout_models")
      .select("*")
      .eq("studio_id", profile.studio_id)
      .order("platform");

    setPayoutModels(models ?? []);
    setLoading(false);
  }, [supabase, studioForm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function saveStudioSettings(data: StudioSettingsFormValues) {
    if (!studioId) return;
    const { error } = await supabase
      .from("studios")
      .update({
        name: data.name,
        currency: data.currency,
        timezone: data.timezone || null,
        week_start: data.week_start || null,
        monthly_revenue_goal: data.monthly_revenue_goal ?? null,
      })
      .eq("id", studioId);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved");
    }
  }

  function openAddDialog() {
    setEditingModel(null);
    payoutForm.reset({ platform: "", avg_payout_per_booking: 0, payout_lag_days: undefined });
    setDialogOpen(true);
  }

  function openEditDialog(model: PayoutModel) {
    setEditingModel(model);
    payoutForm.reset({
      platform: model.platform,
      avg_payout_per_booking: model.avg_payout_per_booking,
      payout_lag_days: model.payout_lag_days ?? undefined,
    });
    setDialogOpen(true);
  }

  async function savePayoutModel(data: PayoutModelFormValues) {
    if (!studioId) return;

    const payload = {
      studio_id: studioId,
      platform: data.platform,
      avg_payout_per_booking: data.avg_payout_per_booking,
      payout_lag_days: data.payout_lag_days ?? null,
      updated_at: new Date().toISOString(),
    };

    if (editingModel) {
      const { error } = await supabase
        .from("payout_models")
        .update(payload)
        .eq("id", editingModel.id);
      if (error) {
        toast.error("Failed to update model");
        return;
      }
      toast.success("Payout model updated");
    } else {
      const { error } = await supabase.from("payout_models").insert(payload);
      if (error) {
        toast.error("Failed to add model");
        return;
      }
      toast.success("Payout model added");
    }

    setDialogOpen(false);
    loadData();
  }

  async function deletePayoutModel() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("payout_models")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Failed to delete model");
    } else {
      toast.success("Payout model deleted");
      loadData();
    }
    setDeleteTarget(null);
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
      <p className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
        Configuration
      </p>
      <h1 className="text-3xl font-bold text-[#113069] mt-1">
        Account Settings
      </h1>
      <p className="text-[#445D99] mt-1 mb-10">
        Manage your studio preferences, payout models, and data synchronization
        rules for your financial atelier.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left column: Payout Models */}
        <div className="lg:col-span-2 space-y-10">
          {/* Payout Models Section */}
          <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#113069]">
                  Payout Models
                </h2>
                <p className="text-sm text-[#445D99] mt-0.5">
                  Used to estimate your daily revenue based on bookings.
                </p>
              </div>
              <Button
                onClick={openAddDialog}
                className="bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Model
              </Button>
            </div>

            {payoutModels.length === 0 ? (
              <div className="text-center py-12 text-[#445D99]">
                <p className="text-sm">No platforms configured yet.</p>
                <p className="text-sm">Add your first payout model to start tracking revenue.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  <div className="col-span-4">Platform</div>
                  <div className="col-span-3">Avg Revenue Per Booking</div>
                  <div className="col-span-3">Last Updated</div>
                  <div className="col-span-2">Actions</div>
                </div>

                {payoutModels.map((model, idx) => (
                  <div
                    key={model.id}
                    className={`grid grid-cols-12 gap-4 px-4 py-4 items-center rounded-lg ${
                      idx % 2 === 0 ? "bg-[#FAF8FF]" : "bg-white"
                    }`}
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#F2F3FF] flex items-center justify-center text-xs font-semibold text-[#004CED]">
                        {model.platform.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-[#113069]">
                        {model.platform}
                      </span>
                    </div>
                    <div className="col-span-3 text-sm text-[#113069]">
                      €{Number(model.avg_payout_per_booking).toFixed(2)}
                    </div>
                    <div className="col-span-3 text-sm text-[#445D99]">
                      {new Date(model.updated_at).toLocaleDateString("en-GB", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={() => openEditDialog(model)}
                        className="text-[#004CED] hover:text-[#0042D1] text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(model)}
                        className="text-[#445D99] hover:text-[#9E3F4E] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Studio Settings */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-[0px_20px_40px_rgba(17,48,105,0.04)]">
            <h2 className="text-xl font-bold text-[#113069] mb-6">
              Studio Settings
            </h2>

            <form
              onSubmit={studioForm.handleSubmit(saveStudioSettings)}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Studio Name
                </Label>
                <Input
                  className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                  {...studioForm.register("name")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Currency
                </Label>
                <Select
                  value={studioForm.watch("currency")}
                  onValueChange={(val) => { if (val) studioForm.setValue("currency", val); }}
                >
                  <SelectTrigger className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                    <SelectItem value="USD">US Dollar ($)</SelectItem>
                    <SelectItem value="GBP">British Pound (£)</SelectItem>
                    <SelectItem value="CHF">Swiss Franc (CHF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Timezone
                </Label>
                <Select
                  value={studioForm.watch("timezone") ?? ""}
                  onValueChange={(val) => { if (val) studioForm.setValue("timezone", val); }}
                >
                  <SelectTrigger className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Berlin">
                      (GMT+01:00) Berlin
                    </SelectItem>
                    <SelectItem value="Europe/London">
                      (GMT+00:00) London
                    </SelectItem>
                    <SelectItem value="America/New_York">
                      (GMT-05:00) New York
                    </SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      (GMT-08:00) Los Angeles
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Week Start
                </Label>
                <div className="flex gap-2">
                  {["Monday", "Sunday"].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => studioForm.setValue("week_start", day)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                        studioForm.watch("week_start") === day
                          ? "bg-[#004CED]/8 text-[#004CED]"
                          : "bg-[#F2F3FF] text-[#445D99] hover:bg-[#DDE1FF]"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                  Monthly Revenue Goal (€)
                </Label>
                <Input
                  type="number"
                  step="1"
                  min={0}
                  placeholder="e.g. 9500"
                  className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                  {...studioForm.register("monthly_revenue_goal", { valueAsNumber: true })}
                />
                <p className="text-xs text-[#445D99]">
                  Set a monthly target to track progress on your dashboard.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg mt-2"
              >
                Save Changes
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Add/Edit Payout Model Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-0 shadow-[0px_20px_40px_rgba(17,48,105,0.12)] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#113069]">
              {editingModel ? "Edit Payout Model" : "Add Payout Model"}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={payoutForm.handleSubmit(savePayoutModel)}
            className="space-y-5 mt-2"
          >
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                Platform
              </Label>
              {editingModel ? (
                <Input
                  className="bg-[#F2F3FF] border-[#98B1F2]/20 h-10"
                  value={editingModel.platform}
                  disabled
                />
              ) : (
                <Select
                  value={payoutForm.watch("platform")}
                  onValueChange={(val) => { if (val) payoutForm.setValue("platform", val); }}
                >
                  <SelectTrigger className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {payoutForm.formState.errors.platform && (
                <p className="text-sm text-[#9E3F4E]">
                  {payoutForm.formState.errors.platform.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                Avg Revenue Per Booking (€)
              </Label>
              <Input
                type="number"
                step="0.01"
                className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                {...payoutForm.register("avg_payout_per_booking", { valueAsNumber: true })}
              />
              {payoutForm.formState.errors.avg_payout_per_booking && (
                <p className="text-sm text-[#9E3F4E]">
                  {payoutForm.formState.errors.avg_payout_per_booking.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-[0.05em] text-[#445D99]">
                Payout Lag (days)
              </Label>
              <Input
                type="number"
                placeholder="e.g. 30"
                className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] h-10"
                {...payoutForm.register("payout_lag_days", { valueAsNumber: true })}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-br from-[#004CED] to-[#0042D1] text-white rounded-lg"
            >
              {editingModel ? "Save Changes" : "Add Model"}
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
              Delete payout model
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#445D99]">
              Are you sure you want to delete the payout model for{" "}
              <strong>{deleteTarget?.platform}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#F2F3FF] text-[#113069] border-0 hover:bg-[#DDE1FF]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deletePayoutModel}
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
