// Carregar .env; em desenvolvimento, sobrescreve variáveis do ambiente para evitar conflitos
require('dotenv').config({ override: process.env.NODE_ENV !== 'production' });

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('./services/supabaseCompat');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const helmet = require('helmet');
const cors = require('cors');
const { uploadToFolder } = require('./services/storage');
const { db } = require('./services/firebaseAdmin');

const app = express();

const isProd = process.env.NODE_ENV === 'production';

// CORS para GitHub Pages
const allowedOrigins = [
  'https://bicicletariodejaperi.online',
  'https://sistema.bicicletariodejaperi.online',
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:3001', 'http://127.0.0.1:3001'
];
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex.: curl, Postman) e mesmas origens
    if (!origin) return callback(null, true);
    // Produção: apenas origens da lista
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Desenvolvimento: permitir qualquer porta local (localhost/127.0.0.1)
    if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS: ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
app.use(cors(corsOptions));
// Responder preflight (OPTIONS)
app.options('*', cors(corsOptions));

const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET;
const MIGRATION_TOKEN = process.env.MIGRATION_TOKEN || '';

if (!JWT_SECRET) {
    console.error('ERRO: JWT_SECRET não definido');
    process.exit(1);
}

// Debug: verificar disponibilidade do MIGRATION_TOKEN (sem expor valor)
app.get('/api/debug/migration-token-len', (req, res) => {
    try {
        let expected = (MIGRATION_TOKEN || '').trim();
        try {
            if (!expected) {
                const { defineSecret } = require('firebase-functions/params');
                const S = defineSecret('MIGRATION_TOKEN');
                const v = S && S.value ? S.value() : null;
                if (v) expected = String(v).trim();
            }
        } catch(_){ }
        return res.json({ present: !!expected, length: expected ? expected.length : 0 });
    } catch (err) {
        return res.status(500).json({ present: false, length: 0 });
    }
});

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'img-src': ["'self'", 'data:', 'https:'],
        },
    },
}));

// Configuração Supabase (permite fallback para Firebase via compat)
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Thresholds configuráveis para severidade de alertas (podem ser sobrescritos via .env)
const ALERT_MED_DAYS = Math.max(0, parseInt(process.env.ALERT_MED_DAYS || '3', 10));
let ALERT_HI_DAYS = Math.max(0, parseInt(process.env.ALERT_HI_DAYS || '7', 10));
if (ALERT_HI_DAYS < ALERT_MED_DAYS) ALERT_HI_DAYS = ALERT_MED_DAYS;

// Configuração do Multer para Supabase Storage
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Tipo de arquivo não permitido'));
        }
        cb(null, true);
    }
}).fields([
    { name: 'fotoProprietario', maxCount: 1 }, 
    { name: 'fotoProprietarioExtra', maxCount: 1 },
    { name: 'fotoBicicleta', maxCount: 1 },
    { name: 'fotoDonoComBicicleta', maxCount: 1 }
]);

// Função para upload no Supabase Storage
async function uploadToSupabase(file, folder) {
    const url = await uploadToFolder(file, folder);
    return url;
}

// Middleware de autenticação
const autenticarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ENDPOINTS ---

// Health check (para monitoramento do front)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Catálogo de bikes (serve JSON estático com fallback no front)
app.get('/api/catalogo-bikes', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'BicicletarioMunicipaldeJaperi', 'data', 'catalogo-bikes.json');
        const stat = await fs.promises.stat(filePath);
        const lastModified = stat.mtime.toUTCString();
        const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(16)}"`;

        // Cabeçalhos de cache
        res.set('Cache-Control', isProd ? 'public, max-age=3600' : 'no-store');
        res.set('Last-Modified', lastModified);
        res.set('ETag', etag);

        // Validação condicional
        const inm = req.headers['if-none-match'];
        const ims = req.headers['if-modified-since'];
        const imsTime = ims ? Date.parse(ims) : NaN;
        if ((inm && inm === etag) || (imsTime && stat.mtime.getTime() <= imsTime)) {
            return res.status(304).end();
        }

        const content = await fs.promises.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        return res.json(data);
    } catch (err) {
        console.error('Erro ao carregar catálogo de bikes:', err);
        const payload = isProd
          ? { erro: 'Falha ao carregar catálogo' }
          : { erro: 'Falha ao carregar catálogo', detalhes: err?.message || String(err) };
        res.status(500).json(payload);
    }
});

app.post('/api/admin/risk/score', autenticarToken, async (req, res) => {
  try{
    const entrada_iso = (req.body?.entrada_iso || req.body?.data_hora_entrada || '').toString();
    const local = (req.body?.local || '').toString();
    const tzOffsetMinutes = parseInt(req.body?.tzOffsetMinutes || '0', 10);
    if (!entrada_iso) return res.status(400).json({ erro: 'entrada_iso obrigatório' });
    const nowMs = Date.now();
    let rs = computeMLRisk(entrada_iso, local, tzOffsetMinutes);
    let algo = 'ml';
    if (rs === null) {
      const t = Date.parse(entrada_iso);
      const minutesElapsed = Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t)/60000)) : 0;
      rs = computeHeuristicRisk(entrada_iso, nowMs, tzOffsetMinutes, undefined, minutesElapsed);
      algo = 'heuristic';
    }
    res.json({ algo, risk_score: rs, risk_percent: Math.round(rs*100) });
  } catch (err) {
    console.error('Erro em /api/admin/risk/score:', err);
    res.status(500).json({ erro: 'Falha ao pontuar risco' });
  }
});

// Dataset para treino do risco (Fase 1)
// Retorna histórico com saída para rotular "estourou_72h"
// Params: dias (padrão 365), limit (padrão 5000), tzOffsetMinutes (para derivar features locais)
app.get('/api/admin/risk/dataset', autenticarToken, async (req, res) => {
  try{
    const dias = Math.max(1, Math.min(parseInt(req.query.dias || '365', 10), 1825));
    const limit = Math.max(100, Math.min(parseInt(req.query.limit || '5000', 10), 20000));
    const tzOffsetMinutes = parseInt(req.query.tzOffsetMinutes || '0', 10);
    const nowMs = Date.now();
    const sinceIso = new Date(nowMs - dias * 24 * 60 * 60 * 1000).toISOString();

    let q = supabaseAdmin
      .from('controleacesso')
      .select('id, proprietario_id, bicicleta_id, local, data_hora_entrada, data_hora_saida')
      .gte('data_hora_entrada', sinceIso)
      .not('data_hora_saida', 'is', null)
      .order('data_hora_entrada', { ascending: false })
      .limit(limit);

    const { data, error } = await q;
    if (error) throw error;
    const itens = (data || []).map(r => {
      const tIn = Date.parse(r.data_hora_entrada);
      const tOut = Date.parse(r.data_hora_saida);
      const durH = (Number.isFinite(tIn) && Number.isFinite(tOut)) ? (tOut - tIn)/3600000 : null;
      const localMs = Number.isFinite(tIn) ? (tIn - tzOffsetMinutes*60000) : NaN;
      const d = Number.isFinite(localMs) ? new Date(localMs) : null;
      const day_of_week = d ? d.getUTCDay() : null; // 0..6 (Dom..Sáb)
      const hour_of_day = d ? d.getUTCHours() : null; // 0..23
      return {
        id: r.id,
        proprietario_id: r.proprietario_id || null,
        bicicleta_id: r.bicicleta_id || null,
        local: r.local || null,
        entrada_iso: r.data_hora_entrada,
        saida_iso: r.data_hora_saida,
        duracao_horas: durH !== null ? Math.round(durH * 100) / 100 : null,
        day_of_week,
        hour_of_day,
        estourou_72h: (durH !== null) ? (durH >= 72) : null
      };
    });
    res.json({ dias, total: itens.length, itens });
  } catch(err){
    console.error('Erro em /api/admin/risk/dataset:', err);
    const payload = isProd ? { erro: 'Erro ao gerar dataset' } : { erro: 'Erro ao gerar dataset', detalhes: err?.message || String(err) };
    res.status(500).json(payload);
  }
});

// Verificar dependências de bicicleta (quantidade de registros de acesso associados)
app.get('/api/bicicletas/:id/dependencias', autenticarToken, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    try {
        const { count, error } = await supabaseAdmin
            .from('controleacesso')
            .select('id', { count: 'exact', head: true })
            .eq('bicicleta_id', id);
        if (error) throw error;
        res.json({ total: count || 0 });
    } catch (err) {
        console.error('Erro ao verificar dependências de bicicleta:', err);
        const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
        const payload = isProd
          ? { erro: 'Erro ao verificar dependências' }
          : { erro: 'Erro ao verificar dependências', detalhes: pretty(err), code: err?.code, hint: err?.hint };
        res.status(500).json(payload);
    }
});

// Debug simples do ambiente (não expõe chaves)
app.get('/api/debug/env', autenticarToken, (req, res) => {
    res.json({
        hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasAnon: !!process.env.SUPABASE_ANON_KEY,
        hasUrl: !!process.env.SUPABASE_URL,
        nodeEnv: process.env.NODE_ENV || 'development'
    });
});

// Dev: metadados das chaves (sem expor o segredo)
app.get('/api/debug/supabase-meta', autenticarToken, (req, res) => {
    if (isProd) return res.status(404).json({ erro: 'Indisponível em produção' });
    function decodeTokenMeta(tok){
        try {
            if(!tok || typeof tok !== 'string' || !tok.includes('.')) return null;
            const base64 = tok.split('.')[1];
            const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
            const { role, ref, iss, iat, exp } = json || {};
            return { role, ref, iss, iat, exp };
        } catch(_){ return null; }
    }
    function projectRefFromUrl(url){
        try { const u = new URL(url); const host = u.hostname || ''; const m = host.match(/^([^.]+)\./); return m ? m[1] : null; } catch(_){ return null; }
    }
    return res.json({
        url: supabaseUrl,
        projectRefFromUrl: projectRefFromUrl(supabaseUrl),
        anonMeta: decodeTokenMeta(supabaseKey),
        serviceMeta: decodeTokenMeta(supabaseServiceKey)
    });
});

// Importação em lote via token de migração (para execução dentro das Cloud Functions)
app.post('/api/admin/import-batch', async (req, res) => {
    try {
        // Captura token do header, Authorization Bearer ou querystring, com trim
        const headerTok = req.headers['x-migration-token'] || req.headers['x_migration_token'] || '';
        const auth = (req.headers['authorization'] || '').toString();
        const authTok = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
        const qsTok = (req.query && (req.query.token || req.query.migration_token)) || '';
        const token = String(headerTok || authTok || qsTok || '').trim();
        let expected = (MIGRATION_TOKEN || '').trim();
        try {
            if (!expected) {
                const { defineSecret } = require('firebase-functions/params');
                const S = defineSecret('MIGRATION_TOKEN');
                const v = S && S.value ? S.value() : null;
                if (v) expected = String(v).trim();
            }
        } catch(_){}
        if (!expected || !token || token !== expected) {
            try { console.log('import-batch debug: tokenLen=', (token||'').length, 'expectedSet=', !!expected); } catch(_){}
            return res.status(403).json({ erro: 'forbidden', hint: 'token' });
        }

        const body = req.body || {};
        const collection = (body.collection || '').toString().trim();
        const records = Array.isArray(body.records) ? body.records : [];
        const idField = (body.idField || 'id').toString();
        const merge = body.merge !== false;
        const dryRun = body.dryRun === true;
        if (!collection) return res.status(400).json({ erro: 'collection obrigatória' });
        if (!records.length) return res.status(400).json({ erro: 'records vazio' });

        if (dryRun) {
            return res.json({ ok: true, dryRun: true, collection, total: records.length });
        }

        const BATCH_LIMIT = 450;
        let enviados = 0;
        let batches = 0;
        for (let i = 0; i < records.length; i += BATCH_LIMIT) {
            const lote = records.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            const col = db.collection(collection);
            for (const rec of lote) {
                const idVal = rec && rec[idField] != null ? String(rec[idField]) : null;
                const ref = idVal ? col.doc(idVal) : col.doc();
                batch.set(ref, rec, { merge });
            }
            await batch.commit();
            enviados += lote.length;
            batches++;
        }
        return res.json({ ok: true, collection, total: records.length, batches, enviados });
    } catch (err) {
        const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
        return res.status(500).json({ erro: 'Falha no import-batch', detalhes: pretty(err) });
    }
});

