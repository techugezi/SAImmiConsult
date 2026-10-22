// src/lib/supabaseServer.ts
import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// If you generated a Database type, you can add <Database> generics later.

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.");

  return createServerClient(
    url,
    anon,
    {
      cookies: {
        // ✅ Next 16 + @supabase/ssr require getAll/setAll only
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as CookieOptions);
            });
          } catch {
            // Called from a Server Component that can’t set cookies.
            // Safe to ignore if middleware keeps sessions updated.
          }
        },
      },
    }
  );
}

let adminClient: SupabaseClient | null = null;

/**
 * Admin Supabase client (Service Role key).
 * Use ONLY in server actions / route handlers.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Add it to your environment variables.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your server environment variables (do NOT prefix with NEXT_PUBLIC_).'
    );
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}
