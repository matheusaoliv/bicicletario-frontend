#!/usr/bin/env node
/*
  Uso (Windows CMD):
    set TOKEN=SEU_JWT && node scripts\report-historico.js --termo "Laparrier Domingues Liberato" --bicicleta 32 --proprietario 41 --baseUrl http://localhost:5050/api
  Opções:
    --termo "texto"            Filtro de nome/CPF na busca admin/proprietarios
    --proprietario 41          Filtrar pelo ID do proprietário
    --bicicleta 32             Filtrar pelo ID da bicicleta
    --numero JPR-XXXX          Filtrar pelo número de identificação da bicicleta
    --baseUrl http://.../api   Base da API (default: http://localhost:5050/api)
    --token XXX                JWT (ou use variável de ambiente TOKEN/JWT_TOKEN)
*/

const args = process.argv.slice(2);
function getArg(flag, def = undefined) {
  const i = args.findIndex(a => a === flag || a.startsWith(flag + '='));
  if (i === -1) return def;
  if (args[i].includes('=')) return args[i].split('=').slice(1).join('=');
  return args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
}
function toInt(v){ const n = parseInt(v, 10); return Number.isFinite(n) ? n : undefined; }

const baseUrl = (getArg('--baseUrl') || 'http://localhost:5050/api').replace(/\/$/, '');
const token = getArg('--token') || process.env.TOKEN || process.env.JWT_TOKEN;
const termo = getArg('--termo');
const propId = toInt(getArg('--proprietario'));
const bikeId = toInt(getArg('--bicicleta'));
const numeroBike = getArg('--numero');

if (!token) {
  console.error('Erro: informe o token JWT via --token OU variável de ambiente TOKEN.');
  process.exit(1);
}

const fmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
function formatSP(iso){ if(!iso) return null; const d=new Date(iso); return fmt.format(d); }

async function main(){
  const url = `${baseUrl}/admin/proprietarios${termo ? `?termo=${encodeURIComponent(termo)}` : ''}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if(!resp.ok){ const txt = await resp.text(); throw new Error(`HTTP ${resp.status}: ${txt}`); }
  const arr = await resp.json();

  const proprietarios = Array.isArray(arr) ? arr : [];
  const propFiltrados = proprietarios.filter(p => {
    if (propId && p.id !== propId) return false;
    return true;
  });

  let registros = [];
  for (const p of propFiltrados) {
    for (const b of (p.bicicletas || [])) {
      if (bikeId && b.id !== bikeId) continue;
      if (numeroBike && String(b.numero_identificacao) !== String(numeroBike)) continue;
      for (const h of (b.historico || [])) {
        registros.push({
          proprietario_id: p.id,
          proprietario_nome: p.nome,
          bicicleta_id: b.id,
          numero_identificacao: b.numero_identificacao,
          entrada_iso: h.data_hora_entrada,
          saida_iso: h.data_hora_saida,
          funcionario_entrada: h.funcionario_entrada || null,
          funcionario_saida: h.funcionario_saida || null,
          numero_lacre: h.numero_lacre || null
        });
      }
    }
  }

  registros.sort((a,b)=> new Date(b.entrada_iso||0) - new Date(a.entrada_iso||0));

  if (registros.length === 0) {
    console.log('Nenhum registro encontrado com os filtros informados.');
    return;
  }

  console.log('Total de movimentações:', registros.length);
  console.log('');
  for (const r of registros) {
    const ent = formatSP(r.entrada_iso);
    const sai = formatSP(r.saida_iso);
    const lacre = r.numero_lacre ? ` - Lacre ${r.numero_lacre}` : '';
    console.log(`[${r.proprietario_nome}] Bike ${r.numero_identificacao} (id ${r.bicicleta_id})`);
    console.log(`  Entrada: ${ent || '-'}${r.funcionario_entrada ? ` - Func. entrada: ${r.funcionario_entrada}` : ''}${lacre}`);
    console.log(`  Saída  : ${sai || '-'}${r.funcionario_saida ? ` - Func. saída: ${r.funcionario_saida}` : ''}`);
    console.log('');
  }
}

main().catch(err => { console.error('Falha ao gerar relatório:', err.message || err); process.exit(1); });

