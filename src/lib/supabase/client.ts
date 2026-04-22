import { createBrowserClient } from "@supabase/ssr";

// TODO(types): createBrowserClient<Database>() 로 점진 이행.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
