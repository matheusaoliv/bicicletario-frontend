// Script para inserir o HTML do card Detalhe do Registro no container
// Agora, só inicializa após o textarea estar realmente presente no DOM

const API_BASE_URL = window.API_BASE_URL || 'https://bicicletario-backend.onrender.com';

// Função segura: só chama exibirDetalheRegistro quando o campo existe
document.addEventListener('DOMContentLoaded', () => {
  // Só carrega o card se NÃO estiver na área do funcionário
  if (!window.location.pathname.includes('area-funcionario')) {
    fetch('./components/detalhe-registro.html')
      .then(resp => resp.text())
      .then(html => {
        document.getElementById('detalheRegistroCardContainer').innerHTML = '';
        document.getElementById('detalheRegistroCardContainer').innerHTML = html;
        console.log('[DEBUG] HTML do card carregado:', html.length, 'chars');
        const btnFoto = document.getElementById('btnFotoProprietario');
        console.log('[DEBUG] Após inserir HTML, btnFotoProprietario existe?', !!btnFoto);
        // Oculta o card ao carregar
        const card = document.getElementById('detalheRegistroCard');
        if (card) {
          card.style.display = 'none';
          card.style.visibility = 'hidden';
          card.classList.remove('mostrar');
          card.classList.add('hidden');
          console.log('[DEBUG] Card ocultado inicialmente');
        } else {
          console.warn('[WARN] Card Detalhe do Registro não encontrado após carregar HTML!');
        }
        aguardarCampoDetalheObservacoes(inicializarDetalheRegistro);
      });
  }
});

// Função para sanitizar strings e evitar XSS
function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"]/g, function(s) {
    switch (s) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return s;
    }
  });
}

function aguardarCampoDetalheObservacoes(callback) {
  console.log('[DEBUG] aguardarCampoDetalheObservacoes chamado');
  // Sempre executa o callback, mesmo se o card já existe
  const card = document.getElementById('detalheRegistroCard');
  if (card) {
    console.log('[DEBUG] Card já existe, executando callback');
    callback();
    return;
  }
  console.log('[DEBUG] Card não existe, observando mudanças...');
  // Senão, observa até aparecer o card
  const observer = new MutationObserver(() => {
    const newCard = document.getElementById('detalheRegistroCard');
    if (newCard) {
      console.log('[DEBUG] Card apareceu, executando callback');
      observer.disconnect();
      callback();
    }
  });
  const container = document.getElementById('detalheRegistroCardContainer');
  if (container) {
    observer.observe(container, { childList: true, subtree: true });
    // Timeout de segurança
    setTimeout(() => {
      const finalCard = document.getElementById('detalheRegistroCard');
      if (finalCard) {
        console.log('[DEBUG] Card encontrado por timeout, executando callback');
        observer.disconnect();
        callback();
      } else {
        console.error('[ERRO] Card não apareceu após timeout');
      }
    }, 1000);
  } else {
    console.error('[ERRO] Container não encontrado');
  }
}

// Estado das fotos do proprietário
var fotosProprietario = Array.isArray(fotosProprietario) ? fotosProprietario : [];

function inicializarDetalheRegistro() {
  // Expor função global para integração
  // Não expor mais exibirDetalheRegistro globalmente. Apenas a função segura:
  window.exibirDetalheRegistroSeguro = function(item) {
    console.log('[DEBUG] exibirDetalheRegistroSeguro chamado com:', item);
    
    // Sempre recarregar o HTML para garantir funcionamento
    fetch('./components/detalhe-registro.html')
      .then(resp => resp.text())
      .then(html => {
        document.getElementById('detalheRegistroCardContainer').innerHTML = html;
        // Aguardar um pouco e inicializar
        setTimeout(() => {
          inicializarDetalheRegistro();
          exibirDetalheRegistro(item);
        }, 100);
      })
      .catch(err => console.error('[ERRO] Falha ao carregar HTML:', err));
  };
  // Botões
  const btnFoto = document.getElementById('btnFotoProprietario');
  console.log('[DEBUG] inicializarDetalheRegistro: btnFotoProprietario existe?', !!btnFoto);
  if (btnFoto) btnFoto.onclick = onFotoBtnClick;
  const btnEditar = document.getElementById('btnEditarProprietario');
  if (btnEditar) btnEditar.onclick = onEditarBtnClick;
  const btnCancelar = document.getElementById('btnCancelarDetalhe');
  if (btnCancelar) btnCancelar.onclick = esconderCard;
  const btnCheckOut = document.getElementById('btnConfirmarCheckOut');
  if (btnCheckOut) btnCheckOut.onclick = confirmarCheckOut;
  const btnFicha = document.getElementById('btnGerarCartaoFicha');
  if (btnFicha) btnFicha.onclick = gerarCartaoFicha;
  // Bloquear edição dos campos de observação inicialmente
  const obsNormais = document.getElementById('detalheObservacoesNormais');
  const obsOcorrencia = document.getElementById('detalheObservacoesOcorrencia');
  if (obsNormais) obsNormais.readOnly = true;
  if (obsOcorrencia) obsOcorrencia.readOnly = true;
}

