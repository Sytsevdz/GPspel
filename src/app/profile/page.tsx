import { redirect } from "next/navigation";

import { updateDisplayName } from "@/app/actions/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

type ProfilePageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Profile</h1>
        <p>Manage your display name.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <form className="auth-form" action={updateDisplayName}>
          <label htmlFor="display_name">Display name</label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            defaultValue={profile?.display_name ?? ""}
            maxLength={50}
            autoComplete="nickname"
          />

          <button type="submit">Save profile</button>
        </form>
      </section>
    </main>
  );
}
