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
  const FRAC_RAT   = .8;
  const FRAC_CAMPO = 4;
  const FRAC_TEMPO = 200;

  const PENALIZACAO_ATIVA = false;
  const K_PENALIDADE      = 0.10;
  const DECAY_PENALIDADE  = .9;
  const PENALIDADE_MIN    = 0.001;

  // ---- Parâmetros ELO (fixos) ----------------------------------------------
  const ELO_K   = 1;    // fator de atualização por jogo
  const ELO_HA  = 3;    // ajuste de home advantage na fórmula logística
  const ELO_MAX = 95;   // teto de rating ELO (não ultrapassa este valor)
  let USE_ELO   = false; // controlado pelo checkbox da UI

  // ===========================================================================
  // JOGOS JÁ REALIZADOS — edite esta lista manualmente conforme a Copa avança.
  //
  // Cada linha é um confronto JÁ DISPUTADO (fase de grupos OU mata-mata), com
  // o placar real. A simulação usa esse placar (sem rodar o motor) para esse
  // confronto específico, e simula normalmente tudo o que ainda não aconteceu.
  //
  // Use exatamente os nomes em português usados em GRUPOS (ex: "EUA", "Rep.
  // Dem. do Congo", "Bósnia", "Costa do Marfim", "República Tcheca"...).
  // A ordem dos dois times na linha não importa (gA é sempre do timeA, gB do
  // timeB, na ordem em que você escreveu).
  //
  // FASE DE GRUPOS — placar pode empatar normalmente:
  //   { timeA:"México", gA:1, timeB:"EUA", gB:1 },
  //
  // MATA-MATA (Round of 32 em diante) — não há empate na vida real; some o
  // placar normal (90 min) e, se o jogo foi decidido nos pênaltis (empate no
  // placar normal), informe explicitamente quem venceu com `vencedor`:
  //   { timeA:"Brasil", gA:2, timeB:"Japão", gB:1 },                          // vitória normal
  //   { timeA:"Holanda", gA:1, timeB:"Marrocos", gB:1, vencedor:"Holanda" },  // foi a pênaltis
  //
  // Deixe comentado (//) ou remova uma linha para "zerar" e voltar a simular
  // aquele confronto normalmente.
  // ===========================================================================
  const JOGOS_REALIZADOS = [
    // Gerado por ATUALIZA_JOGOS_REALIZADOS.R em 2026-06-30 09:36
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
    { timeA:"Egito", gA:1, timeB:"Irã", gB:1 },  // Grupo G — 2026-06-26
    { timeA:"Nova Zelândia", gA:1, timeB:"Bélgica", gB:5 },  // Grupo G — 2026-06-26
    { timeA:"Cabo Verde", gA:0, timeB:"Arábia Saudita", gB:0 },  // Grupo H — 2026-06-26
    { timeA:"Uruguai", gA:0, timeB:"Espanha", gB:1 },  // Grupo H — 2026-06-26
    { timeA:"Noruega", gA:1, timeB:"França", gB:4 },  // Grupo I — 2026-06-26
    { timeA:"Senegal", gA:5, timeB:"Iraque", gB:0 },  // Grupo I — 2026-06-26
    { timeA:"Argélia", gA:3, timeB:"Áustria", gB:3 },  // Grupo J — 2026-06-27
    { timeA:"Jordânia", gA:1, timeB:"Argentina", gB:3 },  // Grupo J — 2026-06-27
    { timeA:"Colômbia", gA:0, timeB:"Portugal", gB:0 },  // Grupo K — 2026-06-27
    { timeA:"Rep. Dem. do Congo", gA:3, timeB:"Uzbequistão", gB:1 },  // Grupo K — 2026-06-27
    { timeA:"Panamá", gA:0, timeB:"Inglaterra", gB:2 },  // Grupo L — 2026-06-27
    { timeA:"Croácia", gA:2, timeB:"Gana", gB:1 },  // Grupo L — 2026-06-27
    { timeA:"África do Sul", gA:0, timeB:"Canadá", gB:1 },  // Round of 32 — 2026-06-28
    { timeA:"Alemanha", gA:1, timeB:"Paraguai", gB:1, vencedor:"Paraguai" },  // Round of 32 — 2026-06-29 (pênaltis 3-4)
    { timeA:"Holanda", gA:1, timeB:"Marrocos", gB:1, vencedor:"Marrocos" },  // Round of 32 — 2026-06-29 (pênaltis 2-3)
    { timeA:"Brasil", gA:2, timeB:"Japão", gB:1 },  // Round of 32 — 2026-06-29
    { timeA: "Noruega", gA:2, timeB:"Costa do Marfim", gB:1},
    { timeA: "França", gA:3, timeB:"Suécia", gB:0},
    { timeA: "México", gA:2, timeB: "Equador", gB:0},
    { timeA: "Inglaterra", gA:2, timeB: "Rep. Dem. do Congo", gB:1},
    { timeA:"Bélgica", gA:3, timeB:"Senegal", gB:2 },  
    { timeA:"EUA", gA:2, timeB:"Bósnia", gB:0 }, 
    { timeA: "Espanha", gA:3, timeB: "Áustria", gB:0},
    { timeA: "Portugal", gA:2, timeB: "Croácia", gB:1},
    { timeA: "Suíça", gA:2, timeB: "Argélia", gB:0},
    { timeA: "Egito", gA:1, timeB: "Austrália", gB:1, vencedor: "Egito"},
    { timeA: "Argentina", gA:3, timeB: "Cabo Verde", gB: 2},
    { timeA: "Colômbia", gA: 1, timeB: "Gana", gB: 0},
    { timeA: "Marrocos", gA: 3, timeB: "Canadá", gB:0},
    { timeA: "França", gA:1, timeB:"Paraguai", gB:0},
    { timeA: "Brasil", gA:1, timeB:"Noruega", gB:2},
    { timeA: "México", gA:2, timeB:"Inglaterra", gB:3},
    { timeA: "Espanha", gA: 1, timeB:"Portugal", gB:0},
    { timeA: "Bélgica", gA: 4, timeB: "EUA", gB:1},
    { timeA: "Argentina", gA:3, timeB: "Egito", gB: 2},
    { timeA: "Colômbia", gA: 0, timeB: "Suíça", gB: 0, vencedor:"Suíça"},
    { timeA: "França", gA: 2, timeB: "Marrocos", gB: 0},
    { timeA: "Espanha", gA: 2, timeB:"Bélgica", gB:1},
    { timeA: "Inglaterra", gA:2, timeB: "Noruega",gB:1},
    { timeA: "Argentina", gA: 3, timeB: "Suíça", gB: 1},
  ];



  // Times do mesmo grupo, usado para inferir automaticamente se uma linha de
  // JOGOS_REALIZADOS é um jogo de GRUPO (mesmo grupo) ou de MATA-MATA (grupos
  // diferentes) — não exige que você marque a fase manualmente em cada linha.
  const GRUPO_DO_TIME = {};
  for (const g in GRUPOS) for (const t of GRUPOS[g]) GRUPO_DO_TIME[t] = g;
  function mesmoGrupo(tA, tB){ return GRUPO_DO_TIME[tA] && GRUPO_DO_TIME[tA] === GRUPO_DO_TIME[tB]; }

  // Dois índices separados — essencial porque dois times do mesmo grupo podem
  // se enfrentar de novo no mata-mata (ex: dois 3os colocados de grupos
  // diferentes não se cruzam, mas um 1º e 2º do MESMO grupo eliminados em
  // grupos diferentes do bracket podem teoricamente se reencontrar). Sem essa
  // separação, o placar da fase de grupos seria incorretamente reaproveitado
  // como se fosse o resultado do mata-mata (e vice-versa).
  function buildJogosRealizadosIndex(lista, filtro){
    const idx = {};
    for (const j of lista){
      if (!filtro(j.timeA, j.timeB)) continue;
      idx[j.timeA + "__" + j.timeB] = { gA: j.gA, gB: j.gB, vencedor: j.vencedor || null };
      idx[j.timeB + "__" + j.timeA] = { gA: j.gB, gB: j.gA, vencedor: j.vencedor || null };
    }
    return idx;
  }
  const JOGOS_IDX_GRUPO     = buildJogosRealizadosIndex(JOGOS_REALIZADOS, mesmoGrupo);
  const JOGOS_IDX_MATAMATA  = buildJogosRealizadosIndex(JOGOS_REALIZADOS, (a,b) => !mesmoGrupo(a,b));

  // Retorna {gA, gB, vencedor} se tA x tB (nessa ordem) já foi disputado NA
  // FASE DE GRUPOS, ou null.
  function buscarJogoRealGrupo(tA, tB){
    const r = JOGOS_IDX_GRUPO[tA + "__" + tB];
    return r ? { gA: r.gA, gB: r.gB, vencedor: r.vencedor } : null;
  }
  // Retorna {gA, gB, vencedor} se tA x tB (nessa ordem) já foi disputado NO
  // MATA-MATA, ou null.
  function buscarJogoRealMataMata(tA, tB){
    const r = JOGOS_IDX_MATAMATA[tA + "__" + tB];
    return r ? { gA: r.gA, gB: r.gB, vencedor: r.vencedor } : null;
  }

  // Valida a lista (nomes de times existem; placares de mata-mata empatados
  // têm vencedor definido) — ajuda a pegar erros de digitação/esquecimento
  // em JOGOS_REALIZADOS no console do browser.
  function validarJogosRealizados(){
    const todosTimes = new Set(Object.values(GRUPOS).flat());
    const grupoDoTime = {};
    for (const g in GRUPOS) for (const t of GRUPOS[g]) grupoDoTime[t] = g;
    const problemas = [];
    JOGOS_REALIZADOS.forEach((j, i) => {
      if (!todosTimes.has(j.timeA)) problemas.push(`Linha ${i+1}: time "${j.timeA}" não encontrado em GRUPOS.`);
      if (!todosTimes.has(j.timeB)) problemas.push(`Linha ${i+1}: time "${j.timeB}" não encontrado em GRUPOS.`);
      if (j.gA === j.gB && j.vencedor && j.vencedor !== j.timeA && j.vencedor !== j.timeB){
        problemas.push(`Linha ${i+1}: "vencedor" ("${j.vencedor}") não é nem "${j.timeA}" nem "${j.timeB}".`);
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
    {id:74, posA:"1E", posB:"3_7"},
    {id:75, posA:"1F", posB:"2C"},
    {id:76, posA:"1C", posB:"2F"},
    {id:77, posA:"1I", posB:"3_2"},
    {id:78, posA:"2E", posB:"2I"},
    {id:79, posA:"1A", posB:"3_3"},
    {id:80, posA:"1L", posB:"3_1"},
    {id:81, posA:"1D", posB:"3_5"},
    {id:82, posA:"1G", posB:"3_8"},
    {id:83, posA:"2K", posB:"2L"},
    {id:84, posA:"1H", posB:"2J"},
    {id:85, posA:"1B", posB:"3_6"},
    {id:86, posA:"1J", posB:"2H"},
    {id:87, posA:"1K", posB:"3_4"},
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
  // O motor agora usa um ÚNICO rating geral por time (campo `overall`).
  // Ele é inicializado pela média dos 4 atributos originais do SOFIFA
  // (Goleiro/Defesa/Meio/Ataque), mas a partir daqui o jogo todo roda só
  // em cima desse número — os 4 atributos originais ficam guardados apenas
  // como referência/ponto de partida, não são mais usados pelo motor.
  function overallBase(t){
    return BASE_TEAMS[t].overall;
  }
  function cloneBaseTeams(){
    const out = {};
    for (const k in BASE_TEAMS) out[k] = { overall: overallBase(k) };
    return out;
  }
  let TEAMS = cloneBaseTeams();

  function overall(t){
    return TEAMS[t].overall;
  }

  // =====================================================================
  // DINÂMICA ELO
  //
  // O ELO parte do rating atual (slider) como ponto de partida.
  // Cada jogo — real ou simulado — atualiza os ratings dos dois times.
  // Os jogos já realizados (JOGOS_REALIZADOS) são processados UMA VEZ
  // para gerar ELO_POS_REAIS: o estado de rating que cada time carrega
  // ao entrar na parte simulada do torneio. Cada simulação Monte Carlo
  // parte desse ELO_POS_REAIS e evolui de forma independente.
  // =====================================================================

  // Probabilidade esperada de vitória do timeA dada a diferença de ELO.
  // HA (home advantage) é somado ao ELO do timeA na fórmula — como todos
  // os jogos da Copa são em campo neutro, HA serve apenas como ajuste
  // de calibração da curva logística (parâmetro fixo em 6).
  function pEsperadaElo(eloA, eloB){
    return 1 / (1 + Math.pow(10, (eloB - eloA + ELO_HA) / 400));
  }

  // Atualiza o eloState in-place após um jogo.
  // resultado: 1 = vitória de tA, 0 = vitória de tB, 0.5 = empate.
  function atualizarElo(tA, tB, resultado, eloState){
    const eloA = eloState[tA], eloB = eloState[tB];
    const pe = pEsperadaElo(eloA, eloB);
    const deltaA = ELO_K * (resultado - pe);
    const deltaB = ELO_K * ((1 - resultado) - (1 - pe));
    eloState[tA] = Math.min(ELO_MAX, eloA + deltaA);
    eloState[tB] = Math.min(ELO_MAX, eloB + deltaB);
  }

  // Constrói o estado ELO inicial a partir dos ratings atuais (sliders),
  // depois processa todos os JOGOS_REALIZADOS em ordem, gerando
  // ELO_POS_REAIS — o ponto de partida de cada simulação quando USE_ELO.
  //
  // Chamado automaticamente quando USE_ELO é ativado, e também cada vez
  // que ratings são editados (via setOverall/resetTeam/resetAll), para
  // garantir que as edições se refletem no ELO base.
  function buildEloPosReais(){
    const state = {};
    for (const t in TEAMS) state[t] = TEAMS[t].overall;

    // Processa jogos reais em ordem — usamos a lista bruta JOGOS_REALIZADOS
    // (que inclui grupos e mata-mata), sem distinção de fase, pois o ELO
    // deve refletir tudo que já aconteceu.
    for (const j of JOGOS_REALIZADOS){
      if (!(j.timeA in state) || !(j.timeB in state)) continue;
      // Determina resultado real: 1 = timeA venceu, 0 = timeB venceu, 0.5 = empate
      let resultado;
      if (j.gA > j.gB) resultado = 1;
      else if (j.gA < j.gB) resultado = 0;
      else if (j.vencedor === j.timeA) resultado = 1;
      else if (j.vencedor === j.timeB) resultado = 0;
      else resultado = 0.5; // empate real (fase de grupos)
      atualizarElo(j.timeA, j.timeB, resultado, state);
    }
    return state;
  }

  // Estado ELO após os jogos reais — reconstruído ao ativar ELO ou editar ratings.
  let ELO_POS_REAIS = null;
  function getEloPosReais(){
    if (!ELO_POS_REAIS) ELO_POS_REAIS = buildEloPosReais();
    return ELO_POS_REAIS;
  }
  function invalidarEloPosReais(){ ELO_POS_REAIS = null; }

  // Clona um eloState (para não mutar entre simulações).
  function clonarElo(state){
    const out = {};
    for (const t in state) out[t] = state[t];
    return out;
  }


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
  //
  // Versão com RATING ÚNICO. Quando USE_ELO=true, `eloState` deve ser
  // passado: o rating usado na probabilidade é o ELO atual daquele time
  // no eloState (em vez de TEAMS[t].overall), e o ELO é atualizado
  // in-place após cada jogo simulado.
  // =====================================================================
  function simJogo(t1, t2, rng, opts, eloState){
    opts = opts || {};
    const permiteEmpate = opts.permiteEmpate !== false;
    const fracCampo = FRAC_CAMPO, fracTempo = FRAC_TEMPO, fracRat = FRAC_RAT;

    // Rating efetivo: ELO se ativado e disponível, senão overall base
    const rat1 = (USE_ELO && eloState) ? eloState[t1] : TEAMS[t1].overall;
    const rat2 = (USE_ELO && eloState) ? eloState[t2] : TEAMS[t2].overall;

    const pBase = rat1 / (rat1 + rat2);
    const logit = Math.log(pBase / (1 - pBase));
    const scaled = fracRat * logit;
    const p = Math.exp(scaled) / (1 + Math.exp(scaled));

    // Campo uniforme: mesma probabilidade em todas as posições.
    const midLen = Math.floor(fracCampo/2)*2 + 1;
    const n = 1 + fracCampo + midLen + fracCampo + 1;
    const half = Math.floor(n/2);

    let pos = 0, gA = 0, gB = 0;
    for (let i=0;i<fracTempo;i++){
      const disputa = (rng() < p) ? 1 : -1;
      pos += disputa;
      if (Math.abs(pos) > half){
        if (disputa > 0) gA++; else gB++;
        pos = 0;
      }
    }

    let winner, pen = false;
    if (!permiteEmpate && gA === gB){
      const pPen = rat1 / (rat1 + rat2);
      winner = (rng() < pPen) ? t1 : t2;
      pen = true;
    } else {
      winner = gA > gB ? t1 : (gA < gB ? t2 : null);
    }

    // Atualiza ELO após jogo simulado (jogos reais já foram processados
    // em buildEloPosReais, não se reprocessam aqui)
    if (USE_ELO && eloState){
      const resultado = winner === t1 ? 1 : (winner === t2 ? 0 : 0.5);
      atualizarElo(t1, t2, resultado, eloState);
    }

    return { tA:t1, tB:t2, gA, gB, winner, pen };
  }

  // =====================================================================
  // Sistema de penalização por zebra (fiel ao R)
  // =====================================================================
  function forcaMedia(t){
    return TEAMS[t].overall;
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
    const overrides = {}; // time -> {overall} ajustado
    for (const t in penalidadesAtivas){
      const soma = penalidadesAtivas[t].reduce((a,b)=>a+b, 0);
      let fator = 1 - soma;
      fator = Math.max(fator, 0.5);
      const base = TEAMS[t];
      overrides[t] = { overall: base.overall * fator };
    }
    return overrides;
  }

  // Executa fn com TEAMS temporariamente sobrescrito pelos overrides de penalidade
  function withPenalties(overrides, fn, eloState){
    const saved = {};
    for (const t in overrides){ saved[t] = TEAMS[t]; TEAMS[t] = overrides[t]; }
    try { return fn(eloState); }
    finally { for (const t in overrides){ TEAMS[t] = saved[t]; } }
  }

  // =====================================================================
  // sim_grupo — fase de grupos rodada a rodada (R1, R2, R3)
  // Padrão: R1: 1v2,3v4 | R2: 1v3,2v4 | R3: 1v4,2v3
  // =====================================================================
  function simGrupo(letra, penalidadesAtivas, rng, eloState){
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
        const jogoReal = buscarJogoRealGrupo(tA, tB);

        let r;
        if (jogoReal){
          const gA = jogoReal.gA, gB = jogoReal.gB;
          const winner = gA > gB ? tA : (gA < gB ? tB : null);
          r = { tA, tB, gA, gB, winner, pen:false, real:true };
          // Resultados reais não alimentam o sistema de zebra (igual ao R)
        } else {
          r = withPenalties(overrides, (es) => simJogo(tA, tB, rng, {permiteEmpate:true}, es), eloState);
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

  function simFase(bracket, classificados, penalidadesAtivas, rng, eloState){
    const resultados = {};
    const overrides = aplicarPenalidades(penalidadesAtivas);

    for (const jogo of bracket){
      const tA = resolverSlot(jogo.wA || jogo.posA, classificados);
      const tB = resolverSlot(jogo.wB || jogo.posB, classificados);
      const jogoReal = buscarJogoRealMataMata(tA, tB);

      let r;
      if (jogoReal){
        const gA = jogoReal.gA, gB = jogoReal.gB;
        let winner;
        if (gA === gB){
          winner = jogoReal.vencedor || tA;
          if (!jogoReal.vencedor){
            console.warn(`[CopaEngine] Jogo real ${tA} ${gA}-${gB} ${tB} empatou no mata-mata mas não tem "vencedor" definido em JOGOS_REALIZADOS — assumindo ${tA} (provavelmente errado, corrija a linha adicionando vencedor:"${tA}" ou vencedor:"${tB}").`);
          }
        } else {
          winner = gA > gB ? tA : tB;
        }
        r = { tA, tB, gA, gB, winner, pen:false, real:true };
      } else {
        r = withPenalties(overrides, (es) => simJogo(tA, tB, rng, {permiteEmpate:false}, es), eloState);
        r.real = false;
        penalidadesAtivas = calcularPenalidadeZebra(tA, tB, r.gA, r.gB, penalidadesAtivas);
      }

      resultados["W"+jogo.id] = r.winner;
      resultados["L"+jogo.id] = (r.winner === tA) ? tB : tA;
      resultados["R"+jogo.id] = r;
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

    // Se ELO ativo, cada simulação parte do estado pós-jogos-reais (clone)
    const eloState = USE_ELO ? clonarElo(getEloPosReais()) : null;

    for (const g of Object.keys(GRUPOS)){
      const resG = simGrupo(g, penalidadesAtivas, rng, eloState);
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

    const resR32 = simFase(BRACKET_R32, classificados, penalidadesAtivas, rng, eloState);
    Object.assign(classificados, resR32.resultados);
    penalidadesAtivas = resR32.penalidadesAtivas;

    const resR16 = simFase(BRACKET_R16, classificados, penalidadesAtivas, rng, eloState);
    Object.assign(classificados, resR16.resultados);
    penalidadesAtivas = resR16.penalidadesAtivas;

    const resQF = simFase(BRACKET_QF, classificados, penalidadesAtivas, rng, eloState);
    Object.assign(classificados, resQF.resultados);
    penalidadesAtivas = resQF.penalidadesAtivas;

    const resSF = simFase(BRACKET_SF, classificados, penalidadesAtivas, rng, eloState);
    Object.assign(classificados, resSF.resultados);
    penalidadesAtivas = resSF.penalidadesAtivas;

    const overridesPosSemis = aplicarPenalidades(penalidadesAtivas);

    const t3a = classificados["L101"], t3b = classificados["L102"];
    const r3o = withPenalties(overridesPosSemis, (es) => simJogo(t3a, t3b, rng, {permiteEmpate:false}, es), eloState);
    const terceiro = r3o.winner;
    const quarto = (r3o.winner === t3a) ? t3b : t3a;

    const tFinA = classificados["W101"], tFinB = classificados["W102"];
    const rFin = withPenalties(overridesPosSemis, (es) => simJogo(tFinA, tFinB, rng, {permiteEmpate:false}, es), eloState);
    const campeao = rFin.winner;
    const vice = (rFin.winner === tFinA) ? tFinB : tFinA;

    return {
      campeao, vice, terceiro, quarto,
      grupos: resultadoGrupos,
      melhores3os,
      classificados,
      r32: resR32.resultados, r16: resR16.resultados, qf: resQF.resultados, sf: resSF.resultados,
      r3o, rFin,
      penalidadesFinais: penalidadesAtivas,
      eloFinal: eloState  // null quando USE_ELO=false
    };
  }

  // =====================================================================
  // Monte Carlo
  // =====================================================================
  function simularMonteCarlo(N, seed, onProgress){
    const rng = mulberry32(seed);
    const todosTimes = Object.values(GRUPOS).flat();
    const contadores = {campeao:{}, vice:{}, terceiro:{}, quarto:{}, semi:{}, quartas:{}, oitavas:{}};
    const somaElo = {};  // acumula ELO final de cada time ao longo das sims
    todosTimes.forEach(t => {
      contadores.campeao[t]=0; contadores.vice[t]=0; contadores.terceiro[t]=0;
      contadores.quarto[t]=0; contadores.semi[t]=0; contadores.quartas[t]=0; contadores.oitavas[t]=0;
      somaElo[t] = 0;
    });

    for (let i=0;i<N;i++){
      const r = simularCopa(rng);
      contadores.campeao[r.campeao]++;
      contadores.vice[r.vice]++;
      contadores.terceiro[r.terceiro]++;
      contadores.quarto[r.quarto]++;
      [r.campeao, r.vice, r.terceiro, r.quarto].forEach(t => contadores.semi[t]++);

      // Acumula ELO final (quando USE_ELO, r.eloFinal é o estado ao fim da copa)
      if (USE_ELO && r.eloFinal){
        todosTimes.forEach(t => { if (r.eloFinal[t] !== undefined) somaElo[t] += r.eloFinal[t]; });
      }

      if (onProgress && (i % Math.max(1, Math.floor(N/20)) === 0)) onProgress(i, N);
    }

    const prob = todosTimes.map(t => ({
      time: t,
      p_campeao: contadores.campeao[t]/N*100,
      p_vice: contadores.vice[t]/N*100,
      p_terceiro: contadores.terceiro[t]/N*100,
      p_quarto: contadores.quarto[t]/N*100,
      p_semi: contadores.semi[t]/N*100,
      eloMedio: USE_ELO ? somaElo[t]/N : null
    }));
    prob.sort((a,b) => b.p_campeao - a.p_campeao);
    return prob;
  }

  // =====================================================================
  // Trajetória de uma seleção — Monte Carlo focado em um único time
  //
  // Para cada simulação completa da copa, percorre as fases (fase de
  // grupos -> R32 -> Oitavas -> Quartas -> Semifinal -> Final/3ºlugar)
  // procurando os jogos em que o TIME_ALVO participou, registrando:
  //   - em que fase ele caiu (ou se foi campeão)
  //   - contra quem jogou em cada fase, e o placar
  // Agrega isso em duas visões:
  //   (a) funil por fase: % de chegar a cada fase
  //   (b) trajetórias mais comuns: sequências completas de adversários
  //       (uma por fase alcançada), ranqueadas por frequência
  // =====================================================================

  const FASES_MATA_MATA = [
    { key:'r32', label:'Round of 32' },
    { key:'r16', label:'Oitavas' },
    { key:'qf',  label:'Quartas' },
    { key:'sf',  label:'Semifinal' }
  ];

  // Acha, dentro do objeto de resultados de uma fase (ex: r.r32, que mapeia
  // "R73"->jogo, "W73"->vencedor, "L73"->perdedor), o jogo em que timeAlvo
  // jogou. Retorna {oponente, venceu, golsA, golsB, golsAlvo, golsOponente} ou null.
  function acharJogoDoTime(faseResultados, timeAlvo){
    for (const key in faseResultados){
      if (key[0] !== 'R') continue; // só objetos de jogo (R73, R74, ...)
      const jogo = faseResultados[key];
      if (jogo.tA === timeAlvo || jogo.tB === timeAlvo){
        const ehA = jogo.tA === timeAlvo;
        const oponente = ehA ? jogo.tB : jogo.tA;
        const golsAlvo = ehA ? jogo.gA : jogo.gB;
        const golsOponente = ehA ? jogo.gB : jogo.gA;
        const venceu = jogo.winner === timeAlvo;
        return { oponente, venceu, golsAlvo, golsOponente, pen: jogo.pen };
      }
    }
    return null;
  }

  // Roda uma copa e devolve a trajetória do timeAlvo nela.
  // etapas: array de {fase, label, oponente, venceu, golsAlvo, golsOponente, pen}
  // faseFinal: 'grupos' | 'Round of 32' | 'Oitavas' | 'Quartas' | 'Semifinal' | 'vice' | 'campeao'
  function tracarTrajetoria(r, timeAlvo){
    const etapas = [];

    // Fase de grupos: o time se classificou (top2 do grupo OU um dos 8
    // melhores terceiros)? Se não, a trajetória já acaba aqui.
    let grupoDoTime = null;
    for (const g in GRUPOS){ if (GRUPOS[g].includes(timeAlvo)){ grupoDoTime = g; break; } }
    const tabGrupo = r.grupos[grupoDoTime].tab;
    const linhaTime = tabGrupo.find(row => row.time === timeAlvo);
    const foiMelhor3 = r.melhores3os.some(row => row.time === timeAlvo);
    const classificou = linhaTime.pos <= 2 || foiMelhor3;

    if (!classificou){
      return { etapas, faseFinal:'grupos', posicaoGrupo: linhaTime.pos };
    }

    const fasesObjs = { r32: r.r32, r16: r.r16, qf: r.qf, sf: r.sf };
    let aindaVivo = true;
    let perdeuNaSemi = false;

    for (const fase of FASES_MATA_MATA){
      if (!aindaVivo) break;
      const jogo = acharJogoDoTime(fasesObjs[fase.key], timeAlvo);
      if (!jogo){
        // Não deveria acontecer estando vivo, mas por segurança interrompe.
        break;
      }
      etapas.push(Object.assign({ fase: fase.key, label: fase.label }, jogo));
      if (!jogo.venceu){
        aindaVivo = false;
        if (fase.key === 'sf') perdeuNaSemi = true;
      }
    }

    if (!aindaVivo && !perdeuNaSemi){
      const ultima = etapas[etapas.length-1];
      return { etapas, faseFinal: ultima.label, posicaoGrupo: linhaTime.pos };
    }

    // Chegou ao fim da semifinal (venceu ou perdeu): joga a final (se venceu)
    // ou a disputa de 3º lugar (se perdeu).
    if (perdeuNaSemi){
      const jogo3o = acharJogoDoTime({ R998: r.r3o }, timeAlvo);
      if (jogo3o){
        etapas.push(Object.assign({ fase:'terceiro', label:'Disputa de 3º' }, jogo3o));
        return {
          etapas,
          faseFinal: jogo3o.venceu ? 'terceiro' : 'quarto',
          posicaoGrupo: linhaTime.pos
        };
      }
      // Não deveria chegar aqui se a lógica do bracket estiver consistente.
      return { etapas, faseFinal:'Semifinal', posicaoGrupo: linhaTime.pos };
    }

    const jogoFinal = acharJogoDoTime({ R999: r.rFin }, timeAlvo);
    if (jogoFinal){
      etapas.push(Object.assign({ fase:'final', label:'Final' }, jogoFinal));
      return {
        etapas,
        faseFinal: jogoFinal.venceu ? 'campeao' : 'vice',
        posicaoGrupo: linhaTime.pos
      };
    }

    // Não deveria chegar aqui se a lógica do bracket estiver consistente.
    return { etapas, faseFinal:'Semifinal', posicaoGrupo: linhaTime.pos };
  }

  const ORDEM_FASE_FINAL = [
    'grupos','Round of 32','Oitavas','Quartas','Semifinal','quarto','terceiro','vice','campeao'
  ];
  const LABEL_FASE_FINAL = {
    grupos: 'Eliminado na fase de grupos',
    'Round of 32': 'Eliminado no Round of 32',
    'Oitavas': 'Eliminado nas Oitavas',
    'Quartas': 'Eliminado nas Quartas',
    'Semifinal': 'Eliminado na Semifinal',
    quarto: '4º lugar',
    terceiro: '3º lugar',
    vice: 'Vice-campeão',
    campeao: 'Campeão'
  };

  function simularTrajetoria(timeAlvo, N, seed, onProgress){
    const rng = mulberry32(seed);

    const contadorFaseFinal = {};
    ORDEM_FASE_FINAL.forEach(f => contadorFaseFinal[f] = 0);

    const funilChegou = { grupos_eliminado:0, r32:0, r16:0, qf:0, sf:0, final_ou_3o:0, campeao:0 };
    const trajetorias = {};
    const adversariosPorFase = {};
    FASES_MATA_MATA.concat([{key:'final', label:'Final'}, {key:'terceiro', label:'Disputa de 3º lugar'}]).forEach(f => { adversariosPorFase[f.key] = {}; });
    let chegouNaFase = { r32:0, r16:0, qf:0, sf:0, final:0, terceiro:0 };
    let somaEloFinal = 0;  // acumula ELO final do time alvo

    for (let i=0;i<N;i++){
      const r = simularCopa(rng);
      const traj = tracarTrajetoria(r, timeAlvo);

      contadorFaseFinal[traj.faseFinal] = (contadorFaseFinal[traj.faseFinal]||0) + 1;

      if (traj.faseFinal === 'grupos') funilChegou.grupos_eliminado++;
      else {
        funilChegou.r32++;
        if (traj.etapas.length >= 2) funilChegou.r16++;
        if (traj.etapas.length >= 3) funilChegou.qf++;
        if (traj.etapas.length >= 4) funilChegou.sf++;
        if (traj.etapas.length >= 5) funilChegou.final_ou_3o++;
        if (traj.faseFinal === 'campeao') funilChegou.campeao++;
      }

      const chaveEtapas = traj.etapas.map(e => e.fase + ':' + e.oponente + ':' + (e.venceu?'V':'D')).join('|');
      const chave = chaveEtapas + '>>' + traj.faseFinal;
      if (!trajetorias[chave]){
        trajetorias[chave] = { count:0, etapas: traj.etapas, faseFinal: traj.faseFinal };
      }
      trajetorias[chave].count++;

      // Agrega adversário por fase (independente do caminho completo)
      traj.etapas.forEach(e => {
        const faseKey = e.fase; // 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'terceiro'
        if (!adversariosPorFase[faseKey]) return;
        chegouNaFase[faseKey] = (chegouNaFase[faseKey]||0) + 1;
        if (!adversariosPorFase[faseKey][e.oponente]) adversariosPorFase[faseKey][e.oponente] = { count:0, vitorias:0 };
        adversariosPorFase[faseKey][e.oponente].count++;
        if (e.venceu) adversariosPorFase[faseKey][e.oponente].vitorias++;
      });

      // Acumula ELO final do time alvo nesta simulação
      if (USE_ELO && r.eloFinal && r.eloFinal[timeAlvo] !== undefined){
        somaEloFinal += r.eloFinal[timeAlvo];
      }

      if (onProgress && (i % Math.max(1, Math.floor(N/20)) === 0)) onProgress(i, N);
    }

    const faseFinalProb = ORDEM_FASE_FINAL.map(f => ({
      fase: f, label: LABEL_FASE_FINAL[f],
      count: contadorFaseFinal[f], pct: contadorFaseFinal[f]/N*100
    })).filter(x => x.count > 0);

    const trajetoriasOrdenadas = Object.values(trajetorias)
      .sort((a,b) => b.count - a.count)
      .map(t => Object.assign({}, t, { pct: t.count/N*100 }));

    const funilPct = {
      grupos: 100,
      r32: funilChegou.r32/N*100,
      r16: funilChegou.r16/N*100,
      qf: funilChegou.qf/N*100,
      sf: funilChegou.sf/N*100,
      final_ou_3o: funilChegou.final_ou_3o/N*100,
      campeao: funilChegou.campeao/N*100
    };

    const FASE_LABEL_CURTA = { r32:'Round of 32', r16:'Oitavas', qf:'Quartas', sf:'Semifinal', final:'Final', terceiro:'Disputa de 3º lugar' };
    const adversariosPorFaseOrdenado = Object.keys(adversariosPorFase).map(faseKey => {
      const total = chegouNaFase[faseKey] || 0;
      const lista = Object.keys(adversariosPorFase[faseKey]).map(op => {
        const d = adversariosPorFase[faseKey][op];
        return { oponente: op, count: d.count, pctDentroFase: total>0 ? d.count/total*100 : 0, pctVitoria: d.count>0 ? d.vitorias/d.count*100 : 0 };
      }).sort((a,b) => b.count - a.count);
      return { fase: faseKey, label: FASE_LABEL_CURTA[faseKey], totalChegou: total, pctChegou: total/N*100, adversarios: lista };
    }).filter(f => f.totalChegou > 0);

    return {
      time: timeAlvo, N,
      faseFinalProb,
      trajetorias: trajetoriasOrdenadas,
      funilPct,
      adversariosPorFase: adversariosPorFaseOrdenado,
      eloMedio: USE_ELO ? somaEloFinal/N : null
    };
  }

  // Expor no namespace global da app
  window.CopaEngine = {
    GRUPOS, FLAGS, BASE_TEAMS, JOGOS_REALIZADOS,
    getTeams: () => TEAMS,
    setOverall: (team, val) => { TEAMS[team].overall = val; invalidarEloPosReais(); },
    resetTeam: (team) => { TEAMS[team] = { overall: overallBase(team) }; invalidarEloPosReais(); },
    resetAll: () => { TEAMS = cloneBaseTeams(); invalidarEloPosReais(); },
    overall, overallBase,
    mulberry32,
    simJogo, simularCopa, simularMonteCarlo, simularTrajetoria,
    LABEL_FASE_FINAL, ORDEM_FASE_FINAL,
    ROUND_LABELS,
    // ELO
    setUseElo: (v) => { USE_ELO = v; },
    getUseElo: () => USE_ELO,
    getEloPosReais,
    invalidarEloPosReais,
    ELO_K, ELO_HA, ELO_MAX
  };
})();
