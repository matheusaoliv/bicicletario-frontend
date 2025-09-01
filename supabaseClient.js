// Configuração do Supabase Client para o frontend
// Substitua pelos valores do seu projeto Supabase
// ATENÇÃO: Substitua pelos valores REAIS do seu projeto Supabase!
const SUPABASE_URL = 'https://uteujecwghmfscxtoelw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0ZXVqZWN3Z2htZnNjeHRvZWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNDUyNjIsImV4cCI6MjA2OTgyMTI2Mn0.bx6LSf0GsKupLRQYbqQlviXonGIAQtC6jOzuqu9YUSs';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.supabaseClient = supabase;