// Dashboard stats (mínimo viável para não quebrar o front)
app.get('/api/dashboard/stats', autenticarToken, async (req, res) => {
    try {
        // Período: últimos N dias (padrão 7). Se "data" vier, considera o dia LOCAL do cliente.
        // Para precisão: o front envia tzOffsetMinutes = getTimezoneOffset() (ex.: 180 p/ -03:00).
        const dias = Math.max(1, parseInt(req.query.dias || '7', 10));
        const dataRef = (req.query.data && String(req.query.data)) || new Date().toISOString().slice(0,10);
        const tzOffsetMinutes = parseInt(req.query.tzOffsetMinutes || '0', 10); // minutos a adicionar para converter local->UTC
        const compatMode = String(req.query.compat || req.query.mode || '').toLowerCase() === '1' || String(req.query.mode || '').toLowerCase() === 'compat';
        const [Y, M, D] = dataRef.split('-').map(n => parseInt(n, 10));
        // Calcula fim do dia local em UTC e também o exclusivo (nextDayStart)
        const nextDayStartUTCmsBase = Date.UTC(Y, (M||1)-1, (D||1) + 1, 0, 0, 0, 0) + (tzOffsetMinutes * 60000);
        let endUTCms;
        if (compatMode) {
            // Modo compatibilidade: cálculo antigo (23:59:59.999 local)
            endUTCms = Date.UTC(Y, (M||1)-1, D||1, 23, 59, 59, 999) + (tzOffsetMinutes * 60000);
        } else {
            // Precisão: início do dia seguinte - 1ms
            endUTCms = nextDayStartUTCmsBase - 1;
        }
        // Calcula início (dias-1) dias antes, considerando dias locais
        const startBase = new Date(Date.UTC(Y, (M||1)-1, D||1, 0, 0, 0, 0));
        startBase.setUTCDate(startBase.getUTCDate() - (dias - 1));
        const startUTCms = startBase.getTime() + (tzOffsetMinutes * 60000);
        const start = new Date(startUTCms).toISOString();
        const end = new Date(endUTCms).toISOString();
        const endExclusiveIso = new Date(compatMode ? (endUTCms + 1) : nextDayStartUTCmsBase).toISOString();
        const localFiltro = req.query.local && req.query.local !== 'todos' ? String(req.query.local) : null;
        const localFiltroNorm = localFiltro ? localFiltro.trim() : null;
        const localPattern = localFiltroNorm ? `%${localFiltroNorm}%` : null;
        // Modo legado estrito: replica exatamente as consultas da produção
        const legacyStrict = String(req.query.legacy || '').toLowerCase() === '1'
          || String(req.query.mode || '').toLowerCase() === 'legacy'
          || String(req.query.mode || '').toLowerCase() === 'legacystrict';
        const dataFiltro = dataRef; // esperado no formato YYYY-MM-DD
        const startLegacy = `${dataFiltro}T00:00:00`;
        const endLegacy = `${dataFiltro}T23:59:59`;
        const legacyLocalEq = localFiltroNorm ? (localFiltroNorm === 'Japeri' ? 'Japeri' : 'Engenheiro Pedreira') : null;
        // Paginação das atividades
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || '10', 10)));

        // Bicicletas atualmente estacionadas (registros sem data_hora_saida)
        let queryEst = supabase
            .from('controleacesso')
            .select('id', { count: 'exact', head: true })
            .is('data_hora_saida', null);
        if (legacyStrict) {
            if (legacyLocalEq) queryEst = queryEst.eq('local', legacyLocalEq);
        } else {
            if (localPattern) queryEst = queryEst.ilike('local', localPattern);
        }
        const { count: estacionadasAgora = 0, error: errEst } = await queryEst;
        if (errEst) throw errEst;

        // Entradas no período
        let queryEnt;
        if (legacyStrict) {
            queryEnt = supabase
                .from('controleacesso')
                .select('id', { count: 'exact', head: true })
                .gte('data_hora_entrada', startLegacy)
                .lt('data_hora_entrada', endLegacy);
            if (legacyLocalEq) queryEnt = queryEnt.eq('local', legacyLocalEq);
        } else {
            queryEnt = supabase
                .from('controleacesso')
                .select('id', { count: 'exact', head: true })
                .gte('data_hora_entrada', start)
                .lt('data_hora_entrada', endExclusiveIso);
            if (localPattern) queryEnt = queryEnt.ilike('local', localPattern);
        }
        const { count: entradasHoje = 0, error: errEnt } = await queryEnt;
        if (errEnt) throw errEnt;

        // Saídas no período
        let querySai;
        if (legacyStrict) {
            querySai = supabase
                .from('controleacesso')
                .select('id', { count: 'exact', head: true })
                .not('data_hora_saida', 'is', null)
                .gte('data_hora_saida', startLegacy)
                .lt('data_hora_saida', endLegacy);
            if (legacyLocalEq) querySai = querySai.eq('local', legacyLocalEq);
        } else {
            querySai = supabase
                .from('controleacesso')
                .select('id', { count: 'exact', head: true })
                .gte('data_hora_saida', start)
                .lt('data_hora_saida', endExclusiveIso);
            if (localPattern) querySai = querySai.ilike('local', localPattern);
        }
        const { count: saidasHoje = 0, error: errSai } = await querySai;
        if (errSai) throw errSai;

        // Atividades recentes (entradas e saídas do dia)
        let qEntList;
        if (legacyStrict) {
            qEntList = supabase
                .from('controleacesso')
                .select('id, proprietario_id, bicicleta_id, local, data_hora_entrada')
                .gte('data_hora_entrada', startLegacy)
                .lt('data_hora_entrada', endLegacy)
                .order('data_hora_entrada', { ascending: false })
                .limit(200);
            if (legacyLocalEq) qEntList = qEntList.eq('local', legacyLocalEq);
        } else {
            qEntList = supabase
                .from('controleacesso')
                .select('id, proprietario_id, bicicleta_id, local, data_hora_entrada')
                .gte('data_hora_entrada', start)
                .lt('data_hora_entrada', endExclusiveIso);
            qEntList = qEntList.order('data_hora_entrada', { ascending: false }).limit(200);
            if (localPattern) qEntList = qEntList.ilike('local', localPattern);
        }
        const { data: entList = [], error: errEntList } = await qEntList;
        if (errEntList) throw errEntList;

        let qSaiList;
        if (legacyStrict) {
            qSaiList = supabase
                .from('controleacesso')
                .select('id, proprietario_id, bicicleta_id, local, data_hora_saida')
                .not('data_hora_saida', 'is', null)
                .gte('data_hora_saida', startLegacy)
                .lt('data_hora_saida', endLegacy)
                .order('data_hora_saida', { ascending: false })
                .limit(200);
            if (legacyLocalEq) qSaiList = qSaiList.eq('local', legacyLocalEq);
        } else {
            qSaiList = supabase
                .from('controleacesso')
                .select('id, proprietario_id, bicicleta_id, local, data_hora_saida')
                .gte('data_hora_saida', start)
                .lt('data_hora_saida', endExclusiveIso);
            qSaiList = qSaiList.order('data_hora_saida', { ascending: false }).limit(200);
            if (localPattern) qSaiList = qSaiList.ilike('local', localPattern);
        }
        const { data: saiList = [], error: errSaiList } = await qSaiList;
        if (errSaiList) throw errSaiList;

        const atividadesBrutas = [
            ...entList.map(r => ({
                id: r.id,
                tipo: 'entrada',
                hora: r.data_hora_entrada,
                proprietario_id: r.proprietario_id,
                bicicleta_id: r.bicicleta_id,
                local: r.local || null,
            })),
            ...saiList.map(r => ({
                id: r.id,
                tipo: 'saida',
                hora: r.data_hora_saida,
                proprietario_id: r.proprietario_id,
                bicicleta_id: r.bicicleta_id,
                local: r.local || null,
            })),
        ].filter(a => !!a.hora);

        // Enriquecer com nome do proprietário
        const propIds = Array.from(new Set(atividadesBrutas.map(a => a.proprietario_id).filter(Boolean)));
        let propMap = {};
        if (propIds.length > 0) {
            const { data: props = [] } = await supabase
                .from('proprietarios')
                .select('id, nome_completo')
                .in('id', propIds);
            propMap = Object.fromEntries(props.map(p => [p.id, p.nome_completo]));
        }
        
        // Enriquecer com dados da bicicleta (marca, modelo, tipo e número)
        const bikeIds = Array.from(new Set(atividadesBrutas.map(a => a.bicicleta_id).filter(Boolean)));
        let bikeMap = {};
        if (bikeIds.length > 0) {
            const { data: bikes = [] } = await supabase
                .from('bicicletas')
                .select('id, marca, modelo, numero_identificacao, tipo_bike')
                .in('id', bikeIds);
            bikeMap = Object.fromEntries((bikes || []).map(b => [b.id, b]));
        }
        const atividadesOrdenadas = atividadesBrutas
            .map(a => {
                const b = bikeMap[a.bicicleta_id] || null;
                return {
                    ...a,
                    proprietario_nome: propMap[a.proprietario_id] || null,
                    // Campos de bicicleta para o feed
                    marca: b ? b.marca : null,
                    marca_bicicleta: b ? b.marca : null,
                    modelo: b ? b.modelo : null,
                    modelo_bicicleta: b ? b.modelo : null,
                    tipo_bike: b ? b.tipo_bike : null,
                    numero_identificacao: b ? b.numero_identificacao : null,
                };
            })
            .sort((a, b) => new Date(b.hora) - new Date(a.hora));

        const totalAtividades = atividadesOrdenadas.length;
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const atividadesPagina = atividadesOrdenadas.slice(startIdx, endIdx);

        // Rótulo amigável: "Entrada às HH:MM - Nome"
        const atividadesRecentes = atividadesPagina.map(a => {
            const d = new Date(a.hora);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const tipoLabel = a.tipo === 'entrada' ? 'Entrada' : 'Saída';
            const nome = a.proprietario_nome || 'Proprietário';
            return {
                ...a,
                label: `${tipoLabel} às ${hh}:${mm} - ${nome}`
            };
        });

        // Ranking de proprietários por entradas no dia
        let qRank;
        if (legacyStrict) {
            qRank = supabase
                .from('controleacesso')
                .select('id, proprietario_id')
                .gte('data_hora_entrada', startLegacy)
                .lt('data_hora_entrada', endLegacy);
            if (legacyLocalEq) qRank = qRank.eq('local', legacyLocalEq);
        } else {
            qRank = supabase
                .from('controleacesso')
                .select('id, proprietario_id')
                .gte('data_hora_entrada', start);
            if (compatMode) {
                qRank = qRank.lte('data_hora_entrada', end);
            } else {
                qRank = qRank.lt('data_hora_entrada', endExclusiveIso);
            }
            if (localPattern) qRank = qRank.ilike('local', localPattern);
        }
        const { data: entradasDia = [], error: errRank } = await qRank;
        if (errRank) throw errRank;

        const contagem = {};
        for (const r of entradasDia) {
            if (!r.proprietario_id) continue;
            contagem[r.proprietario_id] = (contagem[r.proprietario_id] || 0) + 1;
        }
        const topIds = Object.entries(contagem)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => parseInt(id, 10));

        let topMap = {};
        if (topIds.length > 0) {
            const { data: topProps = [] } = await supabase
                .from('proprietarios')
                .select('id, nome_completo')
                .in('id', topIds);
            topMap = Object.fromEntries(topProps.map(p => [p.id, p.nome_completo]));
        }
        const rankingProprietarios = topIds.map(id => ({
            proprietario_id: id,
            nome_completo: topMap[id] || 'Proprietário',
            total_entradas: contagem[id] || 0,
        }));

        // --- Detalhamento para compatibilidade com payload de produção ---
        // Bicicletas Estacionadas (detalhes): registros com data_hora_saida NULL, com join em proprietarios e bicicletas
        let qEstDet = supabase
            .from('controleacesso')
            .select('id, local, proprietarios(nome_completo), bicicletas(tipo_bike, modelo, numero_identificacao)')
            .is('data_hora_saida', null);
        if (legacyStrict) {
            if (legacyLocalEq) qEstDet = qEstDet.eq('local', legacyLocalEq);
        } else {
            if (localPattern) qEstDet = qEstDet.ilike('local', localPattern);
        }
        const { data: estDet = [] } = await qEstDet;
        const bicicletasEstacionadas = (estDet || []).map(r => ({
            nome_completo: r?.proprietarios?.nome_completo || null,
            tipo_bike: r?.bicicletas?.tipo_bike || null,
            modelo: r?.bicicletas?.modelo || null,
            numero_identificacao: r?.bicicletas?.numero_identificacao || null,
        }));

        // Entradas Hoje (detalhadas)
        let qEntDet = supabase
            .from('controleacesso')
            .select('data_hora_entrada, local, proprietarios(nome_completo), bicicletas(tipo_bike, modelo, numero_identificacao)');
        if (legacyStrict) {
            qEntDet = qEntDet
                .gte('data_hora_entrada', startLegacy)
                .lt('data_hora_entrada', endLegacy);
            if (legacyLocalEq) qEntDet = qEntDet.eq('local', legacyLocalEq);
        } else {
            qEntDet = qEntDet
                .gte('data_hora_entrada', start)
                .lt('data_hora_entrada', endExclusiveIso);
            if (localPattern) qEntDet = qEntDet.ilike('local', localPattern);
        }
        qEntDet = qEntDet.order('data_hora_entrada', { ascending: false });
        const { data: entDet = [] } = await qEntDet;
        const entradasHojeDetalhadas = (entDet || []).map(r => ({
            nome_completo: r?.proprietarios?.nome_completo || null,
            tipo_bike: r?.bicicletas?.tipo_bike || null,
            modelo: r?.bicicletas?.modelo || null,
            numero_identificacao: r?.bicicletas?.numero_identificacao || null,
            data_hora_entrada: r?.data_hora_entrada || null,
        }));

        // Saídas Hoje (detalhadas)
        let qSaiDet = supabase
            .from('controleacesso')
            .select('data_hora_saida, local, proprietarios(nome_completo), bicicletas(tipo_bike, modelo, numero_identificacao)');
        if (legacyStrict) {
            qSaiDet = qSaiDet
                .not('data_hora_saida', 'is', null)
                .gte('data_hora_saida', startLegacy)
                .lt('data_hora_saida', endLegacy);
            if (legacyLocalEq) qSaiDet = qSaiDet.eq('local', legacyLocalEq);
        } else {
            qSaiDet = qSaiDet
                .gte('data_hora_saida', start)
                .lt('data_hora_saida', endExclusiveIso);
            if (localPattern) qSaiDet = qSaiDet.ilike('local', localPattern);
        }
        qSaiDet = qSaiDet.order('data_hora_saida', { ascending: false });
        const { data: saiDet = [] } = await qSaiDet;
        const saidasHojeDetalhadas = (saiDet || []).map(r => ({
            nome_completo: r?.proprietarios?.nome_completo || null,
            tipo_bike: r?.bicicletas?.tipo_bike || null,
            modelo: r?.bicicletas?.modelo || null,
            numero_identificacao: r?.bicicletas?.numero_identificacao || null,
            data_hora_saida: r?.data_hora_saida || null,
        }));

        // Ocorrências Recentes (observações no dia local)
        // Estratégia: coletar registros do período tanto por entrada quanto por saída e extrair
        // observacoes_entrada, observacoes_saida e observacao_geral (quando presentes).
        let qEntObs = supabase
            .from('controleacesso')
            .select('id, local, data_hora_entrada, proprietarios(nome_completo), bicicletas(marca, modelo, numero_identificacao, tipo_bike), observacoes_entrada, observacao_geral')
            .gte('data_hora_entrada', start)
            .lt('data_hora_entrada', endExclusiveIso)
            .order('data_hora_entrada', { ascending: false })
            .limit(300);
        if (localPattern) qEntObs = qEntObs.ilike('local', localPattern);
        const { data: entObs = [] } = await qEntObs;

        let qSaiObs = supabase
            .from('controleacesso')
            .select('id, local, data_hora_saida, proprietarios(nome_completo), bicicletas(marca, modelo, numero_identificacao, tipo_bike), observacoes_saida')
            .gte('data_hora_saida', start)
            .lt('data_hora_saida', endExclusiveIso)
            .order('data_hora_saida', { ascending: false })
            .limit(300);
        if (localPattern) qSaiObs = qSaiObs.ilike('local', localPattern);
        const { data: saiObs = [] } = await qSaiObs;

        const ocorrencias = [];
        // Entrada: observacoes_entrada e observacao_geral
        for (const r of (entObs || [])) {
            const nome = r?.proprietarios?.nome_completo || null;
            const bike = r?.bicicletas || {};
            const descEnt = (r?.observacoes_entrada || '').toString().trim();
            const descGeral = (r?.observacao_geral || '').toString().trim();
            if (descEnt) {
                ocorrencias.push({
                    id: r.id,
                    tipo: 'entrada',
                    descricao: descEnt,
                    hora: r?.data_hora_entrada || null,
                    local: r?.local || null,
                    proprietario_nome: nome,
                    marca: bike?.marca || null,
                    modelo: bike?.modelo || null,
                    numero_identificacao: bike?.numero_identificacao || null,
                    tipo_bike: bike?.tipo_bike || null,
                });
            }
            if (descGeral) {
                ocorrencias.push({
                    id: r.id,
                    tipo: 'geral',
                    descricao: descGeral,
                    hora: r?.data_hora_entrada || null,
                    local: r?.local || null,
                    proprietario_nome: nome,
                    marca: bike?.marca || null,
                    modelo: bike?.modelo || null,
                    numero_identificacao: bike?.numero_identificacao || null,
                    tipo_bike: bike?.tipo_bike || null,
                });
            }
        }
        // Saída: observacoes_saida
        for (const r of (saiObs || [])) {
            const nome = r?.proprietarios?.nome_completo || null;
            const bike = r?.bicicletas || {};
            const descSai = (r?.observacoes_saida || '').toString().trim();
            if (descSai) {
                ocorrencias.push({
                    id: r.id,
                    tipo: 'saida',
                    descricao: descSai,
                    hora: r?.data_hora_saida || null,
                    local: r?.local || null,
                    proprietario_nome: nome,
                    marca: bike?.marca || null,
                    modelo: bike?.modelo || null,
                    numero_identificacao: bike?.numero_identificacao || null,
                    tipo_bike: bike?.tipo_bike || null,
                });
            }
        }
        // Ordena por hora desc e limita para vitrine
        ocorrencias.sort((a,b) => new Date(b.hora || 0) - new Date(a.hora || 0));
        const ocorrenciasHoje = ocorrencias.length;
        const ocorrenciasRecentes = ocorrencias.slice(0, 20);

        // Tipos das bicicletas atualmente estacionadas
        const tipoCounts = {};
        for (const b of bicicletasEstacionadas) {
            const t = (b?.tipo_bike || 'Desconhecido').toString();
            tipoCounts[t] = (tipoCounts[t] || 0) + 1;
        }
        const tiposBicicletaEstacionadas = Object.entries(tipoCounts).map(([tipo_bike, total]) => ({ tipo_bike, total }));

        // Fluxo por hora (dia local) — binning com base no tzOffsetMinutes
        const horas = Array.from({ length: 24 }, (_, i) => i);
        const fluxoEntr = Array(24).fill(0);
        const fluxoSai = Array(24).fill(0);
        const offsetMs = tzOffsetMinutes * 60000;
        const toLocalHour = (iso) => {
            if (!iso) return null;
            const t = new Date(iso).getTime();
            if (Number.isNaN(t)) return null;
            const localMs = t - offsetMs; // converte UTC -> hora local (local = UTC - offset)
            return new Date(localMs).getUTCHours();
        };
        for (const r of entList) {
            const h = toLocalHour(r.data_hora_entrada);
            if (h !== null) fluxoEntr[h]++;
        }
        for (const r of saiList) {
            const h = toLocalHour(r.data_hora_saida);
            if (h !== null) fluxoSai[h]++;
        }
        const fluxoPorHora = { horas, entradas: fluxoEntr, saidas: fluxoSai };

        // Distribuição simples de atividades no período
        const distribuicaoAtividades = { entrada: entradasHoje || 0, saida: saidasHoje || 0, ocorrencia: ocorrenciasHoje || 0 };

        // --- Debug opcional: análise exata de saídas (contagens e bordas) ---
        const debugMode = String(req.query.debug || '0') === '1';
        let debugInfo = undefined;
        if (debugMode) {
            // Contagem inclusiva no fim (legado) e exclusiva no fim (padrão)
            let qSaiIncl = supabase
                .from('controleacesso')
                .select('id', { count: 'exact', head: true })
                .gte('data_hora_saida', start)
                .lte('data_hora_saida', end);
            if (localPattern) qSaiIncl = qSaiIncl.ilike('local', localPattern);
            const { count: saidasIncl = 0 } = await qSaiIncl;

            let qSaiExcl = supabase
                .from('controleacesso')
                .select('id', { count: 'exact', head: true })
                .gte('data_hora_saida', start)
                .lt('data_hora_saida', endExclusiveIso);
            if (localPattern) qSaiExcl = qSaiExcl.ilike('local', localPattern);
            const { count: saidasExcl = 0 } = await qSaiExcl;

            // Quantos registros estão exatamente em 'end'
            let qEqEnd = supabase
                .from('controleacesso')
                .select('id', { count: 'exact', head: true })
                .eq('data_hora_saida', end);
            if (localPattern) qEqEnd = qEqEnd.ilike('local', localPattern);
            const { count: saidasEqEnd = 0 } = await qEqEnd;

            // Bordas: primeira e última saída do período exclusivo
            let qMin = supabase
                .from('controleacesso')
                .select('id, local, data_hora_saida')
                .gte('data_hora_saida', start)
                .lt('data_hora_saida', endExclusiveIso)
                .order('data_hora_saida', { ascending: true })
                .limit(1);
            if (localPattern) qMin = qMin.ilike('local', localPattern);
            const { data: minArr = [] } = await qMin;

            let qMax = supabase
                .from('controleacesso')
                .select('id, local, data_hora_saida')
                .gte('data_hora_saida', start)
                .lt('data_hora_saida', endExclusiveIso)
                .order('data_hora_saida', { ascending: false })
                .limit(1);
            if (localPattern) qMax = qMax.ilike('local', localPattern);
            const { data: maxArr = [] } = await qMax;

            // Registros próximos ao fim (últimos 5 minutos)
            const endMinus5minIso = new Date(new Date(end).getTime() - 5 * 60 * 1000).toISOString();
            let qNearEnd = supabase
                .from('controleacesso')
                .select('id, local, data_hora_saida')
                .gte('data_hora_saida', endMinus5minIso)
                .lte('data_hora_saida', end)
                .order('data_hora_saida', { ascending: false })
                .limit(10);
            if (localPattern) qNearEnd = qNearEnd.ilike('local', localPattern);
            const { data: nearEndArr = [] } = await qNearEnd;

            debugInfo = {
                bounds: { start, end, endExclusive: endExclusiveIso, compatMode },
                localFiltroAplicado: localPattern || null,
                saidas: {
                    atual: saidasHoje || 0,
                    inclusivo_end: saidasIncl || 0,
                    exclusivo_end: saidasExcl || 0,
                    iguais_ao_end: saidasEqEnd || 0,
                    min: minArr[0]?.data_hora_saida || null,
                    max: maxArr[0]?.data_hora_saida || null,
                    proximos_do_fim: nearEndArr || []
                }
            };
        }

        // Resposta
        const verbose = String(req.query.verbose || req.query.extras || '0') === '1';
        const baseResponse = {
            bicicletasEstacionadasAgora: estacionadasAgora || 0,
            entradasHoje: entradasHoje || 0,
            saidasHoje: saidasHoje || 0,
            ocorrenciasHoje: ocorrenciasHoje || 0,
            bicicletasEstacionadas,
            entradasHojeDetalhadas,
            saidasHojeDetalhadas,
            tiposBicicletaEstacionadas,
            fluxoPorHora,
            distribuicaoAtividades,
            atividadesRecentes,
        };
        if (verbose) {
            baseResponse.atividadesRecentes = atividadesRecentes;
            baseResponse.ocorrenciasRecentes = ocorrenciasRecentes;
            baseResponse.rankingProprietarios = rankingProprietarios;
            baseResponse.atividadesPaginacao = {
                page,
                pageSize,
                total: totalAtividades,
                totalPages: Math.max(1, Math.ceil(totalAtividades / pageSize))
            };
            baseResponse.periodo = { dias, inicio: start, fim: end };
        }
        res.json(baseResponse);
    } catch (err) {
        console.error('Erro em /api/dashboard/stats:', err);
        const payload = isProd
          ? { erro: 'Erro ao calcular estatísticas' }
          : { erro: 'Erro ao calcular estatísticas', detalhes: err?.message || String(err) };
        res.status(500).json(payload);
    }
});

