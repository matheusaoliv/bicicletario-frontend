// Script para inserir o HTML do card Detalhe do Registro no container
// Agora, só inicializa após o textarea estar realmente presente no DOM

// Configuração da URL base da API
const API_BASE_URL = 'https://bicicletario-backend.onrender.com';

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

function exibirDetalheRegistro(item) {
  console.log('[DEBUG] exibirDetalheRegistro chamado com:', item);
  
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

function exibirCardComDados(card, item) {
  console.log('[DEBUG] exibirCardComDados chamado com:', item);
  // Mover lógica para função separada
  exibirCardComDados(card, item);
}

function exibirCardComDados(card, item) {
  console.log('[DEBUG] exibirCardComDados chamado com:', item);
  
  // Mostra o card normalmente
  console.log('[DEBUG] Exibindo card...');
  card.setAttribute('data-proprietario-id', item.proprietario?.id || '');
  
  // Forçar exibição do card com CSS inline
  card.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 1000 !important;';
  card.classList.remove('hidden');
  card.classList.add('mostrar');
  
  console.log('[DEBUG] Card após exibição - cssText:', card.style.cssText);
  console.log('[DEBUG] Card offsetHeight:', card.offsetHeight, 'offsetWidth:', card.offsetWidth);

  // Oculta o bloco antigo de detalhes, se existir
  var detalhesAcaoDiv = document.getElementById('detalhesAcaoDiv');
  if (detalhesAcaoDiv) detalhesAcaoDiv.classList.add('hidden');
  // Preenche campos
  document.getElementById('detalheNomeProprietario').textContent = sanitize(item.proprietario?.nome_completo || '-');
  document.getElementById('detalheCpfProprietario').textContent = sanitize(item.proprietario?.cpf || '-');
  document.getElementById('detalheInfoBicicleta').textContent = sanitize(`${item.bicicleta?.marca || ''} ${item.bicicleta?.modelo || ''}`);
  const statusAtual = item.registro_entrada_atual ? 'DENTRO' : 'FORA';
  document.getElementById('detalheStatusAtual').textContent = statusAtual;
  document.getElementById('detalheStatusAtual').className = item.registro_entrada_atual ? 'status-dentro' : 'status-fora';
  // Ajusta texto do botão de ação principal
  const btnAcao = document.getElementById('btnConfirmarCheckOut');
  if(btnAcao) {
    btnAcao.textContent = (statusAtual === 'FORA') ? 'Confirmar Check-in' : 'Confirmar Check-out';
    btnAcao.onclick = async function() {
      const acao = btnAcao.textContent.includes('Check-in') ? 'Check-in' : 'Check-out';
      try {
        const token = sessionStorage.getItem('token');
        let endpoint = '';
        let payload = {};
        if (acao === 'Check-in') {
          endpoint = `${API_BASE_URL}/api/controle-acesso/checkin`;
          payload = {
            bicicleta_id: item.bicicleta?.id,
            proprietario_id: item.proprietario?.id,
            local: document.getElementById('select-bicicletario')?.value || 'Japeri',
            observacoes_entrada: document.getElementById('detalheObservacoesNormais')?.value || '',
            observacao_geral: document.getElementById('detalheObservacoesOcorrencia')?.value || ''
          };
        } else {
          endpoint = `${API_BASE_URL}/api/controle-acesso/checkout`;
          payload = {
            controle_acesso_id: item.registro_entrada_atual?.id,
            observacoes_saida: document.getElementById('detalheObservacoesNormais')?.value || '',
            observacao_geral: document.getElementById('detalheObservacoesOcorrencia')?.value || ''
          };
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Erro ao realizar ' + acao + ': ' + (await res.text()));
        // Exibir popup institucional de confirmação
        window.mostrarPopupConfirmacao('Operação de ' + acao + ' realizada com sucesso!');
        // Atualizar lista de resultados automaticamente
        setTimeout(() => {
          try {
            // Buscar novamente com o mesmo termo da busca anterior
            const termoBusca = document.getElementById('termoPesquisa')?.value;
            if (termoBusca && window.buscarProprietarios) {
              console.log('[DEBUG] Atualizando lista após operação com termo:', termoBusca);
              window.buscarProprietarios(termoBusca);
            } else {
              console.log('[DEBUG] Não foi possível atualizar - termo:', termoBusca, 'função:', !!window.buscarProprietarios);
            }
            esconderCard();
          } catch (erroBusca) {
            console.error('[ERRO] Falha ao atualizar lista:', erroBusca);
            esconderCard();
          }
        }, 500);
      } catch (err) {
        let msg = (err && err.message) ? err.message : String(err);
        if (msg.includes('Registro de check-in não encontrado')) {
          msg = 'Não foi possível realizar o check-out: este registro já foi finalizado, não existe ou está inválido.\nSelecione um registro em aberto.';
        } else if (msg.includes('Nenhum registro de check-in atualizado')) {
          msg = 'Não foi possível atualizar o registro de check-in. Verifique se ele ainda está aberto.';
        } else if (msg.includes('404')) {
          msg = 'Registro não encontrado. Tente atualizar a lista ou realizar um novo check-in antes.';
        } else {
          msg = 'Erro ao realizar operação: ' + msg;
        }
        window.mostrarPopupConfirmacao(msg);
      }
    };
  }
  // Exibir data/hora atual do dispositivo
  const agora = new Date();
  const dataHoraOperacao = agora.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('detalheDataHora').textContent = dataHoraOperacao;
  // Bicicletário
  const selectBicicletario = document.getElementById('select-bicicletario');
  let valorBicicletario = (item.bicicletario || '').trim();
  const opcoesValidas = Array.from(selectBicicletario.options).map(opt => opt.value);
  if (opcoesValidas.includes(valorBicicletario)) {
    selectBicicletario.value = valorBicicletario;
  } else {
    selectBicicletario.selectedIndex = 0;
  }
  // Observações
  const obsNormais = document.getElementById('detalheObservacoesNormais');
  const obsOcorrencia = document.getElementById('detalheObservacoesOcorrencia');
  if (obsNormais) obsNormais.value = item.observacoes_normais || '';
  if (obsOcorrencia) obsOcorrencia.value = item.observacoes_ocorrencia || '';
  // Fotos
  if (item.fotosProprietario && Array.isArray(item.fotosProprietario) && item.fotosProprietario.length > 0) {
    fotosProprietario = item.fotosProprietario.slice(0,3);
  } else if (item.proprietario && item.proprietario.foto_proprietario_url) {
    fotosProprietario = [item.proprietario.foto_proprietario_url];
  } else {
    fotosProprietario = [];
  }
  setTimeout(() => {
    // Só chama se o botão já existe
    if (document.getElementById('btnFotoProprietario')) {
      atualizarFotoProprietario();
      atualizarBotaoFoto();
    } else {
    }
  }, 0);
  // Reset edição
  setCamposEditaveis(false);

  // Rolagem automática e destaque visual
  setTimeout(() => {
    const cardContainer = document.getElementById('detalheRegistroCardContainer');
    if (cardContainer) {
      // Scroll mais agressivo
      cardContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Adicionar destaque visual temporário
      card.style.border = '3px solid #ff6b35';
      card.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.5)';
      
      setTimeout(() => {
        card.style.border = '';
        card.style.boxShadow = '0 8px 32px rgba(25,118,210,0.11)';
      }, 2000);
      
      console.log('[DEBUG] Card destacado e scroll realizado');
    }
  }, 200);
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
  document.getElementById('detalheNomeProprietario').contentEditable = editavel;
  document.getElementById('detalheCpfProprietario').contentEditable = editavel;
  document.getElementById('detalheInfoBicicleta').contentEditable = editavel;
  const obsNormais = document.getElementById('detalheObservacoesNormais');
  const obsOcorrencia = document.getElementById('detalheObservacoesOcorrencia');
  if (obsNormais) obsNormais.readOnly = !editavel;
  if (obsOcorrencia) obsOcorrencia.readOnly = !editavel;
  // Select de Bicicletário sempre habilitado por preferência do usuário
  document.getElementById('btnEditarProprietario').textContent = editavel ? 'Salvar' : 'Editar';
}

async function onEditarBtnClick() {
  const btn = document.getElementById('btnEditarProprietario');
  const editavel = btn.textContent === 'Editar';
  setCamposEditaveis(editavel);
  if (!editavel) {
    // Salvando alterações
    const nome = document.getElementById('detalheNomeProprietario').textContent.trim();
    const cpf = document.getElementById('detalheCpfProprietario').textContent.trim();
    const email = document.getElementById('detalheEmailProprietario') ? document.getElementById('detalheEmailProprietario').textContent.trim() : '';
    const contato = document.getElementById('detalheContatoProprietario') ? document.getElementById('detalheContatoProprietario').textContent.trim() : '';
    const endereco = document.getElementById('detalheEnderecoProprietario') ? document.getElementById('detalheEnderecoProprietario').textContent.trim() : '';
    // ID do proprietário salvo em data-id do elemento principal
    const card = document.getElementById('detalheRegistroCard');
    const proprietarioId = card ? card.getAttribute('data-proprietario-id') : null;
    if (!proprietarioId) {
      window.mostrarPopupConfirmacao('Erro: ID do proprietário não encontrado.');
      return;
    }
    const token = sessionStorage.getItem('token');
    if (!token) {
      window.mostrarPopupConfirmacao('Erro: usuário não autenticado.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/proprietarios/${proprietarioId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nome_completo: nome,
          cpf: cpf,
          email: email,
          contato: contato,
          endereco: endereco
        })
      });
      const result = await response.json();
      if (response.ok) {
        window.mostrarPopupConfirmacao('Dados do proprietário atualizados com sucesso!');
        // Atualiza o card com os dados retornados
        if (result.proprietario) {
          document.getElementById('detalheNomeProprietario').textContent = result.proprietario.nome_completo || nome;
          document.getElementById('detalheCpfProprietario').textContent = result.proprietario.cpf || cpf;
          if(document.getElementById('detalheEmailProprietario')) document.getElementById('detalheEmailProprietario').textContent = result.proprietario.email || email;
          if(document.getElementById('detalheContatoProprietario')) document.getElementById('detalheContatoProprietario').textContent = result.proprietario.contato || contato;
          if(document.getElementById('detalheEnderecoProprietario')) document.getElementById('detalheEnderecoProprietario').textContent = result.proprietario.endereco || endereco;
        }
      } else {
        window.mostrarPopupConfirmacao(result.erro || 'Erro ao atualizar proprietário.');
      }
    } catch (err) {
      window.mostrarPopupConfirmacao('Erro ao atualizar proprietário: ' + err.message);
    }
  }
}


