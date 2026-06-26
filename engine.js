// =============================================================================
// SIMULADOR COPA DO MUNDO 2026 — Engine fiel ao script R original
// (03_simulador_copa2026_rating_SOFIFA.R)
//
// Reimplementa em JS:
//   - sim_jogo(): motor de "disputa de posse" (random walk com barreira)
//   - sim_grupo(): rodadas 1-2-3, com penalização de zebra entre rodadas
//   - bracket completo R32 -> Oitavas -> Quartas -> Semis -> Final + 3º lugar
//   - 8 melhores terceiros
//   - Monte Carlo (N simulações) com probabilidades agregadas
// =============================================================================

(function(){
  "use strict";

  const BASE_TEAMS  = JSON.parse(document.getElementById('data-teams').textContent);
  const GRUPOS       = JSON.parse(document.getElementById('data-groups').textContent);

  // ---- Parâmetros do motor (idênticos ao R) --------------------------------
  const FRAC_RAT   = .75;
  const FRAC_CAMPO = 4;
  const FRAC_TEMPO = 200;

  const PENALIZACAO_ATIVA = true;
  const K_PENALIDADE      = 0.10;
  const DECAY_PENALIDADE  = .9;
  const PENALIDADE_MIN    = 0.001;

  // ===========================================================================
  // JOGOS JÁ REALIZADOS — edite esta lista manualmente conforme a Copa avança.
  //
  // Cada linha é um confronto da FASE DE GRUPOS já disputado, com o placar
  // real. A simulação usa esse placar (sem rodar o motor) para esse confronto,
  // e simula apenas os jogos do grupo que ainda não aparecem aqui — igual ao
  // que o script R fazia lendo JOGOS_REALIZADOS / buscar_jogo_real().
  //
  // Use exatamente os nomes em português usados em GRUPOS (ex: "EUA", "Rep.
  // Dem. do Congo", "Bósnia", "Costa do Marfim", "República Tcheca"...).
  // A ordem dos dois times na linha não importa (gA é sempre do timeA, gB do
  // timeB, na ordem em que você escreveu).
  //
  // Exemplo (deixe comentado // ou remova para "zerar" e simular tudo):
  //   { timeA:"México", gA:1, timeB:"EUA", gB:1 },
  //   { timeA:"Brasil", gA:2, timeB:"Marrocos", gB:0 },
  // ===========================================================================
  const JOGOS_REALIZADOS = [
    // Gerado por ATUALIZA_JOGOS_REALIZADOS.R em 2026-06-26 10:48
    // Fonte: https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
    { timeA:"México", gA:2, timeB:"África do Sul", gB:0 },  // Grupo A — 2026-06-11
    { timeA:"Coreia do Sul", gA:2, timeB:"República Tcheca", gB:1 },  // Grupo A — 2026-06-11
    { timeA:"Canadá", gA:1, timeB:"Bósnia", gB:1 },  // Grupo B — 2026-06-12
    { timeA:"EUA", gA:4, timeB:"Paraguai", gB:1 },  // Grupo D — 2026-06-12
    { timeA:"Catar", gA:1, timeB:"Suíça", gB:1 },  // Grupo B — 2026-06-13
    { timeA:"Brasil", gA:1, timeB:"Marrocos", gB:1 },  // Grupo C — 2026-06-13
    { timeA:"Haiti", gA:0, timeB:"Escócia", gB:1 },  // Grupo C — 2026-06-13
    { timeA:"Austrália", gA:2, timeB:"Turquia", gB:0 },  // Grupo D — 2026-06-13
    { timeA:"Alemanha", gA:7, timeB:"Curaçao", gB:1 },  // Grupo E — 2026-06-14
    { timeA:"Costa do Marfim", gA:1, timeB:"Equador", gB:0 },  // Grupo E — 2026-06-14
    { timeA:"Holanda", gA:2, timeB:"Japão", gB:2 },  // Grupo F — 2026-06-14
    { timeA:"Suécia", gA:5, timeB:"Tunísia", gB:1 },  // Grupo F — 2026-06-14
    { timeA:"Bélgica", gA:1, timeB:"Egito", gB:1 },  // Grupo G — 2026-06-15
    { timeA:"Irã", gA:2, timeB:"Nova Zelândia", gB:2 },  // Grupo G — 2026-06-15
    { timeA:"Espanha", gA:0, timeB:"Cabo Verde", gB:0 },  // Grupo H — 2026-06-15
    { timeA:"Arábia Saudita", gA:1, timeB:"Uruguai", gB:1 },  // Grupo H — 2026-06-15
    { timeA:"França", gA:3, timeB:"Senegal", gB:1 },  // Grupo I — 2026-06-16
    { timeA:"Iraque", gA:1, timeB:"Noruega", gB:4 },  // Grupo I — 2026-06-16
    { timeA:"Argentina", gA:3, timeB:"Argélia", gB:0 },  // Grupo J — 2026-06-16
    { timeA:"Áustria", gA:3, timeB:"Jordânia", gB:1 },  // Grupo J — 2026-06-16
    { timeA:"Portugal", gA:1, timeB:"Rep. Dem. do Congo", gB:1 },  // Grupo K — 2026-06-17
    { timeA:"Uzbequistão", gA:1, timeB:"Colômbia", gB:3 },  // Grupo K — 2026-06-17
    { timeA:"Inglaterra", gA:4, timeB:"Croácia", gB:2 },  // Grupo L — 2026-06-17
    { timeA:"Gana", gA:1, timeB:"Panamá", gB:0 },  // Grupo L — 2026-06-17
    { timeA:"República Tcheca", gA:1, timeB:"África do Sul", gB:1 },  // Grupo A — 2026-06-18
    { timeA:"México", gA:1, timeB:"Coreia do Sul", gB:0 },  // Grupo A — 2026-06-18
    { timeA:"Suíça", gA:4, timeB:"Bósnia", gB:1 },  // Grupo B — 2026-06-18
    { timeA:"Canadá", gA:6, timeB:"Catar", gB:0 },  // Grupo B — 2026-06-18
    { timeA:"Escócia", gA:0, timeB:"Marrocos", gB:1 },  // Grupo C — 2026-06-19
    { timeA:"Brasil", gA:3, timeB:"Haiti", gB:0 },  // Grupo C — 2026-06-19
    { timeA:"EUA", gA:2, timeB:"Austrália", gB:0 },  // Grupo D — 2026-06-19
    { timeA:"Turquia", gA:0, timeB:"Paraguai", gB:1 },  // Grupo D — 2026-06-19
    { timeA:"Alemanha", gA:2, timeB:"Costa do Marfim", gB:1 },  // Grupo E — 2026-06-20
    { timeA:"Equador", gA:0, timeB:"Curaçao", gB:0 },  // Grupo E — 2026-06-20
    { timeA:"Holanda", gA:5, timeB:"Suécia", gB:1 },  // Grupo F — 2026-06-20
    { timeA:"Tunísia", gA:0, timeB:"Japão", gB:4 },  // Grupo F — 2026-06-20
    { timeA:"Bélgica", gA:0, timeB:"Irã", gB:0 },  // Grupo G — 2026-06-21
    { timeA:"Nova Zelândia", gA:1, timeB:"Egito", gB:3 },  // Grupo G — 2026-06-21
    { timeA:"Espanha", gA:4, timeB:"Arábia Saudita", gB:0 },  // Grupo H — 2026-06-21
    { timeA:"Uruguai", gA:2, timeB:"Cabo Verde", gB:2 },  // Grupo H — 2026-06-21
    { timeA:"França", gA:3, timeB:"Iraque", gB:0 },  // Grupo I — 2026-06-22
    { timeA:"Noruega", gA:3, timeB:"Senegal", gB:2 },  // Grupo I — 2026-06-22
    { timeA:"Argentina", gA:2, timeB:"Áustria", gB:0 },  // Grupo J — 2026-06-22
    { timeA:"Jordânia", gA:1, timeB:"Argélia", gB:2 },  // Grupo J — 2026-06-22
    { timeA:"Portugal", gA:5, timeB:"Uzbequistão", gB:0 },  // Grupo K — 2026-06-23
    { timeA:"Colômbia", gA:1, timeB:"Rep. Dem. do Congo", gB:0 },  // Grupo K — 2026-06-23
    { timeA:"Inglaterra", gA:0, timeB:"Gana", gB:0 },  // Grupo L — 2026-06-23
    { timeA:"Panamá", gA:0, timeB:"Croácia", gB:1 },  // Grupo L — 2026-06-23
    { timeA:"República Tcheca", gA:0, timeB:"México", gB:3 },  // Grupo A — 2026-06-24
    { timeA:"África do Sul", gA:1, timeB:"Coreia do Sul", gB:0 },  // Grupo A — 2026-06-24
    { timeA:"Suíça", gA:2, timeB:"Canadá", gB:1 },  // Grupo B — 2026-06-24
    { timeA:"Bósnia", gA:3, timeB:"Catar", gB:1 },  // Grupo B — 2026-06-24
    { timeA:"Escócia", gA:0, timeB:"Brasil", gB:3 },  // Grupo C — 2026-06-24
    { timeA:"Marrocos", gA:4, timeB:"Haiti", gB:2 },  // Grupo C — 2026-06-24
    { timeA:"Turquia", gA:3, timeB:"EUA", gB:2 },  // Grupo D — 2026-06-25
    { timeA:"Paraguai", gA:0, timeB:"Austrália", gB:0 },  // Grupo D — 2026-06-25
    { timeA:"Curaçao", gA:0, timeB:"Costa do Marfim", gB:2 },  // Grupo E — 2026-06-25
    { timeA:"Equador", gA:2, timeB:"Alemanha", gB:1 },  // Grupo E — 2026-06-25
    { timeA:"Japão", gA:1, timeB:"Suécia", gB:1 },  // Grupo F — 2026-06-25
    { timeA:"Tunísia", gA:1, timeB:"Holanda", gB:3 },  // Grupo F — 2026-06-25
  ];



  // Índice rápido "TimeA__TimeB" -> {gA, gB} (e o inverso) para consulta O(1)
  function buildJogosRealizadosIndex(lista){
    const idx = {};
    for (const j of lista){
      idx[j.timeA + "__" + j.timeB] = { gA: j.gA, gB: j.gB };
      idx[j.timeB + "__" + j.timeA] = { gA: j.gB, gB: j.gA };
    }
    return idx;
  }
  let JOGOS_IDX = buildJogosRealizadosIndex(JOGOS_REALIZADOS);

  // Retorna {gA, gB} se tA x tB (nessa ordem) já foi disputado, ou null.
  function buscarJogoReal(tA, tB){
    const r = JOGOS_IDX[tA + "__" + tB];
    return r ? { gA: r.gA, gB: r.gB } : null;
  }

  // Valida a lista (nomes de times existem e fazem parte do mesmo grupo) —
  // ajuda a pegar erros de digitação em JOGOS_REALIZADOS no console do browser.
  function validarJogosRealizados(){
    const todosTimes = new Set(Object.values(GRUPOS).flat());
    const grupoDoTime = {};
    for (const g in GRUPOS) for (const t of GRUPOS[g]) grupoDoTime[t] = g;
    const problemas = [];
    JOGOS_REALIZADOS.forEach((j, i) => {
      if (!todosTimes.has(j.timeA)) problemas.push(`Linha ${i+1}: time "${j.timeA}" não encontrado em GRUPOS.`);
      if (!todosTimes.has(j.timeB)) problemas.push(`Linha ${i+1}: time "${j.timeB}" não encontrado em GRUPOS.`);
      if (todosTimes.has(j.timeA) && todosTimes.has(j.timeB) && grupoDoTime[j.timeA] !== grupoDoTime[j.timeB]){
        problemas.push(`Linha ${i+1}: "${j.timeA}" e "${j.timeB}" estão em grupos diferentes (${grupoDoTime[j.timeA]} x ${grupoDoTime[j.timeB]}) — só jogos de grupo são suportados aqui.`);
      }
    });
    if (problemas.length){
      console.warn("[CopaEngine] Problemas em JOGOS_REALIZADOS:\n" + problemas.join("\n"));
    }
    return problemas;
  }
  validarJogosRealizados();

  // Bracket Round of 32 (ids 73-88) — fonte: openfootball/worldcup/2026
  const BRACKET_R32 = [
    {id:73, posA:"2A", posB:"2B"},
    {id:74, posA:"1E", posB:"3_1"},
    {id:75, posA:"1F", posB:"2C"},
    {id:76, posA:"1C", posB:"2F"},
    {id:77, posA:"1I", posB:"3_2"},
    {id:78, posA:"2E", posB:"2I"},
    {id:79, posA:"1A", posB:"3_3"},
    {id:80, posA:"1L", posB:"3_4"},
    {id:81, posA:"1D", posB:"3_5"},
    {id:82, posA:"1G", posB:"3_6"},
    {id:83, posA:"2K", posB:"2L"},
    {id:84, posA:"1H", posB:"2J"},
    {id:85, posA:"1B", posB:"3_7"},
    {id:86, posA:"1J", posB:"2H"},
    {id:87, posA:"1K", posB:"3_8"},
    {id:88, posA:"2D", posB:"2G"}
  ];
  const BRACKET_R16 = [
    {id:89, wA:"W74", wB:"W77"},
    {id:90, wA:"W73", wB:"W75"},
    {id:91, wA:"W76", wB:"W78"},
    {id:92, wA:"W79", wB:"W80"},
    {id:93, wA:"W83", wB:"W84"},
    {id:94, wA:"W81", wB:"W82"},
    {id:95, wA:"W86", wB:"W88"},
    {id:96, wA:"W85", wB:"W87"}
  ];
  const BRACKET_QF = [
    {id:97,  wA:"W89", wB:"W90"},
    {id:98,  wA:"W93", wB:"W94"},
    {id:99,  wA:"W91", wB:"W92"},
    {id:100, wA:"W95", wB:"W96"}
  ];
  const BRACKET_SF = [
    {id:101, wA:"W97", wB:"W98"},
    {id:102, wA:"W99", wB:"W100"}
  ];

  const ROUND_LABELS = {
    73:"Round of 32",74:"Round of 32",75:"Round of 32",76:"Round of 32",
    77:"Round of 32",78:"Round of 32",79:"Round of 32",80:"Round of 32",
    81:"Round of 32",82:"Round of 32",83:"Round of 32",84:"Round of 32",
    85:"Round of 32",86:"Round of 32",87:"Round of 32",88:"Round of 32",
    89:"Oitavas",90:"Oitavas",91:"Oitavas",92:"Oitavas",
    93:"Oitavas",94:"Oitavas",95:"Oitavas",96:"Oitavas",
    97:"Quartas",98:"Quartas",99:"Quartas",100:"Quartas",
    101:"Semifinal",102:"Semifinal"
  };

  // Bandeiras (emoji) por nome em português, só estética — não afeta cálculo
  const FLAGS = {
    "México":"🇲🇽","África do Sul":"🇿🇦","Coreia do Sul":"🇰🇷","República Tcheca":"🇨🇿",
    "Canadá":"🇨🇦","Bósnia":"🇧🇦","Catar":"🇶🇦","Suíça":"🇨🇭",
    "Brasil":"🇧🇷","Marrocos":"🇲🇦","Haiti":"🇭🇹","Escócia":"🏴",
    "EUA":"🇺🇸","Paraguai":"🇵🇾","Austrália":"🇦🇺","Turquia":"🇹🇷",
    "Alemanha":"🇩🇪","Curaçao":"🇨🇼","Costa do Marfim":"🇨🇮","Equador":"🇪🇨",
    "Holanda":"🇳🇱","Japão":"🇯🇵","Suécia":"🇸🇪","Tunísia":"🇹🇳",
    "Bélgica":"🇧🇪","Egito":"🇪🇬","Irã":"🇮🇷","Nova Zelândia":"🇳🇿",
    "Espanha":"🇪🇸","Cabo Verde":"🇨🇻","Arábia Saudita":"🇸🇦","Uruguai":"🇺🇾",
    "França":"🇫🇷","Senegal":"🇸🇳","Iraque":"🇮🇶","Noruega":"🇳🇴",
    "Argentina":"🇦🇷","Argélia":"🇩🇿","Áustria":"🇦🇹","Jordânia":"🇯🇴",
    "Portugal":"🇵🇹","Rep. Dem. do Congo":"🇨🇩","Uzbequistão":"🇺🇿","Colômbia":"🇨🇴",
    "Inglaterra":"🏴","Croácia":"🇭🇷","Gana":"🇬🇭","Panamá":"🇵🇦"
  };

  // ---- Estado mutável dos ratings (editável pelo usuário) -------------------
  // Clona profundamente os ratings-base; window.TEAMS é o que a engine lê.
  function cloneBaseTeams(){
    const out = {};
    for (const k in BASE_TEAMS) out[k] = Object.assign({}, BASE_TEAMS[k]);
    return out;
  }
  let TEAMS = cloneBaseTeams();

  function overall(t){
    const r = TEAMS[t];
    return Math.round((r.ataque + r.meio + r.defesa + r.goleiro) / 4);
  }

  // =====================================================================
  // RNG seedável (mulberry32) — para permitir Monte Carlo reprodutível
  // e não depender de Math.random global.
  // =====================================================================
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // =====================================================================
  // sim_jogo — motor de disputa de posse (random walk com barreira)
  // Fiel ao sim_jogo() do R: mesmas 5 razões logísticas, mesmo vetor de
  // campo (frac.campo posições de cada lado + meio + 2 extremos goleiro/
  // ataque), mesmo loop de frac.tempo ciclos.
  // =====================================================================
  function simJogo(t1, t2, rng, opts){
    opts = opts || {};
    const permiteEmpate = opts.permiteEmpate !== false;
    const fracCampo = FRAC_CAMPO, fracTempo = FRAC_TEMPO, fracRat = FRAC_RAT;

    const r1 = TEAMS[t1], r2 = TEAMS[t2];

    const raw = [
      r1.goleiro / (r1.goleiro + r2.ataque),
      r1.defesa  / (r1.defesa  + r2.ataque),
      r1.meio    / (r1.meio    + r2.meio),
      r1.ataque  / (r1.ataque  + r2.defesa),
      r1.ataque  / (r1.ataque  + r2.goleiro)
    ];
    // logit -> *fracRat -> sigmoid (com fracRat=1 é identidade, mas mantemos
    // a transformação para fidelidade caso o usuário queira variar o motor)
    const rat = raw.map(p => {
      const logit = Math.log(p / (1 - p));
      const scaled = fracRat * logit;
      return Math.exp(scaled) / (1 + Math.exp(scaled));
    });
    const [gA2, dA2, mM2, aD2, aG2] = rat;

    const vec = [];
    vec.push(gA2);
    for (let i=0;i<fracCampo;i++) vec.push(dA2);
    const midLen = Math.floor(fracCampo/2)*2 + 1;
    for (let i=0;i<midLen;i++) vec.push(mM2);
    for (let i=0;i<fracCampo;i++) vec.push(aD2);
    vec.push(aG2);

    const n = vec.length;
    const half = Math.floor(n/2);
    const center = (n-1)/2; // 0-indexed center position in vec

    let pos = 0, gA = 0, gB = 0;
    for (let i=0;i<fracTempo;i++){
      const idx = Math.round(pos + center);
      const p = vec[idx];
      const disputa = (rng() < p) ? 1 : -1;
      pos += disputa;
      if (Math.abs(pos) > half){
        if (disputa > 0) gA++; else gB++;
        pos = 0;
      }
    }

    let winner, pen = false;
    if (!permiteEmpate && gA === gB){
      const pPen = r1.ataque / (r1.ataque + r2.ataque);
      winner = (rng() < pPen) ? t1 : t2;
      pen = true;
    } else {
      winner = gA > gB ? t1 : (gA < gB ? t2 : null);
    }

    return { tA:t1, tB:t2, gA, gB, winner, pen };
  }

  // =====================================================================
  // Sistema de penalização por zebra (fiel ao R)
  // =====================================================================
  function forcaMedia(t){
    const r = TEAMS[t];
    return (r.goleiro + r.defesa + r.meio + r.ataque) / 4;
  }

  function calcularPenalidadeZebra(tA, tB, gA, gB, penalidadesAtivas){
    if (!PENALIZACAO_ATIVA) return penalidadesAtivas;
    if (gA === gB) return penalidadesAtivas;
    const perdedor = gA < gB ? tA : tB;
    const vencedor = gA < gB ? tB : tA;
    const forcaPerd = forcaMedia(perdedor);
    const forcaVenc = forcaMedia(vencedor);
    if (forcaPerd <= forcaVenc) return penalidadesAtivas;
    const zebra = (forcaPerd - forcaVenc) / forcaPerd;
    const penalidade = K_PENALIDADE * zebra;
    if (!penalidadesAtivas[perdedor]) penalidadesAtivas[perdedor] = [];
    penalidadesAtivas[perdedor].push(penalidade);
    return penalidadesAtivas;
  }

  function decairPenalidades(penalidadesAtivas){
    for (const t in penalidadesAtivas){
      let nova = penalidadesAtivas[t].map(p => p * DECAY_PENALIDADE).filter(p => p >= PENALIDADE_MIN);
      if (nova.length === 0) delete penalidadesAtivas[t];
      else penalidadesAtivas[t] = nova;
    }
    return penalidadesAtivas;
  }

  // Aplica penalidades ativas, gerando ratings temporários (não mutam TEAMS base)
  function aplicarPenalidades(penalidadesAtivas){
    const overrides = {}; // time -> {ataque,meio,defesa,goleiro} ajustado
    for (const t in penalidadesAtivas){
      const soma = penalidadesAtivas[t].reduce((a,b)=>a+b, 0);
      let fator = 1 - soma;
      fator = Math.max(fator, 0.5);
      const base = TEAMS[t];
      overrides[t] = {
        ataque: base.ataque * fator, meio: base.meio * fator,
        defesa: base.defesa * fator, goleiro: base.goleiro * fator
      };
    }
    return overrides;
  }

  // Executa fn com TEAMS temporariamente sobrescrito pelos overrides de penalidade
  function withPenalties(overrides, fn){
    const saved = {};
    for (const t in overrides){ saved[t] = TEAMS[t]; TEAMS[t] = overrides[t]; }
    try { return fn(); }
    finally { for (const t in overrides){ TEAMS[t] = saved[t]; } }
  }

  // =====================================================================
  // sim_grupo — fase de grupos rodada a rodada (R1, R2, R3)
  // Padrão: R1: 1v2,3v4 | R2: 1v3,2v4 | R3: 1v4,2v3
  // =====================================================================
  function simGrupo(letra, penalidadesAtivas, rng){
    const times = GRUPOS[letra];
    const tab = times.map(t => ({time:t, pts:0, gf:0, gc:0, gd:0, j:0}));
    const byName = {}; tab.forEach(r => byName[r.time] = r);
    const jogos = [];

    const rodadas = [
      [0,1,2,3], // R1: (1v2),(3v4)  [0-indexed]
      [0,2,1,3], // R2: (1v3),(2v4)
      [0,3,1,2]  // R3: (1v4),(2v3)
    ];

    for (const rodada of rodadas){
      const pares = [[rodada[0],rodada[1]], [rodada[2],rodada[3]]];
      const overrides = aplicarPenalidades(penalidadesAtivas);

      for (const par of pares){
        const tA = times[par[0]], tB = times[par[1]];
        const jogoReal = buscarJogoReal(tA, tB);

        let r;
        if (jogoReal){
          const gA = jogoReal.gA, gB = jogoReal.gB;
          const winner = gA > gB ? tA : (gA < gB ? tB : null);
          r = { tA, tB, gA, gB, winner, pen:false, real:true };
          // Resultados reais não alimentam o sistema de zebra (igual ao R)
        } else {
          r = withPenalties(overrides, () => simJogo(tA, tB, rng, {permiteEmpate:true}));
          r.real = false;
          penalidadesAtivas = calcularPenalidadeZebra(tA, tB, r.gA, r.gB, penalidadesAtivas);
        }
        jogos.push(r);

        byName[tA].gf += r.gA; byName[tA].gc += r.gB;
        byName[tB].gf += r.gB; byName[tB].gc += r.gA;
        byName[tA].j++; byName[tB].j++;

        if (r.winner === tA) byName[tA].pts += 3;
        else if (r.winner === tB) byName[tB].pts += 3;
        else { byName[tA].pts += 1; byName[tB].pts += 1; }
      }
      penalidadesAtivas = decairPenalidades(penalidadesAtivas);
    }

    tab.forEach(r => r.gd = r.gf - r.gc);
    tab.sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    tab.forEach((r,i) => r.pos = i+1);

    return { letra, tab, jogos, penalidadesAtivas };
  }

  // =====================================================================
  // sim_fase — fase de mata-mata genérica a partir do bracket
  // =====================================================================
  function resolverSlot(slot, classificados){ return classificados[slot]; }

  function simFase(bracket, classificados, penalidadesAtivas, rng){
    const resultados = {};
    const overrides = aplicarPenalidades(penalidadesAtivas);

    for (const jogo of bracket){
      const tA = resolverSlot(jogo.wA || jogo.posA, classificados);
      const tB = resolverSlot(jogo.wB || jogo.posB, classificados);
      const r = withPenalties(overrides, () => simJogo(tA, tB, rng, {permiteEmpate:false}));
      resultados["W"+jogo.id] = r.winner;
      resultados["L"+jogo.id] = (r.winner === tA) ? tB : tA;
      resultados["R"+jogo.id] = r;
      penalidadesAtivas = calcularPenalidadeZebra(tA, tB, r.gA, r.gB, penalidadesAtivas);
    }
    penalidadesAtivas = decairPenalidades(penalidadesAtivas);
    return { resultados, penalidadesAtivas };
  }

  // =====================================================================
  // simularCopa — torneio completo (uma realização)
  // =====================================================================
  function simularCopa(rng){
    const resultadoGrupos = {};
    let penalidadesAtivas = {};

    for (const g of Object.keys(GRUPOS)){
      const resG = simGrupo(g, penalidadesAtivas, rng);
      resultadoGrupos[g] = resG;
      penalidadesAtivas = resG.penalidadesAtivas;
    }

    const classificados = {};
    const terceiros = [];

    for (const g of Object.keys(GRUPOS)){
      const tab = resultadoGrupos[g].tab;
      classificados["1"+g] = tab[0].time;
      classificados["2"+g] = tab[1].time;
      terceiros.push({grupo:g, time:tab[2].time, pts:tab[2].pts, gd:tab[2].gd, gf:tab[2].gf});
    }

    terceiros.sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    const melhores3os = terceiros.slice(0,8);
    melhores3os.forEach((row,i) => { classificados["3_"+(i+1)] = row.time; });

    const resR32 = simFase(BRACKET_R32, classificados, penalidadesAtivas, rng);
    Object.assign(classificados, resR32.resultados);
    penalidadesAtivas = resR32.penalidadesAtivas;

    const resR16 = simFase(BRACKET_R16, classificados, penalidadesAtivas, rng);
    Object.assign(classificados, resR16.resultados);
    penalidadesAtivas = resR16.penalidadesAtivas;

    const resQF = simFase(BRACKET_QF, classificados, penalidadesAtivas, rng);
    Object.assign(classificados, resQF.resultados);
    penalidadesAtivas = resQF.penalidadesAtivas;

    const resSF = simFase(BRACKET_SF, classificados, penalidadesAtivas, rng);
    Object.assign(classificados, resSF.resultados);
    penalidadesAtivas = resSF.penalidadesAtivas;

    const overridesPosSemis = aplicarPenalidades(penalidadesAtivas);

    const t3a = classificados["L101"], t3b = classificados["L102"];
    const r3o = withPenalties(overridesPosSemis, () => simJogo(t3a, t3b, rng, {permiteEmpate:false}));
    const terceiro = r3o.winner;
    const quarto = (r3o.winner === t3a) ? t3b : t3a;

    const tFinA = classificados["W101"], tFinB = classificados["W102"];
    const rFin = withPenalties(overridesPosSemis, () => simJogo(tFinA, tFinB, rng, {permiteEmpate:false}));
    const campeao = rFin.winner;
    const vice = (rFin.winner === tFinA) ? tFinB : tFinA;

    return {
      campeao, vice, terceiro, quarto,
      grupos: resultadoGrupos,
      melhores3os,
      classificados,
      r32: resR32.resultados, r16: resR16.resultados, qf: resQF.resultados, sf: resSF.resultados,
      r3o, rFin,
      penalidadesFinais: penalidadesAtivas
    };
  }

  // =====================================================================
  // Monte Carlo
  // =====================================================================
  function simularMonteCarlo(N, seed, onProgress){
    const rng = mulberry32(seed);
    const todosTimes = Object.values(GRUPOS).flat();
    const contadores = {campeao:{}, vice:{}, terceiro:{}, quarto:{}, semi:{}};
    todosTimes.forEach(t => { contadores.campeao[t]=0; contadores.vice[t]=0; contadores.terceiro[t]=0; contadores.quarto[t]=0; contadores.semi[t]=0; });

    for (let i=0;i<N;i++){
      const r = simularCopa(rng);
      contadores.campeao[r.campeao]++;
      contadores.vice[r.vice]++;
      contadores.terceiro[r.terceiro]++;
      contadores.quarto[r.quarto]++;
      [r.campeao, r.vice, r.terceiro, r.quarto].forEach(t => contadores.semi[t]++);
      if (onProgress && (i % Math.max(1, Math.floor(N/20)) === 0)) onProgress(i, N);
    }

    const prob = todosTimes.map(t => ({
      time: t,
      p_campeao: contadores.campeao[t]/N*100,
      p_vice: contadores.vice[t]/N*100,
      p_terceiro: contadores.terceiro[t]/N*100,
      p_quarto: contadores.quarto[t]/N*100,
      p_semi: contadores.semi[t]/N*100
    }));
    prob.sort((a,b) => b.p_campeao - a.p_campeao);
    return prob;
  }

  // Expor no namespace global da app
  window.CopaEngine = {
    GRUPOS, FLAGS, BASE_TEAMS, JOGOS_REALIZADOS,
    getTeams: () => TEAMS,
    setTeamAttr: (team, attr, val) => { TEAMS[team][attr] = val; },
    resetTeam: (team) => { TEAMS[team] = Object.assign({}, BASE_TEAMS[team]); },
    resetAll: () => { TEAMS = cloneBaseTeams(); },
    overall,
    mulberry32,
    simJogo, simularCopa, simularMonteCarlo,
    ROUND_LABELS
  };
})();
