"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserLocale } from "@/lib/supabase/types";

export async function updateUserLocaleAction(locale: UserLocale) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("users_profile").update({ locale }).eq("id", user.id);
}