// Cadastro de funcionário
app.post('/api/funcionarios/cadastro', async (req, res) => {
    const { nome_completo, nome_usuario, senha, email } = req.body;
    
    if (!nome_completo || !nome_usuario || !senha || !email) {
        return res.status(400).json({ erro: 'Dados obrigatórios não fornecidos' });
    }
    
    if (senha.length < 6) {
        return res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' });
    }

    try {
        // Salvar funcionário no banco, apenas localmente
        const senha_hash = await bcrypt.hash(senha, 10);
        const { data, error } = await supabase
            .from('funcionarios')
            .insert([{
                nome_completo,
                nome_usuario,
                senha_hash,
                email: email.toLowerCase()
            }])
            .select();
        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ erro: 'Usuário ou email já existe' });
            }
            throw error;
        }
        res.status(201).json({
            mensagem: 'Funcionário cadastrado com sucesso!', 
            id: data[0].id
        });
    } catch (err) {
        console.error('Erro ao cadastrar funcionário:', err);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { nome_usuario, senha } = req.body;
    
    if (!nome_usuario || !senha) {
        return res.status(400).json({ erro: 'Usuário e senha obrigatórios' });
    }
    
    try {
        const { data, error } = await supabase
            .from('funcionarios')
            .select('*')
            .eq('nome_usuario', nome_usuario)
            .single();
        
        if (error || !data) {
            return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
        }
        
        const senhaValida = await bcrypt.compare(senha, data.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
        }
        
        if (!data.ativo) {
            return res.status(403).json({ erro: 'Usuário inativo' });
        }
        
        const token = jwt.sign(
            { id: data.id, nome_usuario: data.nome_usuario }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );
        
        res.json({
            mensagem: 'Login bem-sucedido!',
            token,
            funcionario: { 
                id: data.id, 
                nome_completo: data.nome_completo 
            }
        });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ erro: 'Erro no servidor' });
    }
});

// Cadastro de proprietário e bicicleta
app.post('/api/cadastros', autenticarToken, upload, async (req, res) => {
    const { nome, email, cpf, contato, endereco, numero_bike, tipo_bike, marca, modelo, observacoes } = req.body;
    
    if (!nome || !cpf || !numero_bike) {
        return res.status(400).json({ erro: 'Nome, CPF e número da bicicleta são obrigatórios' });
    }
    
    try {
        // Upload das fotos
        let foto_proprietario_url = null;
        let foto_bicicleta_url = null;
        let foto_dono_com_bicicleta_url = null;
        
        if (req.files?.fotoProprietario) {
            foto_proprietario_url = await uploadToSupabase(req.files.fotoProprietario[0], 'proprietarios');
        }
        
        if (req.files?.fotoBicicleta) {
            foto_bicicleta_url = await uploadToSupabase(req.files.fotoBicicleta[0], 'bicicletas');
        }
        
        if (req.files?.fotoDonoComBicicleta) {
            foto_dono_com_bicicleta_url = await uploadToSupabase(req.files.fotoDonoComBicicleta[0], 'dono-com-bicicleta');
        }
        
        // Inserir proprietário
        const { data: proprietario, error: errorProp } = await supabase
            .from('proprietarios')
            .insert([{
                nome_completo: nome,
                email: email ? email.toLowerCase() : null,
                cpf,
                contato: contato || null,
                endereco: endereco || null,
                foto_proprietario_url
            }])
            .select()
            .single();
        
        if (errorProp) throw errorProp;
        
        // Inserir bicicleta
        const { error: errorBike } = await supabase
            .from('bicicletas')
            .insert([{
                proprietario_id: proprietario.id,
                numero_identificacao: numero_bike,
                tipo_bike: tipo_bike || null,
                marca: marca || null,
                modelo: modelo || null,
                observacoes_bike: observacoes || null,
                foto_bicicleta_url,
                foto_dono_com_bicicleta_url
            }]);
        
        if (errorBike) throw errorBike;
        
        res.status(201).json({ 
            mensagem: 'Cadastro realizado com sucesso!', 
            proprietarioId: proprietario.id 
        });
    } catch (err) {
        console.error('Erro no cadastro:', err);
        if (err.code === '23505') {
            return res.status(409).json({ erro: 'CPF ou número da bicicleta já cadastrado' });
        }
        res.status(500).json({ erro: 'Erro ao realizar cadastro' });
    }
});

