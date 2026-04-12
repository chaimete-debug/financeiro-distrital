// ═══════════════════════════════════════════════════════════════
//  Adicionar ao Dashboard.gs (ou criar novo ficheiro)
//  Também registar no Server_call.gs dentro do FN_MAP:
//
//  Dashboard_resumoRubricas: (a) => Dashboard_resumoRubricas(a[0] || {}),
//
// ═══════════════════════════════════════════════════════════════

/**
 * Resumo aprovado por rubrica para o âmbito do utilizador autenticado.
 * Parâmetros opcionais: { ano, mes }
 * Retorna: { ano, mes, linhas: [{id_rubrica, nome_rubrica, nome_grupo, tipo_movimento, entrada, saida, saldo}], totalEntrada, totalSaida, totalSaldo }
 */
function Dashboard_resumoRubricas(filtros) {
  const user = Auth_requireActor();

  const agora = new Date();
  const ano = Number((filtros && filtros.ano) || agora.getFullYear());
  const mes = Number((filtros && filtros.mes) || (agora.getMonth() + 1));

  const lancamentos = SheetUtil_getObjects(SHEETS.LANCAMENTOS).filter(function(r) {
    if (String(r.estado || '').trim().toUpperCase() !== 'APROVADO') return false;
    if (Number(r.ano) !== ano) return false;
    if (Number(r.mes) !== mes) return false;
    return Scope_matchesUser(r, user);
  });

  // Indexar rubricas e grupos por ID para resolver nomes
  const rubricas = SheetUtil_getObjects(SHEETS.RUBRICAS);
  const grupos   = SheetUtil_getObjects(SHEETS.GRUPOS);

  const rubricaById = {};
  rubricas.forEach(function(r) {
    rubricaById[String(r.id_rubrica || '')] = r;
  });

  const grupoById = {};
  grupos.forEach(function(g) {
    grupoById[String(g.id_grupo || '')] = g;
  });

  // Agrupar por rubrica
  const agrupado = {};

  lancamentos.forEach(function(r) {
    const idRub  = String(r.id_rubrica || '').trim() || '(sem rubrica)';
    const tipo   = String(r.tipo_movimento || '').trim().toUpperCase();
    const valor  = parseFloat(String(r.valor || '0').replace(',', '.')) || 0;

    if (!agrupado[idRub]) {
      const rub  = rubricaById[idRub] || {};
      const grp  = grupoById[String(rub.id_grupo || r.id_grupo || '')] || {};
      agrupado[idRub] = {
        id_rubrica:     idRub,
        nome_rubrica:   rub.nome_rubrica   || idRub,
        id_grupo:       rub.id_grupo       || r.id_grupo || '',
        nome_grupo:     grp.nome_grupo     || rub.id_grupo || '',
        tipo_movimento: rub.tipo_movimento || '',
        entrada: 0,
        saida:   0
      };
    }

    if (tipo === 'RECEITA') agrupado[idRub].entrada += valor;
    if (tipo === 'DESPESA') agrupado[idRub].saida   += valor;
  });

  const linhas = Object.values(agrupado).map(function(g) {
    return {
      id_rubrica:     g.id_rubrica,
      nome_rubrica:   g.nome_rubrica,
      id_grupo:       g.id_grupo,
      nome_grupo:     g.nome_grupo,
      tipo_movimento: g.tipo_movimento,
      entrada: g.entrada,
      saida:   g.saida,
      saldo:   g.entrada - g.saida
    };
  }).sort(function(a, b) {
    return a.nome_grupo.localeCompare(b.nome_grupo) || a.nome_rubrica.localeCompare(b.nome_rubrica);
  });

  const totalEntrada = linhas.reduce(function(s, l) { return s + l.entrada; }, 0);
  const totalSaida   = linhas.reduce(function(s, l) { return s + l.saida;   }, 0);

  return {
    ano:          ano,
    mes:          mes,
    id_igreja:    user.id_igreja    || '',
    igreja_nome:  user.igreja_nome  || '',
    linhas:       linhas,
    totalEntrada: totalEntrada,
    totalSaida:   totalSaida,
    totalSaldo:   totalEntrada - totalSaida
  };
}
