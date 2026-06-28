// =============================================================================
// UI — Simulador Copa do Mundo 2026
// Consome window.CopaEngine (engine.js) e renderiza:
//   1. Editor de ratings por grupo (expansível, com sliders)
//   2. Resultado de uma simulação única (grupos + bracket + pódio)
//   3. Monte Carlo (N simulações, tabela de probabilidades)
// =============================================================================

(function(){
  "use strict";
  const E = window.CopaEngine;
  const $content = document.getElementById('content');

  let state = {
    tab: 'editor',
    lastSingleResult: null,
    lastMC: null,
    lastTraj: null,
    mcN: 10000,
    seed: 2026,
    openTeam: null,
    trajTeam: null,
  };

  function flag(t){ return E.FLAGS[t] || '⚽'; }
  function esc(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---------------------------------------------------------------------
  // RENDER: shell com tabs
  // ---------------------------------------------------------------------
  function render(){
    $content.innerHTML = `
      <section id="sec-editor">
        <div class="section-head">
          <div>
            <div class="section-num">01 — ELENCO</div>
            <h2 class="section-title">Ratings das 48 seleções</h2>
            <p class="section-desc">Clique em qualquer time para ajustar seu Rating Geral (escala 0–99, ponto de partida calculado pela média dos atributos SOFIFA). As mudanças entram em vigor na próxima simulação.</p>
          </div>
          <button class="btn btn-ghost" id="btn-reset-all">↺ Restaurar todos os ratings originais</button>
        </div>
        <div class="groups-grid" id="groups-grid"></div>
      </section>

      <section id="sec-run">
        <div class="section-head">
          <div>
            <div class="section-num">02 — SIMULAÇÃO</div>
            <h2 class="section-title">Rodar o torneio</h2>
            <p class="section-desc">Uma simulação única mostra um resultado possível, jogo a jogo. O Monte Carlo roda o torneio repetidas vezes e calcula a probabilidade de cada seleção chegar a cada fase.</p>
          </div>
        </div>
        <div class="toolbar">
          <button class="btn btn-primary" id="btn-run-single">▶ Simular copa (resultado único)</button>
          <div class="spacer"></div>
          <div class="field-inline">
            <label>SIMULAÇÕES</label>
            <input type="number" id="input-mc-n" value="10000" min="10" max="1000000" step="10">
          </div>
          <button class="btn" id="btn-run-mc">∑ Rodar Simulações</button>
        </div>
        <div id="real-games-note" style="margin-top:10px; font-family:var(--mono); font-size:11.5px; color:var(--giz-faint);"></div>
      </section>

      <section id="sec-results">
        <div class="tabs">
          <button class="tab-btn active" data-tab="single">Simulação única</button>
          <button class="tab-btn" data-tab="mc">Probabilidades das Simulações</button>
          <button class="tab-btn" data-tab="traj">Trajetória de um time</button>
        </div>
        <div class="tab-panel active" id="panel-single"></div>
        <div class="tab-panel" id="panel-mc"></div>
        <div class="tab-panel" id="panel-traj">
          <div class="toolbar">
            <div class="field-inline">
              <label>SELEÇÃO</label>
              <select id="input-traj-team" class="traj-team-select"></select>
            </div>
            <div class="spacer"></div>
            <div class="field-inline">
              <label>SIMULAÇÕES</label>
              <input type="number" id="input-traj-n" value="5000" min="100" max="20000" step="100">
            </div>
            <button class="btn btn-primary" id="btn-run-traj">↝ Traçar trajetórias</button>
          </div>
          <div id="panel-traj-results" style="margin-top:20px;"></div>
        </div>
      </section>
    `;

    renderGroupsGrid();
    renderSingleEmpty();
    renderMCEmpty();
    renderRealGamesNote();
    renderTrajTeamSelect();
    renderTrajEmpty();
    bindShellEvents();
  }

  function renderTrajTeamSelect(){
    const sel = document.getElementById('input-traj-team');
    if (!sel) return;
    sel.innerHTML = Object.keys(E.GRUPOS).map(letra => {
      const opts = E.GRUPOS[letra].map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
      return `<optgroup label="Grupo ${letra}">${opts}</optgroup>`;
    }).join('');
    // tenta manter a seleção anterior, se ainda existir nas opções
    if (state.trajTeam && Object.values(E.GRUPOS).flat().includes(state.trajTeam)){
      sel.value = state.trajTeam;
    } else {
      state.trajTeam = sel.value;
    }
  }

  function renderTrajEmpty(){
    const el = document.getElementById('panel-traj-results');
    if (!el) return;
    el.innerHTML = `
      <div class="empty-state">
        <div class="ball">↝</div>
        <strong>Nenhuma trajetória traçada ainda</strong>
        <p>Escolha uma seleção e clique em "Traçar trajetórias" para ver o funil de avanço, os adversários mais prováveis em cada fase e os caminhos completos mais comuns até o título.</p>
      </div>`;
  }

  function renderRealGamesNote(){
    const el = document.getElementById('real-games-note');
    const n = E.JOGOS_REALIZADOS.length;
    if (n === 0){
      el.innerHTML = '';
    } else {
      const lista = E.JOGOS_REALIZADOS.map(j => `${flag(j.timeA)} ${esc(j.timeA)} ${j.gA}–${j.gB} ${esc(j.timeB)} ${flag(j.timeB)}`).join(' &nbsp;·&nbsp; ');
      el.innerHTML = `<span style="color:var(--ouro);">${n} jogo(s) real(is) fixado(s)</span>`;
    }
  }

  function bindShellEvents(){
    document.getElementById('btn-reset-all').addEventListener('click', () => {
      E.resetAll();
      state.openTeam = null;
      renderGroupsGrid();
    });
    document.getElementById('btn-run-single').addEventListener('click', () => window.runSingle());
    document.getElementById('btn-run-mc').addEventListener('click', () => window.runMC());
    document.getElementById('input-traj-team').addEventListener('change', (ev) => {
      state.trajTeam = ev.target.value;
    });
    document.getElementById('btn-run-traj').addEventListener('click', () => window.runTrajetoria());

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ---------------------------------------------------------------------
  // RATING EDITOR — agora com um único parâmetro: Rating Geral (overall)
  // ---------------------------------------------------------------------
  function teamRowHTML(team){
    const isOpen = state.openTeam === team;
    const ov = E.overall(team);
    return `
      <div class="team-row" data-team-row="${esc(team)}">
        <div class="t-name" data-toggle-team="${esc(team)}">
          <span class="t-flag">${flag(team)}</span>
          <span>${esc(team)}</span>
        </div>
        <div class="t-overall" data-overall="${esc(team)}">${ov}</div>
      </div>
      <div class="team-edit ${isOpen ? 'open' : ''}" data-edit-panel="${esc(team)}">
        <div class="attr-row">
          <label>RATING</label>
          <input type="range" min="40" max="99" value="${ov}"
                 data-team="${esc(team)}" class="attr-slider overall-slider">
          <div class="attr-val" data-team-val="${esc(team)}">${ov}</div>
        </div>
        <button class="reset-link" data-reset-team="${esc(team)}">restaurar rating original deste time</button>
      </div>`;
  }

  function renderGroupsGrid(){
    const grid = document.getElementById('groups-grid');
    grid.innerHTML = Object.keys(E.GRUPOS).map(letra => {
      const times = E.GRUPOS[letra];
      return `
        <div class="group-card">
          <div class="group-card-head">
            <span class="g-letter">Grupo ${letra}</span>
            <span class="g-label">4 SELEÇÕES</span>
          </div>
          ${times.map(teamRowHTML).join('')}
        </div>`;
    }).join('');

    bindGroupsGridEvents();
  }

  function bindGroupsGridEvents(){
    document.querySelectorAll('[data-toggle-team]').forEach(el => {
      el.addEventListener('click', () => {
        const t = el.getAttribute('data-toggle-team');
        state.openTeam = (state.openTeam === t) ? null : t;
        renderGroupsGrid();
      });
    });
    document.querySelectorAll('.attr-slider').forEach(el => {
      el.addEventListener('input', () => {
        const team = el.getAttribute('data-team');
        const val = parseInt(el.value, 10);
        E.setOverall(team, val);
        document.querySelector(`[data-team-val="${cssEsc(team)}"]`).textContent = val;
        document.querySelector(`[data-overall="${cssEsc(team)}"]`).textContent = E.overall(team);
      });
    });
    document.querySelectorAll('[data-reset-team]').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const t = el.getAttribute('data-reset-team');
        E.resetTeam(t);
        renderGroupsGrid();
        state.openTeam = t; // keep open after reset
        renderGroupsGrid();
      });
    });
  }

  // helper: CSS.escape fallback for attribute selectors with special chars
  function cssEsc(s){
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return s.replace(/["\\]/g, '\\$&');
  }

  // ---------------------------------------------------------------------
  // EMPTY STATES
  // ---------------------------------------------------------------------
  function renderSingleEmpty(){
    document.getElementById('panel-single').innerHTML = `
      <div class="empty-state">
        <div class="ball">⚽</div>
        <strong>Nenhuma simulação rodada ainda</strong>
        <p>Ajuste os ratings se quiser e clique em "Simular copa" para ver a fase de grupos, o chaveamento completo e o campeão — jogo a jogo.</p>
      </div>`;
  }
  function renderMCEmpty(){
    document.getElementById('panel-mc').innerHTML = `
      <div class="empty-state">
        <div class="ball">∑</div>
        <strong>Nenhuma Simulação rodada ainda</strong>
        <p>Rode milhares de simulações para estimar a probabilidade de cada seleção ser campeã, vice, chegar à semifinal etc.</p>
      </div>`;
  }

  // expose for part 2 (results.js)
  window.CopaUI = { state, flag, esc, render, $content };

  // Init
  document.addEventListener('DOMContentLoaded', render);
  if (document.readyState === 'interactive' || document.readyState === 'complete') render();
})();