// Buscar dados para controle de acesso
app.get('/api/controle-acesso/buscar', autenticarToken, async (req, res) => {
    const { termo } = req.query;
    
    if (!termo) {
        return res.status(400).json({ erro: 'Termo de pesquisa obrigatório' });
    }
    
    try {
        // Buscar proprietários (com ou sem bicicletas)
        const { data: proprietarios, error } = await supabase
            .from('proprietarios')
            .select(`
                id,
                nome_completo,
                cpf,
                email,
                contato,
                foto_proprietario_url,
                numero_lacre,
                bicicletas (
                    id,
                    numero_identificacao,
                    marca,
                    modelo,
                    tipo_bike
                )
            `)
            .or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%`)
            .order('nome_completo');
        
        if (error) throw error;
        
        // Transformar resultado
        const resultados = [];
        if (proprietarios && proprietarios.length > 0) {
            for (const proprietario of proprietarios) {
                if (proprietario.bicicletas && proprietario.bicicletas.length > 0) {
                    // Proprietário COM bicicletas
                    for (const bicicleta of proprietario.bicicletas) {
                        // Verificar status real da bicicleta
                        const { data: controleAtivo } = await supabase
                            .from('controleacesso')
                            .select('*')
                            .eq('bicicleta_id', bicicleta.id)
                            .is('data_hora_saida', null)
                            .order('data_hora_entrada', { ascending: false })
                            .limit(1);
                        
                        const statusReal = controleAtivo && controleAtivo.length > 0 ? 'DENTRO' : 'FORA';
                        const registroAtual = controleAtivo && controleAtivo.length > 0 ? controleAtivo[0] : null;
                        
                        resultados.push({
                            proprietario: {
                                id: proprietario.id,
                                nome_completo: proprietario.nome_completo,
                                cpf: proprietario.cpf,
                                email: proprietario.email,
                                contato: proprietario.contato,
                                foto_proprietario_url: proprietario.foto_proprietario_url,
                                numero_lacre: proprietario.numero_lacre
                            },
                            bicicleta: {
                                id: bicicleta.id,
                                numero_identificacao: bicicleta.numero_identificacao,
                                marca: bicicleta.marca,
                                modelo: bicicleta.modelo,
                                tipo_bike: bicicleta.tipo_bike
                            },
                            status: statusReal,
                            registro_entrada_atual: registroAtual
                        });
                    }
                } else {
                    // Proprietário SEM bicicletas
                    resultados.push({
                        proprietario: {
                            id: proprietario.id,
                            nome_completo: proprietario.nome_completo,
                            cpf: proprietario.cpf,
                            email: proprietario.email,
                            contato: proprietario.contato,
                            foto_proprietario_url: proprietario.foto_proprietario_url,
                            numero_lacre: proprietario.numero_lacre
                        },
                        bicicleta: {
                            id: null,
                            numero_identificacao: 'Sem bicicleta cadastrada',
                            marca: '-',
                            modelo: '-',
                            tipo_bike: '-'
                        },
                        status: 'SEM_BICICLETA',
                        registro_entrada_atual: null
                    });
                }
            }
        }
        
        res.json(resultados);
    } catch (err) {
        console.error('Erro na busca:', err);
        res.status(500).json({ erro: 'Erro ao buscar dados' });
    }
});

// Sugestões de proprietários (autocomplete leve)
app.get('/api/proprietarios/suggest', autenticarToken, async (req, res) => {
    try {
        const termo = String(req.query.termo || req.query.term || '').trim();
        if (!termo) return res.json([]);
        const { data, error } = await supabase
            .from('proprietarios')
            .select('id, nome_completo')
            .ilike('nome_completo', `%${termo}%`)
            .order('nome_completo')
            .limit(10);
        if (error) throw error;
        res.json(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error('Erro em /api/proprietarios/suggest:', err);
        res.status(500).json({ erro: 'Erro ao sugerir proprietários' });
    }
});

// Adicionar bicicleta a proprietário existente
app.post('/api/bicicletas', autenticarToken, upload, async (req, res) => {
    const { proprietario_id, numero_bike, tipo_bike, marca, modelo, observacoes } = req.body;
    if (!proprietario_id || !numero_bike || !marca || !modelo) {
        return res.status(400).json({ erro: 'Proprietário ID, número da bicicleta, marca e modelo são obrigatórios' });
    }
    try {
        // Verificar se proprietário existe
        const { data: proprietario, error: errorProp } = await supabaseAdmin
            .from('proprietarios')
            .select('id, nome_completo')
            .eq('id', proprietario_id)
            .single();
        if (errorProp || !proprietario) {
            return res.status(404).json({ erro: 'Proprietário não encontrado' });
        }
        // Limite de até 3 bicicletas
        const { data: bikesExistentes, error: errorCount } = await supabaseAdmin
            .from('bicicletas')
            .select('id')
            .eq('proprietario_id', proprietario_id);
        if (errorCount) throw errorCount;
        if ((bikesExistentes || []).length >= 3) {
            return res.status(400).json({ erro: 'Limite de 3 bicicletas atingido para este proprietário.' });
        }
        // Upload das fotos
        let foto_bicicleta_url = null;
        let foto_dono_com_bicicleta_url = null;
        if (req.files?.fotoBicicleta) {
            foto_bicicleta_url = await uploadToSupabase(req.files.fotoBicicleta[0], 'bicicletas');
        }
        if (req.files?.fotoDonoComBicicleta) {
            foto_dono_com_bicicleta_url = await uploadToSupabase(req.files.fotoDonoComBicicleta[0], 'dono-com-bicicleta');
        }
        const { data, error } = await supabaseAdmin
            .from('bicicletas')
            .insert([
                {
                    proprietario_id: parseInt(proprietario_id),
                    numero_identificacao: numero_bike,
                    tipo_bike: tipo_bike || null,
                    marca,
                    modelo,
                    observacoes_bike: observacoes || null,
                    foto_bicicleta_url,
                    foto_dono_com_bicicleta_url
                }
            ])
            .select()
            .single();
        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ erro: 'Número da bicicleta já existe' });
            }
            throw error;
        }
        res.status(201).json({ mensagem: `Bicicleta adicionada com sucesso para ${proprietario.nome_completo}!`, bicicleta: data });
    } catch (err) {
        console.error('Erro ao adicionar bicicleta:', err);
        res.status(500).json({ erro: 'Erro interno ao adicionar bicicleta' });
    }
});

// Check-in
app.post('/api/controle-acesso/checkin', autenticarToken, async (req, res, next) => {
    try {
        console.log('Requisição de check-in recebida:', {
            headers: req.headers,
            body: req.body
        });
        const { bicicleta_id, proprietario_id, local, observacoes_entrada, observacao_geral } = req.body;
        if (!bicicleta_id || !proprietario_id || !local) {
            return res.status(400).json({ erro: 'Dados incompletos para check-in' });
        }
        const { data, error } = await supabase
            .from('controleacesso')
            .insert([{
                bicicleta_id,
                proprietario_id,
                funcionario_entrada_id: req.user ? req.user.id : null,
                local,
                data_hora_entrada: new Date().toISOString(),
                observacoes_entrada: observacoes_entrada || null,
                observacao_geral: observacao_geral || null
            }])
            .select()
            .single();
        if (error) {
            console.error('Erro do Supabase ao inserir check-in:', error);
            // Se a coluna não existir, retornar dica de migração
            const msg = (error?.message || '').toLowerCase();
            if (error.code === '42703' || msg.includes('undefined column') || msg.includes('numero_lacre')) {
                return res.status(500).json({ erro: 'Coluna numero_lacre ausente no banco. Execute a migração para adicionar a coluna.', dica: 'ALTER TABLE controleacesso ADD COLUMN IF NOT EXISTS numero_lacre TEXT;' });
            }
            return res.status(500).json({ erro: 'Erro ao realizar check-in', detalhes: error.message, supabase: error });
        }
        res.json({
            mensagem: 'Check-in realizado com sucesso!',
            controleAcessoId: data.id 
        });
    } catch (err) {
        console.error('Erro inesperado no check-in:', err);
        next(err); // Passa para o middleware global de erro
    }
});

// Check-out
// Endpoint para atualizar o número do lacre de um proprietário
app.put('/api/proprietarios/:id/lacre', autenticarToken, async (req, res) => {
    const { id } = req.params;
    const { numero_lacre } = req.body;

    if (!numero_lacre) {
        return res.status(400).json({ erro: 'Número do lacre é obrigatório' });
    }

    try {
        const { data, error } = await db
            .collection('proprietarios')
            .doc(id)
            .update({ numero_lacre });

        if (error) {
            throw error;
        }

        res.json({ mensagem: 'Lacre atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar lacre:', err);
        res.status(500).json({ erro: 'Falha ao atualizar lacre' });
    }
});

app.post('/api/controle-acesso/checkout', autenticarToken, async (req, res, next) => {
    try {
        console.log('Requisição de check-out recebida:', {
            headers: req.headers,
            body: req.body
        });
        const { controle_acesso_id, observacoes_saida, observacao_geral } = req.body;
        if (!controle_acesso_id) {
            return res.status(400).json({ erro: 'ID do controle de acesso obrigatório' });
        }
        const { data, error } = await supabase
            .from('controleacesso')
            .update({
                data_hora_saida: new Date().toISOString(),
                funcionario_saida_id: req.user.id,
                observacoes_saida: observacoes_saida || null,
                observacao_geral: observacao_geral || null
            })
            .eq('id', controle_acesso_id)
            .is('data_hora_saida', null)
            .select();
        if (error) {
            console.error('Erro do Supabase ao realizar check-out:', error);
            return res.status(500).json({ erro: 'Erro ao realizar check-out', detalhes: error.message, supabase: error });
        }
        if (!data.length) {
            return res.status(404).json({ erro: 'Registro não encontrado ou já finalizado' });
        }
        res.json({ mensagem: 'Check-out realizado com sucesso!' });
    } catch (err) {
        console.error('Erro inesperado no check-out:', err);
        next(err); // Passa para o middleware global de erro
    }
});

// Obter proprietário por ID
app.get('/api/proprietarios/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('proprietarios')
            .select('id, nome_completo, cpf, email, contato, endereco, foto_proprietario_url')
            .eq('id', id)
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ erro: 'Proprietário não encontrado' });
        res.json(data);
    } catch (err) {
        console.error('Erro ao obter proprietário:', err);
        const payload = isProd
          ? { erro: 'Erro ao carregar proprietário' }
          : { erro: 'Erro ao carregar proprietário', detalhes: err?.message || String(err), stack: err.stack };
        res.status(500).json(payload);
    }
});

// Atualizar proprietário
app.put('/api/proprietarios/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { nome_completo, cpf, email, contato, endereco } = req.body;
  
  if (!nome_completo || !cpf) {
    return res.status(400).json({ erro: 'Nome e CPF são obrigatórios' });
  }
  
  try {
    const { data, error } = await supabase
      .from('proprietarios')
      .update({
        nome_completo,
        cpf,
        email: email || null,
        contato: contato || null,
        endereco: endereco || null
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ erro: 'CPF já existe para outro proprietário' });
      }
      throw error;
    }
    
    if (!data) {
      return res.status(404).json({ erro: 'Proprietário não encontrado' });
    }
    
    res.json({ 
        mensagem: 'Proprietário atualizado com sucesso!',
        proprietario: data
    });
  } catch (err) {
    console.error('Erro ao atualizar proprietário:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// Excluir proprietário (bloqueia se houver dependências)
app.delete('/api/proprietarios/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { data: bikes } = await supabase
            .from('bicicletas')
            .select('id')
            .eq('proprietario_id', id)
            .limit(1);
        if (bikes && bikes.length) {
            return res.status(409).json({ erro: 'Não é possível excluir: há bicicletas vinculadas a este proprietário.' });
        }
        const { data: acessos } = await supabase
            .from('controleacesso')
            .select('id')
            .eq('proprietario_id', id)
            .limit(1);
        if (acessos && acessos.length) {
            return res.status(409).json({ erro: 'Não é possível excluir: há registros de acesso vinculados.' });
        }
        const { error } = await supabaseAdmin
            .from('proprietarios')
            .delete()
            .eq('id', id);
        if (error) throw error;
        res.json({ mensagem: 'Proprietário excluído com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir proprietário:', err);
        res.status(500).json({ erro: 'Erro ao excluir proprietário' });
    }
});

// Atualizar foto do proprietário
app.put('/api/proprietarios/:id/foto', autenticarToken, upload, async (req, res) => {
    const { id } = req.params;
    
    if (!req.files?.fotoProprietario) {
        return res.status(400).json({ erro: 'Nenhuma foto enviada' });
    }
    
    try {
        const foto_proprietario_url = await uploadToSupabase(req.files.fotoProprietario[0], 'proprietarios');
        
        const { data, error } = await supabase
            .from('proprietarios')
            .update({ foto_proprietario_url })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        if (!data) {
            return res.status(404).json({ erro: 'Proprietário não encontrado' });
        }
        
        res.json({ 
            mensagem: 'Foto atualizada com sucesso!',
            foto_proprietario_url: data.foto_proprietario_url
        });
    } catch (err) {
        console.error('Erro ao atualizar foto:', err);
        res.status(500).json({ erro: 'Erro ao salvar foto' });
    }
});

// Atualizar foto extra do proprietário
app.put('/api/proprietarios/:id/foto-extra', autenticarToken, upload, async (req, res) => {
    const { id } = req.params;
    if (!req.files?.fotoProprietarioExtra) {
        return res.status(400).json({ erro: 'Nenhuma foto extra enviada' });
    }
    try {
        const foto_proprietario_extra_url = await uploadToSupabase(req.files.fotoProprietarioExtra[0], 'proprietarios');
        const { data, error } = await supabase
            .from('proprietarios')
            .update({ foto_proprietario_extra_url })
            .eq('id', id)
            .select()
            .single();
        if (error) {
            // Caso a coluna não exista ainda
            if (error.message && error.message.includes('column') ) {
                return res.status(500).json({ erro: 'Coluna foto_proprietario_extra_url inexistente. Crie a coluna no banco.', dica: 'ALTER TABLE proprietarios ADD COLUMN foto_proprietario_extra_url TEXT;' });
            }
            throw error;
        }
        if (!data) return res.status(404).json({ erro: 'Proprietário não encontrado' });
        res.json({ mensagem: 'Foto extra atualizada com sucesso!', foto_proprietario_extra_url: data.foto_proprietario_extra_url });
    } catch (err) {
        console.error('Erro ao atualizar foto extra:', err);
        res.status(500).json({ erro: 'Erro ao salvar foto extra' });
    }
});

// Rota para receber justificativas de inatividade (Supabase/PostgreSQL)
app.post('/api/funcionarios/justificativa-inatividade', autenticarToken, async (req, res) => {
    const { funcionario_id, nome_funcionario, justificativa, pagina, data_hora } = req.body;
    if (!funcionario_id || !nome_funcionario || !justificativa || !pagina || !data_hora) {
        return res.status(400).json({ erro: 'Dados obrigatórios não fornecidos.' });
    }
    try {
        const { error } = await supabase
            .from('justificativas_inatividade')
            .insert([{
                funcionario_id,
                nome_funcionario,
                justificativa,
                pagina,
                data_hora
            }]);
        if (error) throw error;
        res.status(201).json({ mensagem: 'Justificativa registrada com sucesso!' });
    } catch (err) {
        console.error('Erro ao salvar justificativa de inatividade:', err.message);
        res.status(500).json({ erro: 'Erro ao salvar justificativa.' });
    }
});

// --- Heartbeat de atividade do funcionário (ping) ---
app.post('/api/funcionarios/ping', autenticarToken, async (req, res) => {
  try {
    const uid = req.user?.id;
    if(!uid) return res.status(401).json({ erro: 'Token inválido' });
    // Usa client com service role para não ser bloqueado por RLS
    const { error } = await supabaseAdmin
      .from('funcionarios')
      .update({ last_ping: new Date().toISOString() })
      .eq('id', uid);
    if (error) {
      const msg = (error.message||'').toLowerCase();
      if (error.code === '42703' || msg.includes('last_ping')) {
        return res.status(501).json({ erro: 'Coluna last_ping ausente', dica: 'ALTER TABLE funcionarios ADD COLUMN last_ping TIMESTAMPTZ;' });
      }
      throw error;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em /api/funcionarios/ping:', err);
    res.status(500).json({ erro: 'Falha ao registrar ping' });
  }
});

// Admin - Monitoramento (com produtividade, inatividade, ranking e fluxo)
app.get('/api/admin/monitoramento', autenticarToken, async (req, res) => {
  try {
    // Buscar funcionários (tenta incluir last_ping; se não existir, ignora)
    let funcionariosRows = [];
    let gotLastPing = true;
    let respFunc = await supabase.from('funcionarios').select('id, nome_completo, ativo, last_ping').eq('ativo', true);
    if (respFunc.error) {
      const msg = (respFunc.error.message||'').toLowerCase();
      if (respFunc.error.code === '42703' || msg.includes('last_ping')) {
        gotLastPing = false;
        const fallback = await supabase.from('funcionarios').select('id, nome_completo, ativo').eq('ativo', true);
        if (fallback.error) throw fallback.error;
        funcionariosRows = (fallback.data||[]).map(f=>({...f, last_ping: null}));
      } else throw respFunc.error;
    } else {
      funcionariosRows = respFunc.data || [];
    }

    // Janela temporal: start inclusivo, end exclusivo (fallback últimos 7 dias)
    const now = new Date();
    const nowIso = now.toISOString();
    const startQ = (req.query.start || '').toString().trim();
    const endQ = (req.query.end || '').toString().trim();
    const startIso = startQ ? new Date(startQ).toISOString() : new Date(now.getTime() - 7*24*60*60*1000).toISOString();
    const endIso = endQ ? new Date(endQ).toISOString() : nowIso;

    const { data: justificativas } = await supabase
      .from('justificativas_inatividade')
      .select('*')
      .gte('data_hora', startIso)
      .lt('data_hora', endIso);

    const { data: acessos } = await supabase
      .from('controleacesso')
      .select('id, funcionario_entrada_id, funcionario_saida_id, data_hora_entrada, data_hora_saida')
      .or(`and(data_hora_entrada.gte.${startIso},data_hora_entrada.lt.${endIso}),and(data_hora_saida.gte.${startIso},data_hora_saida.lt.${endIso})`);

    const agora = Date.now();
    // Thresholds de atividade configuráveis via env (fallback 15/60 min)
    const ATIVO_PING_MIN = Math.max(1, parseInt(process.env.FUNC_ATIVO_PING_MIN || '15', 10));
    const ATIVO_MOV_MIN = Math.max(5, parseInt(process.env.FUNC_ATIVO_MOV_MIN || '60', 10));
    const hojeStr = new Date(agora).toISOString().slice(0,10);

    const funcionarios = funcionariosRows.map(f => {
      const acessosEntrada = acessos.filter(a => a.funcionario_entrada_id === f.id);
      const acessosSaida = acessos.filter(a => a.funcionario_saida_id === f.id);
      const dias = {};
      for (let i=0;i<7;i++){ const d=new Date(agora - i*24*60*60*1000); const ds=d.toISOString().slice(0,10); dias[ds]={ checkins:0, checkouts:0 }; }
      acessosEntrada.forEach(a=>{ if(a.data_hora_entrada){ const ds=a.data_hora_entrada.slice(0,10); if(dias[ds]) dias[ds].checkins++; }});
      acessosSaida.forEach(a=>{ if(a.data_hora_saida){ const ds=a.data_hora_saida.slice(0,10); if(dias[ds]) dias[ds].checkouts++; }});
      const ultCheckin = acessosEntrada.reduce((m,a)=>(!m||a.data_hora_entrada>m)?a.data_hora_entrada:m,null);
      const ultCheckout = acessosSaida.reduce((m,a)=>(!m||a.data_hora_saida>m)?a.data_hora_saida:m,null);
      const ultJust = justificativas.filter(j=>j.funcionario_id===f.id).reduce((m,j)=>(!m||j.data_hora>m)?j.data_hora:m,null);
      const lastPing = f.last_ping || null;
      // Última movimentação física: considerar somente checkin/checkout (não inclui ping)
      const candidatosMov = [
        { tipo:'checkin', data: ultCheckin },
        { tipo:'checkout', data: ultCheckout }
      ].filter(c=>!!c.data);
      let ultimaMov=null, tipoUltimaMov='';
      candidatosMov.forEach(c=>{ if(!ultimaMov || c.data>ultimaMov){ ultimaMov=c.data; tipoUltimaMov=c.tipo; } });
      let tempoParadoMin = null;
      let tempoParadoSec = null;
      if(ultimaMov){
        const diffMs = agora - new Date(ultimaMov).getTime();
        tempoParadoMin = Math.floor(diffMs/60000);
        tempoParadoSec = Math.floor(diffMs/1000);
      }
      // Status com base: 'ping' se somente ping recente, 'mov' se movimentação recente
      let status='Parado';
      let status_basis = 'none';
      const pingRecente = !!(lastPing && (agora - new Date(lastPing).getTime()) <= ATIVO_PING_MIN*60000);
      const movRecente = (tempoParadoMin !== null && tempoParadoMin <= ATIVO_MOV_MIN);
      if (pingRecente) { status='Ativo'; status_basis='ping'; }
      if (movRecente) { status='Ativo'; status_basis = status_basis==='ping' ? 'ambos' : 'mov'; }
      const totalMov = acessosEntrada.length + acessosSaida.length;
      const totalMovHoje = (dias[hojeStr]?.checkins||0) + (dias[hojeStr]?.checkouts||0);

      // Heurística preditiva simples para indicar provavel atividade
      let probAtivo = 0.05;
      const motivos = [];
      if (lastPing) {
        const diffPingMin = Math.floor((agora - new Date(lastPing).getTime())/60000);
        motivos.push(`último ping há ${diffPingMin} min`);
        if (diffPingMin <= ATIVO_PING_MIN) { probAtivo = 0.95; motivos.push('ping recente'); }
      } else {
        motivos.push('sem ping registrado');
      }
      if (tempoParadoMin !== null) {
        motivos.push(`última movimentação (${tipoUltimaMov}) há ${tempoParadoMin} min`);
        if (tempoParadoMin <= ATIVO_MOV_MIN && probAtivo < 0.8) { probAtivo = Math.max(probAtivo, 0.7); motivos.push('movimentação recente'); }
        else if (tempoParadoMin <= ATIVO_MOV_MIN*1.5 && probAtivo < 0.6) { probAtivo = Math.max(probAtivo,0.5); motivos.push('movimentação relativamente recente'); }
      } else {
        motivos.push('sem histórico de movimentação');
      }
      if (totalMovHoje > 0) { probAtivo = Math.max(probAtivo, 0.6); motivos.push(`movimentações hoje: ${totalMovHoje}`); }
      if (tipoUltimaMov === 'justificativa' && tempoParadoMin !== null && tempoParadoMin < 180) { probAtivo = Math.max(probAtivo,0.5); motivos.push('justificativa recente'); }
      let statusPreditivo = status;
      if (status === 'Parado' && probAtivo >= 0.7) statusPreditivo = 'Ativo (heurística)';

      return {
        id: f.id,
        nome: f.nome_completo,
        checkinsPorDia: dias,
        totalCheckins: acessosEntrada.length,
        totalCheckouts: acessosSaida.length,
        tempoParadoMin,
        tempoParadoSec,
        tipoUltimaMov,
        ultimaMov,
        last_ping: lastPing,
        status,
        status_basis,
        totalMovimentacoes: totalMov,
        totalMovHoje,
        prob_ativo: Number(probAtivo.toFixed(2)),
        status_preditivo: statusPreditivo,
        motivos_preditivos: motivos
      };
    });

    const ranking = [...funcionarios].sort((a,b)=> b.totalMovimentacoes - a.totalMovimentacoes);
    const fluxoPorDia={};
    for(let i=0;i<7;i++){ const d=new Date(agora - i*24*60*60*1000); const ds=d.toISOString().slice(0,10); fluxoPorDia[ds]=funcionarios.reduce((acc,f)=>{acc.checkins+=f.checkinsPorDia[ds]?.checkins||0; acc.checkouts+=f.checkinsPorDia[ds]?.checkouts||0; return acc},{checkins:0,checkouts:0}); }
    const fluxoPorFuncionarioPorDia={}; funcionarios.forEach(f=>{ fluxoPorFuncionarioPorDia[f.id]={}; Object.entries(f.checkinsPorDia).forEach(([ds,val])=> fluxoPorFuncionarioPorDia[f.id][ds]={...val}); });
    // Filtros opcionais por status (aplicados pós-cálculo)
    let outFuncionarios = funcionarios;
    const filterStatus = (req.query.status || '').toString().trim();
    if (filterStatus) {
      const statusNorm = filterStatus.toLowerCase();
      outFuncionarios = outFuncionarios.filter(f => (f.status||'').toLowerCase() === statusNorm);
    }

    res.json({ funcionarios: outFuncionarios, ranking, fluxoPorDia, fluxoPorFuncionarioPorDia, gotLastPing, thresholds: { ATIVO_PING_MIN, ATIVO_MOV_MIN }, server_now: nowIso, preditivo: true });
  } catch(err){
    console.error('Erro no monitoramento (ext):', err);
    res.status(500).json({ erro: 'Erro ao carregar monitoramento' });
  }
});

// Admin - Proprietários (com histórico detalhado de movimentação)
app.get('/api/admin/proprietarios', autenticarToken, async (req, res) => {
    const { termo } = req.query;
    try {
        // 1) Tentar via relacionamento (requer FK configurada no Supabase)
        let proprietarios = [];
        let usedFallback = false;
        try {
            let qJoin = supabaseAdmin
                .from('proprietarios')
                .select(`
                    id, nome_completo, email, cpf, contato, endereco, foto_proprietario_url, foto_proprietario_extra_url,
                    bicicletas ( id, proprietario_id, numero_identificacao, marca, modelo, tipo_bike, observacoes_bike, foto_bicicleta_url )
                `);
            if (termo) {
                qJoin = qJoin.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`);
            }
            let { data, error } = await qJoin.order('nome_completo');
            if (error) throw error;
            // Fallback especial para CPF sem/with pontuação: tenta padrão com % entre dígitos
            if ((!data || data.length === 0) && termo) {
                const digits = String(termo).replace(/\D+/g, '');
                if (digits.length >= 5) {
                    const pattern = `%${digits.split('').join('%')}%`;
                    let qCpf = supabaseAdmin
                        .from('proprietarios')
                        .select(`
                            id, nome_completo, email, cpf, contato, endereco, foto_proprietario_url, foto_proprietario_extra_url,
                            bicicletas ( id, proprietario_id, numero_identificacao, marca, modelo, tipo_bike, observacoes_bike, foto_bicicleta_url )
                        `)
                        .ilike('cpf', pattern)
                        .order('nome_completo');
                    const alt = await qCpf;
                    if (!alt.error && Array.isArray(alt.data)) data = alt.data;
                }
            }
            proprietarios = data || [];
        } catch (e) {
            // 2) Fallback sem join: busca proprietários e bicicletas em consultas separadas
            usedFallback = true;
            let propsBase = [];
            try {
                let qProps = supabaseAdmin
                    .from('proprietarios')
                    .select('id, nome_completo, email, cpf, contato, endereco, foto_proprietario_url, foto_proprietario_extra_url');
                if (termo) {
                    qProps = qProps.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`);
                }
                let { data: dataProps, error: errBase } = await qProps.order('nome_completo');
                if (errBase) throw errBase;
                // Fallback especial CPF com pattern entre dígitos se vazio
                if ((!dataProps || dataProps.length === 0) && termo) {
                    const digits = String(termo).replace(/\D+/g, '');
                    if (digits.length >= 5) {
                        const pattern = `%${digits.split('').join('%')}%`;
                        const alt = await supabaseAdmin
                            .from('proprietarios')
                            .select('id, nome_completo, email, cpf, contato, endereco, foto_proprietario_url, foto_proprietario_extra_url')
                            .ilike('cpf', pattern)
                            .order('nome_completo');
                        if (!alt.error && Array.isArray(alt.data)) dataProps = alt.data;
                    }
                }
                propsBase = dataProps || [];
            } catch (colErr) {
                // Coluna inexistente no ambiente local (ex.: foto_proprietario_extra_url)
                const msg = (colErr?.message || '').toLowerCase();
                if (colErr?.code === '42703' || msg.includes('column') || msg.includes('undefined column')) {
                    try {
                        let qPropsSafe = supabaseAdmin
                            .from('proprietarios')
                            .select('id, nome_completo, email, cpf, contato, endereco, foto_proprietario_url');
                        if (termo) {
                            qPropsSafe = qPropsSafe.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`);
                        }
                        let { data: dataPropsSafe, error: errSafe } = await qPropsSafe.order('nome_completo');
                        if (errSafe) throw errSafe;
                        // Fallback CPF pattern se vazio
                        if ((!dataPropsSafe || dataPropsSafe.length === 0) && termo) {
                            const digits = String(termo).replace(/\D+/g, '');
                            if (digits.length >= 5) {
                                const pattern = `%${digits.split('').join('%')}%`;
                                const alt2 = await supabaseAdmin
                                    .from('proprietarios')
                                    .select('id, nome_completo, email, cpf, contato, endereco, foto_proprietario_url')
                                    .ilike('cpf', pattern)
                                    .order('nome_completo');
                                if (!alt2.error && Array.isArray(alt2.data)) dataPropsSafe = alt2.data;
                            }
                        }
                        propsBase = dataPropsSafe || [];
                    } catch (colErr2) {
                        const msg2 = (colErr2?.message || '').toLowerCase();
                        if (colErr2?.code === '42703' || msg2.includes('column') || msg2.includes('undefined column')) {
                            try {
                                const { data: propsMin, error: errMin } = await supabaseAdmin
                                    .from('proprietarios')
                                    .select('id, nome_completo, email, cpf');
                                if (errMin) throw errMin;
                                // Filtro manual por termo quando mínimo
                                let list = propsMin || [];
                                if (termo) {
                                    const t = String(termo).toLowerCase();
                                    const digits = t.replace(/\D+/g, '');
                                    const patternDigits = digits ? new RegExp(digits.split('').join('.*')) : null;
                                    list = list.filter(p => {
                                        const nomeOk = (p.nome_completo||'').toLowerCase().includes(t);
                                        const cpfVal = String(p.cpf||'');
                                        const cpfDigits = cpfVal.replace(/\D+/g,'');
                                        const cpfOk = patternDigits ? patternDigits.test(cpfDigits) : cpfVal.toLowerCase().includes(t);
                                        const emailOk = (p.email||'').toLowerCase().includes(t);
                                        return nomeOk || cpfOk || emailOk;
                                    });
                                }
                                propsBase = list;
                            } catch (colErr3) {
                                const msg3 = (colErr3?.message || '').toLowerCase();
                                if (colErr3?.code === '42703' || msg3.includes('column') || msg3.includes('undefined column')) {
                                    // Extremamente mínima: id + nome (sem filtros avançados)
                                    let qPropsVeryMin = supabaseAdmin
                                        .from('proprietarios')
                                        .select('id, nome_completo');
                                    if (termo) {
                                        qPropsVeryMin = qPropsVeryMin.or(`nome_completo.ilike.%${termo}%`);
                                    }
                                    const { data: dataPropsVeryMin, error: errVeryMin } = await qPropsVeryMin.order('nome_completo');
                                    if (errVeryMin) throw errVeryMin;
                                    propsBase = dataPropsVeryMin || [];
                                } else {
                                    throw colErr3;
                                }
                            }
                        } else {
                            throw colErr2;
                        }
                    }
                } else {
                    throw colErr;
                }
            }
            proprietarios = propsBase;
            const ids = proprietarios.map(p => p.id);
            let bikesByProp = {};
            if (ids.length > 0) {
                let bikes = [];
                const bikeSelectVariants = [
                    'id, proprietario_id, numero_identificacao, marca, modelo, tipo_bike, observacoes_bike, foto_bicicleta_url',
                    'id, proprietario_id, numero_identificacao, marca, modelo',
                    'id, proprietario_id, numero_identificacao',
                    'id, proprietario_id'
                ];
                for (const cols of bikeSelectVariants) {
                    try {
                        const { data, error } = await supabaseAdmin
                            .from('bicicletas')
                            .select(cols)
                            .in('proprietario_id', ids);
                        if (error) throw error;
                        bikes = data || [];
                        break; // sucesso: sai do loop
                    } catch (errSel) {
                        const msg = (errSel?.message || '').toLowerCase();
                        if (errSel?.code === '42703' || msg.includes('undefined column') || msg.includes('column')) {
                            // tenta próxima variante menor
                            continue;
                        } else {
                            // erro diferente: propaga
                            throw errSel;
                        }
                    }
                }
                for (const b of bikes) {
                    const pid = b.proprietario_id;
                    if (!bikesByProp[pid]) bikesByProp[pid] = [];
                    const { proprietario_id, ...rest } = b;
                    bikesByProp[pid].push(rest);
                }
            }
            proprietarios = proprietarios.map(p => ({ ...p, bicicletas: bikesByProp[p.id] || [] }));
        }

        // IMPORTANTE: Para performance, não montar histórico completo aqui.
        // Apenas mapear dados básicos; o histórico completo será servido em endpoint dedicado.
        const proprietariosDetalhados = (proprietarios || []).map(p => ({
            id: p.id,
            nome: p.nome_completo,
            email: p.email || null,
            cpf: p.cpf || null,
            contato: p.contato || null,
            endereco: p.endereco || null,
            foto_proprietario_url: p.foto_proprietario_url || null,
            foto_proprietario_extra_url: p.foto_proprietario_extra_url || null,
            fotoUrl: p.foto_proprietario_url || null,
            bicicletas: Array.isArray(p.bicicletas) ? p.bicicletas.map(b => ({
                id: b.id,
                numero_identificacao: b.numero_identificacao || null,
                marca: b.marca || null,
                modelo: b.modelo || null,
                tipo_bike: b.tipo_bike || null,
                observacoes_bike: b.observacoes_bike || null,
                foto_bicicleta_url: b.foto_bicicleta_url || null
            })) : []
            // Campos de checkin/checkout serão resolvidos sob demanda no histórico específico
        }));

        res.json(proprietariosDetalhados);
    } catch (err) {
        console.error('Erro ao buscar proprietários:', err);
        const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
        const payload = isProd
          ? { erro: 'Erro ao carregar proprietários' }
          : { erro: 'Erro ao carregar proprietários', detalhes: pretty(err), code: err?.code, hint: err?.hint };
        res.status(500).json(payload);
    }
});