// Nova função unificada de exibição do card (substitui quaisquer versões antigas)
function exibirCardComDados(card, item) {
  window._registroItemAtual = item;
  card.setAttribute('data-proprietario-id', item.proprietario?.id || '');
  card.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:1000!important;';
  card.classList.remove('hidden');
  card.classList.add('mostrar');
  const detalhesAcaoDiv = document.getElementById('detalhesAcaoDiv');
  if (detalhesAcaoDiv) detalhesAcaoDiv.classList.add('hidden');
  // Proprietário
  const nomeEl = document.getElementById('detalheNomeProprietario');
  const cpfEl = document.getElementById('detalheCpfProprietario');
  if (nomeEl) nomeEl.textContent = sanitize(item.proprietario?.nome_completo || '-');
  if (cpfEl) cpfEl.textContent = sanitize(item.proprietario?.cpf || '-');
  // Inputs marca/modelo
  const marcaInput = document.getElementById('inputMarcaBike');
  const modeloInput = document.getElementById('inputModeloBike');
  if (marcaInput) marcaInput.value = item.bicicleta?.marca || '';
  if (modeloInput) modeloInput.value = item.bicicleta?.modelo || '';
  // Status
  const statusEl = document.getElementById('detalheStatusAtual');
  const estaDentro = !!item.registro_entrada_atual;
  if (statusEl) {
    statusEl.textContent = estaDentro ? 'DENTRO' : 'FORA';
    statusEl.className = estaDentro ? 'status-dentro' : 'status-fora';
  }
  const indicador = document.getElementById('indicadorBikeDentro');
  if (indicador) indicador.style.display = estaDentro ? 'inline-block' : 'none';
  // Data/Hora operação
  const dataEl = document.getElementById('detalheDataHora');
  if (dataEl) {
    const agora = new Date();
    dataEl.textContent = agora.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  // Observações
  const obsNormais = document.getElementById('detalheObservacoesNormais');
  const obsOcorrencia = document.getElementById('detalheObservacoesOcorrencia');
  if (obsNormais) obsNormais.value = item.observacoes_normais || '';
  if (obsOcorrencia) obsOcorrencia.value = item.observacoes_ocorrencia || '';
  // Fotos
  if (item.fotosProprietario && Array.isArray(item.fotosProprietario) && item.fotosProprietario.length>0) {
    fotosProprietario = item.fotosProprietario.slice(0,3);
  } else if (item.proprietario?.foto_proprietario_url) {
    fotosProprietario = [item.proprietario.foto_proprietario_url];
  } else { fotosProprietario = []; }
  if (item.proprietario?.foto_proprietario_extra_url && !fotosProprietario.includes(item.proprietario.foto_proprietario_extra_url)) {
    fotosProprietario.push(item.proprietario.foto_proprietario_extra_url);
  }
  setTimeout(()=>{ if (document.getElementById('btnFotoProprietario')) { atualizarFotoProprietario(); atualizarBotaoFoto(); } },0);
  setCamposEditaveis(false);
  // Botão principal ação
  const btnAcao = document.getElementById('btnConfirmarCheckOut');
  ajustarBotaoAcaoPrincipal();
  if (btnAcao) {
    btnAcao.onclick = async () => {
      if (!window._registroItemAtual?.bicicleta) { window.mostrarPopupConfirmacao('Selecione uma bicicleta.'); return; }
      const acao = (window._registroItemAtual.bicicleta.status === 'DENTRO') ? 'Check-out' : 'Check-in';
      if (acao === 'Check-out') {
        const confirmar = window.confirm('Confirmar Check-out desta bicicleta?');
        if (!confirmar) return; }
      const selBike = document.getElementById('selectBicicletaProprietario');
      const bikeIdSelecionada = selBike && selBike.value ? parseInt(selBike.value,10) : window._registroItemAtual.bicicleta.id;
      if (acao==='Check-in' && !bikeIdSelecionada) { window.mostrarPopupConfirmacao('Selecione uma bicicleta.'); return; }
      const bikeObj = (window._bicicletasDoProprietario||[]).find(b=>b.id===bikeIdSelecionada) || window._registroItemAtual.bicicleta;
      if (acao==='Check-in' && bikeObj.status==='DENTRO') { window.mostrarPopupConfirmacao('Esta bicicleta já está DENTRO.'); return; }
      if (acao==='Check-out' && bikeObj.status==='FORA') { window.mostrarPopupConfirmacao('Esta bicicleta já está FORA.'); return; }
      const btnOriginal = btnAcao.textContent;
      btnAcao.disabled = true; btnAcao.textContent = 'Processando...';
      try {
        const obsNormais = document.getElementById('detalheObservacoesNormais');
        const obsOcorrencia = document.getElementById('detalheObservacoesOcorrencia');
        if (acao==='Check-in') {
          await api.post('/controle-acesso/checkin', {
            bicicleta_id: bikeIdSelecionada,
            proprietario_id: item.proprietario.id,
            local: document.getElementById('select-bicicletario')?.value || 'Japeri',
            observacoes_entrada: obsNormais?.value || '',
            observacao_geral: obsOcorrencia?.value || ''
          });
        } else {
          const openId = bikeObj.open_registro_id || item.registro_entrada_atual?.id;
          if(!openId) throw new Error('Registro aberto não encontrado para checkout.');
          await api.post('/controle-acesso/checkout', {
            controle_acesso_id: openId,
            observacoes_saida: obsNormais?.value || '',
            observacao_geral: obsOcorrencia?.value || ''
          });
        }
        window.mostrarPopupConfirmacao(`Operação de ${acao} realizada com sucesso!`);
        await carregarBicicletasDoProprietario(item.proprietario.id);
        aplicarBicicletaSelecionada();
        ajustarBotaoAcaoPrincipal();
        dispararFlashBicicleta(acao);
      } catch(err){ window.mostrarPopupConfirmacao('Falha: '+(err.message||err)); }
      finally { btnAcao.textContent = btnOriginal; btnAcao.disabled = false; }
    };
  }
  // Scroll + destaque
  setTimeout(()=>{
    const cardContainer = document.getElementById('detalheRegistroCardContainer');
    if(cardContainer){ cardContainer.scrollIntoView({behavior:'smooth',block:'start'}); }
  },150);
}

// Função para exibir os detalhes do registro de forma segura
function exibirDetalheRegistro(item) {
  console.log('[DEBUG] exibirDetalheRegistro chamado com:', item);
  window._registroItemAtual = item; // guarda referência do item atual

  // Validar se item tem estrutura correta
  if (!item || !item.proprietario || !item.bicicleta) {
    console.error('[ERRO] Item inválido passado para exibirDetalheRegistro:', item);
    window.mostrarPopupConfirmacao && window.mostrarPopupConfirmacao('Erro: dados do registro inválidos');
    return;
  }

  // Buscar o card diretamente
  const card = document.getElementById('detalheRegistroCard');
  if (!card) {
    console.error('[ERRO] Card não encontrado');
    return;
  }

  // Exibir diretamente
  exibirCardComDados(card, item);
}

// Injeta estilos de flash uma vez
(function injectFlashStyles(){
  if(document.getElementById('flashBikeStyles')) return;
  const st=document.createElement('style');
  st.id='flashBikeStyles';
  st.textContent=`@keyframes flashInBike{0%{box-shadow:0 0 0 0 rgba(46,204,113,.0);}30%{box-shadow:0 0 0 6px rgba(46,204,113,.45);}100%{box-shadow:0 0 0 0 rgba(46,204,113,0);} }@keyframes flashOutBike{0%{box-shadow:0 0 0 0 rgba(231,76,60,.0);}30%{box-shadow:0 0 0 6px rgba(231,76,60,.45);}100%{box-shadow:0 0 0 0 rgba(231,76,60,0);} } .flash-in-bike{animation:flashInBike 1.4s ease-out;} .flash-out-bike{animation:flashOutBike 1.4s ease-out;} select#selectBicicletaProprietario option[disabled]{color:#888;}`;
  document.head.appendChild(st);
})();

function dispararFlashBicicleta(acao){
  const sel = document.getElementById('selectBicicletaProprietario');
  if(!sel) return;
  sel.classList.remove('flash-in-bike','flash-out-bike');
  void sel.offsetWidth; // force reflow
  sel.classList.add(acao==='Check-in' ? 'flash-in-bike' : 'flash-out-bike');
}

function esconderCard() {
  // Esconde o card de detalhe (garante sumiço total)
  const card = document.getElementById('detalheRegistroCard');
  if (card) {
    card.style.display = 'none';
    card.classList.remove('mostrar');
    // Opcional: remove do DOM para garantir sumiço total
    // card.parentNode && card.parentNode.removeChild(card);
  }
  // Limpa a lista de resultados
  const lista = document.getElementById('listaResultadosBusca');
  if (lista) lista.innerHTML = '';

}


function setCamposEditaveis(editavel) {
  const nomeEl = document.getElementById('detalheNomeProprietario');
  const cpfEl = document.getElementById('detalheCpfProprietario');
  if(nomeEl) nomeEl.contentEditable = editavel;
  if(cpfEl) cpfEl.contentEditable = editavel;
  const marcaEl = document.getElementById('inputMarcaBike');
  const modeloEl = document.getElementById('inputModeloBike');
  if(marcaEl) marcaEl.readOnly = !editavel;
  if(modeloEl) modeloEl.readOnly = !editavel;
  const obsNormais = document.getElementById('detalheObservacoesNormais');
  const obsOcorrencia = document.getElementById('detalheObservacoesOcorrencia');
  if (obsNormais) obsNormais.readOnly = !editavel;
  if (obsOcorrencia) obsOcorrencia.readOnly = !editavel;
  const btn = document.getElementById('btnEditarProprietario');
  if(btn) btn.textContent = editavel ? 'Salvar' : 'Editar';
}

async function onEditarBtnClick() {
  const btn = document.getElementById('btnEditarProprietario');
  const editavel = btn.textContent === 'Editar';
  setCamposEditaveis(editavel);
  if (!editavel) {
    const nome = document.getElementById('detalheNomeProprietario').textContent.trim();
    const cpf = document.getElementById('detalheCpfProprietario').textContent.trim();
    const marca = document.getElementById('inputMarcaBike')?.value.trim() || '';
    const modelo = document.getElementById('inputModeloBike')?.value.trim() || '';
    const email = document.getElementById('detalheEmailProprietario') ? document.getElementById('detalheEmailProprietario').textContent.trim() : '';
    const contato = document.getElementById('detalheContatoProprietario') ? document.getElementById('detalheContatoProprietario').textContent.trim() : '';
    const endereco = document.getElementById('detalheEnderecoProprietario') ? document.getElementById('detalheEnderecoProprietario').textContent.trim() : '';
    const card = document.getElementById('detalheRegistroCard');
    const proprietarioId = card ? card.getAttribute('data-proprietario-id') : null;
    if (!proprietarioId) { window.mostrarPopupConfirmacao('Erro: ID do proprietário não encontrado.'); return; }
    try {
      await api.put(`/proprietarios/${proprietarioId}`, { nome_completo: nome, cpf, email, contato, endereco });
      const bicicletaId = window._registroItemAtual?.bicicleta?.id;
      if (bicicletaId) { await api.put(`/bicicletas/${bicicletaId}`, { marca, modelo }).catch(err=>{ window.mostrarPopupConfirmacao(err.message || 'Erro ao atualizar bicicleta.'); }); }
      window.mostrarPopupConfirmacao('Dados atualizados com sucesso!');
    } catch(err){ window.mostrarPopupConfirmacao(err.message || 'Erro ao atualizar.'); }
  } else {
    // Entrando em modo edição: guardar item atual
    const card = document.getElementById('detalheRegistroCard');
    // Assume item atual armazenado em window._registroItemAtual previamente
  }
}


function atualizarFotoProprietario() {
  const container = document.getElementById('fotoProprietarioContainer');
  container.innerHTML = '';
  if (fotosProprietario.length === 0) {
    container.innerHTML = "<img id=\"fotoProprietario\" src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='150' height='150' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EFoto%3C/text%3E%3C/svg%3E\" alt=\"Foto do Proprietário\" />";
  } else {
    // Mantém a primeira (principal) sempre visível; extras só na galeria.
    const principal = fotosProprietario[0];
    const img = document.createElement('img');
    img.id = 'fotoProprietario';
    img.src = principal;
    img.alt = 'Foto do Proprietário';
    container.appendChild(img);
  }
}

function atualizarBotaoFoto() {
  const btn = document.getElementById('btnFotoProprietario');
  if (!btn) {
  }
  btn.textContent = fotosProprietario.length === 0 ? 'Adicionar Foto' : 'Ver Foto';
}

async function onFotoBtnClick() {
  if (fotosProprietario.length === 0) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async function(e) {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const card = document.getElementById('detalheRegistroCard');
        const proprietarioId = card ? card.getAttribute('data-proprietario-id') : null;
        if (!proprietarioId) { window.mostrarPopupConfirmacao('Erro: ID do proprietário não encontrado.'); return; }
        try {
          const result = await api.upload(`/proprietarios/${proprietarioId}/foto`, { fotoProprietario: file });
          if (result && result.foto_proprietario_url) {
            fotosProprietario = [result.foto_proprietario_url];
            atualizarFotoProprietario(); atualizarBotaoFoto();
            window.mostrarPopupConfirmacao('Foto do proprietário atualizada com sucesso!');
          } else { window.mostrarPopupConfirmacao('Erro ao salvar foto.'); }
        } catch(err){ window.mostrarPopupConfirmacao(err.message || 'Erro ao enviar foto.'); }
      }
    };
    input.click();
  } else { abrirGaleriaFotos(); }
}


