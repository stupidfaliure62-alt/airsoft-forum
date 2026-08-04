const SUPABASE_URL = "https://oiiernumnccrveluhwov.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SsUFNDClTNk1tj2t6OWCYQ_5weGCJKs";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// hCaptcha's public test key — always passes, works on any domain, but provides
// zero real spam protection. Replace with your own site key from hcaptcha.com
// once you've created an account, then enable CAPTCHA protection in the
// Supabase dashboard (Authentication -> Attack Protection) with the matching
// secret key.
const HCAPTCHA_SITE_KEY = "10000000-ffff-ffff-ffff-000000000001";
