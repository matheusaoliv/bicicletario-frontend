
// --- Assistente Preditivo — Alertas de Inatividade ---
function initAssistenteAlertas(){
  const btn = document.getElementById('assistAtualizar');
  const diasEl = document.getElementById('assistDias');
  const localEl = document.getElementById('assistLocal');
  if (btn && !btn._bound) { btn.addEventListener('click', carregarAssistAlertas); btn._bound = true; }
  if (diasEl && !diasEl._bound) { diasEl.addEventListener('change', carregarAssistAlertas); diasEl._bound = true; }
  if (localEl && !localEl._bound) {
    localEl.addEventListener('change', carregarAssistAlertas);
    localEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); carregarAssistAlertas(); }});
    localEl._bound = true;
  }
  carregarAssistAlertas();
}

async function carregarAssistAlertas(){
  const cont = document.getElementById('assistAlertasLista');
  const resumo = document.getElementById('assistResumo');
  if(!cont) return;
  cont.innerHTML = '<p class="text-muted mb-0">Carregando alertas...</p>';
  try {
    const dias = Math.max(1, parseInt(document.getElementById('assistDias')?.value || '3', 10));
    const localVal = (document.getElementById('assistLocal')?.value || '').trim();
    const query = { dias: String(dias), limit: '200' };
    if(localVal) query.local_ilike = localVal;
    const data = await apiFetchJson('/admin/alertas', { query });
    const alertas = Array.isArray(data?.alertas) ? data.alertas : [];

    try {
      const cutoff = data?.cutoff_iso ? formatDateTimeExact(data.cutoff_iso) : '';
      if (resumo) resumo.textContent = `${alertas.length} alerta(s) • corte: ${cutoff || '-'}`;
    } catch {}

    if(alertas.length === 0){
      cont.innerHTML = '<p class="text-muted mb-0">Nenhum alerta para os filtros informados.</p>';
      return;
    }

    let html = '<div class="table-responsive"><table class="table table-sm table-striped align-middle"><thead><tr>'
      + '<th>Proprietário</th><th>Bicicleta</th><th>Entrada</th><th>Local</th><th>Inatividade</th><th>Severidade</th>'
      + '</tr></thead><tbody>';

    alertas.forEach(a => {
      const nome = a.proprietario_nome || '-';
      const bike = [a.numero_identificacao, [a.marca, a.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' • ');
      const entrada = a.data_hora_entrada ? formatDateTimeExact(a.data_hora_entrada) : '-';
      const local = a.local || '-';
      const d = Number.isFinite(a.dias_inatividade) ? a.dias_inatividade : null;
      const h = Number.isFinite(a.horas_inatividade) ? a.horas_inatividade : null;
      const m = Number.isFinite(a.minutos_inatividade) ? a.minutos_inatividade : null;
      let inat = '-';
      if (d !== null && d >= 1) inat = d + 'd';
      else if (h !== null && h >= 1) inat = h + 'h';
      else if (m !== null) inat = m + 'm';
      const sev = (a.severidade || '').toLowerCase();
      const sevCls = sev==='alta' ? 'bg-danger' : (sev==='media' ? 'bg-warning text-dark' : 'bg-secondary');
      html += '<tr><td>' + nome + '</td><td>' + (bike || '-') + '</td><td>' + entrada + '</td><td>' + local + '</td><td>' + inat + '</td><td><span class="badge ' + sevCls + '">' + (sev || '-') + '</span></td></tr>';
    });

    html += '</tbody></table></div>';
    cont.innerHTML = html;
  } catch(err){
    console.error('Assistente alertas:', err);
    cont.innerHTML = '<p class="text-danger mb-0">Erro ao carregar alertas: ' + ((err && err.message) || 'erro desconhecido') + '</p>';
  }
}