// Histórico completo do proprietário (paginado)
app.get('/api/admin/proprietarios/:id/historico', autenticarToken, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });
    const termoNumero = (req.query.numero || '').toString().trim();
    const sortDesc = String(req.query.sortDesc || req.query.desc || '1') === '1';
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt(req.query.pageSize || '500', 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
        // Buscar dados básicos do proprietário (inclui CPF)
        let proprietarioNome = null;
        let proprietarioCpf = null;
        try {
            const { data: propRow } = await supabaseAdmin
                .from('proprietarios')
                .select('id, nome_completo, cpf')
                .eq('id', id)
                .single();
            proprietarioNome = propRow?.nome_completo || null;
            proprietarioCpf = propRow?.cpf || null;
        } catch(_) { proprietarioNome = null; proprietarioCpf = null; }

        // Buscar bicicletas do proprietário (com filtro opcional por número)
        let bikeQuery = supabaseAdmin
            .from('bicicletas')
            .select('id, numero_identificacao, marca, modelo, tipo_bike')
            .eq('proprietario_id', id);
        if (termoNumero) bikeQuery = bikeQuery.ilike('numero_identificacao', `%${termoNumero}%`);
        const { data: bikes = [] } = await bikeQuery;
        const bikeIds = bikes.map(b => b.id);
        const bikeMap = Object.fromEntries((bikes || []).map(b => [b.id, b]));

        // Base da consulta de histórico (primeira tentativa com todos campos + relações embutidas para nomes dos funcionários)
        let baseHist = supabaseAdmin
            .from('controleacesso')
            .select(`
                id, bicicleta_id, local, data_hora_entrada, data_hora_saida, funcionario_entrada_id, funcionario_saida_id, observacoes_entrada, observacoes_saida, observacao_geral,
                func_entrada:funcionario_entrada_id ( id, nome_completo ),
                func_saida:funcionario_saida_id ( id, nome_completo )
            `, { count: 'exact' })
            .eq('proprietario_id', id);
        if (bikeIds.length && termoNumero) {
            baseHist = baseHist.in('bicicleta_id', bikeIds);
        }
        baseHist = baseHist.order('data_hora_entrada', { ascending: !sortDesc }).range(from, to);

        let rows = [];
        let total = 0;
        try {
            const { data, error, count } = await baseHist;
            if (error) throw error;
            rows = data || [];
            total = count || rows.length;
        } catch (errA) {
            const msg = (errA?.message || '').toLowerCase();
            if (errA?.code === '42703' || msg.includes('undefined column') || msg.includes('column')) {
                // Tentativa 2: remover dependência de proprietario_id e filtrar por bicicleta_id do proprietário
                try {
                    if (!bikeIds || bikeIds.length === 0) {
                        rows = [];
                        total = 0;
                    } else {
                        let base2 = supabaseAdmin
                            .from('controleacesso')
                            .select('id, bicicleta_id, local, data_hora_entrada, data_hora_saida, funcionario_entrada_id, funcionario_saida_id', { count: 'exact' })
                            .in('bicicleta_id', bikeIds);
                        base2 = base2.order('data_hora_entrada', { ascending: !sortDesc }).range(from, to);
                        const { data: d2, error: e2, count: c2 } = await base2;
                        if (e2) throw e2;
                        rows = d2 || [];
                        total = c2 || rows.length;
                    }
                } catch (errB) {
                    const msgB = (errB?.message || '').toLowerCase();
                    if (errB?.code === '42703' || msgB.includes('undefined column') || msgB.includes('column')) {
                        // Tentativa 3: fallback mínimo (sem colunas de funcionário), ainda filtrando por bicicleta_id
                        if (!bikeIds || bikeIds.length === 0) {
                            rows = [];
                            total = 0;
                        } else {
                            let baseMin = supabaseAdmin
                                .from('controleacesso')
                                .select('id, bicicleta_id, local, data_hora_entrada, data_hora_saida', { count: 'exact' })
                                .in('bicicleta_id', bikeIds)
                                .order('data_hora_entrada', { ascending: !sortDesc })
                                .range(from, to);
                            const { data: dMin, error: eMin, count: cMin } = await baseMin;
                            if (eMin) throw eMin;
                            rows = dMin || [];
                            total = cMin || rows.length;
                        }
                    } else {
                        throw errB;
                    }
                }
            } else {
                throw errA;
            }
        }

        // Enriquecer com nomes dos funcionários (preferir relações embutidas, depois map por ID)
        const funcEntIds = Array.from(new Set(rows.map(r => r.funcionario_entrada_id).filter(Boolean)));
        const funcSaiIds = Array.from(new Set(rows.map(r => r.funcionario_saida_id).filter(Boolean)));
        const funcIds = Array.from(new Set([...funcEntIds, ...funcSaiIds]));
        let funcMap = {};
        if (funcIds.length) {
            try {
                const { data: funcs } = await supabaseAdmin
                    .from('funcionarios')
                    .select('id, nome_completo')
                    .in('id', funcIds);
                funcMap = Object.fromEntries((funcs || []).map(f => [f.id, f.nome_completo]));
            } catch(_) { funcMap = {}; }
        }

        const itens = rows.map(r => {
            const b = bikeMap[r.bicicleta_id] || null;
            const nomeFuncE = (r?.func_entrada?.nome_completo) || (r.funcionario_entrada_id ? (funcMap[r.funcionario_entrada_id] || null) : null);
            const nomeFuncS = (r?.func_saida?.nome_completo) || (r.funcionario_saida_id ? (funcMap[r.funcionario_saida_id] || null) : null);
            return {
                id: r.id,
                data_hora_entrada: r.data_hora_entrada || null,
                data_hora_saida: r.data_hora_saida || null,
                local: r.local || null,
                observacoes_entrada: r.observacoes_entrada || null,
                observacoes_saida: r.observacoes_saida || null,
                observacao_geral: r.observacao_geral || null,
                funcionario_entrada: nomeFuncE || null,
                funcionario_saida: nomeFuncS || null,
                bicicleta: b ? {
                    id: b.id,
                    numero_identificacao: b.numero_identificacao || null,
                    marca: b.marca || null,
                    modelo: b.modelo || null,
                    tipo_bike: b.tipo_bike || null
                } : null
            };
        });

        res.json({
            proprietario: { id, nome: proprietarioNome, cpf: proprietarioCpf },
            total,
            page,
            pageSize,
            sortDesc,
            filtroNumero: termoNumero || null,
            itens
        });
    } catch (err) {
        console.error('Erro ao buscar histórico do proprietário:', err);
        const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
        const payload = isProd
          ? { erro: 'Erro ao carregar histórico' }
          : { erro: 'Erro ao carregar histórico', detalhes: pretty(err), code: err?.code, hint: err?.hint };
        res.status(500).json(payload);
    }
});

