import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zgdyjwehhagwkgddelqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZHlqd2VoaGFnd2tnZGRlbHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTk5OTMsImV4cCI6MjA5MTkzNTk5M30.2P6wz32TzyJDiPmEE-oL_0EnL2Na9finNmDCmSIWKGw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
