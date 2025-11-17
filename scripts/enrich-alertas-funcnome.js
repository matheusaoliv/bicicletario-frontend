// Patches server.js to enrich /api/admin/alertas with funcionario_entrada_nome
// - Adds funcionario_entrada_id to both SELECTs
// - Builds a funcMap to resolve names
// - Injects funcionario_entrada_nome in the alert payload

const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'server.js');
const enc = 'utf8';

if (!fs.existsSync(target)) {
  console.error('server.js not found at', target);
  process.exit(1);
}

const original = fs.readFileSync(target, enc);
let s = original;
let changes = 0;

// 1) Template-literal SELECT: insert funcionario_entrada_id before proprietarios (
// Looks like:
//   .select(`
//     id, local, data_hora_entrada, data_hora_saida, proprietario_id, bicicleta_id,
//     proprietarios (...),
//     bicicletas (...)
//   `)
if (!/funcionario_entrada_id/.test(s)) {
  s = s.replace(/(bicicleta_id,)(\s*\r?\n\s*)proprietarios\s*\(/, (_m, g1, g2) => {
    changes++;
    return `${g1} funcionario_entrada_id,${g2}proprietarios (`;
  });
}

// 2) Fallback SELECT: 'select(\'id, local, data_hora_entrada, proprietario_id, bicicleta_id\')'
if (!/bicicleta_id,\s*funcionario_entrada_id'\)/.test(s)) {
  s = s.replace(/select\('id,\s*local,\s*data_hora_entrada,\s*proprietario_id,\s*bicicleta_id'\)/, () => {
    changes++;
    return "select('id, local, data_hora_entrada, proprietario_id, bicicleta_id, funcionario_entrada_id')";
  });
}

// 3) Insert enrichment block before "// Filtrar por limiar de dias e calcular métricas"
if (!/funcionario_entrada_nome:\s*\(r\.funcionario_entrada_id/.test(s)) {
  s = s.replace(/(\r?\n\s*\/\/ Filtrar por limiar de dias e calcular métricas)/, `

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
$1`);
  changes++;
}

// 4) Add funcionario_entrada_nome in the returned alert object
s = s.replace(/(local:\s*r\.local\s*\|\|\s*null,)(\s*\r?\n\s*data_hora_entrada:)/, (_m, g1, g2) => {
  changes++;
  return `${g1}\n        funcionario_entrada_nome: (r.funcionario_entrada_id && funcMap[r.funcionario_entrada_id]) ? funcMap[r.funcionario_entrada_id] : null,${g2}`;
});

if (changes === 0) {
  console.log('No changes applied (it may already be enriched).');
  process.exit(0);
}

const backup = target + '.bak.' + new Date().toISOString().replace(/[-:TZ.]/g, '');
fs.writeFileSync(backup, original, enc);
fs.writeFileSync(target, s, enc);
console.log('server.js enriched with funcionario_entrada_nome. Backup at', backup);