// Resumo otimizado de check-in/check-out por proprietário (últimos registros)
// Uso: GET /api/admin/proprietarios/resumo?ids=1,2,3
app.get('/api/admin/proprietarios/resumo', autenticarToken, async (req, res) => {
  try {
    const idsStr = String(req.query.ids || '').trim();
    if (!idsStr) return res.json({ itens: [] });
    const ids = Array.from(new Set(idsStr.split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n))));
    if (!ids.length) return res.json({ itens: [] });

    const chunk = (arr, size) => { const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; };
    const IDS_CHUNK = 150;

    let rowsIn = [];
    let rowsOut = [];
    // Primeira estratégia: por proprietario_id (ambiente com coluna disponível)
    try {
      for (const part of chunk(ids, IDS_CHUNK)) {
        let qIn = supabaseAdmin
          .from('controleacesso')
          .select('id, proprietario_id, local, data_hora_entrada, funcionario_entrada_id')
          .in('proprietario_id', part)
          .order('data_hora_entrada', { ascending: false })
          .limit(part.length * 3);
        const rIn = await qIn; if (rIn.error) throw rIn.error; rowsIn.push(...(rIn.data||[]));

        let qOut = supabaseAdmin
          .from('controleacesso')
          .select('id, proprietario_id, local, data_hora_saida, funcionario_saida_id')
          .in('proprietario_id', part)
          .not('data_hora_saida', 'is', null)
          .order('data_hora_saida', { ascending: false })
          .limit(part.length * 3);
        const rOut = await qOut; if (rOut.error) throw rOut.error; rowsOut.push(...(rOut.data||[]));
      }
    } catch (errA) {
      const msg = (errA?.message || '').toLowerCase();
      if (errA?.code === '42703' || msg.includes('undefined column') || msg.includes('column')) {
        // Fallback: não há proprietario_id em controleacesso; resolver via bicicleta_id
        let bikeToOwner = {};
        let allBikeIds = [];
        for (const part of chunk(ids, IDS_CHUNK)) {
          const rB = await supabaseAdmin
            .from('bicicletas')
            .select('id, proprietario_id')
            .in('proprietario_id', part);
          if (rB.error) throw rB.error;
          (rB.data||[]).forEach(b=>{ bikeToOwner[b.id]=b.proprietario_id; allBikeIds.push(b.id); });
        }
        allBikeIds = Array.from(new Set(allBikeIds.filter(n=>Number.isFinite(n))));
        if (allBikeIds.length) {
          for (const bpart of chunk(allBikeIds, 500)) {
            const rIn = await supabaseAdmin
              .from('controleacesso')
              .select('id, bicicleta_id, local, data_hora_entrada, funcionario_entrada_id')
              .in('bicicleta_id', bpart)
              .order('data_hora_entrada', { ascending: false });
            if (rIn.error) throw rIn.error;
            rowsIn.push(...(rIn.data||[]).map(r=> ({ ...r, proprietario_id: bikeToOwner[r.bicicleta_id] })));

            const rOut = await supabaseAdmin
              .from('controleacesso')
              .select('id, bicicleta_id, local, data_hora_saida, funcionario_saida_id')
              .in('bicicleta_id', bpart)
              .not('data_hora_saida', 'is', null)
              .order('data_hora_saida', { ascending: false });
            if (rOut.error) throw rOut.error;
            rowsOut.push(...(rOut.data||[]).map(r=> ({ ...r, proprietario_id: bikeToOwner[r.bicicleta_id] })));
          }
        }
      } else {
        throw errA;
      }
    }

    // Mapear funcionário ids
    const funcIds = Array.from(new Set([
      ...rowsIn.map(r => r.funcionario_entrada_id).filter(Boolean),
      ...rowsOut.map(r => r.funcionario_saida_id).filter(Boolean)
    ]));
    let funcMap = {};
    if (funcIds.length) {
      try {
        const { data: funcs } = await supabaseAdmin
          .from('funcionarios')
          .select('id, nome_completo')
          .in('id', funcIds);
        funcMap = Object.fromEntries((funcs || []).map(f => [f.id, f.nome_completo]));
      } catch(_) { funcMap = {}; }
    }

    // Pegar o primeiro registro por proprietário (já que estão ordenados desc)
    const lastInByProp = {};
    for (const r of rowsIn) {
      const pid = r.proprietario_id;
      if (!pid) continue;
      if (!lastInByProp[pid]) lastInByProp[pid] = r;
    }
    const lastOutByProp = {};
    for (const r of rowsOut) {
      const pid = r.proprietario_id;
      if (!pid) continue;
      if (!lastOutByProp[pid]) lastOutByProp[pid] = r;
    }

    const itens = ids.map(pid => {
      const cin = lastInByProp[pid] || null;
      const cout = lastOutByProp[pid] || null;
      return {
        proprietario_id: pid,
        checkin: cin ? {
          id: cin.id,
          dataHora: cin.data_hora_entrada || null,
          operador: cin.funcionario_entrada_id ? (funcMap[cin.funcionario_entrada_id] || null) : null,
          funcionario_id: cin.funcionario_entrada_id || null,
          local: cin.local || null,
          numero_lacre: cin.numero_lacre || null
        } : null,
        checkout: cout ? {
          id: cout.id,
          dataHora: cout.data_hora_saida || null,
          operador: cout.funcionario_saida_id ? (funcMap[cout.funcionario_saida_id] || null) : null,
          funcionario_id: cout.funcionario_saida_id || null,
          local: cout.local || null
        } : null
      };
    });

    res.json({ itens });
  } catch (err) {
    console.error('Erro em /api/admin/proprietarios/resumo:', err);
    const payload = isProd
      ? { erro: 'Erro ao carregar resumo' }
      : { erro: 'Erro ao carregar resumo', detalhes: err?.message || String(err) };
    res.status(500).json(payload);
  }
});
// --- ENDPOINTS ---

// Middleware para autenticar token Supabase e configurar o client
function autenticarSupabaseToken(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        req.supabaseToken = token;
    } else {
        req.supabaseToken = null;
    }
    next();
}

// Use este middleware nas rotas que acessam o Supabase
app.use('/api', autenticarSupabaseToken);

// Rota raiz
app.get('/', (req, res) => {
    res.json({ 
        mensagem: 'API Bicicletário Municipal funcionando!',
        versao: '2.0',
        timestamp: new Date().toISOString()
    });
});

// Health check para Render
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Iniciar servidor

// Série para gráficos do Assistente  contagem por dia (últimos N dias) e por severidade
// Params:
//   - dias: janela em dias (padrão 14)
//   - limiar_dias: limiar de inatividade para considerar alerta (padrão 3)
//   - local_ilike: filtro opcional de local (case-insensitive)
//   - tzOffsetMinutes: deslocamento do fuso do cliente em minutos (UTC = local - offset)

// Utilitário: risco heurístico (0-1) para estourar 72h, baseado em tempo decorrido e contexto
function computeHeuristicRisk(entryIso, nowMs, tzOffsetMinutes, severidade, minutesElapsed){
  try{
    const t = Date.parse(entryIso);
    if (!Number.isFinite(t)) return 0.15;
    const localMs = t - (Number.isFinite(tzOffsetMinutes)? tzOffsetMinutes : 0) * 60000;
    const d = new Date(localMs);
    const dow = d.getUTCDay(); // 0=Dom, 5=Sex
    const hour = d.getUTCHours();
    const elapsedH = (Number.isFinite(minutesElapsed)? minutesElapsed : Math.max(0, (nowMs - t)/60000)) / 60;
    const x = (elapsedH - 36) / 12; // centrado em 36h, inclinação 12h
    let p = 1 / (1 + Math.exp(-x));
    if (dow === 5) p += 0.07;           // sexta
    if (dow === 6 || dow === 0) p += 0.05; // fim de semana
    if (hour >= 18) p += 0.05;          // fim de tarde/noite
    else if (hour <= 8) p -= 0.02;      // início da manhã
    if (severidade === 'alta') p += 0.10; else if (severidade === 'media') p += 0.05;
    if (!Number.isFinite(p)) p = 0.5;
    if (p < 0.01) p = 0.01; if (p > 0.99) p = 0.99;
    return p;
  } catch { return 0.15; }
}

let _riskModelCache = { mtimeMs: 0, model: null };
function loadRiskModelSync(){
  try{
    const modelPath = path.join(process.cwd(), 'models', 'risk-weights.json');
    const stat = fs.existsSync(modelPath) ? fs.statSync(modelPath) : null;
    if (!stat) return null;
    if (_riskModelCache.model && _riskModelCache.mtimeMs === stat.mtimeMs) return _riskModelCache.model;
    const raw = fs.readFileSync(modelPath, 'utf8');
    const model = JSON.parse(raw);
    if (!Array.isArray(model.weights) || !Array.isArray(model.locals_vocab)) return null;
    _riskModelCache = { mtimeMs: stat.mtimeMs, model };
    return model;
  } catch { return null; }
}
function _sigmoid(z){ return 1/(1+Math.exp(-z)); }
function _buildFeatures(entryIso, local, tzOffsetMinutes, localsVocab){
  try{
    const t = Date.parse(entryIso);
    if (!Number.isFinite(t)) return null;
    const localMs = t - (Number.isFinite(tzOffsetMinutes)? tzOffsetMinutes : 0) * 60000;
    const d = new Date(localMs);
    const hour = d.getUTCHours();
    const dow = d.getUTCDay();
    const sinH = Math.sin(2*Math.PI*hour/24);
    const cosH = Math.cos(2*Math.PI*hour/24);
    const sinD = Math.sin(2*Math.PI*dow/7);
    const cosD = Math.cos(2*Math.PI*dow/7);
    const K = (localsVocab||[]).length;
    const feats = [1, sinH, cosH, sinD, cosD];
    const idx = (localsVocab||[]).indexOf((local||'-').toString());
    for (let i=0;i<K+1;i++) feats.push(0);
    const bucket = (idx === -1) ? K : idx; // last = other
    feats[5 + bucket] = 1;
    return feats;
  } catch { return null; }
}
function computeMLRisk(entryIso, local, tzOffsetMinutes){
  const m = loadRiskModelSync();
  if (!m) return null;
  const x = _buildFeatures(entryIso, local, tzOffsetMinutes, Array.isArray(m.locals_vocab)? m.locals_vocab : []);
  if (!x) return null;
  const w = Array.isArray(m.weights) ? m.weights : [];
  if (w.length !== x.length) return null;
  let z = 0; for (let i=0;i<w.length;i++) z += w[i] * x[i];
  const p = _sigmoid(z);
  if (!Number.isFinite(p)) return null;
  return Math.max(0.01, Math.min(0.99, p));
}

