// =============================================================================
// RESULTS RENDERING — simulação única + Monte Carlo
// =============================================================================
(function(){
  "use strict";
  const E = window.CopaEngine;
  const UI = window.CopaUI;
  const flag = UI.flag, esc = UI.esc;

  function posClass(pos){ return 'pos-' + pos; }

  // ---------------------------------------------------------------------
  // SINGLE SIMULATION — fase de grupos
  // ---------------------------------------------------------------------
  function matchLineHTML(m){
    const realTag = m.real ? '<span class="real-tag">REAL</span>' : '';
    return `
      <div class="match-line">
        <span class="m-team">${flag(m.tA)} ${esc(m.tA)}</span>
        <span class="m-score">${m.gA} – ${m.gB}${realTag}</span>
        <span class="m-team right">${esc(m.tB)} ${flag(m.tB)}</span>
      </div>`;
  }

  function standingCardHTML(letra, resG, melhores3osSet){
    const tab = resG.tab;
    const rows = tab.map(row => {
      const isQualified = row.pos <= 2;
      const isThirdBest = row.pos === 3 && melhores3osSet.has(row.time);
      const cls = [isQualified ? 'qualified' : '', isThirdBest ? 'third-best' : ''].filter(Boolean).join(' ');
      return `
        <tr class="${cls}">
          <td><span class="pos-mark ${posClass(row.pos)}">${row.pos}</span>${flag(row.time)} ${esc(row.time)}</td>
          <td>${row.pts}</td>
          <td>${row.gd > 0 ? '+'+row.gd : row.gd}</td>
          <td>${row.gf}</td>
          <td>${row.gc}</td>
        </tr>`;
    }).join('');

    return `
      <div class="standing-card">
        <div class="standing-head">
          <span class="g-letter">Grupo ${letra}</span>
        </div>
        <table class="standing-table">
          <thead><tr><th>Seleção</th><th>Pts</th><th>SG</th><th>GF</th><th>GC</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="group-matches">
          ${resG.jogos.map(matchLineHTML).join('')}
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------
  // BRACKET
  // ---------------------------------------------------------------------
  const BRACKET_DEFS = [
    {label:'Round of 32', ids:[73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88]},
    {label:'Oitavas', ids:[89,90,91,92,93,94,95,96]},
    {label:'Quartas', ids:[97,98,99,100]},
    {label:'Semifinal', ids:[101,102]},
  ];

  function bmatchHTML(r, isFinal){
    if (!r) return `<div class="bmatch"><div class="brow"><span class="bname">—</span></div></div>`;
    const aWin = r.winner === r.tA;
    const bWin = r.winner === r.tB;
    const realClass = r.real ? 'real-match' : '';
    return `
      <div class="bmatch ${isFinal ? 'final-card' : ''} ${realClass}">
        <div class="brow ${aWin ? 'winner':''}"><span class="bname">${flag(r.tA)} ${esc(r.tA)}</span><span class="bscore">${r.gA}</span></div>
        <div class="brow ${bWin ? 'winner':''}"><span class="bname">${flag(r.tB)} ${esc(r.tB)}</span><span class="bscore">${r.gB}</span></div>
      </div>`;
  }

  function renderBracket(result){
    const all = Object.assign({}, result.r32, result.r16, result.qf, result.sf);
    const rounds = BRACKET_DEFS.map(round => {
      const matches = round.ids.map(id => bmatchHTML(all['R'+id], false)).join('');
      return `
        <div class="bracket-round">
          <div class="bracket-round-label">${round.label}</div>
          ${matches}
        </div>`;
    }).join('');

    const finalRound = `
      <div class="bracket-round">
        <div class="bracket-round-label">3º lugar</div>
        ${bmatchHTML(result.r3o, false)}
      </div>
      <div class="bracket-round">
        <div class="bracket-round-label">Final</div>
        ${bmatchHTML(result.rFin, true)}
      </div>`;

    return `<div class="bracket-scroll"><div class="bracket">${rounds}${finalRound}</div></div>`;
  }

  function renderPodium(result){
    return `
      <div class="podium-wrap">
        <div class="podium-spot">
          <div class="podium-medal">2º LUGAR</div>
          <div class="podium-team">${flag(result.vice)} ${esc(result.vice)}</div>
          <div class="podium-bar silver"><div class="podium-num">2</div></div>
        </div>
        <div class="podium-spot">
          <div class="podium-medal">🏆 CAMPEÃO</div>
          <div class="podium-team">${flag(result.campeao)} ${esc(result.campeao)}</div>
          <div class="podium-bar gold"><div class="podium-num">1</div></div>
        </div>
        <div class="podium-spot">
          <div class="podium-medal">3º LUGAR</div>
          <div class="podium-team">${flag(result.terceiro)} ${esc(result.terceiro)}</div>
          <div class="podium-bar bronze"><div class="podium-num light">3</div></div>
        </div>
        <div class="podium-spot">
          <div class="podium-medal">4º LUGAR</div>
          <div class="podium-team">${flag(result.quarto)} ${esc(result.quarto)}</div>
          <div class="podium-bar fourth"><div class="podium-num light">4</div></div>
        </div>
      </div>`;
  }

  function renderZebraPenalties(result){
    const pens = result.penalidadesFinais;
    const teams = Object.keys(pens || {});
    if (!teams.length) return '';
    const items = teams.map(t => {
      const soma = pens[t].reduce((a,b)=>a+b,0);
      return `<span style="display:inline-flex;align-items:center;gap:5px;margin:3px 10px 3px 0;">${flag(t)} ${esc(t)} <span style="font-family:var(--mono);color:var(--vermelho-bright);">−${(soma*100).toFixed(1)}%</span></span>`;
    }).join('');
    return `
      <div style="margin-top:18px; padding:12px 16px; background:var(--campo-800); border:1px solid var(--linha); border-radius:var(--radius);">
        <div style="font-family:var(--mono); font-size:10.5px; color:var(--giz-faint); letter-spacing:0.08em; margin-bottom:6px;">PENALIDADES DE ZEBRA AINDA ATIVAS AO FIM DO TORNEIO</div>
        <div style="font-size:12.5px;">${items}</div>
      </div>`;
  }

  function renderSingleResult(result){
    const melhores3osSet = new Set(result.melhores3os.map(r => r.time));
    const groupsHTML = Object.keys(E.GRUPOS).map(letra =>
      standingCardHTML(letra, result.grupos[letra], melhores3osSet)
    ).join('');

    document.getElementById('panel-single').innerHTML = `
      ${renderPodium(result)}

      <div class="section-head" style="margin-top:40px;">
        <div>
          <div class="section-num">FASE DE GRUPOS</div>
          <h2 class="section-title" style="font-size:20px;">Classificação e resultados</h2>
        </div>
      </div>
      <div class="results-groups-grid">${groupsHTML}</div>

      <div class="section-head" style="margin-top:40px;">
        <div>
          <div class="section-num">MATA-MATA</div>
          <h2 class="section-title" style="font-size:20px;">Chaveamento completo</h2>
        </div>
      </div>
      ${renderBracket(result)}
      ${renderZebraPenalties(result)}
    `;
  }

  // ---------------------------------------------------------------------
  // MONTE CARLO
  // ---------------------------------------------------------------------
  function renderMCResult(prob, N){
    const maxCampeao = Math.max(...prob.map(p => p.p_campeao), 1);
    const rows = prob.map((row, i) => `
      <tr>
        <td><span class="rank-num">${i+1}</span>${flag(row.time)} ${esc(row.time)}</td>
        <td class="bar-cell"><span class="bar-bg" style="width:${(row.p_campeao/maxCampeao*100).toFixed(1)}%"></span><span>${row.p_campeao.toFixed(1)}%</span></td>
        <td>${row.p_vice.toFixed(1)}%</td>
        <td>${row.p_terceiro.toFixed(1)}%</td>
        <td>${row.p_quarto.toFixed(1)}%</td>
        <td>${row.p_semi.toFixed(1)}%</td>
      </tr>`).join('');

    document.getElementById('panel-mc').innerHTML = `
      <p class="section-desc" style="margin-bottom:18px;">Resultado de ${N.toLocaleString('pt-BR')} simulações independentes do torneio completo, com os ratings atuais.</p>
      <div class="mc-table-wrap">
        <table class="mc-table">
          <thead>
            <tr><th>Seleção</th><th>Campeão</th><th>Vice</th><th>3º</th><th>4º</th><th>Semifinal</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ---------------------------------------------------------------------
  // TRAJETÓRIA DE UM TIME
  // ---------------------------------------------------------------------
  const FUNIL_STEPS = [
    { key:'grupos',      label:'Fase de grupos' },
    { key:'r32',         label:'Round of 32' },
    { key:'r16',         label:'Oitavas' },
    { key:'qf',          label:'Quartas' },
    { key:'sf',          label:'Semifinal' },
    { key:'final_ou_3o', label:'Final / 3º lugar' },
    { key:'campeao',     label:'Campeão' }
  ];

  function renderFunilHTML(funilPct){
    return FUNIL_STEPS.map(step => {
      const pct = funilPct[step.key];
      return `
        <div class="funil-row">
          <span class="funil-label">${step.label}</span>
          <div class="funil-bar-track"><div class="funil-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
          <span class="funil-pct">${pct.toFixed(1)}%</span>
        </div>`;
    }).join('');
  }

  function renderFaseFinalHTML(faseFinalProb, time){
    const maxPct = Math.max(...faseFinalProb.map(f => f.pct), 1);
    const rows = faseFinalProb.slice().reverse().map(f => `
      <tr>
        <td>${f.label}</td>
        <td class="bar-cell"><span class="bar-bg" style="width:${(f.pct/maxPct*100).toFixed(1)}%"></span><span>${f.pct.toFixed(1)}%</span></td>
      </tr>`).join('');
    return `
      <div class="mc-table-wrap">
        <table class="mc-table">
          <thead><tr><th>Resultado final do ${esc(time)}</th><th>Probabilidade</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderAdversariosPorFaseHTML(adversariosPorFase, timeAlvo){
    if (!adversariosPorFase.length){
      return `<p class="section-desc">${esc(timeAlvo)} não chegou à fase de mata-mata em nenhuma das simulações — a campanha já terminou na fase de grupos.</p>`;
    }
    return adversariosPorFase.map(f => {
      const maxPct = Math.max(...f.adversarios.map(a => a.pctDentroFase), 1);
      const rows = f.adversarios.slice(0, 6).map(a => `
        <div class="opp-row">
          <span class="opp-name">${flag(a.oponente)} ${esc(a.oponente)}</span>
          <div class="opp-bar-track"><div class="opp-bar-fill" style="width:${(a.pctDentroFase/maxPct*100).toFixed(1)}%"></div></div>
          <span class="opp-pct">${a.pctDentroFase.toFixed(1)}%</span>
          <span class="opp-win">${a.pctVitoria.toFixed(0)}% vitória</span>
        </div>`).join('');
      return `
        <div class="traj-fase-card">
          <div class="traj-fase-head">
            <span class="traj-fase-title">${f.label}</span>
            <span class="traj-fase-sub">${esc(timeAlvo)} chega aqui em ${f.pctChegou.toFixed(1)}% das simulações</span>
          </div>
          <div class="opp-list">${rows}</div>
        </div>`;
    }).join('') + `<p class="section-desc" style="margin-top:10px;">% = participação entre as simulações em que ${esc(timeAlvo)} chegou a essa fase. "Vitória" = chance de ${esc(timeAlvo)} ganhar especificamente contra aquele adversário.</p>`;
  }

  function renderTrajetoriaCompletaHTML(etapas, faseFinal, time){
    const passos = etapas.map(e => {
      const tag = e.venceu ? 'win' : 'loss';
      return `<span class="traj-step ${tag}">${e.label} <strong>${e.venceu?'✓':'✗'}</strong> vs ${esc(e.oponente)}</span>`;
    }).join('<span class="traj-arrow">→</span>');
    const finalLabel = E.LABEL_FASE_FINAL[faseFinal] || faseFinal;
    const finalTagClass = (faseFinal === 'campeao') ? 'campeao' : (faseFinal === 'vice' || faseFinal === 'terceiro') ? 'podio' : '';
    return `${passos}<span class="traj-arrow">→</span><span class="traj-step-final ${finalTagClass}">${finalLabel}</span>`;
  }

  function renderTopTrajetoriasHTML(trajetorias, time, soCampeao){
    if (!trajetorias.length){
      return `<p class="section-desc">Nenhuma trajetória de mata-mata registrada para ${esc(time)}.</p>`;
    }
    const nCampeao = trajetorias.filter(t => t.faseFinal === 'campeao').length;
    const visiveis = soCampeao ? trajetorias.filter(t => t.faseFinal === 'campeao') : trajetorias;

    const filtroHTML = `
      <label class="traj-filter-toggle">
        <input type="checkbox" id="chk-so-campeao" ${soCampeao ? 'checked' : ''}>
        <span>Mostrar apenas trajetórias em que ${esc(time)} foi campeão</span>
      </label>`;

    const resumo = nCampeao > 0
      ? `<p class="section-desc" style="margin:6px 0 14px;">${trajetorias.length} caminhos distintos identificados no total, ordenados do mais para o menos provável. <span class="traj-legend-campeao">★</span> ${nCampeao} deles terminam com ${esc(time)} campeão${soCampeao ? ' — exibindo apenas esses' : ''}.</p>`
      : `<p class="section-desc" style="margin:6px 0 14px;">${trajetorias.length} caminhos distintos identificados. Nenhum deles termina com ${esc(time)} campeão nesta amostra.</p>`;

    if (soCampeao && nCampeao === 0){
      return filtroHTML + resumo + `<p class="section-desc">Sem trajetórias campeãs para mostrar — desmarque o filtro para ver todos os caminhos.</p>`;
    }

    const rows = visiveis.map((t, i) => {
      const isCampeao = t.faseFinal === 'campeao';
      return `
      <div class="traj-path-row ${isCampeao ? 'is-campeao' : ''}">
        <div class="traj-path-pct"><span class="rank-num">${i+1}</span>${t.pct.toFixed(2)}%${isCampeao ? ' <span class="traj-star">★</span>' : ''}</div>
        <div class="traj-path-steps">${renderTrajetoriaCompletaHTML(t.etapas, t.faseFinal, time)}</div>
      </div>`;
    }).join('');
    return filtroHTML + resumo + `<div class="traj-paths-scroll">${rows}</div>`;
  }

  function renderTrajResult(result){
    const time = result.time;
    document.getElementById('panel-traj-results').innerHTML = `
      <div class="traj-header">
        <span class="traj-header-flag">${flag(time)}</span>
        <span class="traj-header-name">${esc(time)}</span>
        <span class="traj-header-n">${result.N.toLocaleString('pt-BR')} simulações do mata-mata, a partir da fase de grupos já encerrada</span>
      </div>

      <div class="section-head" style="margin-top:28px;">
        <div><h2 class="section-title" style="font-size:18px;">Funil de avanço</h2></div>
      </div>
      <div class="funil-wrap">${renderFunilHTML(result.funilPct)}</div>

      <div class="section-head" style="margin-top:32px;">
        <div><h2 class="section-title" style="font-size:18px;">Onde a campanha termina</h2></div>
      </div>
      ${renderFaseFinalHTML(result.faseFinalProb, time)}

      <div class="section-head" style="margin-top:32px;">
        <div>
          <h2 class="section-title" style="font-size:18px;">Adversário mais provável em cada fase</h2>
          <p class="section-desc">Considerando só as simulações em que ${esc(time)} chegou até aquela fase.</p>
        </div>
      </div>
      <div class="traj-fase-grid">${renderAdversariosPorFaseHTML(result.adversariosPorFase, time)}</div>

      <div class="section-head" style="margin-top:32px;">
        <div>
          <h2 class="section-title" style="font-size:18px;">Todos os caminhos possíveis</h2>
          <p class="section-desc">Todas as sequências exatas de adversários (vitória/derrota em cada fase) observadas nas simulações, da mais para a menos provável.</p>
        </div>
      </div>
      <div class="traj-paths-wrap" id="traj-paths-wrap"></div>
    `;

    renderTrajPathsSection(result, true);
  }

  function renderTrajPathsSection(result, soCampeao){
    const time = result.time;
    document.getElementById('traj-paths-wrap').innerHTML =
      renderTopTrajetoriasHTML(result.trajetorias, time, soCampeao);

    const chk = document.getElementById('chk-so-campeao');
    if (chk){
      chk.addEventListener('change', () => {
        renderTrajPathsSection(result, chk.checked);
      });
    }
  }

  // ---------------------------------------------------------------------
  // RUN HANDLERS (attached to window so app.js's bindShellEvents can call)
  // ---------------------------------------------------------------------
  function randomSeed(){
    // Combina timestamp + ruído para um seed inteiro de 32 bits bem distribuído
    return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  }

  window.runSingle = function(){
    const rng = E.mulberry32(randomSeed());

    document.getElementById('panel-single').innerHTML = `
      <div class="loading-pulse">
        <span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>
        &nbsp;Disputando as 104 partidas do torneio…
      </div>`;
    // give the DOM a tick to paint the loading state
    setTimeout(() => {
      const result = E.simularCopa(rng);
      window.CopaUI.state.lastSingleResult = result;
      renderSingleResult(result);
      document.querySelector('.tab-btn[data-tab="single"]').click();
    }, 30);
  };

  window.runMC = function(){
    const nInput = document.getElementById('input-mc-n');
    let N = parseInt(nInput.value, 10) || 1000;
    N = Math.max(10, Math.min(1000000, N));
    const seed = randomSeed();

    document.getElementById('panel-mc').innerHTML = `
      <div class="loading-pulse">
        <span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>
        &nbsp;Rodando ${N.toLocaleString('pt-BR')} torneios…
      </div>`;

    setTimeout(() => {
      const prob = E.simularMonteCarlo(N, seed);
      window.CopaUI.state.lastMC = prob;
      renderMCResult(prob, N);
      document.querySelector('.tab-btn[data-tab="mc"]').click();
    }, 30);
  };

  window.runTrajetoria = function(){
    const teamSelect = document.getElementById('input-traj-team');
    const nInput = document.getElementById('input-traj-n');
    const time = teamSelect.value;
    let N = parseInt(nInput.value, 10) || 5000;
    N = Math.max(100, Math.min(20000, N));
    const seed = randomSeed();

    document.getElementById('panel-traj-results').innerHTML = `
      <div class="loading-pulse">
        <span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>
        &nbsp;Traçando ${N.toLocaleString('pt-BR')} caminhos possíveis para ${time}…
      </div>`;

    setTimeout(() => {
      const result = E.simularTrajetoria(time, N, seed);
      window.CopaUI.state.lastTraj = result;
      renderTrajResult(result);
      document.querySelector('.tab-btn[data-tab="traj"]').click();
    }, 30);
  };
})();
