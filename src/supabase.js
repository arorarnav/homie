import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://xirmpavtyczcdbyomtxh.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_-SZLhAEHIwIfdoHtSiu1mA_Qc0BhoI8"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)