function abrirGaleriaFotos() {
  // Modal simples para galeria
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = 0;
  modal.style.left = 0;
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.75)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = 9999;
  const galeria = document.createElement('div');
  galeria.style.display = 'flex';
  galeria.style.gap = '18px';
  galeria.style.background = '#fff';
  galeria.style.padding = '18px';
  galeria.style.borderRadius = '14px';
  galeria.style.boxShadow = '0 8px 32px rgba(25,118,210,0.18)';
  fotosProprietario.forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.style.width = '140px';
    img.style.height = '140px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '10px';
    galeria.appendChild(img);
  });
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fechar';
  closeBtn.style.marginLeft = '20px';
  closeBtn.style.padding = '8px 18px';
  closeBtn.style.fontSize = '1.1em';
  closeBtn.style.borderRadius = '7px';
  closeBtn.style.border = 'none';
  closeBtn.style.background = '#1976d2';
  closeBtn.style.color = '#fff';
  closeBtn.style.cursor = 'pointer';
  closeBtn.onclick = () => document.body.removeChild(modal);
  galeria.appendChild(closeBtn);
  modal.appendChild(galeria);
  modal.onclick = e => { if (e.target === modal) document.body.removeChild(modal); };
  document.body.appendChild(modal);
}

function confirmarCheckOut() {
  // Aqui você pode integrar com a lógica de check-out/check-in
  alert('Operação confirmada!');
}

