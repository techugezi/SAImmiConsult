// src/lib/supabaseClient.ts
'use client';

import { createBrowserClient } from '@supabase/ssr';

// If your .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY,
// keep using those here. The "publishable" key in the docs is your anon key.

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
