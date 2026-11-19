/* Expedição Bromélia · interações
 *
 * Como funciona
 * -------------
 * O HTML das partes interativas usa alguns atributos que este arquivo lê:
 *   data-text="Texto {{caminho}}"   → conteúdo de texto do elemento
 *   data-a-NOME="{{caminho}}"       → atributo NOME (ex.: data-a-src, data-a-aria-pressed)
 *   data-style="prop: {{caminho}}"  → propriedade CSS vinda dos dados (cores, posições)
 *   data-if="caminho"               → mostra/esconde o elemento
 *   data-on="caminho"               → função chamada no clique
 *   <template data-for="item in caminho"> → repete o conteúdo para cada item
 *
 * Cada seção é um módulo com estado próprio e uma função view(), que devolve
 * os valores usados no HTML. Ao mudar o estado, só a seção é atualizada.
 * Listas com o mesmo tamanho reaproveitam os elementos (o foco não se perde).
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilitários
  // ---------------------------------------------------------------------------
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  var suportaWebp = (function () {
    try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; }
    catch (e) { return false; }
  })();

  function embaralhar(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var x = a[j]; a[j] = a[k]; a[k] = x;
    }
    return a;
  }

  function contar(lista, fn) {
    return lista.filter(fn).length;
  }

  // ---------------------------------------------------------------------------
  // Binder: aplica os valores de view() no HTML
  // ---------------------------------------------------------------------------
  var MARCA = /\{\{\s*([^}]+?)\s*\}\}/g;
  var MARCA_UNICA = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function ler(ctx, caminho) {
    return caminho.split('.').reduce(function (obj, chave) {
      return obj == null ? undefined : obj[chave];
    }, ctx);
  }

  function interpolar(modelo, ctx) {
    var unico = modelo.match(MARCA_UNICA);
    if (unico) return ler(ctx, unico[1]);
    return modelo.replace(MARCA, function (_, caminho) {
      var v = ler(ctx, caminho);
      return v == null ? '' : String(v);
    });
  }

  function caminhoImagem(src, el) {
    var d = IMG_DIMS[src];
    if (d) { el.setAttribute('width', d[0]); el.setAttribute('height', d[1]); }
    return suportaWebp && /\.jpg$/.test(src) ? src.replace(/\.jpg$/, '.webp') : src;
  }

  function definirAtributo(el, nome, valor) {
    if (valor == null || valor === '' || (valor === false && nome.indexOf('aria-') !== 0)) {
      el.removeAttribute(nome);
      return;
    }
    if (nome === 'src') valor = caminhoImagem(valor, el);
    valor = String(valor);
    if (el.getAttribute(nome) !== valor) el.setAttribute(nome, valor);
  }

  function aplicar(el, ctx) {
    var ds = el.dataset;
    if (ds.text !== undefined) {
      var t = interpolar(ds.text, ctx);
      t = t == null ? '' : String(t);
      if (el.textContent !== t) el.textContent = t;
    }
    if (ds.if !== undefined) el.hidden = !ler(ctx, ds.if);
    if (ds.on !== undefined) el._acao = ler(ctx, ds.on);
    if (ds.style !== undefined) {
      ds.style.split(';').forEach(function (decl) {
        var i = decl.indexOf(':');
        if (i < 0) return;
        var v = interpolar(decl.slice(i + 1).trim(), ctx);
        el.style.setProperty(decl.slice(0, i).trim(), v == null ? '' : String(v));
      });
    }
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      if (a.name.indexOf('data-a-') === 0) definirAtributo(el, a.name.slice(7), interpolar(a.value, ctx));
    });
  }

  function renderizarLista(tpl, ctx) {
    var partes = tpl.dataset.for.split(' in ');
    var nome = partes[0];
    var itens = ler(ctx, partes[1]) || [];
    var nos = tpl._nos || [];
    if (nos.length !== itens.length) {
      nos.forEach(function (n) { n.remove(); });
      nos = itens.map(function () {
        var n = tpl.content.firstElementChild.cloneNode(true);
        n._item = true;
        tpl.parentNode.insertBefore(n, tpl);
        return n;
      });
      tpl._nos = nos;
    }
    itens.forEach(function (item, i) {
      var sub = Object.create(ctx);
      sub[nome] = item;
      vincular(nos[i], sub, true);
    });
  }

  function vincular(raiz, ctx, ehRaiz) {
    aplicar(raiz, ctx);
    var el = raiz.firstElementChild;
    while (el) {
      var prox = el.nextElementSibling;
      if (el.tagName === 'TEMPLATE') {
        if (el.dataset.for) renderizarLista(el, ctx);
      } else if (!el._item && !el._modulo) {
        vincular(el, ctx, false);
      }
      el = prox;
    }
  }

  // Cria um módulo de seção: estado + view + atualização só da própria raiz.
  function secao(raiz, estado, view, aoAtualizar) {
    raiz._modulo = true;
    var mod = {
      raiz: raiz,
      estado: estado,
      set: function (mudancas) {
        Object.assign(mod.estado, mudancas);
        mod.render();
      },
      render: function () {
        vincular(raiz, view(mod.estado, mod), true);
        if (aoAtualizar) aoAtualizar(mod.estado, mod);
      }
    };
    return mod;
  }

  // Um único ouvinte de clique para todos os botões com data-on.
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-on]');
    if (!el || typeof el._acao !== 'function') return;
    var tinhaFoco = document.activeElement === el;
    var painel = el.closest('[aria-live]') || el.closest('section');
    el._acao(e);
    // Se o botão clicado sumiu (troca de pergunta, fim de jogo), o foco vai
    // para o painel, para quem navega pelo teclado não voltar ao topo.
    if (tinhaFoco && (!el.isConnected || el.offsetParent === null) && painel && painel.isConnected) {
      if (!painel.hasAttribute('tabindex')) painel.setAttribute('tabindex', '-1');
      painel.focus({ preventScroll: true });
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Cabeçalho: menu em grupos, tamanho do texto, ouvir e alto contraste
  // ---------------------------------------------------------------------------
  function criarCabecalho() {
    var app = $('#app');
    var mod = secao($('.nav-header'), { navG: -1, zoom: 1, contraste: false, lendo: false }, function (s, m) {
      return {
        navGrupos: NAVG.map(function (g, k) {
          var on = k === s.navG;
          return {
            nome: g.nome, sel: on, seta: on ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6',
            pick: function () { m.set({ navG: s.navG === k ? -1 : k }); }
          };
        }),
        navAberto: s.navG >= 0,
        navAtual: s.navG >= 0
          ? { nome: NAVG[s.navG].nome, links: NAVG[s.navG].links.map(function (l) { return { t: l[0], h: l[1] }; }) }
          : { nome: '', links: [] },
        fecharNav: function () { m.set({ navG: -1 }); },
        menorFonte: function () { m.set({ zoom: Math.max(0.9, Math.round((s.zoom - 0.1) * 10) / 10) }); },
        maiorFonte: function () { m.set({ zoom: Math.min(1.4, Math.round((s.zoom + 0.1) * 10) / 10) }); },
        contraste: s.contraste,
        alternarContraste: function () { m.set({ contraste: !s.contraste }); },
        lendo: s.lendo,
        ouvirLabel: s.lendo ? 'Parar' : 'Ouvir',
        ouvir: function () { ouvir(m); }
      };
    }, function (s) {
      app.style.zoom = s.zoom === 1 ? '' : String(s.zoom);
      app.classList.toggle('is-contraste', s.contraste);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mod.estado.navG >= 0) mod.set({ navG: -1 });
    });
    return mod;
  }

  // Lê em voz alta a primeira seção visível abaixo do cabeçalho.
  function ouvir(mod) {
    var sp = window.speechSynthesis;
    if (!sp) return;
    if (mod.estado.lendo) {
      sp.cancel();
      mod.set({ lendo: false });
      return;
    }
    var secoes = Array.prototype.slice.call(document.querySelectorAll('section[id]'));
    var alvo = secoes.filter(function (el) { return el.getBoundingClientRect().bottom > 160; })[0];
    if (!alvo) return;
    var fala = new SpeechSynthesisUtterance(alvo.innerText.replace(/\s+/g, ' ').slice(0, 4000));
    fala.lang = 'pt-BR';
    fala.rate = 1;
    fala.onend = function () { mod.set({ lendo: false }); };
    sp.cancel();
    sp.speak(fala);
    mod.set({ lendo: true });
  }

  // ---------------------------------------------------------------------------
  // 3. Conceitos-chave: cartões que viram
  // ---------------------------------------------------------------------------
  function criarConceitos() {
    return secao($('#curiosidades'), { flip: {} }, function (s, m) {
      return {
        cards: CARDS.map(function (c, i) {
          return Object.assign({}, c, {
            num: '0' + (i + 1),
            flipped: !!s.flip[i],
            toggle: function () {
              var f = Object.assign({}, s.flip);
              f[i] = !f[i];
              m.set({ flip: f });
            }
          });
        })
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Classificação e origem do nome
  // ---------------------------------------------------------------------------
  function criarClassificacao() {
    return secao($('#classificacao'), { nivel: 4 }, function (s, m) {
      return {
        niveis: NIVEIS.map(function (n, i) {
          return Object.assign({}, n, {
            sel: i === s.nivel,
            caminho: i < s.nivel,
            indent: (i * 12) + 'px',
            pick: function () { m.set({ nivel: i }); }
          });
        }),
        nivel: NIVEIS[s.nivel]
      };
    });
  }

  function criarNome() {
    return secao($('#nome'), { tupi: 0 }, function (s, m) {
      return {
        tupi: TUPI.map(function (w, k) {
          return { t: w.t, sel: k === s.tupi, pick: function () { m.set({ tupi: k }); } };
        }),
        tupiAtual: TUPI[s.tupi]
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Subfamílias: tabela comparativa e cladograma
  // ---------------------------------------------------------------------------
  function criarSubfamilias() {
    return secao($('#subfamilias'), { linha: 2, clado: 'classica' }, function (s, m) {
      var classico = s.clado === 'classica';
      return {
        subs: SUBS,
        linhas: LINHAS.map(function (l, i) {
          return Object.assign({}, l, { sel: i === s.linha, pick: function () { m.set({ linha: i }); } });
        }),
        cl: classico ? CLADO.c : CLADO.a,
        modoClassico: classico,
        modoAtual: !classico,
        verClassica: function () { m.set({ clado: 'classica' }); },
        verAtual: function () { m.set({ clado: 'atual' }); },
        cladoTexto: classico
          ? 'Classificação clássica: Pitcairnioideae (laranja) aparece em dois trechos da árvore, e Tillandsioideae e Bromelioideae ficam “aninhadas” entre eles. Como não reúne um ancestral e todos os seus descendentes, Pitcairnioideae é um grupo parafilético.'
          : 'Classificação atual: cada uma das 8 subfamílias ocupa um ramo completo, ou seja, é monofilética. Repare que Puya (Puyoideae) é a parente mais próxima de Bromelioideae, a subfamília do abacaxi.'
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 6. Anatomia: 12 rótulos na ilustração + lista
  // ---------------------------------------------------------------------------
  function criarAnatomia() {
    return secao($('#anatomia'), { parte: 4 }, function (s, m) {
      return {
        partes: PARTES.map(function (p) {
          return Object.assign({}, p, { sel: p.n === s.parte, pick: function () { m.set({ parte: p.n }); } });
        }),
        parte: PARTES[s.parte - 1],
        partePrev: function () { m.set({ parte: s.parte === 1 ? 12 : s.parte - 1 }); },
        parteNext: function () { m.set({ parte: s.parte === 12 ? 1 : s.parte + 1 }); }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Estruturas em detalhe: 8 abas
  // ---------------------------------------------------------------------------
  function criarMorfologia() {
    return secao($('#morfologia'), { orgao: 3 }, function (s, m) {
      var total = ORGAOS.length;
      return {
        orgaos: ORGAOS.map(function (o, i) {
          return { nome: o.nome, sel: i === s.orgao, pick: function () { m.set({ orgao: i }); } };
        }),
        orgao: Object.assign({}, ORGAOS[s.orgao], { fit: ORGAOS[s.orgao].fit || 'cover' }),
        orgaoNum: s.orgao + 1,
        orgaoPrev: function () { m.set({ orgao: (s.orgao + total - 1) % total }); },
        orgaoNext: function () { m.set({ orgao: (s.orgao + 1) % total }); }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 8. A flor trímera: peça escolhida destaca o verticilo no diagrama
  // ---------------------------------------------------------------------------
  function criarFlor() {
    return secao($('#flor'), { peca: 'g' }, function (s, m) {
      var op = {};
      PECAS.forEach(function (p) { op[p.id] = p.id === s.peca ? '1' : '0.28'; });
      return {
        pecas: PECAS.map(function (p) {
          return Object.assign({}, p, { sel: p.id === s.peca, pick: function () { m.set({ peca: p.id }); } });
        }),
        op: op
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Fotossíntese CAM: noite e dia
  // ---------------------------------------------------------------------------
  function criarCam() {
    return secao($('#cam'), { modo: 'noite' }, function (s, m) {
      var n = s.modo === 'noite';
      return {
        cam: {
          modo: s.modo, noite: n, dia: !n,
          ceuLua: '#1E1B4B', astro: n ? '#F8FAFC' : '#FACC15', luaRecorte: n ? '1' : '0', estrelas: n ? '1' : '0',
          poro: n ? '18' : '11', fenda: n ? '14' : '1.5', co2: n ? '1' : '0', agua: '0',
          acidoY: n ? '316' : '356', acidoH: n ? '56' : '16', acucar: n ? '0' : '1', txt: n ? '#E0E7FF' : '#1E3A8A',
          rotulo: n ? 'Noite · estômatos abertos' : 'Dia · estômatos fechados',
          titulo: n ? 'Respirando no frescor' : 'Fotossíntese de portas fechadas',
          texto: n
            ? 'Com o ar mais fresco e úmido, os estômatos se abrem e o gás carbônico entra. Ele é guardado no vacúolo das células na forma de ácido málico, que vai se acumulando durante a noite.'
            : 'Com sol e calor, os estômatos ficam fechados para não perder água. O ácido málico guardado à noite libera o gás carbônico de volta, e a planta faz a fotossíntese com a luz do dia, produzindo açúcares.',
          aria: n
            ? 'Cena noturna: estômatos abertos, gás carbônico entrando e ácido málico enchendo o vacúolo'
            : 'Cena diurna: estômatos fechados, vacúolo esvaziando e produção de açúcar'
        },
        camNoite: function () { m.set({ modo: 'noite' }); },
        camDia: function () { m.set({ modo: 'dia' }); }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 10. Ciclo de vida: roda com 7 etapas e "Ver girar"
  // ---------------------------------------------------------------------------
  function criarCiclo() {
    var timer = null;
    var total = ETAPAS.length;
    var mod = secao($('#ciclo'), { etapa: 1, tocando: false }, function (s, m) {
      function ir(n) { parar(); m.set({ etapa: n }); }
      var v = {
        etapa: ETAPAS[s.etapa - 1],
        etapaTag: ETAPAS[s.etapa - 1].tag,
        etapaAssexuada: s.etapa === 7,
        dots: ETAPAS.map(function (e) { return { on: e.n === s.etapa }; }),
        etapaPrev: function () { ir(s.etapa === 1 ? total : s.etapa - 1); },
        etapaNext: function () { ir(s.etapa === total ? 1 : s.etapa + 1); },
        tocando: s.tocando,
        cartaoLive: s.tocando ? 'off' : 'polite',
        podeGirar: !menosMovimento.matches,
        playLabel: s.tocando ? 'Pausar' : 'Ver girar',
        playIcon: s.tocando ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M7 4.5v15l12-7.5z',
        alternarPlay: function () {
          if (s.tocando) { parar(); return; }
          timer = setInterval(function () { m.set({ etapa: s.etapa === total ? 1 : s.etapa + 1 }); }, 2600);
          m.set({ tocando: true });
        }
      };
      ETAPAS.forEach(function (e) {
        v['ciclo' + e.n] = { sel: s.etapa === e.n, pick: function () { ir(e.n); } };
      });
      return v;
    });

    function parar() {
      if (timer) { clearInterval(timer); timer = null; }
      if (mod.estado.tocando) mod.set({ tocando: false });
    }
    menosMovimento.addEventListener('change', function () { parar(); mod.render(); });
    return mod;
  }

  // ---------------------------------------------------------------------------
  // 11. Tipos ecológicos
  // ---------------------------------------------------------------------------
  function criarTipos() {
    return secao($('#tipos'), { tipo: 2 }, function (s, m) {
      var v = { tipo: TIPOS[s.tipo - 1] };
      TIPOS.forEach(function (t) {
        v['tipo' + t.n] = { sel: s.tipo === t.n, pick: function () { m.set({ tipo: t.n }); } };
      });
      return v;
    });
  }

  // ---------------------------------------------------------------------------
  // 12. Mapa de distribuição
  // ---------------------------------------------------------------------------
  function criarMapa() {
    return secao($('#mapa'), { ativo: 'mata', visitados: ['mata'], foto: 0 }, function (s, m) {
      function escolher(id) {
        var v = s.visitados.indexOf(id) >= 0 ? s.visitados : s.visitados.concat([id]);
        m.set({ ativo: id, visitados: v, foto: 0 });
      }
      var idx = ESPECIES.findIndex(function (e) { return e.id === s.ativo; });
      var e = ESPECIES[idx];
      var n = s.visitados.length;
      return {
        especies: ESPECIES.map(function (x) {
          var sel = x.id === s.ativo;
          var vis = s.visitados.indexOf(x.id) >= 0;
          var p = PINS[x.id];
          return {
            aria: x.regiao + ': ' + x.nome, sel: sel, cor: x.cor, corEscura: x.texto_cor,
            left: (p[0] / 10) + '%', top: (p[1] / 7.2) + '%',
            mark: vis && !sel ? '✓' : '',
            chipLabel: (vis ? '✓ ' : '') + x.regiao,
            pick: function () { escolher(x.id); }
          };
        }),
        e: e,
        stopNum: idx + 1,
        visitCount: n,
        fotoAtual: e.fotos[Math.min(s.foto, e.fotos.length - 1)],
        thumbs: e.fotos.length > 1 ? e.fotos.map(function (f, k) {
          return { src: f.src, aria: 'Ver foto: ' + f.legenda, sel: k === s.foto, pick: function () { m.set({ foto: k }); } };
        }) : [],
        progressDeg: Math.round((n / ESPECIES.length) * 360) + 'deg',
        progressLabel: n === ESPECIES.length ? 'Todas as regiões vistas' : 'Regiões vistas',
        prev: function () { escolher(ESPECIES[(idx - 1 + ESPECIES.length) % ESPECIES.length].id); },
        next: function () { escolher(ESPECIES[(idx + 1) % ESPECIES.length].id); }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 13. Ecologia (3 abas) e Evolução (linha do tempo)
  // ---------------------------------------------------------------------------
  function criarEcologia() {
    return secao($('#ecologia'), { eco: 0 }, function (s, m) {
      return {
        ecoTabs: ECO.map(function (x, k) {
          return { nome: x.nome, sel: k === s.eco, pick: function () { m.set({ eco: k }); } };
        }),
        eco: ECO[s.eco]
      };
    });
  }

  function criarEvolucao() {
    return secao($('#evolucao'), { marco: 0 }, function (s, m) {
      return {
        marcos: MARCOS.map(function (x, k) {
          return { n: x.n, quando: x.quando, curto: x.curto, sel: k === s.marco, pick: function () { m.set({ marco: k }); } };
        }),
        marco: MARCOS[s.marco]
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 17. Bahia: 4 regiões
  // ---------------------------------------------------------------------------
  function criarBahia() {
    // Duas cores das regiões ficam claras demais sob texto branco; no selo
    // usamos o tom seguinte, mais escuro, para manter o contraste AA.
    var FUNDO_ESCURO = { '#059669': '#047857', '#CA8A04': '#A16207' };
    return secao($('#bahia'), { regiao: 'caatinga' }, function (s, m) {
      var regiao = REGIOES.filter(function (g) { return g.id === s.regiao; })[0];
      var v = { regiao: regiao, regiaoFundo: FUNDO_ESCURO[regiao.cor] || regiao.cor };
      REGIOES.forEach(function (g) {
        v['reg_' + g.id] = { sel: s.regiao === g.id, pick: function () { m.set({ regiao: g.id }); } };
      });
      return v;
    });
  }

  // ---------------------------------------------------------------------------
  // 18. Fotos UEFS: cartões que viram
  // ---------------------------------------------------------------------------
  function criarUefs() {
    return secao($('#uefs'), { flip: {} }, function (s, m) {
      return {
        uefs: UEFS.map(function (u, k) {
          var f = !!s.flip[k];
          return Object.assign({}, u, {
            flipped: f,
            aria: (f ? 'Voltar à foto: ' : 'Ver curiosidade: ') + u.legenda,
            toggle: function () {
              var nf = Object.assign({}, s.flip);
              nf[k] = !nf[k];
              m.set({ flip: nf });
            }
          });
        })
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 20. Galeria com lightbox
  // ---------------------------------------------------------------------------
  function criarGaleria() {
    var dialogo = $('#lightbox');
    var abridor = null;
    var total = GALERIA.length;

    var caixa = secao(dialogo, { i: 0 }, function (s, m) {
      return {
        foto: GALERIA[s.i],
        posicao: (s.i + 1) + ' de ' + total,
        anterior: function () { m.set({ i: (s.i - 1 + total) % total }); },
        proxima: function () { m.set({ i: (s.i + 1) % total }); },
        fechar: function () { dialogo.close(); }
      };
    });

    function abrir(i) {
      abridor = document.activeElement;
      caixa.set({ i: i });
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.setAttribute('open', '');
    }

    dialogo.addEventListener('click', function (e) {
      // clique fora da foto (no fundo escurecido) fecha
      if (e.target === dialogo) dialogo.close();
    });
    dialogo.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); caixa.set({ i: (caixa.estado.i - 1 + total) % total }); }
      if (e.key === 'ArrowRight') { e.preventDefault(); caixa.set({ i: (caixa.estado.i + 1) % total }); }
    });
    dialogo.addEventListener('close', function () {
      if (abridor && abridor.focus) abridor.focus();
    });

    var mod = secao($('#galeria'), {}, function () {
      return {
        galeria: GALERIA.map(function (g, i) {
          return Object.assign({}, g, { abrir: function () { abrir(i); } });
        })
      };
    });
    return [mod, caixa];
  }

  // ---------------------------------------------------------------------------
  // 21. Conservação: Desafio do Guardião
  // ---------------------------------------------------------------------------
  function criarConservacao() {
    var TITULOS = ['Aprendiz da floresta', 'Aprendiz da floresta', 'Guardião em treinamento', 'Quase lá, Guardião!', 'Guardião das Bromélias!'];
    return secao($('#conservacao'), { dz: 0, resp: [null, null, null, null] }, function (s, m) {
      var acertos = contar(DESAFIOS, function (d, k) { return s.resp[k] === d.c; });
      var k = Math.min(s.dz, 3);
      var d = DESAFIOS[k];
      var r = s.resp[k];
      var feito = r !== null;
      var ok = feito && r === d.c;
      return {
        desafios: DESAFIOS.map(function (x, j) {
          var rj = s.resp[j];
          var fj = rj !== null;
          var okj = fj && rj === x.c;
          var atual = j === s.dz && s.dz < 4;
          return {
            titulo: x.titulo, sel: atual,
            mark: fj ? (okj ? '✓' : '✕') : String(j + 1),
            estado: fj ? (okj ? 'ok' : 'erro') : (atual ? 'atual' : ''),
            pick: function () { m.set({ dz: j }); }
          };
        }),
        desafioAtivo: s.dz < 4,
        desafioFim: s.dz >= 4,
        desafio: {
          n: d.n, p: d.p, e: d.e, respondido: feito,
          estado: ok ? 'ok' : 'erro',
          fbTitulo: ok ? 'Atitude de Guardião!' : 'Hmm, melhor repensar.',
          ops: d.ops.map(function (t, j) {
            var certo = feito && j === d.c;
            var errado = feito && j === r && j !== d.c;
            return {
              t: t, icon: certo ? '✓' : errado ? '✕' : '', estado: certo ? 'certo' : errado ? 'errado' : '',
              pick: function () {
                if (s.resp[k] !== null) return;
                var nr = s.resp.slice();
                nr[k] = j;
                m.set({ resp: nr });
              }
            };
          })
        },
        proximoDesafio: function () {
          var nx = s.resp.indexOf(null);
          m.set({ dz: nx === -1 ? 4 : nx });
        },
        proximoDesafioLabel: s.resp.indexOf(null) === -1 ? 'Ver resultado' : 'Próxima situação →',
        guardPontos: acertos,
        guardPct: (acertos * 25) + '%',
        guardDeg: (acertos * 90) + 'deg',
        guardTitulo: TITULOS[acertos],
        guardTexto: 'Você acertou ' + acertos + ' de 4 situações. Leve essas quatro atitudes para fora da tela:',
        reiniciarDesafio: function () { m.set({ dz: 0, resp: [null, null, null, null] }); }
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 23. Laboratório de jogos: chave, memória e "É bromélia ou não?"
  // ---------------------------------------------------------------------------
  function criarJogos() {
    var NOMES = ['Chave de identificação', 'Jogo da memória', 'É bromélia ou não?'];
    var estado = {
      jogo: 0,
      // chave de identificação
      ex: 'amarela', kPath: ['q1'], kTrilha: [], kRes: null,
      // memória
      memOrdem: embaralhar(MEM.length * 2), memAbertas: [], memAchados: [], memJog: 0, memTrava: false,
      // é bromélia ou não?
      fi: 0, fr: null, fPontos: 0
    };

    return secao($('#jogos'), estado, function (s, m) {
      var exemplar = EXEMPLARES.filter(function (x) { return x.id === s.ex; })[0];
      var no = CHAVE[s.kPath[s.kPath.length - 1]];
      var nf = Math.min(s.fi, FALSAS.length - 1);
      var falsa = FALSAS[nf];
      var respondida = s.fr !== null;

      function estadoBotao(v) {
        if (!respondida) return '';
        if (v === falsa.resp) return 'certo';
        if (v === s.fr) return 'errado';
        return '';
      }
      function responder(v) {
        if (s.fr !== null) return;
        m.set({ fr: v, fPontos: s.fPontos + (FALSAS[s.fi].resp === v ? 1 : 0) });
      }

      return {
        jogoTabs: NOMES.map(function (nm, k) {
          return { n: String(k + 1), nome: nm, sel: k === s.jogo, pick: function () { m.set({ jogo: k }); } };
        }),
        jogoChave: s.jogo === 0, jogoMemoria: s.jogo === 1, jogoFalsa: s.jogo === 2,

        // chave de identificação
        exemplares: EXEMPLARES.map(function (x) {
          return { nome: x.nome, img: x.img, sel: x.id === s.ex, pick: function () { m.set({ ex: x.id, kPath: ['q1'], kTrilha: [], kRes: null }); } };
        }),
        exemplar: exemplar,
        temExemplar: exemplar.exp !== null,
        chaveTrilha: s.kTrilha,
        chavePasso: s.kPath.length,
        chaveEmPergunta: s.kRes === null,
        chaveEmResultado: s.kRes !== null,
        chaveNo: no,
        chaveOps: no.ops.map(function (o) {
          return {
            t: o[0],
            pick: function () {
              var tr = s.kTrilha.concat([o[0]]);
              if (o[1].indexOf('R_') === 0) m.set({ kRes: o[1], kTrilha: tr });
              else m.set({ kPath: s.kPath.concat([o[1]]), kTrilha: tr });
            }
          };
        }),
        chaveRes: s.kRes ? CHAVE_RES[s.kRes] : CHAVE_RES.R_brom,
        chaveConf: exemplar.exp === s.kRes
          ? { t: 'A chave chegou à resposta esperada!', estado: 'ok' }
          : { t: 'Resultado diferente do esperado. Observe a foto de novo.', estado: 'erro' },
        chaveReiniciar: function () { m.set({ kPath: ['q1'], kTrilha: [], kRes: null }); },

        // memória
        memCartas: s.memOrdem.map(function (ci, pos) {
          var par = MEM[Math.floor(ci / 2)];
          var ehImagem = ci % 2 === 1;
          var achada = s.memAchados.indexOf(par.id) >= 0;
          var virada = achada || s.memAbertas.indexOf(pos) >= 0;
          return {
            ehImagem: ehImagem, ehTermo: !ehImagem, img: par.img, alt: par.alt, termo: par.termo, dica: par.dica,
            virada: virada, achada: achada,
            aria: virada ? (ehImagem ? 'Imagem: ' + par.alt : 'Termo: ' + par.termo) : 'Carta virada para baixo',
            pick: function () {
              if (s.memTrava || s.memAbertas.indexOf(pos) >= 0 || s.memAchados.indexOf(par.id) >= 0) return;
              var abertas = s.memAbertas.concat([pos]);
              if (abertas.length < 2) { m.set({ memAbertas: abertas }); return; }
              var a = s.memOrdem[abertas[0]];
              var b = s.memOrdem[abertas[1]];
              var jogadas = s.memJog + 1;
              if (Math.floor(a / 2) === Math.floor(b / 2)) {
                m.set({ memAbertas: [], memAchados: s.memAchados.concat([par.id]), memJog: jogadas });
              } else {
                m.set({ memAbertas: abertas, memTrava: true, memJog: jogadas });
                setTimeout(function () { m.set({ memAbertas: [], memTrava: false }); }, 950);
              }
            }
          };
        }),
        memJogadas: s.memJog,
        memPares: s.memAchados.length,
        memVenceu: s.memAchados.length === MEM.length,
        memReiniciar: function () {
          m.set({ memOrdem: embaralhar(MEM.length * 2), memAbertas: [], memAchados: [], memJog: 0, memTrava: false });
        },

        // é bromélia ou não?
        falsaAtivo: s.fi < FALSAS.length,
        falsaFim: s.fi >= FALSAS.length,
        falsaNum: nf + 1,
        falsaPontos: s.fPontos,
        falsa: falsa,
        falsaRespondida: respondida,
        falsaBtn: { sim: estadoBotao(true), nao: estadoBotao(false) },
        falsaFb: s.fr === falsa.resp ? { t: 'Acertou!', estado: 'ok' } : { t: 'Errou desta vez.', estado: 'erro' },
        falsaSim: function () { responder(true); },
        falsaNao: function () { responder(false); },
        falsaProxima: function () { m.set({ fi: s.fi + 1, fr: null }); },
        falsaProximaLabel: s.fi + 1 < FALSAS.length ? 'Próxima planta →' : 'Ver resultado',
        falsaReiniciar: function () { m.set({ fi: 0, fr: null, fPontos: 0 }); },
        falsaResultado: s.fPontos >= 7
          ? 'Olho de botânico! Você reconhece uma bromélia de longe.'
          : s.fPontos >= 5
            ? 'Bom resultado. Revise a checklist ao lado e tente de novo.'
            : 'Muitas plantas imitam bromélias. Use a checklist ao lado e jogue outra vez.'
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 24. Quiz
  // ---------------------------------------------------------------------------
  function criarQuiz() {
    return secao($('#quiz'), { qi: 0, resp: null, pontos: 0 }, function (s, m) {
      var fim = s.qi >= QUIZ.length;
      var q = fim ? QUIZ[0] : QUIZ[s.qi];
      return {
        quizAtivo: !fim,
        quizFim: fim,
        q: q,
        qNum: s.qi + 1,
        pontos: s.pontos,
        qPct: ((s.qi / QUIZ.length) * 100) + '%',
        opcoes: q.o.map(function (t, k) {
          var certo = s.resp !== null && k === q.c;
          var errado = s.resp === k && k !== q.c;
          return {
            t: t, icon: certo ? '✓' : errado ? '✕' : '', estado: certo ? 'certo' : errado ? 'errado' : '',
            pick: function () {
              if (s.resp !== null) return;
              m.set({ resp: k, pontos: s.pontos + (k === q.c ? 1 : 0) });
            }
          };
        }),
        respondida: s.resp !== null,
        feedback: s.resp === q.c ? 'Correto.' : 'Incorreto.',
        proximaLabel: s.qi + 1 < QUIZ.length ? 'Próxima' : 'Ver resultado',
        proxima: function () { m.set({ qi: s.qi + 1, resp: null }); },
        reiniciar: function () { m.set({ qi: 0, resp: null, pontos: 0 }); },
        resultado: s.pontos === QUIZ.length
          ? 'Excelente: domínio completo do conteúdo.'
          : s.pontos >= 2 ? 'Bom resultado. Revise os pontos em que errou.' : 'Vale revisar o conteúdo e tentar de novo.'
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 25. Glossário (lista montada uma vez a partir dos dados)
  // ---------------------------------------------------------------------------
  function criarGlossario() {
    return secao($('#glossario'), {}, function () {
      return {
        glossario: GLOSSARIO.map(function (g, i) {
          return { t: g[0], d: g[1], bg: GLOSS_BG[i % GLOSS_BG.length] };
        })
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------------
  // Seções que ficam dentro de outras: marcadas antes, para a seção de fora
  // não tentar preenchê-las.
  ['#nome', '#evolucao', '#lightbox'].forEach(function (sel) { $(sel)._modulo = true; });

  [
    criarCabecalho, criarConceitos, criarClassificacao, criarNome, criarSubfamilias,
    criarAnatomia, criarMorfologia, criarFlor, criarCam, criarCiclo, criarTipos, criarMapa,
    criarEcologia, criarEvolucao, criarBahia, criarUefs, criarGaleria, criarConservacao,
    criarJogos, criarQuiz, criarGlossario
  ].forEach(function (criar) {
    [].concat(criar()).forEach(function (mod) { mod.render(); });
  });
})();
