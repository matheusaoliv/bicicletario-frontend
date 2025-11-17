(function(){
  'use strict';
  const GLOBAL = (typeof window!=='undefined')?window:globalThis;
  const CatalogoBikesUI = {};
  let _cache=null, _loading=null;
  const API_BASE = ((GLOBAL.API_BASE_URL && GLOBAL.API_BASE_URL.trim()) || 'https://api-daja3h3cva-rj.a.run.app').replace(/\/$/, '');

  const FALLBACK={
    'Mountain Bike':{'Caloi':['Elite','Explorer Sport','Explorer EVO SL','MOAB'],'Oggi':['Big Wheel 7.3 2025']},
    'Speed':{'Oggi':['Cadenza 500 2025'],'Specialized':['Tarmac']},
    'Urbana':{'Caloi':['SUPRA'],'GTS':['City']},
    'Elétrica':{'Caloi':['E-Vibe Explorer']},
    'Dobrável':{'Blitz':['Compact']},
    'Infantil':{'Caloi':['Ceci (16/20/24/26)']}
  };

  function q(x){ if(!x) return null; return (typeof x==='string')?document.querySelector(x):x; }
  function norm(s){ return (s||'').toLowerCase(); }
  function enable(el,on){ if(!el) return; if(on) el.removeAttribute('disabled'); else { el.setAttribute('disabled',''); if('value' in el) el.value=''; } }
  function toggle(el,show){ if(!el) return; el.classList.toggle('hidden',!show); }
  function resetSelect(sel,ph,dis){ if(!sel) return; sel.innerHTML=''; sel.appendChild(new Option(ph||'—','')); if(dis) sel.setAttribute('disabled',''); else sel.removeAttribute('disabled'); }

  CatalogoBikesUI.loadCatalog = async function({url}={}){
    if(_cache) { console.log('📚 Catálogo: usando cache'); return _cache; }
    if(_loading) return _loading;
    const primary = url || (API_BASE + '/catalogo-bikes');
    const fallbacks = [ primary, 'data/catalogo-bikes.json' ];
    _loading=(async()=>{
      for(const u of fallbacks){
        try { 
          console.log(`📚 Tentando carregar catálogo de: ${u}`);
          const r=await fetch(u,{cache:'no-store'}); 
          if(r.ok){ 
            const d=await r.json(); 
            if(d&&typeof d==='object'){ 
              const tipos = Object.keys(d).length;
              console.log(`✅ Catálogo carregado de ${u} - ${tipos} tipos de bicicleta`);
              _cache=d; 
              return d; 
            } 
          } 
        }
        catch(e){ console.warn(`❌ Falha ao carregar de ${u}:`, e); }
      }
      console.warn('⚠️ Usando catálogo FALLBACK hardcoded (apenas 2 marcas)');
      _cache = FALLBACK; return _cache;
    })();
    return _loading;
  };

  function renderSuggestions(container, list, query, onPick){
    if(!container) return; const qv=norm(query); if(!qv){ container.classList.remove('show'); container.innerHTML=''; return; }
    const arr=(list||[]).filter(v=>norm(v).includes(qv)).slice(0,20);
    if(!arr.length){ container.classList.remove('show'); container.innerHTML=''; return; }
    container.innerHTML=arr.map((v,i)=>`<div id="opt-${container.id}-${i}" class="item" role="option" aria-selected="false" data-val="${String(v).replace(/\"/g,'&quot;')}"><span>${String(v).replace(/</g,'&lt;')}</span></div>`).join('');
    container.classList.add('show');
    Array.from(container.querySelectorAll('.item')).forEach(it=> it.addEventListener('click',()=>onPick(it.getAttribute('data-val'))));
  }

  function setActive(container, index, searchEl){
    const items = container ? Array.from(container.querySelectorAll('.item')) : [];
    items.forEach((el,i)=>{ el.classList.toggle('active', i===index); el.setAttribute('aria-selected', i===index ? 'true' : 'false'); });
    const activeEl = items[index];
    if(searchEl){
      searchEl.setAttribute('aria-expanded', items.length>0 ? 'true' : 'false');
      searchEl.setAttribute('aria-activedescendant', activeEl ? activeEl.id : '');
    }
  }

  function announceSuggestions(searchEl, container){
    try{
      if(!searchEl) return;
      const items = container ? container.querySelectorAll('.item') : null;
      const cnt = items ? items.length : 0;
      const id = searchEl.id ? `live-${searchEl.id}` : '';
      let region = id ? document.getElementById(id) : null;
      if(!region){
        region = document.createElement('div');
        if(id) region.id = id;
        region.setAttribute('role','status');
        region.setAttribute('aria-live','polite');
        // Visually hidden
        Object.assign(region.style, { position:'absolute', width:'1px', height:'1px', margin:'-1px', border:'0', padding:'0', clip:'rect(0 0 0 0)', overflow:'hidden' });
        const parent = searchEl.parentNode || document.body;
        parent.appendChild(region);
      }
      region.textContent = cnt ? `${cnt} sugestão${cnt>1?'es':''} disponíveis` : 'Nenhuma sugestão';
    } catch(_){ }
  }

  CatalogoBikesUI.setupDependentSelects = function(cfg){
    // Função para obter catálogo atual (sempre pega o cache mais recente)
    const getCatalogo = () => _cache || FALLBACK;
    let cat = getCatalogo();
    const tipoSel=q(cfg.tipoSel), marcaSel=q(cfg.marcaSel), modeloSel=q(cfg.modeloSel);
    const marcaSearch=q(cfg.marcaSearch), modeloSearch=q(cfg.modeloSearch);
    const marcaClear=q(cfg.marcaClear), modeloClear=q(cfg.modeloClear);
    const marcaOutroWrap=q(cfg.marcaOutroWrap), modeloOutroWrap=q(cfg.modeloOutroWrap);
    const marcaOutroInput=q(cfg.marcaOutroInput), modeloOutroInput=q(cfg.modeloOutroInput);
    const marcaSug=q(cfg.marcaSuggestions), modeloSug=q(cfg.modeloSuggestions);
    const includeOutro=(cfg.includeOutroOption!==false);
    const useLinha=!!cfg.includeLinhaFilter;
    const linhaFilterWrap=q(cfg.linhaFilterWrap), linhaSearch=q(cfg.linhaSearch), linhaClear=q(cfg.linhaClear), linhaSug=q(cfg.linhaSuggestions);
    const linhaRow = q(cfg.linhaRow) || (linhaFilterWrap ? (linhaFilterWrap.closest && linhaFilterWrap.closest('.form-row')) : null);

    let currentMarcas=[], currentModelos=[], currentLinhas=[], selectedLinha='';
    let marcaActiveIndex=-1, modeloActiveIndex=-1, linhaActiveIndex=-1;

    // Loading feedback: marca/modelo/(linha) mostram spinner enquanto o catálogo carrega
    const busyEls = [marcaSearch, modeloSearch].concat((useLinha && linhaSearch) ? [linhaSearch] : []);
    function setBusy(on){ busyEls.forEach(el=>{ if(!el) return; el.setAttribute('aria-busy', on ? 'true' : 'false'); }); }
    if(!_cache){
      setBusy(true);
      try {
        CatalogoBikesUI.loadCatalog && CatalogoBikesUI.loadCatalog().finally(()=>{
          setBusy(false);
          // Após carregar catálogo, se já houver tipo selecionado, inicializa marcas/modelos
          try{
            if(tipoSel && tipoSel.value){
              if(includeOutro && tipoSel.value==='Outro'){
                toggle(marcaOutroWrap,true); marcaOutroInput&&marcaOutroInput.setAttribute('required','');
                toggle(modeloOutroWrap,true); modeloOutroInput&&modeloOutroInput.setAttribute('required','');
              } else {
                popularMarcas(tipoSel.value);
              }
            }
          }catch(_){ }
        });
      } catch(_){ setBusy(false); }
    }

    // Garanta atributos básicos de combobox
    if(marcaSearch){ marcaSearch.setAttribute('role','combobox'); marcaSearch.setAttribute('aria-autocomplete','list'); marcaSearch.setAttribute('aria-haspopup','listbox'); if(marcaSug && marcaSug.id) marcaSearch.setAttribute('aria-controls', marcaSug.id); marcaSearch.setAttribute('aria-expanded','false'); }
    if(modeloSearch){ modeloSearch.setAttribute('role','combobox'); modeloSearch.setAttribute('aria-autocomplete','list'); modeloSearch.setAttribute('aria-haspopup','listbox'); if(modeloSug && modeloSug.id) modeloSearch.setAttribute('aria-controls', modeloSug.id); modeloSearch.setAttribute('aria-expanded','false'); }
    if(useLinha && linhaSearch){ linhaSearch.setAttribute('role','combobox'); linhaSearch.setAttribute('aria-autocomplete','list'); linhaSearch.setAttribute('aria-haspopup','listbox'); if(linhaSug && linhaSug.id) linhaSearch.setAttribute('aria-controls', linhaSug.id); linhaSearch.setAttribute('aria-expanded','false'); }

    function aplicarFiltroSelect(selectEl, base, query, placeholder, incluirOutro){
      resetSelect(selectEl, placeholder, false);
      const qv=norm(query); const list=qv?(base||[]).filter(v=>norm(v).includes(qv)):(base||[]);
      list.forEach(v=> selectEl.appendChild(new Option(v,v)));
      if(incluirOutro) selectEl.appendChild(new Option('Outro','Outro'));
    }

    function popularMarcas(tipo){
      resetSelect(marcaSel,'Selecione a Marca',true); resetSelect(modeloSel,'Selecione o Modelo',true);
      cat = getCatalogo(); // Atualiza com o cache mais recente
      const mapa=(cat&&cat[tipo])||null; if(!mapa){ enable(marcaSearch,false); enable(modeloSearch,false); enable(marcaClear,false); enable(modeloClear,false); return; }
      currentMarcas=Object.keys(mapa).sort(); currentMarcas.forEach(m=> marcaSel.appendChild(new Option(m,m)));
      if(includeOutro) marcaSel.appendChild(new Option('Outro','Outro'));
      marcaSel.removeAttribute('disabled'); enable(marcaSearch,true); enable(marcaClear,true); enable(modeloSearch,false); enable(modeloClear,false);
      toggle(marcaOutroWrap,false); marcaOutroInput&&marcaOutroInput.removeAttribute('required');
      toggle(modeloOutroWrap,false); modeloOutroInput&&modeloOutroInput.removeAttribute('required');
      if(useLinha){ toggle(linhaFilterWrap,false); if(linhaRow) toggle(linhaRow,false); enable(linhaSearch,false); enable(linhaClear,false); linhaSug&&linhaSug.classList.remove('show'); selectedLinha=''; }
      marcaSug&&marcaSug.classList.remove('show'); modeloSug&&modeloSug.classList.remove('show');
    }

    function popularModelos(tipo, marca){
      resetSelect(modeloSel,'Selecione o Modelo',true);
      cat = getCatalogo(); // Atualiza com o cache mais recente
      const entry=(cat&&cat[tipo])?cat[tipo][marca]:null;
      currentLinhas=(entry&&entry.lines&&typeof entry.lines==='object')?Object.keys(entry.lines).sort():[];
      if(useLinha){ if(currentLinhas.length){ if(linhaRow) toggle(linhaRow,true); toggle(linhaFilterWrap,true); enable(linhaSearch,true); enable(linhaClear,true); } else { toggle(linhaFilterWrap,false); if(linhaRow) toggle(linhaRow,false); enable(linhaSearch,false); enable(linhaClear,false); selectedLinha=''; linhaSug&&linhaSug.classList.remove('show'); if(linhaSearch) linhaSearch.value=''; } }
      let modelos=[];
      if(selectedLinha && entry && entry.lines && entry.lines[selectedLinha]) modelos=entry.lines[selectedLinha];
      else if(Array.isArray(entry)) modelos=entry;
      else if(entry && Array.isArray(entry.models)) modelos=entry.models;
      currentModelos=(modelos||[]).slice(); currentModelos.forEach(md=> modeloSel.appendChild(new Option(md,md)));
      if(includeOutro) modeloSel.appendChild(new Option('Outro','Outro'));
      modeloSel.removeAttribute('disabled'); enable(modeloSearch,true); enable(modeloClear,true);
      toggle(modeloOutroWrap,false); modeloOutroInput&&modeloOutroInput.removeAttribute('required'); modeloSug&&modeloSug.classList.remove('show'); marcaSug&&marcaSug.classList.remove('show');
    }

    // Listeners
    tipoSel&&tipoSel.addEventListener('change',()=>{
      const v=tipoSel.value;
      if(!v){ resetSelect(marcaSel,'Selecione a Marca',true); resetSelect(modeloSel,'Selecione o Modelo',true); enable(marcaSearch,false); enable(marcaClear,false); enable(modeloSearch,false); enable(modeloClear,false); toggle(marcaOutroWrap,false); marcaOutroInput&&marcaOutroInput.removeAttribute('required'); toggle(modeloOutroWrap,false); modeloOutroInput&&modeloOutroInput.removeAttribute('required'); if(useLinha){ toggle(linhaFilterWrap,false); if(linhaRow) toggle(linhaRow,false); enable(linhaSearch,false); enable(linhaClear,false);} return; }
      if(includeOutro && v==='Outro'){ resetSelect(marcaSel,'Selecione a Marca',true); resetSelect(modeloSel,'Selecione o Modelo',true); enable(marcaSearch,false); enable(marcaClear,false); enable(modeloSearch,false); enable(modeloClear,false); toggle(marcaOutroWrap,true); marcaOutroInput&&marcaOutroInput.setAttribute('required',''); toggle(modeloOutroWrap,true); modeloOutroInput&&modeloOutroInput.setAttribute('required',''); if(useLinha){ toggle(linhaFilterWrap,false); if(linhaRow) toggle(linhaRow,false); enable(linhaSearch,false); enable(linhaClear,false);} return; }
      popularMarcas(v);
    });

    marcaSel&&marcaSel.addEventListener('change',()=>{
      const t=tipoSel.value, m=marcaSel.value;
      if(!t||!m){ resetSelect(modeloSel,'Selecione o Modelo',true); toggle(modeloOutroWrap,false); modeloOutroInput&&modeloOutroInput.removeAttribute('required'); enable(modeloSearch,false); enable(modeloClear,false); toggle(linhaFilterWrap,false); toggle(linhaRow,false); enable(linhaSearch,false); enable(linhaClear,false); return; }
      if(includeOutro && m==='Outro'){ resetSelect(modeloSel,'Selecione o Modelo',true); enable(modeloSearch,false); enable(modeloClear,false); toggle(marcaOutroWrap,true); marcaOutroInput&&marcaOutroInput.setAttribute('required',''); toggle(modeloOutroWrap,true); modeloOutroInput&&modeloOutroInput.setAttribute('required',''); toggle(linhaFilterWrap,false); toggle(linhaRow,false); enable(linhaSearch,false); enable(linhaClear,false); selectedLinha=''; linhaSug&&linhaSug.classList.remove('show'); if(linhaSearch) linhaSearch.value=''; return; }
      toggle(marcaOutroWrap,false); marcaOutroInput&&marcaOutroInput.removeAttribute('required'); popularModelos(t,m); toggle(modeloOutroWrap,false); modeloOutroInput&&modeloOutroInput.removeAttribute('required');
    });

    modeloSel&&modeloSel.addEventListener('change',()=>{ const v=modeloSel.value; if(includeOutro){ const on=(v==='Outro'); toggle(modeloOutroWrap,on); if(modeloOutroInput){ if(on) modeloOutroInput.setAttribute('required',''); else modeloOutroInput.removeAttribute('required'); } } });

    // Search (marca/modelo)
    marcaSearch&&marcaSearch.addEventListener('input',()=>{ if(marcaSel.hasAttribute('disabled')) return; aplicarFiltroSelect(marcaSel,currentMarcas,marcaSearch.value,'Selecione a Marca',includeOutro); renderSuggestions(marcaSug,currentMarcas,marcaSearch.value,(val)=>{ marcaSearch.value=val; aplicarFiltroSelect(marcaSel,currentMarcas,'','Selecione a Marca',includeOutro); marcaSel.value=val; marcaSel.dispatchEvent(new Event('change')); marcaSug&&marcaSug.classList.remove('show'); marcaSearch.setAttribute('aria-expanded','false'); }); setActive(marcaSug,0,marcaSearch); marcaActiveIndex = (marcaSug && marcaSug.querySelectorAll('.item').length)?0:-1; announceSuggestions(marcaSearch, marcaSug); });
    modeloSearch&&modeloSearch.addEventListener('input',()=>{ if(modeloSel.hasAttribute('disabled')) return; aplicarFiltroSelect(modeloSel,currentModelos,modeloSearch.value,'Selecione o Modelo',includeOutro); renderSuggestions(modeloSug,currentModelos,modeloSearch.value,(val)=>{ modeloSearch.value=val; aplicarFiltroSelect(modeloSel,currentModelos,'','Selecione o Modelo',includeOutro); modeloSel.value=val; modeloSel.dispatchEvent(new Event('change')); modeloSug&&modeloSug.classList.remove('show'); modeloSearch.setAttribute('aria-expanded','false'); }); setActive(modeloSug,0,modeloSearch); modeloActiveIndex = (modeloSug && modeloSug.querySelectorAll('.item').length)?0:-1; announceSuggestions(modeloSearch, modeloSug); });
    marcaClear&&marcaClear.addEventListener('click',()=>{ if(marcaSel.hasAttribute('disabled')) return; marcaSearch.value=''; aplicarFiltroSelect(marcaSel,currentMarcas,'','Selecione a Marca',includeOutro); marcaSug&&marcaSug.classList.remove('show'); });
    modeloClear&&modeloClear.addEventListener('click',()=>{ if(modeloSel.hasAttribute('disabled')) return; modeloSearch.value=''; aplicarFiltroSelect(modeloSel,currentModelos,'','Selecione o Modelo',includeOutro); modeloSug&&modeloSug.classList.remove('show'); });

    // Teclado + foco (Marca)
    if(marcaSearch){
      marcaSearch.addEventListener('focus',()=>{ if(marcaSug && marcaSug.innerHTML.trim()) marcaSug.classList.add('show'); });
      marcaSearch.addEventListener('blur',()=>{ setTimeout(()=>{ if(marcaSug) marcaSug.classList.remove('show'); marcaSearch.setAttribute('aria-expanded','false'); },100); });
      marcaSearch.addEventListener('keydown',(e)=>{
        const items = marcaSug ? Array.from(marcaSug.querySelectorAll('.item')) : [];
        if(!items.length) return;
        if(e.key==='ArrowDown'){ e.preventDefault(); marcaActiveIndex = Math.min(items.length-1, (marcaActiveIndex<0?0:marcaActiveIndex)+1); setActive(marcaSug, marcaActiveIndex, marcaSearch); }
        else if(e.key==='ArrowUp'){ e.preventDefault(); marcaActiveIndex = Math.max(0, (marcaActiveIndex<0?0:marcaActiveIndex)-1); setActive(marcaSug, marcaActiveIndex, marcaSearch); }
        else if(e.key==='Home'){ e.preventDefault(); marcaActiveIndex = 0; setActive(marcaSug, marcaActiveIndex, marcaSearch); }
        else if(e.key==='End'){ e.preventDefault(); marcaActiveIndex = items.length-1; setActive(marcaSug, marcaActiveIndex, marcaSearch); }
        else if(e.key==='PageDown'){ e.preventDefault(); const step=5; marcaActiveIndex = Math.min(items.length-1, (marcaActiveIndex<0?0:marcaActiveIndex)+step); setActive(marcaSug, marcaActiveIndex, marcaSearch); }
        else if(e.key==='PageUp'){ e.preventDefault(); const step=5; marcaActiveIndex = Math.max(0, (marcaActiveIndex<0?0:marcaActiveIndex)-step); setActive(marcaSug, marcaActiveIndex, marcaSearch); }
        else if(e.key==='Enter'){ e.preventDefault(); const val = items[marcaActiveIndex]?.getAttribute('data-val'); if(val){ marcaSearch.value=val; aplicarFiltroSelect(marcaSel,currentMarcas,'','Selecione a Marca',includeOutro); marcaSel.value=val; marcaSel.dispatchEvent(new Event('change')); if(marcaSug) marcaSug.classList.remove('show'); marcaSearch.setAttribute('aria-expanded','false'); } }
        else if(e.key==='Escape'){ e.preventDefault(); if(marcaSug) marcaSug.classList.remove('show'); marcaSearch.setAttribute('aria-expanded','false'); }
      });
    }

    // Teclado + foco (Modelo)
    if(modeloSearch){
      modeloSearch.addEventListener('focus',()=>{ if(modeloSug && modeloSug.innerHTML.trim()) modeloSug.classList.add('show'); });
      modeloSearch.addEventListener('blur',()=>{ setTimeout(()=>{ if(modeloSug) modeloSug.classList.remove('show'); modeloSearch.setAttribute('aria-expanded','false'); },100); });
      modeloSearch.addEventListener('keydown',(e)=>{
        const items = modeloSug ? Array.from(modeloSug.querySelectorAll('.item')) : [];
        if(!items.length) return;
        if(e.key==='ArrowDown'){ e.preventDefault(); modeloActiveIndex = Math.min(items.length-1, (modeloActiveIndex<0?0:modeloActiveIndex)+1); setActive(modeloSug, modeloActiveIndex, modeloSearch); }
        else if(e.key==='ArrowUp'){ e.preventDefault(); modeloActiveIndex = Math.max(0, (modeloActiveIndex<0?0:modeloActiveIndex)-1); setActive(modeloSug, modeloActiveIndex, modeloSearch); }
        else if(e.key==='Home'){ e.preventDefault(); modeloActiveIndex = 0; setActive(modeloSug, modeloActiveIndex, modeloSearch); }
        else if(e.key==='End'){ e.preventDefault(); modeloActiveIndex = items.length-1; setActive(modeloSug, modeloActiveIndex, modeloSearch); }
        else if(e.key==='PageDown'){ e.preventDefault(); const step=5; modeloActiveIndex = Math.min(items.length-1, (modeloActiveIndex<0?0:modeloActiveIndex)+step); setActive(modeloSug, modeloActiveIndex, modeloSearch); }
        else if(e.key==='PageUp'){ e.preventDefault(); const step=5; modeloActiveIndex = Math.max(0, (modeloActiveIndex<0?0:modeloActiveIndex)-step); setActive(modeloSug, modeloActiveIndex, modeloSearch); }
        else if(e.key==='Enter'){ e.preventDefault(); const val = items[modeloActiveIndex]?.getAttribute('data-val'); if(val){ modeloSearch.value=val; aplicarFiltroSelect(modeloSel,currentModelos,'','Selecione o Modelo',includeOutro); modeloSel.value=val; modeloSel.dispatchEvent(new Event('change')); if(modeloSug) modeloSug.classList.remove('show'); modeloSearch.setAttribute('aria-expanded','false'); } }
        else if(e.key==='Escape'){ e.preventDefault(); if(modeloSug) modeloSug.classList.remove('show'); modeloSearch.setAttribute('aria-expanded','false'); }
      });
    }

    // Linha (opcional)
    if(useLinha && linhaSearch){
      linhaSearch.addEventListener('input',()=>{ if(!currentLinhas.length) return; renderSuggestions(linhaSug,currentLinhas,linhaSearch.value,(val)=>{ linhaSearch.value=val; selectedLinha=val; popularModelos(tipoSel.value,marcaSel.value); linhaSug&&linhaSug.classList.remove('show'); linhaSearch.setAttribute('aria-expanded','false'); }); setActive(linhaSug,0,linhaSearch); linhaActiveIndex = (linhaSug && linhaSug.querySelectorAll('.item').length)?0:-1; announceSuggestions(linhaSearch, linhaSug); });
      linhaClear&&linhaClear.addEventListener('click',()=>{ if(!currentLinhas.length) return; linhaSearch.value=''; selectedLinha=''; popularModelos(tipoSel.value,marcaSel.value); linhaSug&&linhaSug.classList.remove('show'); linhaSearch.setAttribute('aria-expanded','false'); });
      linhaSearch.addEventListener('focus',()=>{ if(linhaSug && linhaSug.innerHTML.trim()) linhaSug.classList.add('show'); });
      linhaSearch.addEventListener('blur',()=>{ setTimeout(()=>{ if(linhaSug) linhaSug.classList.remove('show'); linhaSearch.setAttribute('aria-expanded','false'); },100); });
      linhaSearch.addEventListener('keydown',(e)=>{
        const items = linhaSug ? Array.from(linhaSug.querySelectorAll('.item')) : [];
        if(!items.length) return;
        if(e.key==='ArrowDown'){ e.preventDefault(); linhaActiveIndex = Math.min(items.length-1, (linhaActiveIndex<0?0:linhaActiveIndex)+1); setActive(linhaSug, linhaActiveIndex, linhaSearch); }
        else if(e.key==='ArrowUp'){ e.preventDefault(); linhaActiveIndex = Math.max(0, (linhaActiveIndex<0?0:linhaActiveIndex)-1); setActive(linhaSug, linhaActiveIndex, linhaSearch); }
        else if(e.key==='Home'){ e.preventDefault(); linhaActiveIndex = 0; setActive(linhaSug, linhaActiveIndex, linhaSearch); }
        else if(e.key==='End'){ e.preventDefault(); linhaActiveIndex = items.length-1; setActive(linhaSug, linhaActiveIndex, linhaSearch); }
        else if(e.key==='PageDown'){ e.preventDefault(); const step=5; linhaActiveIndex = Math.min(items.length-1, (linhaActiveIndex<0?0:linhaActiveIndex)+step); setActive(linhaSug, linhaActiveIndex, linhaSearch); }
        else if(e.key==='PageUp'){ e.preventDefault(); const step=5; linhaActiveIndex = Math.max(0, (linhaActiveIndex<0?0:linhaActiveIndex)-step); setActive(linhaSug, linhaActiveIndex, linhaSearch); }
        else if(e.key==='Enter'){ e.preventDefault(); const val = items[linhaActiveIndex]?.getAttribute('data-val'); if(val){ linhaSearch.value=val; selectedLinha=val; popularModelos(tipoSel.value,marcaSel.value); if(linhaSug) linhaSug.classList.remove('show'); linhaSearch.setAttribute('aria-expanded','false'); } }
        else if(e.key==='Escape'){ e.preventDefault(); if(linhaSug) linhaSug.classList.remove('show'); linhaSearch.setAttribute('aria-expanded','false'); }
      });
    }

    // Click fora fecha sugestões
    document.addEventListener('click',(e)=>{ if(marcaSug && !marcaSug.contains(e.target) && e.target!==marcaSearch) marcaSug.classList.remove('show'); if(modeloSug && !modeloSug.contains(e.target) && e.target!==modeloSearch) modeloSug.classList.remove('show'); if(linhaSug && !linhaSug.contains(e.target) && e.target!==linhaSearch) linhaSug.classList.remove('show'); });

    // Se já existir valor em tipo, inicializa
    if(tipoSel && tipoSel.value){ if(includeOutro && tipoSel.value==='Outro'){ toggle(marcaOutroWrap,true); marcaOutroInput&&marcaOutroInput.setAttribute('required',''); toggle(modeloOutroWrap,true); modeloOutroInput&&modeloOutroInput.setAttribute('required',''); enable(marcaSearch,false); enable(modeloSearch,false); } else { popularMarcas(tipoSel.value); } }
  };

  GLOBAL.CatalogoBikesUI = CatalogoBikesUI;
})();