function gerarCartaoFicha() {
  // Aqui você pode chamar a lógica de geração de cartão/ficha
  alert('Cartão/Ficha gerado!');
}

// Listener mudança select
document.addEventListener('change', e=>{
  if(e.target && e.target.id==='selectBicicletaProprietario'){
    aplicarBicicletaSelecionada();
  }
});

function carregarBicicletasDoProprietario(proprietarioId){
  const sel = document.getElementById('selectBicicletaProprietario');
  const info = document.getElementById('infoBikesStatus');
  const btnAdd = document.getElementById('btnAdicionarBike');
  if(!sel) return Promise.resolve();
  sel.innerHTML = '<option disabled selected>Carregando bicicletas...</option>';
  sel.disabled = true;
  return api.endpoints.listarBicicletasProprietario(proprietarioId)
    .then(bikes=>{
      window._bicicletasDoProprietario = bikes;
      sel.innerHTML='';
      if(!bikes || bikes.length===0){
        sel.innerHTML='<option disabled selected>Sem bicicletas cadastradas</option>';
        sel.disabled=true;
        if(btnAdd){ btnAdd.style.display='inline-block'; btnAdd.onclick=()=>{ window.location.href = `adicionar-bicicleta.html?proprietario_id=${proprietarioId}`; }; }
        if(info) info.textContent='Nenhuma bicicleta. Adicione até 3.';
        return;
      }
      sel.disabled=false;
      bikes.forEach(b=>{ const label = `${(b.marca||'-')} ${(b.modelo||'')} (${b.numero_identificacao}) - ${b.status}`.replace(/\s+/g,' ').trim(); const opt=document.createElement('option'); opt.value=b.id; opt.textContent=label; opt.dataset.status=b.status; sel.appendChild(opt); });
      const anterior = window._registroItemAtual?.bicicleta?.id;
      let selecionada = bikes.find(b=>b.id===anterior) || bikes.find(b=>b.status==='DENTRO') || bikes[0];
      sel.value = selecionada.id;
      aplicarBicicletaSelecionada();
      if(btnAdd){ if(bikes.length<3){ btnAdd.style.display='inline-block'; btnAdd.onclick=()=>{ window.location.href = `adicionar-bicicleta.html?proprietario_id=${proprietarioId}`; }; } else { btnAdd.style.display='none'; } }
      if(info){ const dentro = bikes.filter(b=>b.status==='DENTRO').length; info.textContent = `${bikes.length} bicicleta(s). ${dentro} dentro.`; }
    })
    .catch(err=>{ sel.innerHTML='<option disabled selected>Erro ao carregar</option>'; if(info) info.textContent='Falha ao carregar bicicletas.'; sel.disabled=true; console.error('Erro carregar bicicletas:', err); });
}

