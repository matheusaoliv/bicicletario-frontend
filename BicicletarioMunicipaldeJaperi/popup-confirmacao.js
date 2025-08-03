// Função para mostrar o popup de confirmação animado
function mostrarPopupConfirmacao(mensagem) {
  console.log('[DEBUG] mostrarPopupConfirmacao chamada:', mensagem);

  let popup = document.getElementById('popupConfirmacao');
  let msg = document.getElementById('popupMensagem');
  if (!popup || !msg) {
    console.error('[ERRO] Popup ou mensagem não encontrados no DOM!', {popup, msg});
    return;
  }
  msg.textContent = mensagem;
  popup.classList.remove('hidden');
  // Reinicia animação SVG
  const circle = popup.querySelector('.checkmark-circle');
  const check = popup.querySelector('.checkmark-check');
  if(circle && check) {
    circle.style.strokeDasharray = '166';
    circle.style.strokeDashoffset = '166';
    check.style.strokeDasharray = '48';
    check.style.strokeDashoffset = '48';
    circle.style.animation = 'circle-anim 0.4s ease-out forwards';
    check.style.animation = 'check-anim 0.3s 0.35s cubic-bezier(0.65, 0, 0.45, 1) forwards';
  }
}
window.mostrarPopupConfirmacao = mostrarPopupConfirmacao;
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', function() {
    const okBtn = document.getElementById('popupOkBtn');
    if (okBtn) {
      okBtn.onclick = function() {
        document.getElementById('popupConfirmacao').classList.add('hidden');
        // Oculta/limpa o card de detalhe institucional
        var detalheContainer = document.getElementById('detalheRegistroCardContainer');
        if (detalheContainer) detalheContainer.innerHTML = '';
      };
    }
  });
}
