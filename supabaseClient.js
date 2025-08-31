// Configuração do Supabase Client para o frontend
// Substitua pelos valores do seu projeto Supabase
const SUPABASE_URL = 'https://<SUA-URL>.supabase.co';
const SUPABASE_ANON_KEY = '<SUA-CHAVE-ANONIMA-PUBLICA>';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabase;
