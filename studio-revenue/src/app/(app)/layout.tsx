import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, email")
    .eq("id", user.id)
    .single();

  const { data: studio } = await supabase
    .from("studios")
    .select("name")
    .eq("id", profile?.studio_id)
    .single();

  return (
    <div className="flex h-screen bg-[#FAF8FF]">
      <Sidebar
        studioName={studio?.name ?? "My Studio"}
        userEmail={profile?.email ?? user.email ?? ""}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 lg:p-12">{children}</div>
      </main>
    </div>
  );
}
