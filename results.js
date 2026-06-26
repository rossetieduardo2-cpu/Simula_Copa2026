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
    return `
      <div class="bmatch ${isFinal ? 'final-card' : ''}">
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
})();
