"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signupSchema = z.object({
  studioName: z.string().min(1, "Studio name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(data: SignupForm) {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          studio_name: data.studioName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8FF]">
      <div className="w-full max-w-md px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-[#113069] tracking-tight">
            StudioRevenue
          </h1>
          <p className="mt-2 text-[#445D99] text-base">
            Start tracking your studio&apos;s revenue
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-[#9E3F4E]/10 px-4 py-3 text-sm text-[#9E3F4E]">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="studioName" className="text-[#113069] text-sm font-medium">
              Studio name
            </Label>
            <Input
              id="studioName"
              type="text"
              placeholder="Lumina Yoga Atelier"
              className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] focus:ring-[#DDE1FF] h-11"
              {...register("studioName")}
            />
            {errors.studioName && (
              <p className="text-sm text-[#9E3F4E]">{errors.studioName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#113069] text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@studio.com"
              className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] focus:ring-[#DDE1FF] h-11"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-[#9E3F4E]">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#113069] text-sm font-medium">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="bg-white border-[#98B1F2]/20 focus:border-[#004CED] focus:ring-[#DDE1FF] h-11"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-[#9E3F4E]">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-gradient-to-br from-[#004CED] to-[#0042D1] hover:from-[#0042D1] hover:to-[#003ABB] text-white font-medium rounded-lg"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#445D99]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#004CED] hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