// LISTAGEM PRINCIPAL DE ALERTAS (usada pelo frontend em /admin/alertas)
app.get('/api/admin/alertas', autenticarToken, async (req, res) => {
  try {
    const diasMin = Math.max(1, parseInt(req.query.dias || '3', 10)); // limiar mínimo para ser considerado alerta
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit || '200', 10)));
    const localPattern = (req.query.local_ilike && String(req.query.local_ilike).trim())
      ? `%${String(req.query.local_ilike).trim()}%`
      : null;
    const includeRes = String(req.query.include_resolvidos || '0') === '1';
    const tzOffsetMinutes = parseInt(req.query.tzOffsetMinutes || '0', 10);
    const wantRisk = String(req.query.risk || '0') === '1' || String(req.query.order || '') === 'risk';
    const orderBy = (req.query.order || '').toString(); // '', 'risk'
    const riskType = (req.query.riskType || '').toString(); // 'ml' | 'heuristic' | ''
    const now = new Date();
    const nowMs = now.getTime();
    const diaMs = 24 * 60 * 60 * 1000;

    // Seleção com joins; se falhar por coluna ausente, faz fallback sem joins ricos
    let rows = [];
    let triedFallback = false;
    try {
      let q = supabaseAdmin
        .from('controleacesso')
        .select(`
          id, local, data_hora_entrada, data_hora_saida, proprietario_id, bicicleta_id, funcionario_entrada_id,
          proprietarios ( id, nome_completo, contato, email ),
          bicicletas ( id, numero_identificacao, marca, modelo, tipo_bike )
        `)
        .is('data_hora_saida', null)
        .order('data_hora_entrada', { ascending: true });
      if (localPattern) q = q.ilike('local', localPattern);
      if (!includeRes) q = q.or('alerta_resolvido.is.null,alerta_resolvido.eq.false');
      const { data, error } = await q.limit(limit * 3); // pega mais para filtrar depois
      if (error) throw error;
      rows = data || [];
    } catch (errJoin) {
      const msg = (errJoin?.message || '').toLowerCase();
      if (errJoin?.code === '42703' || msg.includes('column') || msg.includes('undefined column')) {
        triedFallback = true;
        // Fallback: sem campos aninhados; buscaremos depois proprietarios / bicicletas em lote
        let q = supabaseAdmin
          .from('controleacesso')
          .select('id, local, data_hora_entrada, proprietario_id, bicicleta_id, funcionario_entrada_id')
          .is('data_hora_saida', null)
          .order('data_hora_entrada', { ascending: true });
        if (localPattern) q = q.ilike('local', localPattern);
        if (!includeRes) q = q.or('alerta_resolvido.is.null,alerta_resolvido.eq.false');
        const { data: base, error: errBase } = await q.limit(limit * 3);
        if (errBase) throw errBase;
        rows = base || [];
        // Enriquecer manualmente
        const propIds = Array.from(new Set(rows.map(r => r.proprietario_id).filter(Boolean)));
        const bikeIds = Array.from(new Set(rows.map(r => r.bicicleta_id).filter(Boolean)));
        let propMap = {}; let bikeMap = {};
        if (propIds.length) {
          const { data: props } = await supabaseAdmin.from('proprietarios').select('id, nome_completo, contato, email').in('id', propIds);
          propMap = Object.fromEntries((props||[]).map(p=>[p.id,p]));
        }
        if (bikeIds.length) {
          const { data: bikes } = await supabaseAdmin.from('bicicletas').select('id, numero_identificacao, marca, modelo, tipo_bike').in('id', bikeIds);
          bikeMap = Object.fromEntries((bikes||[]).map(b=>[b.id,b]));
        }
        rows = rows.map(r => ({
          ...r,
          proprietarios: propMap[r.proprietario_id] ? { ...propMap[r.proprietario_id] } : null,
          bicicletas: bikeMap[r.bicicleta_id] ? { ...bikeMap[r.bicicleta_id] } : null
        }));
      } else {
        throw errJoin;
      }
    }

    // Enriquecer com nome do funcionário que registrou a entrada (responsável pelo checkout)
    let funcMap = {};
    try {
      const funcIds = Array.from(new Set((rows || []).map(r => r.funcionario_entrada_id).filter(Boolean)));
      if (funcIds.length) {
        const { data: funcs } = await supabaseAdmin
          .from('funcionarios')
          .select('id, nome_completo')
          .in('id', funcIds);
        funcMap = Object.fromEntries((funcs || []).map(f => [f.id, f.nome_completo]));
      }
    } catch (_) { funcMap = {}; }


    // Filtrar por limiar de dias e calcular métricas
    const alertas = [];
    for (const r of rows) {
      if (!r?.data_hora_entrada) continue;
      const tEntrada = new Date(r.data_hora_entrada).getTime();
      if (Number.isNaN(tEntrada)) continue;
      const diffMs = nowMs - tEntrada;
      if (diffMs < 0) continue; // ignora futuros
      const diffDias = Math.floor(diffMs / diaMs);
      if (diffDias < diasMin) continue; // ainda não virou alerta segundo filtro do usuário
      const diffHoras = Math.floor(diffMs / (60*60*1000));
      const diffMin = Math.floor(diffMs / (60*1000));
      // Severidade backend (agora configurável via variáveis de ambiente)
      let severidade = 'baixa';
      if (diffDias >= ALERT_HI_DAYS) severidade = 'alta';
      else if (diffDias >= ALERT_MED_DAYS) severidade = 'media';

      // Dados enriquecidos
      const prop = r.proprietarios || {};
      const bike = r.bicicletas || {};
      const item = {
        id: r.id,
        controle_id: r.id,
        proprietario_id: r.proprietario_id || prop.id || null,
        bicicleta_id: r.bicicleta_id || bike.id || null,
        proprietario_nome: prop.nome_completo || null,
        proprietario_contato: prop.contato || null,
        proprietario_email: prop.email || null,
        numero_identificacao: bike.numero_identificacao || null,
        marca: bike.marca || null,
        modelo: bike.modelo || null,
        tipo_bike: bike.tipo_bike || null,
        local: r.local || null,
        funcionario_entrada_nome: (r.funcionario_entrada_id && funcMap[r.funcionario_entrada_id]) ? funcMap[r.funcionario_entrada_id] : null,
        data_hora_entrada: r.data_hora_entrada,
        dias_inatividade: diffDias,
        horas_inatividade: diffHoras,
        minutos_inatividade: diffMin,
        severidade,
        origem_fallback: triedFallback || undefined
      };
      if (wantRisk) {
        const useML = (riskType === 'ml') || (riskType === '' && !!loadRiskModelSync());
        let rs = null;
        if (useML) {
          rs = computeMLRisk(r.data_hora_entrada, r.local || null, tzOffsetMinutes);
          if (rs === null) rs = computeHeuristicRisk(r.data_hora_entrada, nowMs, tzOffsetMinutes, severidade, diffMin);
        } else {
          rs = computeHeuristicRisk(r.data_hora_entrada, nowMs, tzOffsetMinutes, severidade, diffMin);
        }
        item.risk_score = rs;
        item.risk_percent = Math.round(rs * 100);
      }
      alertas.push(item);
      if (alertas.length >= limit) break; // respeita limite após filtrar
    }

    // Ordenação
    if (orderBy === 'risk' && wantRisk) {
      alertas.sort((a,b)=> (b.risk_score||0) - (a.risk_score||0));
    } else {
      // severidade (alta > media > baixa) e depois por maior inatividade
      alertas.sort((a,b)=>{
        const sevRank = s => (s==='alta'?3:(s==='media'?2:1));
        const d = sevRank(b.severidade) - sevRank(a.severidade);
        if (d) return d;
        return (b.minutos_inatividade||0) - (a.minutos_inatividade||0);
      });
    }

    res.json({
      cutoff_iso: now.toISOString(),
      total: alertas.length,
      dias_min: diasMin,
      thresholds: { med_days: ALERT_MED_DAYS, hi_days: ALERT_HI_DAYS },
      alertas
    });
  } catch (err) {
    console.error('Erro em /api/admin/alertas:', err);
    const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
    const payload = isProd ? { erro: 'Erro ao carregar alertas' } : { erro: 'Erro ao carregar alertas', detalhes: pretty(err), code: err?.code };
    res.status(500).json(payload);
  }
});

// Série para gráficos do Assistente  contagem por dia (últimos N dias) e por severidade
// Params:
//   - dias: janela em dias (padrão 14)
//   - limiar_dias: limiar de inatividade para considerar alerta (padrão 3)
//   - local_ilike: filtro opcional de local (case-insensitive)
//   - tzOffsetMinutes: deslocamento do fuso do cliente em minutos (UTC = local - offset)
app.get('/api/admin/alertas/series', autenticarToken, async (req, res) => {
  try {
    const diasJanela = Math.max(1, parseInt(req.query.dias || '14', 10));
    const limiarDias = Math.max(0, parseInt(req.query.limiar_dias || '3', 10));
    const localPattern = (req.query.local_ilike && String(req.query.local_ilike).trim())
      ? `%${String(req.query.local_ilike).trim()}%`
      : null;
    const tzOffsetMinutes = parseInt(req.query.tzOffsetMinutes || '0', 10);

    let q = supabaseAdmin
      .from('controleacesso')
      .select('id, local, data_hora_entrada')
      .is('data_hora_saida', null)
      .order('data_hora_entrada', { ascending: true })
      .limit(5000);
    if (localPattern) q = q.ilike('local', localPattern);

    const includeRes = String(req.query.include_resolvidos || '0') === '1';
    if (!includeRes) q = q.or('alerta_resolvido.is.null,alerta_resolvido.eq.false');
    const { data: rows, error } = await q;
    if (error) throw error;

    const now = new Date();
    const nowMs = now.getTime();
    const labels = [];
    const total = Array(diasJanela).fill(0);
    const alta = Array(diasJanela).fill(0);
    const media = Array(diasJanela).fill(0);
    const baixa = Array(diasJanela).fill(0);

    for (let i = diasJanela - 1; i >= 0; i--) {
      const d = new Date(nowMs);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      labels.push(`${yyyy}-${mm}-${dd}`);
    }

    function localDayKey(iso) {
      try {
        const t = new Date(iso).getTime();
        if (Number.isNaN(t)) return null;
        const localMs = t - tzOffsetMinutes * 60000; // UTC -> local
        const d = new Date(localMs);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      } catch { return null; }
    }

    const diaMs = 24 * 60 * 60 * 1000;
    for (const r of rows || []) {
      const tEntrada = r?.data_hora_entrada ? new Date(r.data_hora_entrada).getTime() : null;
      if (!tEntrada) continue;
      const diffDias = Math.floor((nowMs - tEntrada) / diaMs);
      if (diffDias < limiarDias) continue;
      const key = localDayKey(r.data_hora_entrada);
      if (!key) continue;
      const idx = labels.indexOf(key);
      if (idx === -1) continue;
      total[idx]++;
      if (diffDias >= ALERT_HI_DAYS) alta[idx]++; else if (diffDias >= ALERT_MED_DAYS) media[idx]++; else baixa[idx]++;
    }

    const byLocal = {};
    for (const r of rows || []) {
      const tEntrada = r?.data_hora_entrada ? new Date(r.data_hora_entrada).getTime() : null;
      if (!tEntrada) continue;
      const diffDias = Math.floor((nowMs - tEntrada) / diaMs);
      if (diffDias < limiarDias) continue;
      const loc = (r?.local || '-').toString();
      byLocal[loc] = (byLocal[loc] || 0) + 1;
    }
    const locais = Object.entries(byLocal)
      .map(([local, total]) => ({ local, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    res.json({ dias: diasJanela, limiar_dias: limiarDias, labels, total, alta, media, baixa, locais });
  } catch (err) {
    console.error('Erro em /api/admin/alertas/series:', err);
    const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
    const payload = isProd
      ? { erro: 'Erro ao carregar series de alertas' }
      : { erro: 'Erro ao carregar series de alertas', detalhes: pretty(err), code: err?.code, hint: err?.hint };
    res.status(500).json(payload);
  }
});
app.post('/api/admin/alertas/:id/resolver', autenticarToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: 'ID inválido' });
  try {
    await supabaseAdmin.from('controleacesso').update({ alerta_resolvido: true, alerta_status: 'resolvido' }).eq('id', id);
    try { await supabaseAdmin.from('alert_actions').insert([{ alert_id: id, acao: 'resolver', autor: req?.user?.nome_usuario || null, payload: req.body || null }]); } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em resolver alerta:', err);
    const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
    const payload = isProd ? { erro: 'Falha ao resolver' } : { erro: 'Falha ao resolver', detalhes: pretty(err), code: err?.code, hint: err?.hint };
    res.status(500).json(payload);
  }
});
app.post('/api/admin/alertas/:id/atribuir', autenticarToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: 'ID inválido' });
  const responsavel = (req.body?.responsavel || '').toString().trim();
  try {
    await supabaseAdmin.from('controleacesso').update({ alerta_responsavel: responsavel, alerta_status: 'atribuido' }).eq('id', id);
    try { await supabaseAdmin.from('alert_actions').insert([{ alert_id: id, acao: 'atribuir', autor: req?.user?.nome_usuario || null, payload: { responsavel } }]); } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em atribuir alerta:', err);
    const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
    const payload = isProd ? { erro: 'Falha ao atribuir' } : { erro: 'Falha ao atribuir', detalhes: pretty(err), code: err?.code, hint: err?.hint };
    res.status(500).json(payload);
  }
});app.post('/api/admin/alertas/:id/comentar', autenticarToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: 'ID inválido' });
  const comentario = (req.body?.comentario || '').toString();
  try {
    try { await supabaseAdmin.from('alert_actions').insert([{ alert_id: id, acao: 'comentar', autor: req?.user?.nome_usuario || null, payload: { comentario } }]); } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em comentar alerta:', err);
    const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
    const payload = isProd ? { erro: 'Falha ao comentar' } : { erro: 'Falha ao comentar', detalhes: pretty(err), code: err?.code, hint: err?.hint };
    res.status(500).json(payload);
  }
});

app.post('/api/admin/alertas/:id/silenciar', autenticarToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: 'ID inválido' });
  const ativo = !!(req.body && req.body.ativo);
  try {
    try {
      await supabaseAdmin.from('alert_actions').insert([{ alert_id: id, acao: 'silenciar', autor: req?.user?.nome_usuario || null, payload: { ativo } }]);
    } catch (_) {}
    await supabaseAdmin.from('controleacesso').update({ alerta_status: ativo ? null : 'silenciado' }).eq('id', id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em silenciar alerta:', err);
    const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
    const payload = isProd ? { erro: 'Falha ao silenciar' } : { erro: 'Falha ao silenciar', detalhes: pretty(err), code: err?.code, hint: err?.hint };
    res.status(500).json(payload);
  }
});

// Endpoint: Logs de Check-in / Check-out (últimos N dias)

