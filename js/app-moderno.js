// ==============================================
// SCRIPT DE CONTROLE - BICICLETÁRIO JAPERI (VERSÃO MODERNA)
// ==============================================
(function(){
  'use strict';

  // Pequena ajuda: base de API - SEMPRE usar produção
  // const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const API_BASE = 'https://api-daja3h3cva-rj.a.run.app'.replace(/\/$/, '');

  // Utilitário: obter token
  function getToken(){
    try { return sessionStorage.getItem('token') || ''; } catch(_){ return ''; }
  }

  // Utilitário: fetch com auth e tratamento básico
  async function apiFetch(path, options){
    const token = getToken();
    const headers = Object.assign({
      'Accept': 'application/json'
    }, options && options.headers ? options.headers : {});
    if(token) headers['Authorization'] = 'Bearer ' + token;
    const url = path.startsWith('http') ? path : API_BASE + (path.startsWith('/') ? path : ('/' + path));
    const resp = await fetch(url, Object.assign({}, options, { headers }));
    let data;
    try { data = await resp.json(); } catch(e) { data = null; }
    if(!resp.ok){
      const msg = (data && (data.erro || data.message)) || ('HTTP ' + resp.status);
      const err = new Error(msg);
      err.status = resp.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  // --- Heartbeat: sinal de vida periódico do funcionário ---
  let _hbTimer = null;
  const HEARTBEAT_MS = 2 * 60 * 1000; // 2 minutos

  async function _sendHeartbeat(){
    try {
      const token = getToken();
      if (!token) return; // não envia se não logado
      await apiFetch('/funcionarios/ping', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
    } catch (e) {
      try { console.warn('[heartbeat] falha no ping:', e?.message || String(e)); } catch(_){ }
    }
  }

  function startHeartbeat(){
    if (_hbTimer) return;
    _sendHeartbeat();
    _hbTimer = setInterval(_sendHeartbeat, HEARTBEAT_MS);
  }

  function stopHeartbeat(){
    if (_hbTimer) {
      clearInterval(_hbTimer);
      _hbTimer = null;
    }
  }

  document.addEventListener('visibilitychange', ()=>{
    try {
      if (document.visibilityState === 'visible') startHeartbeat(); else stopHeartbeat();
    } catch(_){ }
  });

  // Iniciar após DOM pronto, se página estiver visível
  document.addEventListener('DOMContentLoaded', ()=>{
    try {
      if (document.visibilityState === 'visible') startHeartbeat();
    } catch(_){ }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const ui = {
      termoPesquisa: document.getElementById('termoPesquisa'),
      btnBuscar: document.getElementById('btnBuscar'),
      btnClear: document.getElementById('btnClear'),
      searchBar: document.getElementById('searchBar'),
      listaResultados: document.getElementById('listaResultadosBusca'),
      mensagemStatus: document.getElementById('mensagemStatusBusca'),
      modal: {
        overlay: document.getElementById('detalheModal'),
        titulo: document.getElementById('modalTitulo'),
        nomeProprietario: document.getElementById('detalheNomeProprietario'),
        infoBicicleta: document.getElementById('detalheInfoBicicleta'),
        statusAtual: document.getElementById('detalheStatusAtual'),
        // novos campos
        fotoPrincipal: document.getElementById('fotoProprietarioPrincipal'),
        fotoExtra: document.getElementById('fotoProprietarioExtra'),
        selectLocal: document.getElementById('selectLocalBicicletario'),
        dataHoraEl: document.getElementById('dataHoraOperacao'),
        listaBikesEl: document.getElementById('listaBicicletasDoProprietario'),
        obsNormal: document.getElementById('obsNormal'),
        obsOcorrencia: document.getElementById('obsOcorrencia'),
        // Novo campo: número do lacre
        lacre: {
          displayArea: document.getElementById('lacre-display-area'),
          editArea: document.getElementById('lacre-edit-area'),
          currentNumber: document.getElementById('current-lacre-number'),
          btnSim: document.getElementById('btn-lacre-sim'),
          btnNao: document.getElementById('btn-lacre-nao'),
          newInput: document.getElementById('new-lacre-input'),
          btnSave: document.getElementById('btn-save-lacre')
        },
        btnEditarProprietario: document.getElementById('btnEditarProprietario'),
        observacoes: document.getElementById('detalheObservacoes'), // legado (não usado mais)
        btnAcaoPrincipal: document.getElementById('btnAcaoPrincipal'),
        btnClose: document.querySelector('.modal-close-btn'),
        btnCancelar: document.getElementById('btnCancelarModal'),
        contentEl: document.querySelector('#detalheModal .modal-content')
      },
      // Popup de confirmação
      opPopupOverlay: document.getElementById('opPopupOverlay'),
      opPopupTitle: document.getElementById('opPopupTitle'),
      opPopupMessage: document.getElementById('opPopupMessage'),
      opPopupCloseBtn: document.getElementById('opPopupCloseBtn'),
      opPopupDetails: document.getElementById('opPopupDetails')
    };

    let itemAtivoNoModal = null;
    let buscarAborter = null; // AbortController para cancelar buscas em andamento
    let debounceTimer = null; // debounce para busca digitada
    let lastQuery = '';
    let lastFocusedEl = null; // para restaurar foco ao fechar modal
    let isModalOpen = false;
    let dataHoraTimer = null;
    let opPopupTimer = null;
    let lacreVerificado = false;
    let filtersDebounceTimer = null; // debounce para mudanças nos filtros

    // Eventos
    // Header sticky: alterna classe 'scrolled' ao rolar
    const appHeader = document.getElementById('appHeader');
    let ticking = false;
    function onScroll(){
      if(!appHeader) return;
      const y = window.scrollY || document.documentElement.scrollTop;
      if(y > 4) appHeader.classList.add('scrolled'); else appHeader.classList.remove('scrolled');
      ticking = false;
    }
    window.addEventListener('scroll', ()=>{
      if(!ticking){
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, { passive: true });
    onScroll();
    ui.btnBuscar && ui.btnBuscar.addEventListener('click', ()=>{ clearTimeout(debounceTimer); lastQuery = (ui.termoPesquisa?.value||'').trim(); realizarBusca(); });
    ui.termoPesquisa && ui.termoPesquisa.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ clearTimeout(debounceTimer); lastQuery = (ui.termoPesquisa?.value||'').trim(); realizarBusca(); } });
    ui.termoPesquisa && ui.termoPesquisa.addEventListener('input', ()=>{
      clearTimeout(debounceTimer);
      if(ui.searchBar){ ui.searchBar.classList.toggle('has-text', !!(ui.termoPesquisa && ui.termoPesquisa.value)); }
      debounceTimer = setTimeout(()=>{
        const val = (ui.termoPesquisa?.value||'').trim();
        if(!val){ ui.mensagemStatus.textContent=''; ui.listaResultados.innerHTML=''; lastQuery=''; return; }
        if(val === lastQuery) return;
        lastQuery = val;
        realizarBusca();
      }, 350);
    });
    ui.btnClear && ui.btnClear.addEventListener('click', ()=>{
      if(!ui.termoPesquisa) return;
      ui.termoPesquisa.value = '';
      if(ui.searchBar){ ui.searchBar.classList.remove('has-text'); }
      ui.mensagemStatus.textContent = '';
      ui.listaResultados.innerHTML = '';
      lastQuery = '';
      ui.termoPesquisa.focus();
    });
    // Inicializa faixa de filtros (Tipo→Marca→Modelo + Linha) se presente e visível na página
    try {
      const filtrosSec = document.getElementById('filtrosCatalogo');
      const filtrosVisiveis = !!(filtrosSec && !filtrosSec.hasAttribute('hidden'));
      if (window.CatalogoBikesUI && document.getElementById('fltTipo') && filtrosVisiveis) {
        CatalogoBikesUI.loadCatalog();
        CatalogoBikesUI.setupDependentSelects({
          tipoSel: '#fltTipo',
          marcaSel: '#fltMarca',
          modeloSel: '#fltModelo',
          marcaSearch: '#fltMarcaSearch',
          modeloSearch: '#fltModeloSearch',
          marcaClear: '#fltMarcaClear',
          modeloClear: '#fltModeloClear',
          marcaOutroWrap: '#fltMarcaOutroWrap',
          modeloOutroWrap: '#fltModeloOutroWrap',
          marcaOutroInput: '#fltMarcaOutro',
          modeloOutroInput: '#fltModeloOutro',
          marcaSuggestions: '#fltMarcaSuggestions',
          modeloSuggestions: '#fltModeloSuggestions',
          includeOutroOption: true,
          includeLinhaFilter: true,
          linhaRow: '#fltLinhaRow',
          linhaFilterWrap: '#fltLinhaFilterWrap',
          linhaSearch: '#fltLinhaSearch',
          linhaClear: '#fltLinhaClear',
          linhaSuggestions: '#fltLinhaSuggestions'
        });
      }
    } catch(_){}
    // Debounce para filtros: reexecuta busca quando filtros mudam
    function scheduleFilterSearch() {
      clearTimeout(filtersDebounceTimer);
      filtersDebounceTimer = setTimeout(() => {
        const termoAtual = (ui.termoPesquisa?.value || '').trim();
        if (!termoAtual) {
          // mantém o comportamento atual: exige termo para buscar
          return;
        }
        realizarBusca();
      }, 300);
    }
    // Bind listeners dos filtros, se presentes e visíveis
    try {
      const filtrosSec = document.getElementById('filtrosCatalogo');
      const filtrosVisiveis = !!(filtrosSec && !filtrosSec.hasAttribute('hidden'));
      const fltTipo = filtrosVisiveis ? document.getElementById('fltTipo') : null;
      const fltMarca = filtrosVisiveis ? document.getElementById('fltMarca') : null;
      const fltModelo = filtrosVisiveis ? document.getElementById('fltModelo') : null;

      const fltMarcaSearch = document.getElementById('fltMarcaSearch');
      const fltMarcaClear = document.getElementById('fltMarcaClear');
      const fltMarcaOutro = document.getElementById('fltMarcaOutro');

      const fltModeloSearch = document.getElementById('fltModeloSearch');
      const fltModeloClear = document.getElementById('fltModeloClear');
      const fltModeloOutro = document.getElementById('fltModeloOutro');

      const fltLinhaSearch = document.getElementById('fltLinhaSearch');
      const fltLinhaClear = document.getElementById('fltLinhaClear');

      if (fltTipo) fltTipo.addEventListener('change', scheduleFilterSearch);
      if (fltMarca) fltMarca.addEventListener('change', scheduleFilterSearch);
      if (fltModelo) fltModelo.addEventListener('change', scheduleFilterSearch);

      if (filtrosVisiveis && fltMarcaSearch) fltMarcaSearch.addEventListener('input', scheduleFilterSearch);
      if (filtrosVisiveis && fltMarcaClear) fltMarcaClear.addEventListener('click', scheduleFilterSearch);
      if (filtrosVisiveis && fltMarcaOutro) fltMarcaOutro.addEventListener('input', scheduleFilterSearch);

      if (filtrosVisiveis && fltModeloSearch) fltModeloSearch.addEventListener('input', scheduleFilterSearch);
      if (filtrosVisiveis && fltModeloClear) fltModeloClear.addEventListener('click', scheduleFilterSearch);
      if (filtrosVisiveis && fltModeloOutro) fltModeloOutro.addEventListener('input', scheduleFilterSearch);

      if (filtrosVisiveis && fltLinhaSearch) fltLinhaSearch.addEventListener('input', scheduleFilterSearch);
      if (filtrosVisiveis && fltLinhaClear) fltLinhaClear.addEventListener('click', scheduleFilterSearch);
    } catch (_) {}
    // Popup listeners
    if(ui.opPopupCloseBtn) ui.opPopupCloseBtn.addEventListener('click', hideOpPopup);
    if(ui.opPopupOverlay) ui.opPopupOverlay.addEventListener('click', (ev)=>{ if(ev.target === ui.opPopupOverlay) hideOpPopup(); });
    ui.modal.btnClose && ui.modal.btnClose.addEventListener('click', fecharModal);
    ui.modal.btnCancelar && ui.modal.btnCancelar.addEventListener('click', fecharModal);
    ui.modal.overlay && ui.modal.overlay.addEventListener('click', (e)=>{ if(e.target === ui.modal.overlay) fecharModal(); });
    document.addEventListener('keydown', (e)=>{
      const lb = document.getElementById('modalLightbox');
      if(e.key==='Escape' && lb && lb.classList.contains('show')) { e.preventDefault(); closeLightbox(); return; }
      if(e.key==='Escape' && ui.opPopupOverlay && ui.opPopupOverlay.classList.contains('show')) { e.preventDefault(); hideOpPopup(); return; }
      if(e.key==='Escape' && isModalOpen) { e.preventDefault(); fecharModal(); return; }
      if(e.key==='Tab' && isModalOpen){
        trapFocus(e);
      }
    });

    // Funções
    function showOpPopup(title, message, options){
      if(!ui.opPopupOverlay) return;
      const opts = Object.assign({ mode: 'success', detailsHtml: '', autoCloseMs: 2400 }, options || {});
      if(ui.opPopupTitle) ui.opPopupTitle.textContent = title || (opts.mode==='error' ? 'Falha' : 'Sucesso!');
      if(ui.opPopupMessage) ui.opPopupMessage.textContent = message || (opts.mode==='error' ? 'Não foi possível concluir a operação.' : 'Operação concluída com sucesso.');
      if(ui.opPopupDetails) ui.opPopupDetails.innerHTML = opts.detailsHtml || '';
      const card = ui.opPopupOverlay.querySelector('.op-card');
      if(card){ card.classList.remove('op-success','op-error'); card.classList.add(opts.mode === 'error' ? 'op-error' : 'op-success'); }
      // remover hidden (display none) e mostrar com animação
      ui.opPopupOverlay.classList.remove('hidden');
      // pequena espera para permitir transição
      requestAnimationFrame(()=>{ ui.opPopupOverlay.classList.add('show'); });
      setBackgroundInert(true);
      // foco no botão fechar após animação
      setTimeout(()=>{ try { ui.opPopupCloseBtn && ui.opPopupCloseBtn.focus && ui.opPopupCloseBtn.focus(); } catch(_){} }, 600);
      // auto close
      if(opPopupTimer){ clearTimeout(opPopupTimer); opPopupTimer = null; }
      if(opts.autoCloseMs && Number.isFinite(opts.autoCloseMs)){
        opPopupTimer = setTimeout(()=> hideOpPopup(), opts.autoCloseMs);
      }
    }

    function hideOpPopup(){
      if(!ui.opPopupOverlay) return;
      if(opPopupTimer){ clearTimeout(opPopupTimer); opPopupTimer = null; }
      ui.opPopupOverlay.classList.remove('show');
      // após transição, re-ocultar com hidden e liberar background
      setTimeout(()=>{
        ui.opPopupOverlay.classList.add('hidden');
        setBackgroundInert(false);
      }, 320);
    }
    function showLoadingSkeleton(count = 6){
      if(!ui.listaResultados) return;
      ui.listaResultados.setAttribute('aria-busy','true');
      ui.listaResultados.classList.add('loading-skeleton');
      const sk = `
        <div class="resultado-card" aria-hidden="true">
          <div class="card-header">
            <div class="skeleton-circle shimmer"></div>
            <div class="card-info-proprietario" style="flex:1; display:flex; flex-direction:column; gap:6px;">
              <div class="skeleton-block shimmer" style="width:60%; height:16px;"></div>
              <div class="skeleton-block shimmer" style="width:40%; height:12px;"></div>
            </div>
          </div>
          <div class="card-body" style="display:flex; flex-direction:column; gap:8px;">
            <div class="skeleton-block shimmer" style="width:80%; height:12px;"></div>
            <div class="skeleton-block shimmer" style="width:48%; height:12px;"></div>
          </div>
          <div class="card-footer">
            <div class="skeleton-block shimmer" style="width:40%; height:12px;"></div>
            <div class="skeleton-badge shimmer"></div>
          </div>
        </div>`;
      ui.listaResultados.innerHTML = Array.from({length: count}).map(()=> sk).join('');
    }

    function hideLoadingSkeleton(){
      if(!ui.listaResultados) return;
      ui.listaResultados.removeAttribute('aria-busy');
      ui.listaResultados.classList.remove('loading-skeleton');
    }
    // Captura os filtros atuais da faixa de filtros (Tipo→Marca→Modelo + Linha) — retorna vazio se a faixa estiver oculta
    function getCurrentFilters(){
      const filtrosSec = document.getElementById('filtrosCatalogo');
      if (filtrosSec && filtrosSec.hasAttribute('hidden')) { return { tipo:'', marca:'', modelo:'', linha:'' }; }
      const tipoEl = document.getElementById('fltTipo');
      const marcaSel = document.getElementById('fltMarca');
      const modeloSel = document.getElementById('fltModelo');
      const marcaOutroEl = document.getElementById('fltMarcaOutro');
      const modeloOutroEl = document.getElementById('fltModeloOutro');
      const linhaSearch = document.getElementById('fltLinhaSearch');
      const tipo = (tipoEl && tipoEl.value || '').trim();
      const marcaVal = (marcaSel && marcaSel.value || '').trim();
      const modeloVal = (modeloSel && modeloSel.value || '').trim();
      const marca = marcaVal === 'Outro' ? ((marcaOutroEl && marcaOutroEl.value) || '').trim() : marcaVal;
      const modelo = (modeloVal === 'Outro') ? ((modeloOutroEl && modeloOutroEl.value) || '').trim() : modeloVal;
      const linha = (linhaSearch && linhaSearch.value || '').trim();
      return { tipo, marca, modelo, linha };
    }
    function normStr(s){ return (s||'').toString().toLowerCase(); }
    function filterResults(arr, filters){
      const t = (filters && filters.tipo) ? filters.tipo : '';
      const m = (filters && filters.marca) ? filters.marca : '';
      const md = (filters && filters.modelo) ? filters.modelo : '';
      if(!t && !m && !md){ return arr; }
      return arr.filter(item => {
        const tipoItem = item?.bicicleta?.tipo_bike || '';
        const marcaItem = item?.bicicleta?.marca || '';
        const modeloItem = item?.bicicleta?.modelo || '';
        if(t && !normStr(tipoItem).includes(normStr(t))) return false;
        if(m && !normStr(marcaItem).includes(normStr(m))) return false;
        if(md && !normStr(modeloItem).includes(normStr(md))) return false;
        return true;
      });
    }
    async function realizarBusca(){
      const termo = (ui.termoPesquisa && ui.termoPesquisa.value || '').trim();
      if(!termo){ ui.mensagemStatus.textContent = 'Por favor, digite um termo para a busca.'; return; }

      // Cancelar busca anterior se ainda estiver rodando
      if(buscarAborter) buscarAborter.abort();
      buscarAborter = new AbortController();

      showLoadingSkeleton(6);
      ui.mensagemStatus.textContent = '';
      if(ui.btnBuscar) ui.btnBuscar.classList.add('is-loading');

      try {
        const filters = getCurrentFilters();
        const params = new URLSearchParams({ termo });
        if(filters.tipo) params.append('tipo', filters.tipo);
        if(filters.marca) params.append('marca', filters.marca);
        if(filters.modelo) params.append('modelo', filters.modelo);
        if(filters.linha) params.append('linha', filters.linha);
        const data = await apiFetch(`/proprietarios?${params.toString()}`, { signal: buscarAborter.signal });
        const arr = Array.isArray(data) ? data : [];
        
        // Usar dados diretos de proprietários por enquanto
        // TODO: Implementar busca de bicicletas quando endpoint estiver disponível
        console.log('Dados de proprietários carregados:', arr.length);
        const todosResultados = arr;
        
        const filtered = filterResults(todosResultados, filters);
        renderizarResultados(filtered);
      } catch(err){
        if(err.name === 'AbortError') return; // ignorar buscas canceladas
        if(err.status === 401 || err.status === 403){
          ui.mensagemStatus.textContent = 'Sessão expirada. Faça login novamente.';
          setTimeout(()=>{ window.location.href = 'login.html'; }, 1600);
          return;
        }
        hideLoadingSkeleton();
        ui.listaResultados.innerHTML = '';
        ui.mensagemStatus.textContent = `Erro: ${err.message}`;
      }
      finally {
        if(ui.btnBuscar) ui.btnBuscar.classList.remove('is-loading');
      }
    }

    function gerenciarLogicaLacre(item) {
      // Detectar se é dado de proprietário direto ou de controle de acesso
      const isProprietarioDireto = !item.proprietario;
      const proprietario = isProprietarioDireto ? item : item.proprietario;
      const lacreAtual = proprietario?.numero_lacre || null;
      lacreVerificado = false; // Reseta a verificação a cada abertura do modal

      ui.modal.lacre.currentNumber.textContent = lacreAtual || 'Nenhum';
      ui.modal.lacre.displayArea.classList.remove('hidden');
      ui.modal.lacre.editArea.classList.add('hidden');
      ui.modal.btnAcaoPrincipal.disabled = true; // Desabilita o check-in por padrão

      if (!lacreAtual) {
        // Se não tem lacre, força o cadastro
        ui.modal.lacre.displayArea.classList.add('hidden');
        ui.modal.lacre.editArea.classList.remove('hidden');
      } 

      // Limpa listeners antigos para evitar duplicação
      const novoBtnSim = ui.modal.lacre.btnSim.cloneNode(true);
      ui.modal.lacre.btnSim.parentNode.replaceChild(novoBtnSim, ui.modal.lacre.btnSim);
      ui.modal.lacre.btnSim = novoBtnSim;

      const novoBtnNao = ui.modal.lacre.btnNao.cloneNode(true);
      ui.modal.lacre.btnNao.parentNode.replaceChild(novoBtnNao, ui.modal.lacre.btnNao);
      ui.modal.lacre.btnNao = novoBtnNao;

      const novoBtnSave = ui.modal.lacre.btnSave.cloneNode(true);
      ui.modal.lacre.btnSave.parentNode.replaceChild(novoBtnSave, ui.modal.lacre.btnSave);
      ui.modal.lacre.btnSave = novoBtnSave;

      // Adiciona novos listeners
      ui.modal.lacre.btnSim.addEventListener('click', () => {
        lacreVerificado = true;
        ui.modal.btnAcaoPrincipal.disabled = false;
        showOpPopup('Lacre Verificado', 'Pode prosseguir com o check-in.', { mode: 'success', autoCloseMs: 1500 });
      });

      ui.modal.lacre.btnNao.addEventListener('click', () => {
        ui.modal.lacre.displayArea.classList.add('hidden');
        ui.modal.lacre.editArea.classList.remove('hidden');
      });

      ui.modal.lacre.btnSave.addEventListener('click', async () => {
        const novoLacre = ui.modal.lacre.newInput.value.trim();
        if (!novoLacre) {
          showOpPopup('Erro', 'O número do lacre não pode ser vazio.', { mode: 'error' });
          return;
        }

        try {
          await apiFetch(`/proprietarios/${proprietario.id}/lacre`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero_lacre: novoLacre })
          });

          // Atualiza o item local para refletir a mudança
          item.proprietario.numero_lacre = novoLacre;
          ui.modal.lacre.currentNumber.textContent = novoLacre;
          lacreVerificado = true;
          ui.modal.btnAcaoPrincipal.disabled = false;
          ui.modal.lacre.displayArea.classList.remove('hidden');
          ui.modal.lacre.editArea.classList.add('hidden');
          showOpPopup('Sucesso', 'Lacre atualizado. Pode prosseguir.', { mode: 'success', autoCloseMs: 2000 });

        } catch (err) {
          showOpPopup('Erro ao Salvar', err.message, { mode: 'error' });
        }
      });
    }

    function renderizarResultados(resultados){
      hideLoadingSkeleton();
      ui.listaResultados.innerHTML = '';
      if(!resultados.length){
        ui.mensagemStatus.textContent = 'Nenhum resultado encontrado.';
        return;
      }

      // Ordena por nome (compatível com proprietários diretos ou dados de controle de acesso)
      resultados.sort((a,b)=> {
        const nomeA = (a.proprietario?.nome_completo || a.nome_completo || '');
        const nomeB = (b.proprietario?.nome_completo || b.nome_completo || '');
        return nomeA.localeCompare(nomeB);
      });

      resultados.forEach(item => {
        // Detectar se é dado de proprietário direto ou de controle de acesso
        const isProprietarioDireto = !item.proprietario;
        const proprietarioData = isProprietarioDireto ? item : item.proprietario;
        const bicicletaData = item.bicicleta;
        
        const status = bicicletaData?.status || item.status || (item.registro_entrada_atual || bicicletaData?.open_registro_id ? 'DENTRO' : (bicicletaData?.id ? 'FORA' : 'SEM_BICICLETA'));
        const foto = proprietarioData?.foto_proprietario_url || 'imagens/image.png';
        const nome = proprietarioData?.nome_completo || '-';
        const cpf = proprietarioData?.cpf || '-';
        const contatoRaw = proprietarioData?.contato || '';
        const contatoDigits = String(contatoRaw||'').replace(/\D+/g,'');
        const brDigits = contatoDigits.length === 11 ? contatoDigits : (contatoDigits.length === 10 ? ('9'+contatoDigits) : contatoDigits);
        const waLink = brDigits ? `https://wa.me/55${brDigits}` : '';
        function fmtPhone(pt){ const d=String(pt||'').replace(/\D+/g,''); if(d.length>=11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`; if(d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6,10)}`; if(d.length===9) return `${d.slice(0,5)}-${d.slice(5,9)}`; return pt||''; }
        const contatoFmt = fmtPhone(contatoRaw);
        const bikeMarca = bicicletaData?.marca || 'Não cadastrada';
        const bikeModelo = bicicletaData?.modelo || '';
        const numeroId = bicicletaData?.numero_identificacao || 'Sem ID';
        const badgeClass = status === 'DENTRO' ? 'status-dentro' : (status === 'FORA' ? 'status-fora' : 'status-neutro');

        const card = document.createElement('div');
        card.className = 'resultado-card';
        card.innerHTML = `
          <div class="card-header">
            <img src="${foto}" alt="Foto do Proprietário" class="card-foto" />
            <div class="card-info-proprietario">
              <h3>${escapeHtml(nome)}</h3>
              <p>CPF: ${escapeHtml(cpf)}</p>
              ${contatoFmt ? `<p>Celular: ${escapeHtml(contatoFmt)} ${waLink?`<a class="btn btn-ghost" href="${waLink}" target="_blank" rel="noopener" title="WhatsApp">Whats</a>`:''}</p>` : ''}
            </div>
          </div>
          <div class="card-body">
            <p><strong>Bicicleta:</strong> ${escapeHtml(bikeMarca)} ${escapeHtml(bikeModelo)}</p>
          </div>
          <div class="card-footer">
            <p><strong>ID da Bike:</strong> ${escapeHtml(numeroId)}</p>
            ${proprietarioData?.numero_lacre ? `<p><strong>Lacre:</strong> ${escapeHtml(proprietarioData.numero_lacre)}</p>` : ''}
            <span class="status-badge ${badgeClass}">${escapeHtml(status)}</span>
          </div>
        `;
        card.addEventListener('click', ()=> abrirModal(item));
        ui.listaResultados.appendChild(card);
      });
    }

    // Inicializa controle de arquivo customizado
    function initFileControl(inputId, buttonId, nameId, tipo, proprietarioId){
      const inputOld = document.getElementById(inputId);
      if(!inputOld) return;
      const input = inputOld.cloneNode(true);
      inputOld.parentNode.replaceChild(input, inputOld);
      const btn = document.getElementById(buttonId);
      const nameEl = document.getElementById(nameId);
      const container = (btn && btn.closest('.file-control')) || (nameEl && nameEl.parentElement);
      if(btn){ btn.onclick = ()=> input.click(); }
      input.addEventListener('change', ()=>{
        const file = input.files && input.files[0];
        if(nameEl){
          nameEl.textContent = file ? file.name : 'Nenhum arquivo';
          nameEl.title = file ? file.name : '';
        }
        if(container){ container.classList.toggle('has-file', !!file); }
        uploadFotoProprietario(proprietarioId, input.files?.[0], tipo);
      });
    }

    function abrirModal(item){
      itemAtivoNoModal = item;
      isModalOpen = true;
      lastFocusedEl = document.activeElement;
      
      // Detectar se é dado de proprietário direto ou de controle de acesso
      const isProprietarioDireto = !item.proprietario;
      const proprietarioData = isProprietarioDireto ? item : item.proprietario;
      const bicicletaData = item.bicicleta;
      
      // Priorizar status da bicicleta
      const status = bicicletaData?.status || item.status || (item.registro_entrada_atual || bicicletaData?.open_registro_id ? 'DENTRO' : (bicicletaData?.id ? 'FORA' : 'SEM_BICICLETA'));
      const nome = proprietarioData?.nome_completo || '-';
      const cpf = proprietarioData?.cpf || '-';
      const bikeMarca = bicicletaData?.marca || '-';
      const bikeModelo = bicicletaData?.modelo || '';
      const numeroId = bicicletaData?.numero_identificacao || '-';

      if(ui.modal.titulo) ui.modal.titulo.textContent = `Ação para: ${nome}`;
      if(ui.modal.nomeProprietario) setTextAndTooltip(ui.modal.nomeProprietario, `${nome} (CPF: ${cpf})`);
      if(ui.modal.infoBicicleta) setTextAndTooltip(ui.modal.infoBicicleta, `${bikeMarca} ${bikeModelo} (ID: ${numeroId})`);

      atualizarStatusModal(status);

      // Recriar botão para limpar listeners antigos
      const novoBtn = ui.modal.btnAcaoPrincipal.cloneNode(true);
      ui.modal.btnAcaoPrincipal.parentNode.replaceChild(novoBtn, ui.modal.btnAcaoPrincipal);
      ui.modal.btnAcaoPrincipal = novoBtn;
      ui.modal.btnAcaoPrincipal.addEventListener('click', executarAcaoPrincipal);

      // Fotos
      if (ui.modal.fotoPrincipal) ui.modal.fotoPrincipal.src = proprietarioData?.foto_proprietario_url || 'imagens/image.png';
      if (ui.modal.fotoExtra) ui.modal.fotoExtra.src = proprietarioData?.foto_proprietario_extra_url || 'imagens/avatar-placeholder.png';

      // Local (bicicletário)
      popularLocais();
      if (ui.modal.selectLocal) {
        const ultimoLocal = localStorage.getItem('ultimo_local_bicicletario') || 'Japeri';
        ui.modal.selectLocal.value = ultimoLocal;
        ui.modal.selectLocal.onchange = ()=> localStorage.setItem('ultimo_local_bicicletario', ui.modal.selectLocal.value);
      }

      // Data/hora da operação (automática) + timer ao vivo
      if (ui.modal.dataHoraEl) ui.modal.dataHoraEl.textContent = formatarDataHora(new Date());
      if (dataHoraTimer) { clearInterval(dataHoraTimer); dataHoraTimer = null; }
      dataHoraTimer = setInterval(()=>{
        if (ui.modal.dataHoraEl) ui.modal.dataHoraEl.textContent = formatarDataHora(new Date());
      }, 1000);

      // Limpa observações
      if (ui.modal.obsNormal) ui.modal.obsNormal.value = '';
      if (ui.modal.obsOcorrencia) ui.modal.obsOcorrencia.value = '';
      // Gerencia a lógica de verificação do lacre
      gerenciarLogicaLacre(item);

      // Carregar todas as bicicletas do proprietário e permitir seleção
      const proprietarioId = isProprietarioDireto ? item.id : item.proprietario?.id;
      carregarBicicletas(proprietarioId, bicicletaData?.id);

      setBackgroundInert(true);
      ui.modal.overlay && ui.modal.overlay.classList.add('visivel');
      // foco inicial (primeiro focável no conteúdo ou o próprio conteúdo)
      setTimeout(()=>{
        const focusables = getFocusableElements(ui.modal.contentEl);
        if(focusables.length){ focusables[0].focus(); }
        else if(ui.modal.contentEl){ ui.modal.contentEl.focus(); }
      }, 0);

      // Rebind uploaders (custom file picker com nome do arquivo)
      initFileControl('uploadFotoPrincipal','btnPickFotoPrincipal','nomeFotoPrincipal','principal', item.proprietario?.id);
      initFileControl('uploadFotoExtra','btnPickFotoExtra','nomeFotoExtra','extra', item.proprietario?.id);

      // Lightbox: abrir ao clicar nas fotos
      setupLightboxHandlers();

      // Controles da seção "Adicionar Bicicleta" serão inicializados mais abaixo

      // ==============================
      // Adicionar Bicicleta (no modal): Tipo→Marca→Modelo + Gerar ID
      // ==============================
      let addBikeControlsReady = false;
      let addCatalog = null;
      const addCatalogFallback = {
        'Mountain Bike': { 'Caloi': ['Elite','Explorer Sport','Explorer EVO SL'], 'Oggi': ['Big Wheel 7.3 2025'] },
        'Speed': { 'Oggi': ['Cadenza 500 2025'], 'Specialized': ['Tarmac'] },
        'Urbana': { 'Caloi': ['SUPRA'], 'GTS': ['City'] },
        'Elétrica': { 'Caloi': ['E-Vibe Explorer'], 'Oggi': ['E-Bike Big Wheel 8.0 2025'] },
        'Dobrável': { 'Blitz': ['Compact'] },
        'Infantil': { 'Caloi': ['Ceci (16/20/24/26)'] }
      };
      function norm(s){ return (s||'').toLowerCase(); }
      function resetSelect(sel, placeholder, disabled=true){ if(!sel) return; sel.innerHTML=''; sel.appendChild(new Option(placeholder,'')); if(disabled) sel.setAttribute('disabled',''); else sel.removeAttribute('disabled'); }
      function aplicarFiltroSelect(selectEl, base, query, placeholder, incluirOutro){
        if(!selectEl) return; resetSelect(selectEl, placeholder, false);
        const q = norm(query); const lista = q ? base.filter(v => norm(v).includes(q)) : base;
        lista.forEach(v => selectEl.appendChild(new Option(v, v)));
        if(incluirOutro) selectEl.appendChild(new Option('Outro','Outro'));
      }
      function habilitarBusca(el, enabled){ if(!el) return; if(enabled){ el.removeAttribute('disabled'); } else { el.setAttribute('disabled',''); el.value=''; } }
      function habilitarClear(btn, enabled){ if(!btn) return; if(enabled){ btn.removeAttribute('disabled'); } else { btn.setAttribute('disabled',''); } }
      async function carregarAddCatalog(){
        addCatalog = addCatalogFallback;
        try {
          const resp = await fetch('data/catalogo-bikes.json', { cache: 'no-store' });
          if(resp.ok){ const data = await resp.json().catch(()=>null); if(data && typeof data==='object') addCatalog = data; }
        } catch(_){}
      }
      let novoCurrentMarcas = [], novoCurrentModelos = [];
      function popularMarcasPorTipoNovo(tipo){
        const marcaSel = document.getElementById('novoMarca');
        const modeloSel = document.getElementById('novoModelo');
        const marcaSearch = document.getElementById('novoMarcaSearch');
        const marcaClear = document.getElementById('novoMarcaClear');
        const modeloSearch = document.getElementById('novoModeloSearch');
        const modeloClear = document.getElementById('novoModeloClear');
        const marcaOutroWrap = document.getElementById('novoMarcaOutroWrap');
        const modeloOutroWrap = document.getElementById('novoModeloOutroWrap');
        const marcaOutro = document.getElementById('novoMarcaOutro');
        const modeloOutro = document.getElementById('novoModeloOutro');
        resetSelect(marcaSel, 'Selecione a Marca', true);
        resetSelect(modeloSel, 'Selecione o Modelo', true);
        const mapa = addCatalog && addCatalog[tipo] ? addCatalog[tipo] : null;
        if(!mapa){ habilitarBusca(marcaSearch,false); habilitarClear(marcaClear,false); habilitarBusca(modeloSearch,false); habilitarClear(modeloClear,false); return; }
        novoCurrentMarcas = Object.keys(mapa).sort();
        novoCurrentMarcas.forEach(m => marcaSel.appendChild(new Option(m,m)));
        marcaSel.appendChild(new Option('Outro','Outro'));
        marcaSel.removeAttribute('disabled');
        habilitarBusca(marcaSearch,true); habilitarClear(marcaClear,true);
        habilitarBusca(modeloSearch,false); habilitarClear(modeloClear,false);
        if(marcaOutroWrap){ marcaOutroWrap.classList.add('hidden'); if(marcaOutro) marcaOutro.removeAttribute('required'); }
        if(modeloOutroWrap){ modeloOutroWrap.classList.add('hidden'); if(modeloOutro) modeloOutro.removeAttribute('required'); }
      }
      function popularModelosPorMarcaNovo(tipo, marca){
        const modeloSel = document.getElementById('novoModelo');
        const modeloSearch = document.getElementById('novoModeloSearch');
        const modeloClear = document.getElementById('novoModeloClear');
        const modeloOutroWrap = document.getElementById('novoModeloOutroWrap');
        const modeloOutro = document.getElementById('novoModeloOutro');
        resetSelect(modeloSel, 'Selecione o Modelo', true);
        const entry = (addCatalog && addCatalog[tipo]) ? addCatalog[tipo][marca] : [];
        let modelos = [];
        if(Array.isArray(entry)) modelos = entry;
        else if(entry && Array.isArray(entry.models)) modelos = entry.models;
        else if(entry && entry.lines && typeof entry.lines==='object') modelos = Object.values(entry.lines).flat();
        novoCurrentModelos = (modelos || []).slice();
        novoCurrentModelos.forEach(md => modeloSel.appendChild(new Option(md, md)));
        modeloSel.appendChild(new Option('Outro','Outro'));
        modeloSel.removeAttribute('disabled');
        habilitarBusca(modeloSearch,true); habilitarClear(modeloClear,true);
        if(modeloOutroWrap){ modeloOutroWrap.classList.add('hidden'); if(modeloOutro) modeloOutro.removeAttribute('required'); }
      }
      function setupAddBikeControlsOnce(){
        if(addBikeControlsReady) return;
        addBikeControlsReady = true;
        // Inicializa dependentes via módulo compartilhado (novo*)
        try {
          if (window.CatalogoBikesUI) {
            CatalogoBikesUI.loadCatalog();
            CatalogoBikesUI.setupDependentSelects({
              tipoSel: '#novoTipoBike',
              marcaSel: '#novoMarca',
              modeloSel: '#novoModelo',
              marcaSearch: '#novoMarcaSearch',
              modeloSearch: '#novoModeloSearch',
              marcaClear: '#novoMarcaClear',
              modeloClear: '#novoModeloClear',
              marcaOutroWrap: '#novoMarcaOutroWrap',
              modeloOutroWrap: '#novoModeloOutroWrap',
              marcaOutroInput: '#novoMarcaOutro',
              modeloOutroInput: '#novoModeloOutro',
              marcaSuggestions: '#novoMarcaSuggestions',
              modeloSuggestions: '#novoModeloSuggestions',
              includeOutroOption: true,
              includeLinhaFilter: false
            });
          }
        } catch(_){}
        // Desativa lógica legada (mantida como fallback)
        if(false){
        // Carregar catálogo
        carregarAddCatalog();
        // Tipo change
        const tipoSel = document.getElementById('novoTipoBike');
        const marcaSel = document.getElementById('novoMarca');
        const modeloSel = document.getElementById('novoModelo');
        const marcaSearch = document.getElementById('novoMarcaSearch');
        const modeloSearch = document.getElementById('novoModeloSearch');
        const marcaClear = document.getElementById('novoMarcaClear');
        const modeloClear = document.getElementById('novoModeloClear');
        const marcaOutroWrap = document.getElementById('novoMarcaOutroWrap');
        const modeloOutroWrap = document.getElementById('novoModeloOutroWrap');
        const marcaOutro = document.getElementById('novoMarcaOutro');
        const modeloOutro = document.getElementById('novoModeloOutro');
        if(tipoSel){
          tipoSel.addEventListener('change', ()=>{
            const tipo = tipoSel.value;
            if(!tipo){ resetSelect(marcaSel,'Selecione a Marca',true); resetSelect(modeloSel,'Selecione o Modelo',true); habilitarBusca(marcaSearch,false); habilitarClear(marcaClear,false); habilitarBusca(modeloSearch,false); habilitarClear(modeloClear,false); if(marcaOutroWrap){ marcaOutroWrap.classList.add('hidden'); marcaOutro && marcaOutro.removeAttribute('required'); } if(modeloOutroWrap){ modeloOutroWrap.classList.add('hidden'); modeloOutro && modeloOutro.removeAttribute('required'); } return; }
            if(tipo==='Outro'){
              resetSelect(marcaSel,'Selecione a Marca',true); resetSelect(modeloSel,'Selecione o Modelo',true);
              habilitarBusca(marcaSearch,false); habilitarClear(marcaClear,false); habilitarBusca(modeloSearch,false); habilitarClear(modeloClear,false);
              if(marcaOutroWrap){ marcaOutroWrap.classList.remove('hidden'); marcaOutro && marcaOutro.setAttribute('required',''); }
              if(modeloOutroWrap){ modeloOutroWrap.classList.remove('hidden'); modeloOutro && modeloOutro.setAttribute('required',''); }
              return;
            }
            if(marcaOutroWrap){ marcaOutroWrap.classList.add('hidden'); marcaOutro && marcaOutro.removeAttribute('required'); }
            if(modeloOutroWrap){ modeloOutroWrap.classList.add('hidden'); modeloOutro && modeloOutro.removeAttribute('required'); }
            popularMarcasPorTipoNovo(tipo);
          });
        }
        if(marcaSel){
          marcaSel.addEventListener('change', ()=>{
            const tipo = tipoSel ? tipoSel.value : '';
            const marca = marcaSel.value;
            if(!tipo || !marca){ resetSelect(modeloSel,'Selecione o Modelo',true); if(modeloOutroWrap){ modeloOutroWrap.classList.add('hidden'); modeloOutro && modeloOutro.removeAttribute('required'); } habilitarBusca(modeloSearch,false); habilitarClear(modeloClear,false); return; }
            if(marca==='Outro'){
              resetSelect(modeloSel,'Selecione o Modelo',true); habilitarBusca(modeloSearch,false); habilitarClear(modeloClear,false);
              if(marcaOutroWrap){ marcaOutroWrap.classList.remove('hidden'); marcaOutro && marcaOutro.setAttribute('required',''); }
              if(modeloOutroWrap){ modeloOutroWrap.classList.remove('hidden'); modeloOutro && modeloOutro.setAttribute('required',''); }
              return;
            }
            if(marcaOutroWrap){ marcaOutroWrap.classList.add('hidden'); marcaOutro && marcaOutro.removeAttribute('required'); }
            popularModelosPorMarcaNovo(tipo, marca);
            if(modeloOutroWrap){ modeloOutroWrap.classList.add('hidden'); modeloOutro && modeloOutro.removeAttribute('required'); }
          });
        }
        if(marcaSearch){ marcaSearch.addEventListener('input', ()=>{ if(marcaSel.hasAttribute('disabled')) return; aplicarFiltroSelect(marcaSel, novoCurrentMarcas, marcaSearch.value, 'Selecione a Marca', true); }); }
        if(modeloSearch){ modeloSearch.addEventListener('input', ()=>{ if(modeloSel.hasAttribute('disabled')) return; aplicarFiltroSelect(modeloSel, novoCurrentModelos, modeloSearch.value, 'Selecione o Modelo', true); }); }
        if(marcaClear){ marcaClear.addEventListener('click', ()=>{ marcaSearch.value=''; aplicarFiltroSelect(marcaSel, novoCurrentMarcas, '', 'Selecione a Marca', true); }); }
        if(modeloClear){ modeloClear.addEventListener('click', ()=>{ modeloSearch.value=''; aplicarFiltroSelect(modeloSel, novoCurrentModelos, '', 'Selecione o Modelo', true); }); }
        } // fim lógica legada
        // Gerar ID e uppercase
        const novoNumEl = document.getElementById('novoNumeroBike');
        const btnGerar = document.getElementById('btnGerarNovoNumero');
        function gerarCodigoAlfaId(){ const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let s=''; for(let i=0;i<14;i++){ s+=chars.charAt(Math.floor(Math.random()*chars.length)); } return 'JPR-'+s; }
        if(novoNumEl){ novoNumEl.addEventListener('input', ()=>{ novoNumEl.value = (novoNumEl.value||'').toUpperCase(); }); novoNumEl.addEventListener('blur', ()=>{ novoNumEl.value = (novoNumEl.value||'').toUpperCase(); }); }
        if(btnGerar && novoNumEl){ btnGerar.addEventListener('click', ()=>{ novoNumEl.value = gerarCodigoAlfaId(); novoNumEl.dispatchEvent(new Event('input')); }); }
      }

      // Inicializa os controles assim que forem definidos e o modal estiver aberto
      setupAddBikeControlsOnce();

      // Botão Editar Proprietário -> abre ficha_proprietario.html com cache
      if (ui.modal.btnEditarProprietario) {
        ui.modal.btnEditarProprietario.onclick = ()=>{
          const pid = item.proprietario?.id;
          if (!pid) return;
          try {
            // Monta um cache leve para a ficha (evita 1a chamada lenta)
            const cacheRaw = sessionStorage.getItem('ficha_proprietario_cache');
            const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
            cache[String(pid)] = {
              proprietario: item.proprietario || null,
              bicicleta: item.bicicleta || null,
              bicicletas: null // será preenchido pela própria página, se necessário
            };
            sessionStorage.setItem('ficha_proprietario_cache', JSON.stringify(cache));
          } catch(_){}
          const bikeId = (item.bicicleta && item.bicicleta.id) || '';
          const url = `ficha_proprietario.html?id=${encodeURIComponent(pid)}${bikeId?`&bike=${encodeURIComponent(bikeId)}`:''}`;
          window.location.href = url;
        };
      }

      // Botão Adicionar Bicicleta
      const btnAddBike = document.getElementById('btnAdicionarBikeModal');
      if (btnAddBike) {
        btnAddBike.onclick = async ()=>{
          const pid = item.proprietario?.id;
          setupAddBikeControlsOnce();
          const numero = (document.getElementById('novoNumeroBike')?.value || '').trim().toUpperCase();
          const tipoSel = document.getElementById('novoTipoBike');
          const marcaSel = document.getElementById('novoMarca');
          const modeloSel = document.getElementById('novoModelo');
          const marcaOutroEl = document.getElementById('novoMarcaOutro');
          const modeloOutroEl = document.getElementById('novoModeloOutro');
          const tipo = (tipoSel?.value || '').trim();
          let marca = (marcaSel?.value || '').trim();
          let modelo = (modeloSel?.value || '').trim();
          if(tipo==='Outro' || marca==='Outro') marca = (marcaOutroEl?.value || '').trim();
          if(tipo==='Outro' || marca==='Outro' || modelo==='Outro') modelo = (modeloOutroEl?.value || '').trim();
          const obs = document.getElementById('novoObsBike')?.value?.trim();
          const fotoBike = document.getElementById('uploadFotoBike')?.files?.[0] || null;
          const fotoDono = document.getElementById('uploadFotoDonoComBike')?.files?.[0] || null;
          if(!pid){ alert('Proprietário inválido.'); return; }
          if(!numero || !marca || !modelo){ alert('Preencha Número da Bike, Marca e Modelo.'); return; }
          try {
            // Envia JSON em vez de FormData (upload de fotos desabilitado temporariamente)
            const payload = {
              proprietario_id: String(pid),
              numero_bike: numero,
              tipo_bike: tipo || '',
              marca: marca,
              modelo: modelo,
              cor: '', // TODO: adicionar campo cor no formulário
              observacoes: obs || ''
            };
            const token = getToken();
            const url = API_BASE + '/bicicletas';
            const headers = {
              'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = 'Bearer ' + token;
            const resp = await fetch(url, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(()=>null);
            if(!resp.ok){ throw new Error((data && (data.erro||data.message)) || ('HTTP ' + resp.status)); }
            alert('Bicicleta adicionada com sucesso!');
            // limpa campos
            ['novoNumeroBike','novoMarca','novoModelo','novoMarcaSearch','novoModeloSearch','novoMarcaOutro','novoModeloOutro','novoTipoBike','novoObsBike'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
            // Reset selects
            resetSelect(document.getElementById('novoMarca'),'Selecione a Marca', true);
            resetSelect(document.getElementById('novoModelo'),'Selecione o Modelo', true);
            const marcaOutroWrap = document.getElementById('novoMarcaOutroWrap');
            const modeloOutroWrap = document.getElementById('novoModeloOutroWrap');
            if(marcaOutroWrap) marcaOutroWrap.classList.add('hidden');
            if(modeloOutroWrap) modeloOutroWrap.classList.add('hidden');
            if (document.getElementById('uploadFotoBike')) document.getElementById('uploadFotoBike').value='';
            if (document.getElementById('uploadFotoDonoComBike')) document.getElementById('uploadFotoDonoComBike').value='';
            // recarrega a lista e seleciona a nova
            const newId = data && data.bicicleta ? data.bicicleta.id : null;
            await carregarBicicletas(pid, newId);
          } catch(err){
            alert('Falha ao adicionar bicicleta: ' + err.message);
          }
        };
      }
    }

    function atualizarStatusModal(status){
      const estaDentro = status === 'DENTRO';
      const semBike = status === 'SEM_BICICLETA';
      if(ui.modal.statusAtual){
        ui.modal.statusAtual.textContent = status;
        ui.modal.statusAtual.className = `status-badge ${estaDentro ? 'status-dentro' : (semBike ? 'status-neutro' : 'status-fora')}`;
      }
      if(ui.modal.btnAcaoPrincipal){
        if(semBike){
          ui.modal.btnAcaoPrincipal.textContent = 'Sem Bicicleta';
          ui.modal.btnAcaoPrincipal.disabled = true;
          ui.modal.btnAcaoPrincipal.className = 'btn btn-secundario';
        } else {
          ui.modal.btnAcaoPrincipal.textContent = estaDentro ? 'Confirmar Check-out' : 'Confirmar Check-in';
          ui.modal.btnAcaoPrincipal.disabled = false;
          ui.modal.btnAcaoPrincipal.className = `btn ${estaDentro ? 'btn-perigo' : 'btn-sucesso'}`;
        }
      }
    }

    async function executarAcaoPrincipal(){
      if(!itemAtivoNoModal) return;
      // Priorizar status da bicicleta
      const status = itemAtivoNoModal.bicicleta?.status || itemAtivoNoModal.status || (itemAtivoNoModal.registro_entrada_atual || itemAtivoNoModal.bicicleta?.open_registro_id ? 'DENTRO' : (itemAtivoNoModal.bicicleta?.id ? 'FORA' : 'SEM_BICICLETA'));
      const estaDentro = status === 'DENTRO';

      try {
        if(estaDentro){
          // Checkout requer controle_acesso_id
          const controleId = itemAtivoNoModal._selectedOpenRegistroId || itemAtivoNoModal.registro_entrada_atual?.id;
          if(!controleId){
            const nome = itemAtivoNoModal.proprietario?.nome_completo || '-';
            const cpf = itemAtivoNoModal.proprietario?.cpf || '';
            const numeroId = itemAtivoNoModal.bicicleta?.numero_identificacao || String(itemAtivoNoModal.bicicleta?.id || '');
            const details = `
              <div class="op-detail-row"><strong>Proprietário:</strong> ${escapeHtml(nome)} ${cpf?`(CPF: ${escapeHtml(cpf)})`:''}</div>
              <div class="op-detail-row"><strong>Bicicleta:</strong> ${escapeHtml(numeroId || '-')}</div>`;
            showOpPopup('Falha no Checkout', 'Registro de entrada ativo não encontrado.', { mode: 'error', detailsHtml: details, autoCloseMs: 3200 });
            return;
          }

          const body = {
            local: ui.modal.selectLocal ? ui.modal.selectLocal.value : 'Japeri',
            observacoes_saida: ui.modal.obsNormal ? ui.modal.obsNormal.value : '',
            observacao_geral: ui.modal.obsOcorrencia ? ui.modal.obsOcorrencia.value : ''
          };
          await apiFetch('/controle-acesso/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              controle_acesso_id: controleId,
              ...body
            })
          });
          // Sucesso: mostrar popup de checkout
          // Captura o contexto ANTES de fechar o modal
          const ctx = itemAtivoNoModal;
          fecharModal();
          const nome = ctx?.proprietario?.nome_completo || '-';
          const cpf = ctx?.proprietario?.cpf || '';
          const marca = ctx?.bicicleta?.marca || '';
          const modelo = ctx?.bicicleta?.modelo || '';
          const numeroId = ctx?.bicicleta?.numero_identificacao || String(ctx?.bicicleta?.id || '');
          const local = (ui.modal.selectLocal && ui.modal.selectLocal.value) || 'Japeri';
          const details = `
            <div class="op-detail-row"><strong>Proprietário:</strong> ${escapeHtml(nome)} ${cpf?`(CPF: ${escapeHtml(cpf)})`:''}</div>
            <div class="op-detail-row"><strong>Bicicleta:</strong> ${escapeHtml([marca,modelo].filter(Boolean).join(' ') || '-') } (ID: ${escapeHtml(numeroId || '-')})</div>
            <div class="op-detail-row"><strong>Local:</strong> ${escapeHtml(local)}</div>
            <div class="op-detail-row"><strong>Data/Hora:</strong> ${escapeHtml(formatarDataHora(new Date()))}</div>`;
          showOpPopup('Checkout Realizado!', 'A sua saída foi registrada com sucesso.', { mode: 'success', detailsHtml: details, autoCloseMs: 2600 });
        } else {
          // Checkin requer bicicleta_id, proprietario_id, local
          const bicicletaId = itemAtivoNoModal.bicicleta?.id;
          const proprietarioId = itemAtivoNoModal.proprietario?.id;
          if(!bicicletaId || !proprietarioId){
            const nome = itemAtivoNoModal.proprietario?.nome_completo || '-';
            const cpf = itemAtivoNoModal.proprietario?.cpf || '';
            const details = `
              <div class="op-detail-row"><strong>Proprietário:</strong> ${escapeHtml(nome)} ${cpf?`(CPF: ${escapeHtml(cpf)})`:''}</div>`;
            showOpPopup('Falha no Check-in', 'Dados de bicicleta/proprietário ausentes.', { mode: 'error', detailsHtml: details, autoCloseMs: 3200 });
            return;
          }
          // Verificar se o lacre foi confirmado
          if (!lacreVerificado) {
            showOpPopup('Verificação Pendente', 'Você precisa verificar o lacre antes de continuar com o check-in.', { mode: 'error', autoCloseMs: 2400 });
            return;
          }
          // Buscar número do lacre do proprietário (já foi salvo quando clicou em "Sim" ou "Salvar")
          const lacreProprietario = itemAtivoNoModal.proprietario?.numero_lacre || '';
          const lacre = String(lacreProprietario).replace(/\D+/g, ''); // mantém apenas dígitos
          
          console.log('🔍 Debug Check-in:', {
            lacreVerificado,
            lacreProprietario,
            lacre,
            proprietario: itemAtivoNoModal.proprietario
          });
          
          if(!lacre){
            const nome = itemAtivoNoModal.proprietario?.nome_completo || '-';
            const cpf = itemAtivoNoModal.proprietario?.cpf || '';
            const details = `
              <div class="op-detail-row"><strong>Proprietário:</strong> ${escapeHtml(nome)} ${cpf?`(CPF: ${escapeHtml(cpf)})`:''}</div>
              <div class="op-detail-row"><strong>Debug:</strong> lacreVerificado=${lacreVerificado}, lacre do proprietário="${lacreProprietario}"</div>`;
            showOpPopup('Falha no Check-in', 'Informe o número do lacre antes de confirmar.', { mode: 'error', detailsHtml: details, autoCloseMs: 4000 });
            return;
          }
          
          const body = {
            local: ui.modal.selectLocal ? ui.modal.selectLocal.value : 'Japeri',
            observacoes_entrada: ui.modal.obsNormal ? ui.modal.obsNormal.value : '',
            observacao_geral: ui.modal.obsOcorrencia ? ui.modal.obsOcorrencia.value : '',
            numero_lacre: lacre
          };
          
          await apiFetch('/controle-acesso/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bicicleta_id: bicicletaId,
              proprietario_id: proprietarioId,
              ...body
            })
          });
          // Sucesso: mostrar popup de check-in
          // Captura o contexto ANTES de fechar o modal
          const ctx2 = itemAtivoNoModal;
          fecharModal();
          const nome2 = ctx2?.proprietario?.nome_completo || '-';
          const cpf2 = ctx2?.proprietario?.cpf || '';
          const marca2 = ctx2?.bicicleta?.marca || '';
          const modelo2 = ctx2?.bicicleta?.modelo || '';
          const numeroId2 = ctx2?.bicicleta?.numero_identificacao || String(ctx2?.bicicleta?.id || '');
          const local2 = (ui.modal.selectLocal && ui.modal.selectLocal.value) || 'Japeri';
          const details2 = `
            <div class="op-detail-row"><strong>Proprietário:</strong> ${escapeHtml(nome2)} ${cpf2?`(CPF: ${escapeHtml(cpf2)})`:''}</div>
            <div class="op-detail-row"><strong>Bicicleta:</strong> ${escapeHtml([marca2,modelo2].filter(Boolean).join(' ') || '-') } (ID: ${escapeHtml(numeroId2 || '-')})</div>
            <div class="op-detail-row"><strong>Local:</strong> ${escapeHtml(local2)}</div>
            <div class="op-detail-row"><strong>Data/Hora:</strong> ${escapeHtml(formatarDataHora(new Date()))}</div>`;
          showOpPopup('Check-in Concluído!', 'O seu acesso foi registrado com sucesso. Bem-vindo!', { mode: 'success', detailsHtml: details2, autoCloseMs: 2600 });
        }
        realizarBusca(); // Atualiza resultados
      } catch(err){
        if(err.status === 401 || err.status === 403){
          showOpPopup('Sessão expirada', 'Faça login novamente para continuar.', { mode: 'error', autoCloseMs: 1400 });
          setTimeout(()=>{ window.location.href = 'login.html'; }, 1400);
          return;
        }
        const nome = itemAtivoNoModal?.proprietario?.nome_completo || '';
        const cpf = itemAtivoNoModal?.proprietario?.cpf || '';
        const details = nome ? `<div class="op-detail-row"><strong>Proprietário:</strong> ${escapeHtml(nome)} ${cpf?`(CPF: ${escapeHtml(cpf)})`:''}</div>` : '';
        showOpPopup('Erro na operação', err.message || 'Tente novamente.', { mode: 'error', detailsHtml: details, autoCloseMs: 3200 });
      }
    }

    function fecharModal(){
      ui.modal.overlay && ui.modal.overlay.classList.remove('visivel');
      setBackgroundInert(false);
      closeLightbox();
      if (dataHoraTimer) { clearInterval(dataHoraTimer); dataHoraTimer = null; }
      itemAtivoNoModal = null;
      isModalOpen = false;
      // restaurar foco
      try { lastFocusedEl && lastFocusedEl.focus && lastFocusedEl.focus(); } catch(e){}
    }

    function escapeHtml(str){
      return String(str).replace(/[&<>"']/g, function(m){
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
      });
    }

    function setTextAndTooltip(el, text){
      if(!el) return; el.textContent = text; el.title = text;
    }

    function getFocusableElements(container){
      if(!container) return [];
      const selectors = [
        'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
        'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])'
      ];
      const nodes = Array.from(container.querySelectorAll(selectors.join(',')));
      return nodes.filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }

    function trapFocus(e){
      const focusables = getFocusableElements(ui.modal.contentEl);
      if(!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if(e.shiftKey){
        if(active === first || !ui.modal.contentEl.contains(active)){
          e.preventDefault();
          last.focus();
        }
      } else {
        if(active === last){
          e.preventDefault();
          first.focus();
        }
      }
    }

    function setBackgroundInert(inert){
      const header = document.getElementById('appHeader');
      const main = document.getElementById('appMain');
      [header, main].forEach(el => {
        if(!el) return;
        if(inert){
          el.setAttribute('aria-hidden','true');
          try { if('inert' in el) el.inert = true; } catch(e){}
          el.classList.add('inert-backdrop');
        } else {
          el.removeAttribute('aria-hidden');
          try { if('inert' in el) el.inert = false; } catch(e){}
          el.classList.remove('inert-backdrop');
        }
      });
    }

    // ---- Lightbox (visualização das fotos do proprietário) ----
    let lightboxOverlay = null, lightboxImg = null, lightboxCloseBtn = null;
    function ensureLightbox(){
      if(!lightboxOverlay){
        lightboxOverlay = document.createElement('div');
        lightboxOverlay.id = 'modalLightbox';
        lightboxOverlay.className = 'lightbox-overlay';
        lightboxOverlay.innerHTML = '<img class="lightbox-img" alt="" /><button class="lightbox-close" aria-label="Fechar">\u00D7</button>';
        document.body.appendChild(lightboxOverlay);
        lightboxImg = lightboxOverlay.querySelector('.lightbox-img');
        lightboxCloseBtn = lightboxOverlay.querySelector('.lightbox-close');
        lightboxOverlay.addEventListener('click', (ev)=>{ if(ev.target === lightboxOverlay) closeLightbox(); });
        lightboxCloseBtn.addEventListener('click', closeLightbox);
      }
      return lightboxOverlay;
    }
    function openLightbox(src, alt){
      const lb = ensureLightbox();
      if(lightboxImg){ lightboxImg.src = src || ''; lightboxImg.alt = alt || 'Foto'; }
      lb.classList.add('show');
    }
    function closeLightbox(){
      if(lightboxOverlay){ lightboxOverlay.classList.remove('show'); }
    }
    function setupLightboxHandlers(){
      if(ui.modal.fotoPrincipal){
        ui.modal.fotoPrincipal.onclick = ()=> openLightbox(ui.modal.fotoPrincipal.src, ui.modal.fotoPrincipal.alt || 'Foto do Proprietário');
      }
      if(ui.modal.fotoExtra){
        ui.modal.fotoExtra.onclick = ()=> openLightbox(ui.modal.fotoExtra.src, ui.modal.fotoExtra.alt || 'Foto Extra do Proprietário');
      }
    }

    // ---- Novas utilidades do modal ----
    function popularLocais(){
      if(!ui.modal.selectLocal) return;
      const opcoes = [
        { v: 'Japeri', t: 'Bicicletário de Japeri' },
        { v: 'Engenheiro Pedreira', t: 'Bicicletário de Engenheiro Pedreira' }
      ];
      ui.modal.selectLocal.innerHTML = opcoes.map(o=>`<option value="${escapeHtml(o.v)}">${escapeHtml(o.t)}</option>`).join('');
    }

    function formatarDataHora(d){
      try { return new Date(d).toLocaleString('pt-BR', { hour12: false }); } catch(e){ return new Date().toLocaleString('pt-BR'); }
    }

    async function carregarBicicletas(proprietarioId, bikeSelecionadaId){
      if(!proprietarioId || !ui.modal.listaBikesEl) return;
      ui.modal.listaBikesEl.innerHTML = 'Carregando bicicletas...';
      try {
        const arr = await apiFetch(`/proprietarios/${encodeURIComponent(proprietarioId)}/bicicletas`, { method: 'GET' });
        if(!Array.isArray(arr) || arr.length === 0){ ui.modal.listaBikesEl.innerHTML = '<em>Sem bicicletas cadastradas</em>'; return; }
        ui.modal.listaBikesEl.innerHTML = '';
        arr.forEach(b => {
          const status = b.status || (b.open_registro_id ? 'DENTRO' : 'FORA');
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = `bike-pill ${status==='DENTRO'?'inside':''}`;
          pill.dataset.bikeId = String(b.id);
          pill.dataset.openRegistroId = b.open_registro_id ? String(b.open_registro_id) : '';
          pill.innerHTML = `
            <span class="dot" aria-hidden="true"></span>
            <span class="bike-id">${escapeHtml(b.numero_identificacao || String(b.id))}</span>
            <span class="bike-modelo">${escapeHtml([b.marca,b.modelo].filter(Boolean).join(' ') || '')}</span>
          `;
          pill.addEventListener('click', ()=>{
            // marca selecionado
            Array.from(ui.modal.listaBikesEl.querySelectorAll('.bike-pill')).forEach(el=> el.classList.remove('selected'));
            pill.classList.add('selected');
            // atualiza contexto
            itemAtivoNoModal.bicicleta = { id: b.id, numero_identificacao: b.numero_identificacao, marca: b.marca, modelo: b.modelo, tipo_bike: b.tipo_bike };
            itemAtivoNoModal.status = status;
            itemAtivoNoModal._selectedOpenRegistroId = b.open_registro_id || null;
            // Atualiza UI
            if(ui.modal.infoBicicleta) setTextAndTooltip(ui.modal.infoBicicleta, `${b.marca || ''} ${b.modelo || ''} (ID: ${b.numero_identificacao || b.id})`);
            atualizarStatusModal(status);
          });
          if (bikeSelecionadaId && String(bikeSelecionadaId) === String(b.id)) setTimeout(()=> pill.click(), 0);
          ui.modal.listaBikesEl.appendChild(pill);
        });
      } catch(e){
        ui.modal.listaBikesEl.innerHTML = '<em>Falha ao carregar bicicletas.</em>';
      }
    }

    async function apiUpload(path, formData, method='PUT'){
      const token = getToken();
      const url = path.startsWith('http') ? path : API_BASE + (path.startsWith('/') ? path : ('/' + path));
      const resp = await fetch(url, { method, headers: token ? { 'Authorization': 'Bearer ' + token } : undefined, body: formData });
      let data; try { data = await resp.json(); } catch(_){ data = null; }
      if(!resp.ok){ const msg = (data && (data.erro || data.message)) || ('HTTP ' + resp.status); throw new Error(msg); }
      return data;
    }

    async function uploadFotoProprietario(proprietarioId, file, tipo){
      if(!proprietarioId || !file) return;
      const fd = new FormData();
      if (tipo === 'principal') fd.append('fotoProprietario', file);
      else fd.append('fotoProprietarioExtra', file);
      try {
        const nameElId = tipo === 'principal' ? 'nomeFotoPrincipal' : 'nomeFotoExtra';
        const nameEl = document.getElementById(nameElId);
        if(nameEl){ nameEl.classList.remove('success','error'); nameEl.classList.add('uploading'); }
        const endpoint = tipo === 'principal' ? `/proprietarios/${encodeURIComponent(proprietarioId)}/foto` : `/proprietarios/${encodeURIComponent(proprietarioId)}/foto-extra`;
        const res = await apiUpload(endpoint, fd, 'PUT');
        if (tipo === 'principal' && res.foto_proprietario_url && ui.modal.fotoPrincipal) ui.modal.fotoPrincipal.src = res.foto_proprietario_url;
        if (tipo === 'extra' && res.foto_proprietario_extra_url && ui.modal.fotoExtra) ui.modal.fotoExtra.src = res.foto_proprietario_extra_url;
        if(nameEl){ nameEl.classList.remove('uploading','error'); nameEl.classList.add('success'); }
        alert('Foto enviada com sucesso!');
      } catch(err){
        const nameElId = tipo === 'principal' ? 'nomeFotoPrincipal' : 'nomeFotoExtra';
        const nameEl = document.getElementById(nameElId);
        if(nameEl){ nameEl.classList.remove('uploading','success'); nameEl.classList.add('error'); }
        alert('Falha ao enviar foto: ' + err.message);
      }
    }
  });
})();