function aplicarBloqueioOpcoes(){
  const sel = document.getElementById('selectBicicletaProprietario');
  if(!sel) return;
  const bikeSel = window._registroItemAtual?.bicicleta;
  if(!bikeSel) return;
  const contextoAcao = (bikeSel.status==='DENTRO') ? 'checkout' : 'checkin';
  [...sel.options].forEach(opt=>{
    if(!opt.value) return;
    const b = (window._bicicletasDoProprietario||[]).find(x=> String(x.id)===opt.value);
    if(!b) return;
    opt.disabled = false;
    opt.title='';
    if(contextoAcao==='checkin' && b.status==='DENTRO'){
      opt.disabled = true;
      if(!/bloqueada/.test(opt.textContent)) opt.textContent = opt.textContent.replace(/ - DENTRO$/,' - DENTRO (bloqueada)');
      opt.title='Esta bicicleta já está DENTRO. Faça check-out antes.';
    } else if(contextoAcao==='checkout' && b.status==='FORA') {
      opt.disabled = true;
      if(!/bloqueada/.test(opt.textContent)) opt.textContent = opt.textContent.replace(/ - FORA$/,' - FORA (bloqueada)');
      opt.title='Esta bicicleta está FORA. Não há registro para check-out.';
    }
  });
}

function aplicarBicicletaSelecionada(){
  const sel = document.getElementById('selectBicicletaProprietario');
  if(!sel) return;
  const id = parseInt(sel.value,10);
  const bike = (window._bicicletasDoProprietario||[]).find(b=>b.id===id);
  if(!bike) return;
  if(!window._registroItemAtual) window._registroItemAtual = {};
  window._registroItemAtual.bicicleta = bike;
  const marcaEl = document.getElementById('inputMarcaBike');
  const modeloEl = document.getElementById('inputModeloBike');
  const statusEl = document.getElementById('detalheStatusAtual');
  if(marcaEl) marcaEl.value = bike.marca || '';
  if(modeloEl) modeloEl.value = bike.modelo || '';
  if(statusEl){
    statusEl.textContent = bike.status;
    statusEl.className = bike.status==='DENTRO' ? 'status-dentro' : 'status-fora';
  }
  const indicador = document.getElementById('indicadorBikeDentro');
  if(indicador) indicador.style.display = bike.status==='DENTRO' ? 'inline-block':'none';
  ajustarBotaoAcaoPrincipal();
  aplicarBloqueioOpcoes();
}

function ajustarBotaoAcaoPrincipal(){
  const btnAcao = document.getElementById('btnConfirmarCheckOut');
  if(!btnAcao) return;
  const bikeSel = window._registroItemAtual?.bicicleta;
  if(!bikeSel){ btnAcao.disabled=true; btnAcao.textContent='Selecione uma bicicleta'; return; }
  btnAcao.textContent = bikeSel.status==='DENTRO' ? 'Confirmar Check-out' : 'Confirmar Check-in';
  btnAcao.disabled = false;
}