app.post('/api/admin/alertas/:id/dar-saida', autenticarToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: 'ID inválido' });
  try {
    const agoraIso = new Date().toISOString();
    const uid = req?.user?.id || null;
    await supabaseAdmin
      .from('controleacesso')
      .update({ data_hora_saida: agoraIso, funcionario_saida_id: uid, alerta_resolvido: true, alerta_status: 'resolvido' })
      .eq('id', id)
      .is('data_hora_saida', null);
    try { await supabaseAdmin.from('alert_actions').insert([{ alert_id: id, acao: 'resolver', autor: req?.user?.nome_usuario || null, payload: { motivo: 'dar_saida' } }]); } catch (_) {}
    res.json({ ok: true, saida_em: agoraIso });
  } catch (err) {
    console.error('Erro em dar-saida alerta:', err);
    const pretty = (e)=> (e && (e.message || e.error || e.description)) || (typeof e==='object'? JSON.stringify(e) : String(e));
    const payload = isProd ? { erro: 'Falha ao dar saída' } : { erro: 'Falha ao dar saída', detalhes: pretty(err), code: err?.code, hint: err?.hint };
    res.status(500).json(payload);
  }
});
app.get('/api/admin/logs-controle', autenticarToken, async (req, res) => {
    try {
        const dias = Math.max(1, Math.min(parseInt(req.query.dias || '7', 10), 30));
        const limite = Math.max(10, Math.min(parseInt(req.query.limite || '200', 10), 1000));
        const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('controleacesso')
            .select(`
                id,
                local,
                data_hora_entrada,
                data_hora_saida,
                proprietario:proprietario_id ( id, nome_completo ),
                bicicleta:bicicleta_id ( id, numero_identificacao ),
                func_entrada:funcionario_entrada_id ( id, nome_completo ),
                func_saida:funcionario_saida_id ( id, nome_completo )
            `)
            .or(`data_hora_entrada.gte.${desde},data_hora_saida.gte.${desde}`)
            .order('data_hora_entrada', { ascending: false })
            .limit(limite);
        if (error) throw error;

        const logs = [];
        (data || []).forEach(reg => {
            if (reg.data_hora_entrada) {
                logs.push({
                    tipo: 'checkin',
                    data_hora: reg.data_hora_entrada,
                    funcionario: reg.func_entrada?.nome_completo || '—',
                    proprietario: reg.proprietario?.nome_completo || '—',
                    bicicleta: reg.bicicleta?.numero_identificacao || '—',
                    local: reg.local || '—'
                });
            }
            if (reg.data_hora_saida) {
                logs.push({
                    tipo: 'checkout',
                    data_hora: reg.data_hora_saida,
                    funcionario: reg.func_saida?.nome_completo || '—',
                    proprietario: reg.proprietario?.nome_completo || '—',
                    bicicleta: reg.bicicleta?.numero_identificacao || '—',
                    local: reg.local || '—'
                });
            }
        });

        logs.sort((a,b)=> (a.data_hora < b.data_hora ? 1 : -1));

        res.json({ dias, total: logs.length, logs });
    } catch (err) {
        console.error('Erro ao montar logs de controle:', err);
        res.status(500).json({ erro: 'Erro ao obter logs de controle' });
    }
});

// Excluir bicicleta (bloqueia se houver dependências)
app.delete('/api/bicicletas/:id', autenticarToken, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    try {
        // Tenta excluir diretamente; confia na FK (controleacesso.bicicleta_id -> bicicletas.id ON DELETE RESTRICT)
        const { data, error } = await supabaseAdmin
            .from('bicicletas')
            .delete()
            .eq('id', id)
            .select('id')
            .single();
        if (error) {
            // 23503 = violação de chave estrangeira (há dependências)
            if (error.code === '23503' || /foreign key|violates.*foreign/i.test(error.message || '')) {
                return res.status(409).json({ erro: 'Não é possível excluir: há registros de acesso associados.' });
            }
            // PGRST116 = registro não encontrado
            if (error.code === 'PGRST116') {
                return res.status(404).json({ erro: 'Bicicleta não encontrada' });
            }
            throw error;
        }
        res.json({ mensagem: 'Bicicleta excluída com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir bicicleta:', err);
        const payload = isProd
          ? { erro: 'Erro ao excluir bicicleta' }
          : { erro: 'Erro ao excluir bicicleta', detalhes: err?.message || String(err), code: err?.code, hint: err?.hint };
        res.status(500).json(payload);
    }
});

// Adicionar atualização de bicicleta
app.put('/api/bicicletas/:id', autenticarToken, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    const { marca, modelo, tipo_bike, observacoes_bike, numero_identificacao } = req.body;
    if (marca === undefined && modelo === undefined && tipo_bike === undefined && observacoes_bike === undefined && numero_identificacao === undefined) {
        return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    }
    try {
        const campos = {};
        const isBlank = (v)=> (typeof v === 'string' && v.trim() === '');
        const setIfPresent = (key, val, opts={ allowNull:false }) => {
            if (val === undefined) return;
            if (typeof val === 'string') {
                const t = val.trim();
                if (t === '') { if (opts.allowNull) campos[key] = null; return; }
                campos[key] = t;
            } else if (val === null) {
                if (opts.allowNull) campos[key] = null; // só permite null quando especificado
            } else {
                campos[key] = val;
            }
        };

        // marca/modelo/numero_identificacao: strings vazias são ignoradas (não sobrescreve)
        setIfPresent('marca', marca);
        setIfPresent('modelo', modelo);
        setIfPresent('numero_identificacao', numero_identificacao);
        // tipo_bike e observacoes_bike podem ser anulados
        setIfPresent('tipo_bike', tipo_bike, { allowNull: true });
        setIfPresent('observacoes_bike', observacoes_bike, { allowNull: true });

        if (Object.keys(campos).length === 0) {
            return res.status(400).json({ erro: 'Nenhum campo válido para atualizar' });
        }
        const { data, error } = await supabaseAdmin
            .from('bicicletas')
            .update(campos)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ erro: 'Bicicleta não encontrada' });
            // 23505 = unique_violation (ex.: numero_identificacao duplicado)
            if (error.code === '23505' || /unique|duplicat/i.test(error.message || '')) {
                const msg = (String(error?.message||'').includes('numero_identificacao'))
                  ? 'Número de identificação já cadastrado'
                  : 'Conflito de dados (valor já existente)';
                return res.status(409).json({ erro: msg });
            }
            // 23502 = not_null_violation
            if (error.code === '23502' || /null value in column/i.test(error.message || '')) {
                const col = (error?.details || error?.message || '').match(/"([^"]+)"/);
                const campo = col && col[1] ? col[1] : undefined;
                const msg = campo ? `Campo obrigatório ausente: ${campo}` : 'Campo obrigatório ausente';
                return res.status(400).json({ erro: msg });
            }
            // 22P02 = invalid_text_representation e similares
            if (error.code === '22P02') {
                return res.status(400).json({ erro: 'Valor inválido para um dos campos' });
            }
            // 23514 = check_violation (ex.: formato inválido do numero_identificacao)
            if (error.code === '23514' || /check constraint/i.test(error.message || '')) {
                const msg = /numero_identificacao/i.test(error.message || '')
                  ? 'Número de identificação inválido (esperado: JPR-XXXXXXXXXXXXXX)'
                  : 'Violação de restrição de dados (CHECK)';
                return res.status(400).json({ erro: msg });
            }
            // 22001 = string_data_right_truncation (valor muito longo)
            if (error.code === '22001' || /value too long|right truncation/i.test(error.message || '')) {
                return res.status(400).json({ erro: 'Valor muito longo para um dos campos' });
            }
            // 42703 = undefined_column (ex.: coluna inexistente)
            if (error.code === '42703') {
                const payload = isProd
                  ? { erro: 'Erro ao atualizar bicicleta' }
                  : { erro: 'Erro ao atualizar bicicleta', detalhes: 'Coluna inexistente no schema: ' + (error.details || error.message || '') };
                return res.status(500).json(payload);
            }
            const payload = isProd
              ? { erro: 'Erro ao atualizar bicicleta' }
              : { erro: 'Erro ao atualizar bicicleta', detalhes: error?.message || String(error) };
            return res.status(500).json(payload);
        }
        if (!data) return res.status(404).json({ erro: 'Bicicleta não encontrada' });
        res.json({ mensagem: 'Bicicleta atualizada com sucesso', bicicleta: data });
  } catch (err) {
        console.error('Erro ao atualizar bicicleta:', err);
        const payload = isProd
          ? { erro: 'Erro ao atualizar bicicleta' }
          : { erro: 'Erro ao atualizar bicicleta', detalhes: err?.message || String(err) };
        res.status(500).json(payload);
    }
});

// Atualizar foto da bicicleta
app.put('/api/bicicletas/:id/foto', autenticarToken, upload, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    if (!req.files?.fotoBicicleta) return res.status(400).json({ erro: 'Nenhuma foto de bicicleta enviada' });
    try {
        const foto_bicicleta_url = await uploadToSupabase(req.files.fotoBicicleta[0], 'bicicletas');
        const { data, error } = await supabaseAdmin
            .from('bicicletas')
            .update({ foto_bicicleta_url })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ erro: 'Bicicleta não encontrada' });
        res.json({ mensagem: 'Foto da bicicleta atualizada com sucesso', foto_bicicleta_url: data.foto_bicicleta_url });
    } catch (err) {
        console.error('Erro ao atualizar foto da bicicleta:', err);
        res.status(500).json({ erro: 'Erro ao salvar foto da bicicleta' });
    }
});

// Atualizar foto do dono com bicicleta
app.put('/api/bicicletas/:id/foto-dono', autenticarToken, upload, async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    if (!req.files?.fotoDonoComBicicleta) return res.status(400).json({ erro: 'Nenhuma foto do dono com bicicleta enviada' });
    try {
        const foto_dono_com_bicicleta_url = await uploadToSupabase(req.files.fotoDonoComBicicleta[0], 'dono-com-bicicleta');
        const { data, error } = await supabaseAdmin
            .from('bicicletas')
            .update({ foto_dono_com_bicicleta_url })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        if (!data) return res.status(404).json({ erro: 'Bicicleta não encontrada' });
        res.json({ mensagem: 'Foto do dono com bicicleta atualizada com sucesso', foto_dono_com_bicicleta_url: data.foto_dono_com_bicicleta_url });
    } catch (err) {
        console.error('Erro ao atualizar foto do dono com bicicleta:', err);
        res.status(500).json({ erro: 'Erro ao salvar foto do dono com bicicleta' });
    }
});

// =====================
// Tarefas (Plantonista) — Minimal backend with SSE
// =====================
// In-memory store (podemos migrar para Supabase depois)
const tarefasStore = new Map(); // id -> tarefa
const sseClients = new Set(); // { res, assignedKey, userId }
function tarefasAssignedKey(assigned){
  // Normaliza chave de destino: preferir id; senão role
  if (!assigned) return 'plantonista';
  if (assigned.id) return String(assigned.id);
  if (assigned.role) return String(assigned.role);
  return 'plantonista';
}
function tarefaMatchesAssigned(tarefa, key){
  try {
    const a = tarefa.assignedTo || {};
    const keys = [String(a.id||'').trim(), String(a.role||'').trim()].filter(Boolean);
    return keys.includes(String(key));
  } catch(_) { return false; }
}
function broadcastTarefa(eventName, tarefa){
  const data = `event: ${eventName}\n` + `data: ${JSON.stringify(tarefa)}\n\n`;
  for (const c of Array.from(sseClients)){
    try { if (tarefaMatchesAssigned(tarefa, c.assignedKey)) c.res.write(data); } catch(_){ }
  }
}
function newId(){ return String(Date.now()) + '_' + Math.random().toString(36).slice(2,8); }

// Criar tarefa
app.post('/api/admin/tarefas', autenticarToken, async (req, res) => {
  try {
    const { alerta_id = null, mensagem, assignedTo, meta } = req.body || {};
    if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
      return res.status(400).json({ erro: 'mensagem obrigatória' });
    }
    const t = {
      id: newId(),
      alerta_id: alerta_id || null,
      mensagem: mensagem.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: { id: req.user?.id || null, nome: req.user?.nome || req.user?.email || null },
      assignedTo: { id: assignedTo?.id || null, role: assignedTo?.role || 'plantonista' },
      meta: meta && typeof meta === 'object' ? meta : {}
    };
    tarefasStore.set(t.id, t);
    try { broadcastTarefa('task.create', t); } catch(_){ }
    res.status(201).json(t);
  } catch (err) {
    console.error('POST /api/admin/tarefas:', err);
    res.status(500).json({ erro: 'Falha ao criar tarefa' });
  }
});

// Listar tarefas por assignedTo e status
app.get('/api/admin/tarefas', autenticarToken, async (req, res) => {
  try {
    const assignedTo = (req.query.assignedTo || '').toString().trim() || 'plantonista';
    const status = (req.query.status || '').toString().trim(); // opcional
    const updatedAfter = (req.query.updatedAfter || '').toString().trim();
    const uaMs = updatedAfter ? Date.parse(updatedAfter) : null;
    const arr = Array.from(tarefasStore.values()).filter(t => {
      if (!tarefaMatchesAssigned(t, assignedTo)) return false;
      if (status && String(t.status) !== status) return false;
      if (uaMs && Date.parse(t.updatedAt||0) <= uaMs) return false;
      return true;
    }).sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(arr);
  } catch (err) {
    console.error('GET /api/admin/tarefas:', err);
    res.status(500).json({ erro: 'Falha ao listar tarefas' });
  }
});

// Atualizar tarefa (status/comment)
app.patch('/api/admin/tarefas/:id', autenticarToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const t = tarefasStore.get(id);
    if (!t) return res.status(404).json({ erro: 'Tarefa não encontrada' });
    const { status, comment } = req.body || {};
    if (status && !['pending','done'].includes(String(status))) {
      return res.status(400).json({ erro: 'status inválido' });
    }
    if (status) t.status = String(status);
    if (comment) t.lastComment = String(comment);
    t.updatedAt = new Date().toISOString();
    tarefasStore.set(t.id, t);
    try { broadcastTarefa('task.update', t); } catch(_){ }
    res.json(t);
  } catch (err) {
    console.error('PATCH /api/admin/tarefas/:id:', err);
    res.status(500).json({ erro: 'Falha ao atualizar tarefa' });
  }
});

// SSE stream para tarefas (token via query por limitação do EventSource)
app.get('/api/admin/tarefas/stream', (req, res) => {
  try {
    const token = (req.query.token || '').toString().trim();
    const assignedTo = (req.query.assignedTo || '').toString().trim() || 'plantonista';
    if (!token) return res.status(401).end();
    try {
      const user = jwt.verify(token, JWT_SECRET);
      req.user = user;
    } catch (e) {
      return res.status(403).end();
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();
    res.write(': ok\n\n');
    const client = { res, assignedKey: assignedTo, userId: req.user?.id || null };
    sseClients.add(client);
    // Heartbeat a cada 25s
    const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch(_){ } }, 25000);
    req.on('close', () => { clearInterval(hb); sseClients.delete(client); try{ res.end(); }catch(_){ } });
  } catch (err) {
    console.error('SSE /api/admin/tarefas/stream:', err);
    try { res.status(500).end(); } catch(_){ }
  }
});

// Listar bicicletas de um proprietário (com status e open_registro_id)
app.get('/api/proprietarios/:id/bicicletas', autenticarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Buscar bicicletas
        const { data: bikes, error: errorBikes } = await supabase
            .from('bicicletas')
            .select('id, numero_identificacao, marca, modelo, tipo_bike')
            .eq('proprietario_id', id)
            .order('id');
        if (errorBikes) throw errorBikes;
        if (!bikes || bikes.length === 0) return res.json([]);
        const ids = bikes.map(b => b.id);
        // Buscar registros abertos
        const { data: registrosAbertos, error: errorRegs } = await supabase
            .from('controleacesso')
            .select('id, bicicleta_id')
            .in('bicicleta_id', ids)
            .is('data_hora_saida', null);
        if (errorRegs) throw errorRegs;
        const abertoMap = {};
        (registrosAbertos||[]).forEach(r => { abertoMap[r.bicicleta_id] = r.id; });
        const resposta = bikes.map(b => ({
            id: b.id,
            numero_identificacao: b.numero_identificacao,
            marca: b.marca,
            modelo: b.modelo,
            tipo_bike: b.tipo_bike,
            status: abertoMap[b.id] ? 'DENTRO' : 'FORA',
            open_registro_id: abertoMap[b.id] || null
        }));
        res.json(resposta);
    } catch (err) {
        console.error('Erro ao listar bicicletas do proprietário:', err);
        res.status(500).json({ erro: 'Erro ao carregar bicicletas do proprietário' });
    }
});

// --- Inicialização do servidor (faltava, causando ERR_CONNECTION_REFUSED no front) ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  });
}

// Exporta para possíveis testes ou uso em serverless
module.exports = app;
