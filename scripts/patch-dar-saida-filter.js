// Patch server.js to:
// 1) Add POST /api/admin/alertas/:id/dar-saida endpoint
// 2) Exclude resolved alerts by default in GET /api/admin/alertas unless include_resolvidos=1
// 3) Ensure main SELECT includes funcionario_entrada_id

const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'server.js');
const enc = 'utf8';

if (!fs.existsSync(target)) {
  console.error('server.js not found at', target);
  process.exit(1);
}

let s = fs.readFileSync(target, enc);
const orig = s;
let changes = 0;

// 3) Ensure main SELECT includes funcionario_entrada_id in GET /api/admin/alertas
// Look for the template literal select that has bicicleta_id, then a new line with proprietarios (
if (!/id,\s*local,\s*data_hora_entrada,\s*data_hora_saida,\s*proprietario_id,\s*bicicleta_id,\s*funcionario_entrada_id/i.test(s)) {
  s = s.replace(
    /(id,\s*local,\s*data_hora_entrada,\s*data_hora_saida,\s*proprietario_id,\s*bicicleta_id,)(\s*\r?\n\s*proprietarios\s*\()/i,
    (_m, g1, g2) => {
      changes++;
      return g1 + ' funcionario_entrada_id,' + g2;
    }
  );
}

// 2a) Define includeRes near diaMs in GET /api/admin/alertas
if (!/const\s+includeRes\s*=\s*String\(req\.query\.include_resolvidos\s*\|\|\s*'0'\)\s*===\s*'1'/.test(s)) {
  s = s.replace(
    /(const\s+diaMs\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000;)/,
    (_m, g1) => {
      changes++;
      return g1 + "\n\n    const includeRes = String(req.query.include_resolvidos || '0') === '1';";
    }
  );
}

// 2b) On main query `q`, add OR filter unless includeRes
if (!/\(\!includeRes\)\s*q\s*=\s*q\.or\('alerta_resolvido\.is\.null,alerta_resolvido\.eq\.false'\)/.test(s)) {
  s = s.replace(
    /(const\s*\{\s*data:\s*data,\s*error\s*\}\s*=\s*await\s*q\.limit\(limit\s*\*\s*3\)\s*;)/,
    (_m, g1) => {
      changes++;
      return "if (!includeRes) q = q.or('alerta_resolvido.is.null,alerta_resolvido.eq.false');\n      " + g1;
    }
  );
}

// 2c) On fallback query `q`, add OR filter unless includeRes
if (!/\n\s*if\s*\(!includeRes\)\s*q\s*=\s*q\.or\('alerta_resolvido\.is\.null,alerta_resolvido\.eq\.false'\);\s*\n\s*const\s*\{\s*data:\s*base,\s*error:\s*errBase\s*\}\s*=\s*await\s*q\.limit\(limit\s*\*\s*3\)/.test(s)) {
  s = s.replace(
    /(const\s*\{\s*data:\s*base,\s*error:\s*errBase\s*\}\s*=\s*await\s*q\.limit\(limit\s*\*\s*3\)\s*;)/,
    (_m, g1) => {
      changes++;
      return "if (!includeRes) q = q.or('alerta_resolvido.is.null,alerta_resolvido.eq.false');\n        " + g1;
    }
  );
}

// 1) Insert POST /api/admin/alertas/:id/dar-saida route before logs-controle, if not present
if (!/app\.post\('\/api\/admin\/alertas\/:id\/dar-saida'/.test(s)) {
  const insertBefore = s.indexOf("app.get('/api/admin/logs-controle'");
  const route = `
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
`;
  if (insertBefore !== -1) {
    s = s.slice(0, insertBefore) + route + s.slice(insertBefore);
    changes++;
  }
}

if (changes === 0) {
  console.log('No changes applied (already patched).');
  process.exit(0);
}

const backup = target + '.bak.' + new Date().toISOString().replace(/[-:TZ.]/g, '');
fs.writeFileSync(backup, orig, enc);
fs.writeFileSync(target, s, enc);
console.log('server.js patched: dar-saida endpoint + default exclude resolvidos. Backup at', backup);