function atualizarFotoProprietario() {
  const container = document.getElementById('fotoProprietarioContainer');
  container.innerHTML = '';
  if (fotosProprietario.length === 0) {
    container.innerHTML = '<img id="fotoProprietario" src="imagens/default-user.png" alt="Foto do Proprietário" />';
  } else {
    // Mostra a última foto como destaque
    const img = document.createElement('img');
    img.id = 'fotoProprietario';
    img.src = fotosProprietario[fotosProprietario.length-1];
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
    // Adicionar foto (upload ou câmera)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async function(e) {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const card = document.getElementById('detalheRegistroCard');
        const proprietarioId = card ? card.getAttribute('data-proprietario-id') : null;
        const token = sessionStorage.getItem('token');
        if (!proprietarioId || !token) {
          window.mostrarPopupConfirmacao('Erro: ID do proprietário ou token não encontrado.');
          return;
        }
        // Enviar via FormData
        const formData = new FormData();
        formData.append('fotoProprietario', file);
        try {
          const response = await fetch(`${API_BASE_URL}/api/proprietarios/${proprietarioId}/foto`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });
          const result = await response.json();
          if (response.ok && result.foto_proprietario_url) {
            fotosProprietario = [result.foto_proprietario_url];
            atualizarFotoProprietario();
            atualizarBotaoFoto();
            window.mostrarPopupConfirmacao('Foto do proprietário atualizada com sucesso!');
          } else {
            window.mostrarPopupConfirmacao(result.erro || 'Erro ao salvar foto.');
          }
        } catch (err) {
          window.mostrarPopupConfirmacao('Erro ao enviar foto: ' + err.message);
        }
      }
    };
    input.click();
  } else {
    // Ver galeria
    abrirGaleriaFotos();
  }
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
