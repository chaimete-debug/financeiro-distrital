/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */

function showMessage(text, ok, elementId = 'msg'){
  const el = document.getElementById(elementId);
  if(!el) return;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text || '';
  if(ok) setTimeout(() => { if(el.textContent === text) el.innerHTML = ''; }, 5000);
}

function setLoading(state, btnId = 'btnLogin'){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  btn.disabled = state;
  if(btnId === 'btnLogin') btn.textContent = state ? '⏳ A processar...' : 'Iniciar sessão';
}

function formatMoney(value){
  const n = Number(value || 0);
  return n.toLocaleString('pt-PT', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' MZN';
}

function safeText(v){ return v == null || v === '' ? '-' : String(v); }
function getToken(){ return sessionStorage.getItem('app_token') || ''; }
function getUser(){ try{ return JSON.parse(sessionStorage.getItem('app_user')||'{}'); }catch(e){ return {}; } }

function statusBadge(s){
  const map = {
    'APROVADO':  ['badge-success','✅ Aprovado'],
    'SUBMETIDO': ['badge-warning','📤 Submetido'],
    'RASCUNHO':  ['badge-info','📝 Rascunho'],
    'REJEITADO': ['badge-danger','❌ Rejeitado'],
  };
  const key = String(s||'').toUpperCase();
  const [cls, label] = map[key] || ['badge-info', safeText(s)];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ══════════════════════════════════════════════════════
   API
══════════════════════════════════════════════════════ */

async function apiCall(action, args = []) {
  const response = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, args })
  });
  if(!response.ok) throw new Error('Falha de comunicação com o servidor.');
  return await response.json();
}

async function serverCall(fnName, args, onSuccess, onFailure){
  try {
    const token = getToken();
    const res = await apiCall('Server_call', [token, fnName, args || []]);
    if(res && res.success === false) throw new Error(res.message || 'Erro no servidor.');
    if(onSuccess) onSuccess(res);
  } catch(err) {
    if(onFailure) onFailure(err);
  }
}

/* cache de opções do formulário */
let _formOptions = null;
function getFormOptions(cb){
  if(_formOptions){ cb(_formOptions); return; }
  serverCall('Lancamento_getFormOptions', [], function(res){
    _formOptions = res;
    cb(res);
  }, function(err){ cb(null); });
}

/* ══════════════════════════════════════════════════════
   SHELL
══════════════════════════════════════════════════════ */

function setMainIdentity(user){
  document.getElementById('welcomeText').textContent = '👋 Sessão iniciada por ' + safeText(user.nome_completo) + '.';
  document.getElementById('kpiUser').textContent   = safeText(user.nome_completo);
  document.getElementById('kpiPerfil').textContent = safeText(user.id_perfil);
  document.getElementById('kpiIgreja').textContent = safeText(user.nome_igreja || user.id_igreja || '-');
}

function setActiveMenu(label){
  document.querySelectorAll('#menuList li').forEach(li => li.classList.toggle('active', li.textContent === label));
}

function toggleMenu(){
  const btn = document.getElementById('menuToggle'), list = document.getElementById('menuList');
  if(!btn||!list) return;
  const o = list.classList.toggle('open');
  btn.classList.toggle('open', o);
}

function closeMenuOnMobile(){
  if(window.innerWidth <= 680){
    document.getElementById('menuList')?.classList.remove('open');
    document.getElementById('menuToggle')?.classList.remove('open');
  }
}

function renderMenu(menu){
  const ul = document.getElementById('menuList');
  ul.innerHTML = '';
  const source = Array.isArray(menu)&&menu.length ? menu : [
    {label:'📊 Dashboard'},{label:'📝 Lançamentos'},{label:'✓ Aprovações'},
    {label:'📈 Orçamentos'},{label:'📄 Relatórios'},{label:'⚙️ Administração'}
  ];
  source.forEach(function(item){
    const label = typeof item==='string' ? item : (item.label||item.nome||item.modulo||'Sem nome');
    const li = document.createElement('li');
    li.textContent = label;
    li.addEventListener('click', function(){
      closeMenuOnMobile();
      const k = String(label).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if(k.includes('dashboard'))                                    openDashboard();
      else if(k.includes('lancamento'))                              openLancamentos();
      else if(k.includes('aprovac'))                                 openApprovals();
      else if(k.includes('orcamento'))                               openOrcamentos();
      else if(k.includes('relator'))                                 openRelatorios();
      else if(k.includes('administrac'))                             openAdministracao();
    });
    ul.appendChild(li);
  });
}

function renderApp(user, menu){
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  setMainIdentity(user||{});
  renderMenu(menu||[]);
  _formOptions = null; // reset cache on login
  openDashboard();
}

/* ══════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════ */

async function login(){
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  document.getElementById('username').value = username;
  if(!username||!password){ showMessage('❌ Preencha username e palavra-passe.', false); return; }
  setLoading(true); showMessage('⏳ A autenticar...', true);
  try {
    const res = await apiCall('Auth_login', [username, password]);
    setLoading(false);
    if(!res||!res.success){ showMessage('❌ '+(res&&res.message?res.message:'Credenciais inválidas.'), false); document.getElementById('password').value=''; return; }
    sessionStorage.setItem('app_token', res.token||'');
    sessionStorage.setItem('app_user',  JSON.stringify(res.user||{}));
    sessionStorage.setItem('app_menu',  JSON.stringify(res.menu||[]));
    showMessage('✅ Login efectuado!', true);
    setTimeout(()=> renderApp(res.user||{}, res.menu||[]), 500);
  } catch(err) {
    setLoading(false);
    showMessage('❌ Erro: '+(err.message||'Tente novamente.'), false);
    document.getElementById('password').value='';
  }
}

async function logout(){
  try {
    await apiCall('Auth_logout', [getToken()]);
    sessionStorage.clear(); _formOptions = null;
    document.getElementById('appView').classList.add('hidden');
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('username').value='';
    document.getElementById('password').value='';
    showMessage('', true);
  } catch(err){ alert('❌ '+(err.message||'Falha ao terminar sessão')); }
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */

function openDashboard(){
  setActiveMenu('📊 Dashboard');
  document.getElementById('contentTitle').textContent = '📊 Dashboard Financeiro';
  const agora=new Date(), anoActual=agora.getFullYear(), mesActual=agora.getMonth()+1;
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosHtml=''; for(let a=anoActual+1;a>=anoActual-3;a--) anosHtml+=`<option value="${a}"${a===anoActual?' selected':''}>${a}</option>`;
  const mesesHtml=meses.map((m,i)=>`<option value="${i+1}"${i+1===mesActual?' selected':''}>${m}</option>`).join('');

  document.getElementById('contentArea').innerHTML = `
    <div class="grid" style="margin-top:0;">
      <div class="card"><div class="card-title">📈 Receitas Aprovadas</div><div id="dashReceitas" class="card-value">0,00 MZN</div></div>
      <div class="card"><div class="card-title">📉 Despesas Aprovadas</div><div id="dashDespesas" class="card-value">0,00 MZN</div></div>
      <div class="card"><div class="card-title">💰 Saldo Aprovado</div><div id="dashSaldo" class="card-value">0,00 MZN</div></div>
      <div class="card"><div class="card-title">⏳ Pendentes</div><div id="dashPendentes" class="card-value">0</div></div>
      <div class="card"><div class="card-title">📝 Rascunhos</div><div id="dashRascunhos" class="card-value">0</div></div>
      <div class="card"><div class="card-title">❌ Rejeitados</div><div id="dashRejeitados" class="card-value">0</div></div>
    </div>
    <div class="box" style="margin-top:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px;">
        <strong>📊 Relatório por Departamento</strong>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%;">
          <select id="dash_mes" style="flex:1;min-width:110px;padding:10px 12px;">${mesesHtml}</select>
          <select id="dash_ano" style="flex:1;min-width:80px;padding:10px 12px;">${anosHtml}</select>
          <button class="info" style="width:auto;margin-top:0;padding:10px 18px;" onclick="loadDashDeptos()">Actualizar</button>
        </div>
      </div>
      <div id="dashDeptosWrap" class="muted">A carregar...</div>
    </div>`;

  serverCall('Dashboard_getSummary',[{}],function(s){
    document.getElementById('dashReceitas').textContent   = formatMoney(s?.receitas_aprovadas);
    document.getElementById('dashDespesas').textContent   = formatMoney(s?.despesas_aprovadas);
    document.getElementById('dashSaldo').textContent      = formatMoney(s?.saldo);
    document.getElementById('dashPendentes').textContent  = String(s?.pendentes??0);
    document.getElementById('dashRascunhos').textContent  = String(s?.rascunhos??0);
    document.getElementById('dashRejeitados').textContent = String(s?.rejeitados??0);
    document.getElementById('kpiSaldo').textContent = formatMoney(s?.saldo);
    document.getElementById('kpiIgreja').textContent = safeText(s?.igreja_nome||s?.id_igreja||'-');
  }, function(err){
    const w=document.getElementById('dashDeptosWrap');
    if(w) w.innerHTML=`<div class="err">❌ ${err?.message||'Erro'}</div>`;
  });
  loadDashDeptos();
}

function loadDashDeptos(){
  const wrap=document.getElementById('dashDeptosWrap'); if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  const mes=Number(document.getElementById('dash_mes')?.value||new Date().getMonth()+1);
  const ano=Number(document.getElementById('dash_ano')?.value||new Date().getFullYear());
  const nomeMeses=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  serverCall('Dashboard_resumoDeptos',[{ano,mes}],function(res){
    const linhas=Array.isArray(res?.linhas)?res.linhas:[];
    const periodo=`${nomeMeses[res?.mes]||mes} ${res?.ano||ano}`;
    if(!linhas.length){ wrap.innerHTML=`<div class="info">ℹ️ Sem lançamentos aprovados em ${periodo}.</div>`; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Departamento</th><th style="text-align:right;">Entrada</th><th style="text-align:right;">Saída</th><th style="text-align:right;">Saldo</th></tr></thead>
      <tbody>${linhas.map(l=>`<tr>
        <td>${safeText(l.nome_departamento)}</td>
        <td style="text-align:right;">${formatMoney(l.entrada)}</td>
        <td style="text-align:right;">${formatMoney(l.saida)}</td>
        <td style="text-align:right;font-weight:700;color:${Number(l.saldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(l.saldo)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="border-top:2px solid #dee2e6;font-weight:700;background:#f8f9fa;">
        <td>TOTAL</td><td style="text-align:right;">${formatMoney(res.totalEntrada)}</td>
        <td style="text-align:right;">${formatMoney(res.totalSaida)}</td>
        <td style="text-align:right;color:${Number(res.totalSaldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(res.totalSaldo)}</td>
      </tr></tfoot></table></div>`;
  }, function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

/* ══════════════════════════════════════════════════════
   LANÇAMENTOS
   Backend: Lancamento_getFormOptions, Lancamento_create,
            Lancamento_submit, Lancamento_listAll, Lancamento_listMine
            Lancamento_getRubricasPorGrupo
══════════════════════════════════════════════════════ */

function openLancamentos(){
  setActiveMenu('📝 Lançamentos');
  document.getElementById('contentTitle').textContent = '📝 Gestão de Lançamentos';
  const agora=new Date();
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosHtml=''; for(let a=agora.getFullYear()+1;a>=agora.getFullYear()-3;a--) anosHtml+=`<option value="${a}"${a===agora.getFullYear()?' selected':''}>${a}</option>`;
  const mesesHtml=meses.map((m,i)=>`<option value="${i+1}"${i+1===agora.getMonth()+1?' selected':''}>${m}</option>`).join('');

  document.getElementById('contentArea').innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>📋 Lista de Lançamentos</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormLancamento()">＋ Novo Lançamento</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <select id="lanc_mes" style="flex:1;min-width:110px;padding:9px 12px;">${mesesHtml}</select>
        <select id="lanc_ano" style="flex:1;min-width:80px;padding:9px 12px;">${anosHtml}</select>
        <select id="lanc_estado" style="flex:1;min-width:130px;padding:9px 12px;">
          <option value="">Todos os estados</option>
          <option value="RASCUNHO">📝 Rascunho</option>
          <option value="SUBMETIDO">📤 Submetido</option>
          <option value="APROVADO">✅ Aprovado</option>
          <option value="REJEITADO">❌ Rejeitado</option>
        </select>
        <button class="info" style="width:auto;margin-top:0;padding:9px 18px;" onclick="carregarLancamentos()">🔍 Filtrar</button>
      </div>
      <div id="lancTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formLancWrap"></div>`;
  carregarLancamentos();
}

function carregarLancamentos(){
  const wrap=document.getElementById('lancTableWrap'); if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  const estado=document.getElementById('lanc_estado')?.value||'';
  const mes=Number(document.getElementById('lanc_mes')?.value||0);
  const ano=Number(document.getElementById('lanc_ano')?.value||0);
  serverCall('Lancamento_listAll',[{estado, mes:mes||undefined, ano:ano||undefined}],function(res){
    const rows=Array.isArray(res)?res:[];
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem lançamentos para este filtro.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Grupo / Rubrica</th><th>Departamento</th>
      <th style="text-align:right;">Valor</th><th>Tipo</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(l=>`<tr>
        <td style="white-space:nowrap;">${safeText(l.data_movimento||l.data_lancamento)}</td>
        <td>${safeText(l.descricao)}</td>
        <td>${safeText(l.nome_grupo||l.id_grupo||'-')} / ${safeText(l.nome_rubrica||l.id_rubrica||'-')}</td>
        <td>${safeText(l.nome_departamento||l.id_departamento||'-')}</td>
        <td style="text-align:right;font-weight:600;">${formatMoney(l.valor)}</td>
        <td>${l.tipo_movimento==='ENTRADA'?'📈 Entrada':'📉 Saída'}</td>
        <td>${statusBadge(l.estado)}</td>
        <td class="row-actions">${(l.estado==='RASCUNHO')?`
          <button class="success" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="submeterLancamento('${l.id_lancamento}')">📤 Submeter</button>` : ''}
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  }, function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

function abrirFormLancamento(){
  const wrap=document.getElementById('formLancWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>＋ Novo Lançamento</h3>
      <div class="section-grid">
        <div>
          <label>Tipo de Movimento *</label>
          <select id="fl_tipo" onchange="actualizarRubricas()">
            <option value="ENTRADA">📈 Entrada</option>
            <option value="SAIDA">📉 Saída</option>
          </select>
          <label>Data *</label>
          <input type="date" id="fl_data" value="${new Date().toISOString().split('T')[0]}">
          <label>Valor (MZN) *</label>
          <input type="number" id="fl_valor" step="0.01" min="0.01" placeholder="0.00">
          <label>Igreja</label>
          <select id="fl_igreja"><option value="">A carregar...</option></select>
          <label>Departamento *</label>
          <select id="fl_depto"><option value="">A carregar...</option></select>
        </div>
        <div>
          <label>Grupo *</label>
          <select id="fl_grupo" onchange="actualizarRubricas()"><option value="">A carregar...</option></select>
          <label>Rubrica *</label>
          <select id="fl_rubrica"><option value="">Seleccione o grupo primeiro</option></select>
          <label>Conta *</label>
          <select id="fl_conta"><option value="">A carregar...</option></select>
          <label>Descrição *</label>
          <textarea id="fl_descricao" rows="3" placeholder="Descreva o movimento..."></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormLanc()">✖ Cancelar</button>
        <button class="info" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarLancamento('RASCUNHO')">💾 Guardar Rascunho</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarLancamento('SUBMETER')">📤 Submeter para Aprovação</button>
      </div>
      <div id="msgLanc" class="msg"></div>
    </div>`;

  getFormOptions(function(opts){
    if(!opts){ showMessage('❌ Erro ao carregar opções do formulário.', false, 'msgLanc'); return; }

    // Igrejas
    const selIgreja=document.getElementById('fl_igreja');
    if(selIgreja){
      const igrejas=Array.isArray(opts.igrejas)?opts.igrejas:[];
      selIgreja.innerHTML='<option value="">Todas / N/A</option>'+
        igrejas.map(i=>`<option value="${i.id_igreja}">${safeText(i.nome_igreja)}</option>`).join('');
      if(opts.contexto?.id_igreja) selIgreja.value=opts.contexto.id_igreja;
    }

    // Departamentos
    const selDepto=document.getElementById('fl_depto');
    if(selDepto){
      const deptos=Array.isArray(opts.departamentos)?opts.departamentos:[];
      selDepto.innerHTML='<option value="">Seleccione departamento</option>'+
        deptos.map(d=>`<option value="${d.id_departamento}">${safeText(d.nome_departamento)}</option>`).join('');
      if(opts.contexto?.id_departamento) selDepto.value=opts.contexto.id_departamento;
    }

    // Grupos
    const selGrupo=document.getElementById('fl_grupo');
    if(selGrupo){
      const grupos=Array.isArray(opts.grupos)?opts.grupos:[];
      selGrupo.innerHTML='<option value="">Seleccione grupo</option>'+
        grupos.map(g=>`<option value="${g.id_grupo}">${safeText(g.nome_grupo)}</option>`).join('');
    }

    // Contas
    const selConta=document.getElementById('fl_conta');
    if(selConta){
      const contas=Array.isArray(opts.contas)?opts.contas:[];
      selConta.innerHTML='<option value="">Seleccione conta</option>'+
        contas.map(c=>`<option value="${c.id_conta}">${safeText(c.nome_conta)}</option>`).join('');
    }
  });

  wrap.scrollIntoView({behavior:'smooth', block:'start'});
}

function actualizarRubricas(){
  const idGrupo=document.getElementById('fl_grupo')?.value;
  const tipo=document.getElementById('fl_tipo')?.value;
  const sel=document.getElementById('fl_rubrica');
  if(!sel) return;
  if(!idGrupo){ sel.innerHTML='<option value="">Seleccione o grupo primeiro</option>'; return; }
  sel.innerHTML='<option value="">A carregar rubricas...</option>';
  serverCall('Lancamento_getRubricasPorGrupo',[idGrupo],function(rubricas){
    const arr=Array.isArray(rubricas)?rubricas:[];
    // filtrar por tipo se houver tipo_movimento na rubrica
    const filtradas = arr.filter(r => !r.tipo_movimento || !tipo || r.tipo_movimento===tipo);
    if(!filtradas.length){ sel.innerHTML='<option value="">Sem rubricas para este grupo</option>'; return; }
    sel.innerHTML='<option value="">Seleccione rubrica</option>'+
      filtradas.map(r=>`<option value="${r.id_rubrica}">${safeText(r.nome_rubrica)}</option>`).join('');
  }, function(){ sel.innerHTML='<option value="">Erro ao carregar rubricas</option>'; });
}

function fecharFormLanc(){ const w=document.getElementById('formLancWrap'); if(w) w.innerHTML=''; }

function guardarLancamento(modo){
  const tipo     = document.getElementById('fl_tipo')?.value;
  const data     = document.getElementById('fl_data')?.value;
  const valor    = document.getElementById('fl_valor')?.value;
  const depto    = document.getElementById('fl_depto')?.value;
  const grupo    = document.getElementById('fl_grupo')?.value;
  const rubrica  = document.getElementById('fl_rubrica')?.value;
  const conta    = document.getElementById('fl_conta')?.value;
  const descricao= document.getElementById('fl_descricao')?.value?.trim();
  const igreja   = document.getElementById('fl_igreja')?.value;

  if(!tipo||!data||!valor||!depto||!grupo||!rubrica||!conta||!descricao){
    showMessage('❌ Preencha todos os campos obrigatórios (*).', false, 'msgLanc'); return;
  }
  if(Number(valor)<=0){ showMessage('❌ O valor deve ser maior que zero.', false, 'msgLanc'); return; }

  const payload = { tipo_movimento:tipo, data_movimento:data, valor:Number(valor),
    id_departamento:depto, id_grupo:grupo, id_rubrica:rubrica, id_conta:conta,
    descricao, id_igreja:igreja||'' };

  showMessage('⏳ A guardar...', true, 'msgLanc');

  if(modo==='SUBMETER'){
    // Criar e submeter de seguida
    serverCall('Lancamento_create',[payload],function(res){
      const idLanc = res?.id_lancamento || res?.id;
      if(!idLanc){ showMessage('✅ Lançamento criado e submetido!', true, 'msgLanc'); setTimeout(()=>{ fecharFormLanc(); carregarLancamentos(); }, 1200); return; }
      serverCall('Lancamento_submit',[{id_lancamento:idLanc}],function(){
        showMessage('✅ Lançamento submetido para aprovação!', true, 'msgLanc');
        setTimeout(()=>{ fecharFormLanc(); carregarLancamentos(); }, 1200);
      }, function(err2){ showMessage('⚠️ Criado mas erro ao submeter: '+err2?.message, false, 'msgLanc'); });
    }, function(err){ showMessage('❌ '+err?.message, false, 'msgLanc'); });
  } else {
    serverCall('Lancamento_create',[payload],function(){
      showMessage('✅ Rascunho guardado!', true, 'msgLanc');
      setTimeout(()=>{ fecharFormLanc(); carregarLancamentos(); }, 1200);
    }, function(err){ showMessage('❌ '+err?.message, false, 'msgLanc'); });
  }
}

function submeterLancamento(id){
  if(!confirm('Submeter este lançamento para aprovação?')) return;
  serverCall('Lancamento_submit',[{id_lancamento:id}],function(){
    carregarLancamentos();
  }, function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ══════════════════════════════════════════════════════
   APROVAÇÕES
   Backend: Approval_listPending, Approval_decide(id, decisao, comentario)
══════════════════════════════════════════════════════ */

function openApprovals(){
  setActiveMenu('✓ Aprovações');
  document.getElementById('contentTitle').textContent = '✓ Aprovações Pendentes';
  document.getElementById('contentArea').innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>⏳ Lançamentos a Aprovar</strong>
        <button class="info" style="width:auto;margin-top:0;padding:9px 18px;" onclick="carregarAprovacoes()">🔄 Actualizar</button>
      </div>
      <div id="aprovTableWrap" class="muted">A carregar...</div>
    </div>`;
  carregarAprovacoes();
}

function carregarAprovacoes(){
  const wrap=document.getElementById('aprovTableWrap'); if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  serverCall('Approval_listPending',[],function(res){
    const rows=Array.isArray(res)?res:[];
    if(!rows.length){ wrap.innerHTML='<div class="info">✅ Sem lançamentos pendentes de aprovação.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Rubrica</th><th>Departamento</th><th>Criado por</th>
      <th style="text-align:right;">Valor</th><th>Tipo</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(l=>`<tr>
        <td style="white-space:nowrap;">${safeText(l.data_movimento||l.data_lancamento)}</td>
        <td>${safeText(l.descricao)}</td>
        <td>${safeText(l.nome_rubrica||l.id_rubrica||'-')}</td>
        <td>${safeText(l.nome_departamento||l.id_departamento||'-')}</td>
        <td>${safeText(l.criado_por_nome||l.criado_por||'-')}</td>
        <td style="text-align:right;font-weight:600;">${formatMoney(l.valor)}</td>
        <td>${l.tipo_movimento==='ENTRADA'?'📈 Entrada':'📉 Saída'}</td>
        <td class="row-actions">
          <button class="success" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="decidirAprovacao('${l.id_aprovacao}','APROVADO')">✅ Aprovar</button>
          <button class="danger"  style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="decidirAprovacao('${l.id_aprovacao}','REJEITADO')">❌ Rejeitar</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  }, function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

function decidirAprovacao(idAprovacao, decisao){
  let comentario = '';
  if(decisao==='REJEITADO'){
    comentario = prompt('Motivo da rejeição (obrigatório):');
    if(comentario===null || !comentario.trim()){ alert('É obrigatório indicar o motivo da rejeição.'); return; }
  } else {
    if(!confirm('Confirmar aprovação deste lançamento?')) return;
  }
  serverCall('Approval_decide',[idAprovacao, decisao, comentario||''],function(){
    carregarAprovacoes();
    // actualizar saldo no KPI
    serverCall('Dashboard_getSummary',[{}],function(s){
      const el=document.getElementById('kpiSaldo');
      if(el) el.textContent=formatMoney(s?.saldo);
    },()=>{});
  }, function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ══════════════════════════════════════════════════════
   ORÇAMENTOS
   Backend: Orcamento_listResumo, Orcamento_resumoMensal
══════════════════════════════════════════════════════ */

function openOrcamentos(){
  setActiveMenu('📈 Orçamentos');
  document.getElementById('contentTitle').textContent = '📈 Orçamentos';
  const agora=new Date(), ano=agora.getFullYear(), mes=agora.getMonth()+1;
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosHtml=''; for(let a=ano+1;a>=ano-3;a--) anosHtml+=`<option value="${a}"${a===ano?' selected':''}>${a}</option>`;
  const mesesHtml=meses.map((m,i)=>`<option value="${i+1}"${i+1===mes?' selected':''}>${m}</option>`).join('');

  document.getElementById('contentArea').innerHTML=`
    <div class="section-grid" style="margin-top:0;">
      <div class="box" style="margin-top:0;">
        <h3>📊 Resumo Mensal por Departamento</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <select id="orc_mes" style="flex:1;min-width:110px;padding:9px 12px;">${mesesHtml}</select>
          <select id="orc_ano" style="flex:1;min-width:80px;padding:9px 12px;">${anosHtml}</select>
          <button class="info" style="width:auto;margin-top:0;padding:9px 18px;" onclick="carregarOrcamentoMensal()">🔍 Ver</button>
        </div>
        <div id="orcMensalWrap" class="muted">Clique em "Ver" para carregar.</div>
      </div>
      <div class="box" style="margin-top:0;">
        <h3>📋 Resumo Geral de Orçamentos</h3>
        <div id="orcResumoWrap" class="muted">A carregar...</div>
      </div>
    </div>`;

  // Carregar resumo geral
  serverCall('Orcamento_listResumo',[],function(res){
    const wrap=document.getElementById('orcResumoWrap'); if(!wrap) return;
    const itens=Array.isArray(res?.itens)?res.itens:[];
    wrap.innerHTML=`
      <div style="margin-bottom:12px;">
        <strong>Total Orçado: </strong>${formatMoney(res?.totalOrcado)}<br>
        <strong>Quantidade: </strong>${safeText(res?.quantidade)} orçamentos
      </div>
      ${itens.length?`<div style="overflow-x:auto;"><table>
        <thead><tr><th>Rubrica</th><th>Ano</th><th style="text-align:right;">Valor Orçado</th></tr></thead>
        <tbody>${itens.slice(0,20).map(o=>`<tr>
          <td>${safeText(o.nome_rubrica||o.id_rubrica)}</td>
          <td>${safeText(o.ano)}</td>
          <td style="text-align:right;">${formatMoney(o.valor_orcado)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<div class="info">ℹ️ Sem orçamentos registados.</div>'}`;
  }, function(err){ const w=document.getElementById('orcResumoWrap'); if(w) w.innerHTML=`<div class="err">❌ ${err?.message}</div>`; });
}

function carregarOrcamentoMensal(){
  const wrap=document.getElementById('orcMensalWrap'); if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  const mes=Number(document.getElementById('orc_mes')?.value||new Date().getMonth()+1);
  const ano=Number(document.getElementById('orc_ano')?.value||new Date().getFullYear());
  serverCall('Orcamento_resumoMensal',[{mes,ano}],function(res){
    const linhas=Array.isArray(res?.linhas)?res.linhas:[];
    if(!linhas.length){ wrap.innerHTML='<div class="info">ℹ️ Sem dados para este período.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Departamento</th><th style="text-align:right;">Entradas</th><th style="text-align:right;">Saídas</th><th style="text-align:right;">Saldo</th></tr></thead>
      <tbody>${linhas.map(l=>`<tr>
        <td>${safeText(l.nome_departamento||l.id_departamento)}</td>
        <td style="text-align:right;">${formatMoney(l.entrada)}</td>
        <td style="text-align:right;">${formatMoney(l.saida)}</td>
        <td style="text-align:right;font-weight:700;color:${Number(l.saldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(l.saldo)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="border-top:2px solid #dee2e6;font-weight:700;background:#f8f9fa;">
        <td>TOTAL</td><td style="text-align:right;">${formatMoney(res.totalEntrada)}</td>
        <td style="text-align:right;">${formatMoney(res.totalSaida)}</td>
        <td style="text-align:right;color:${Number(res.totalSaldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(res.totalSaldo)}</td>
      </tr></tfoot></table></div>`;
  }, function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

/* ══════════════════════════════════════════════════════
   RELATÓRIOS
   Backend: Relatorio_getResumo
══════════════════════════════════════════════════════ */

function openRelatorios(){
  setActiveMenu('📄 Relatórios');
  document.getElementById('contentTitle').textContent = '📄 Relatórios Financeiros';
  document.getElementById('contentArea').innerHTML=`
    <div class="box" style="margin-top:0;">
      <h3>📄 Relatório Geral</h3>
      <button class="info" style="width:auto;margin-top:0;padding:10px 20px;" onclick="carregarRelatorio()">📥 Gerar Relatório</button>
      <div id="relWrap" style="margin-top:16px;"></div>
    </div>`;
}

function carregarRelatorio(){
  const wrap=document.getElementById('relWrap'); if(!wrap) return;
  wrap.innerHTML='⏳ A gerar relatório...';
  serverCall('Relatorio_getResumo',[],function(res){
    if(!res){ wrap.innerHTML='<div class="info">ℹ️ Sem dados disponíveis.</div>'; return; }
    const linhas=Array.isArray(res?.linhas||res)?(res?.linhas||res):[];
    if(!linhas.length){ wrap.innerHTML='<div class="info">ℹ️ Sem dados para o período.</div>'; return; }
    const totalEnt=linhas.reduce((s,l)=>s+Number(l.entrada||0),0);
    const totalSai=linhas.reduce((s,l)=>s+Number(l.saida||0),0);
    wrap.innerHTML=`
      <div class="grid" style="margin:0 0 16px;">
        <div class="card" style="cursor:default;"><div class="card-title">Total Entradas</div><div class="card-value" style="color:#28a745;font-size:20px;">${formatMoney(totalEnt)}</div></div>
        <div class="card" style="cursor:default;"><div class="card-title">Total Saídas</div><div class="card-value" style="color:#dc3545;font-size:20px;">${formatMoney(totalSai)}</div></div>
        <div class="card" style="cursor:default;"><div class="card-title">Saldo</div><div class="card-value" style="color:${totalEnt-totalSai>=0?'#28a745':'#dc3545'};font-size:20px;">${formatMoney(totalEnt-totalSai)}</div></div>
      </div>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>Descrição / Período</th><th style="text-align:right;">Entrada</th><th style="text-align:right;">Saída</th><th style="text-align:right;">Saldo</th></tr></thead>
        <tbody>${linhas.map(l=>`<tr>
          <td>${safeText(l.descricao||l.periodo||l.nome_departamento||'-')}</td>
          <td style="text-align:right;color:#28a745;">${formatMoney(l.entrada)}</td>
          <td style="text-align:right;color:#dc3545;">${formatMoney(l.saida)}</td>
          <td style="text-align:right;font-weight:700;color:${Number(l.saldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(l.saldo)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }, function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

/* ══════════════════════════════════════════════════════
   ADMINISTRAÇÃO
   Backend: User_list, User_create, User_toggleActive, User_resetPassword
            User_getFormOptions
            Igreja_list, Igreja_create, Igreja_toggleActive
            Departamento_list, Departamento_create, Departamento_toggleActive
══════════════════════════════════════════════════════ */

function openAdministracao(){
  setActiveMenu('⚙️ Administração');
  document.getElementById('contentTitle').textContent = '⚙️ Administração do Sistema';
  document.getElementById('contentArea').innerHTML=`
    <div class="section-grid" style="margin-top:0;">
      <div class="box" style="margin-top:0;cursor:pointer;border:2px solid transparent;" onclick="adminTab('utilizadores')" id="tab_utilizadores">
        <h3>👥 Utilizadores</h3><p class="muted">Gerir contas e permissões.</p>
      </div>
      <div class="box" style="margin-top:0;cursor:pointer;border:2px solid transparent;" onclick="adminTab('departamentos')" id="tab_departamentos">
        <h3>🏢 Departamentos</h3><p class="muted">Gerir departamentos.</p>
      </div>
      <div class="box" style="margin-top:0;cursor:pointer;border:2px solid transparent;" onclick="adminTab('igrejas')" id="tab_igrejas">
        <h3>⛪ Igrejas</h3><p class="muted">Gerir igrejas e entidades.</p>
      </div>
    </div>
    <div id="adminContentWrap" style="margin-top:4px;"></div>`;
}

function adminTab(tab){
  ['utilizadores','departamentos','igrejas'].forEach(t=>{
    const el=document.getElementById('tab_'+t);
    if(el) el.style.borderColor = t===tab?'#123b7a':'transparent';
  });
  if(tab==='utilizadores')  adminUtilizadores();
  if(tab==='departamentos') adminDepartamentos();
  if(tab==='igrejas')       adminIgrejas();
}

/* ── Utilizadores ── */
function adminUtilizadores(){
  const wrap=document.getElementById('adminContentWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>👥 Utilizadores</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormUtilizador()">＋ Novo</button>
      </div>
      <div id="utilTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formUtilWrap"></div>`;
  serverCall('User_list',[],function(res){
    const rows=Array.isArray(res)?res:[];
    const wrap=document.getElementById('utilTableWrap'); if(!wrap) return;
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem utilizadores.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;"><table>
      <thead><tr><th>Nome</th><th>Username</th><th>Perfil</th><th>Igreja</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(u=>`<tr>
        <td>${safeText(u.nome_completo)}</td>
        <td>${safeText(u.username)}</td>
        <td><span class="badge badge-info">${safeText(u.id_perfil)}</span></td>
        <td>${safeText(u.nome_igreja||u.id_igreja||'-')}</td>
        <td>${u.activo!==false&&String(u.activo||'').toUpperCase()!=='FALSE'?'<span class="badge badge-success">✅ Activo</span>':'<span class="badge badge-danger">🚫 Inactivo</span>'}</td>
        <td class="row-actions">
          <button class="${u.activo!==false&&String(u.activo||'').toUpperCase()!=='FALSE'?'danger':'success'}" style="font-size:12px;padding:6px 10px;min-height:32px;"
            onclick="toggleUtilizador('${u.id_utilizador}')">${u.activo!==false&&String(u.activo||'').toUpperCase()!=='FALSE'?'🚫 Desactivar':'✅ Activar'}</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  }, function(err){ const w=document.getElementById('utilTableWrap'); if(w) w.innerHTML=`<div class="err">❌ ${err?.message}</div>`; });
}

function abrirFormUtilizador(){
  const wrap=document.getElementById('formUtilWrap');
  // Buscar opções (perfis, igrejas, departamentos)
  serverCall('User_getFormOptions',[],function(opts){
    const perfis=Array.isArray(opts?.perfis)?opts.perfis:['ADMIN_GERAL','ADMIN_DISTRITAL','TESOUREIRO_DISTRITAL','TESOUREIRO_LOCAL','APROVADOR','VISUALIZADOR'];
    const igrejas=Array.isArray(opts?.igrejas)?opts.igrejas:[];
    const deptos=Array.isArray(opts?.departamentos)?opts.departamentos:[];
    renderFormUtilizador(wrap, perfis, igrejas, deptos);
  }, function(){
    // fallback com perfis padrão
    renderFormUtilizador(wrap,
      ['ADMIN_GERAL','ADMIN_DISTRITAL','TESOUREIRO_DISTRITAL','TESOUREIRO_LOCAL','APROVADOR','VISUALIZADOR'],
      [], []);
  });
}

function renderFormUtilizador(wrap, perfis, igrejas, deptos){
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>＋ Novo Utilizador</h3>
      <div class="section-grid">
        <div>
          <label>Nome Completo *</label><input type="text" id="fu_nome" placeholder="Nome completo">
          <label>Username *</label><input type="text" id="fu_username" placeholder="username">
          <label>Palavra-passe *</label><input type="password" id="fu_pass" placeholder="••••••••">
          <label>E-mail</label><input type="email" id="fu_email" placeholder="email@exemplo.com">
        </div>
        <div>
          <label>Perfil *</label>
          <select id="fu_perfil">${perfis.map(p=>`<option value="${p}">${p}</option>`).join('')}</select>
          <label>Igreja</label>
          <select id="fu_igreja"><option value="">Sem igreja específica</option>${igrejas.map(i=>`<option value="${i.id_igreja}">${safeText(i.nome_igreja)}</option>`).join('')}</select>
          <label>Departamento</label>
          <select id="fu_depto"><option value="">Sem departamento específico</option>${deptos.map(d=>`<option value="${d.id_departamento}">${safeText(d.nome_departamento)}</option>`).join('')}</select>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormUtil()">✖ Cancelar</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarUtilizador()">💾 Criar</button>
      </div>
      <div id="msgUtil" class="msg"></div>
    </div>`;
  wrap.scrollIntoView({behavior:'smooth', block:'start'});
}

function fecharFormUtil(){ const w=document.getElementById('formUtilWrap'); if(w) w.innerHTML=''; }

function guardarUtilizador(){
  const nome   =document.getElementById('fu_nome')?.value?.trim();
  const uname  =document.getElementById('fu_username')?.value?.trim();
  const pass   =document.getElementById('fu_pass')?.value;
  const email  =document.getElementById('fu_email')?.value?.trim();
  const perfil =document.getElementById('fu_perfil')?.value;
  const igreja =document.getElementById('fu_igreja')?.value;
  const depto  =document.getElementById('fu_depto')?.value;
  if(!nome||!uname||!pass||!perfil){ showMessage('❌ Preencha os campos obrigatórios.', false, 'msgUtil'); return; }
  showMessage('⏳ A criar...', true, 'msgUtil');
  serverCall('User_create',[{nome_completo:nome, username:uname, password:pass, email, id_perfil:perfil, id_igreja:igreja||'', id_departamento:depto||''}],function(){
    showMessage('✅ Utilizador criado!', true, 'msgUtil');
    setTimeout(()=>{ fecharFormUtil(); adminUtilizadores(); }, 1200);
  }, function(err){ showMessage('❌ '+err?.message, false, 'msgUtil'); });
}

function toggleUtilizador(id){
  if(!confirm('Alterar estado deste utilizador?')) return;
  serverCall('User_toggleActive',[{id_utilizador:id}],function(){ adminUtilizadores(); },
    function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ── Departamentos ── */
function adminDepartamentos(){
  const wrap=document.getElementById('adminContentWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>🏢 Departamentos</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormDepto()">＋ Novo</button>
      </div>
      <div id="deptoTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formDeptoWrap"></div>`;
  serverCall('Departamento_list',[],function(res){
    const rows=Array.isArray(res)?res:[];
    const wrap=document.getElementById('deptoTableWrap'); if(!wrap) return;
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem departamentos.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;"><table>
      <thead><tr><th>Nome</th><th>Código</th><th>Tipo</th><th>Responsável</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(d=>`<tr>
        <td><strong>${safeText(d.nome_departamento)}</strong></td>
        <td>${safeText(d.codigo_departamento||d.id_departamento)}</td>
        <td>${safeText(d.tipo||'-')}</td>
        <td>${safeText(d.responsavel_nome||'-')}</td>
        <td>${String(d.estado||'').toUpperCase()!=='INACTIVO'?'<span class="badge badge-success">✅ Activo</span>':'<span class="badge badge-danger">🚫 Inactivo</span>'}</td>
        <td class="row-actions">
          <button class="${String(d.estado||'').toUpperCase()!=='INACTIVO'?'danger':'success'}" style="font-size:12px;padding:6px 10px;min-height:32px;"
            onclick="toggleDepto('${d.id_departamento}')">${String(d.estado||'').toUpperCase()!=='INACTIVO'?'🚫 Desactivar':'✅ Activar'}</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  }, function(err){ const w=document.getElementById('deptoTableWrap'); if(w) w.innerHTML=`<div class="err">❌ ${err?.message}</div>`; });
}

function abrirFormDepto(){
  const wrap=document.getElementById('formDeptoWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>＋ Novo Departamento</h3>
      <div class="section-grid">
        <div>
          <label>Nome *</label><input type="text" id="fd_nome" placeholder="Nome do departamento">
          <label>Código</label><input type="text" id="fd_codigo" placeholder="Ex: DEP-001">
        </div>
        <div>
          <label>Tipo</label><input type="text" id="fd_tipo" placeholder="Ex: Pastoral, Financeiro...">
          <label>Responsável</label><input type="text" id="fd_resp" placeholder="Nome do responsável">
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormDepto()">✖ Cancelar</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarDepto()">💾 Criar</button>
      </div>
      <div id="msgDepto" class="msg"></div>
    </div>`;
  wrap.scrollIntoView({behavior:'smooth', block:'start'});
}

function fecharFormDepto(){ const w=document.getElementById('formDeptoWrap'); if(w) w.innerHTML=''; }

function guardarDepto(){
  const nome  =document.getElementById('fd_nome')?.value?.trim();
  const codigo=document.getElementById('fd_codigo')?.value?.trim();
  const tipo  =document.getElementById('fd_tipo')?.value?.trim();
  const resp  =document.getElementById('fd_resp')?.value?.trim();
  if(!nome){ showMessage('❌ O nome é obrigatório.', false, 'msgDepto'); return; }
  showMessage('⏳ A criar...', true, 'msgDepto');
  serverCall('Departamento_create',[{nome_departamento:nome, codigo_departamento:codigo, tipo, responsavel_nome:resp}],function(){
    showMessage('✅ Departamento criado!', true, 'msgDepto');
    setTimeout(()=>{ fecharFormDepto(); adminDepartamentos(); }, 1200);
  }, function(err){ showMessage('❌ '+err?.message, false, 'msgDepto'); });
}

function toggleDepto(id){
  if(!confirm('Alterar estado deste departamento?')) return;
  serverCall('Departamento_toggleActive',[{id_departamento:id}],function(){ adminDepartamentos(); },
    function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ── Igrejas ── */
function adminIgrejas(){
  const wrap=document.getElementById('adminContentWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>⛪ Igrejas</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormIgreja()">＋ Nova</button>
      </div>
      <div id="igrejaTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formIgrejaWrap"></div>`;
  serverCall('Igreja_list',[],function(res){
    const rows=Array.isArray(res)?res:[];
    const wrap=document.getElementById('igrejaTableWrap'); if(!wrap) return;
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem igrejas.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;"><table>
      <thead><tr><th>Nome</th><th>Código</th><th>Zona</th><th>Tesoureiro</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(g=>`<tr>
        <td><strong>${safeText(g.nome_igreja)}</strong></td>
        <td>${safeText(g.codigo_igreja||g.id_igreja)}</td>
        <td>${safeText(g.zona||'-')}</td>
        <td>${safeText(g.tesoureiro_nome||'-')}</td>
        <td>${String(g.estado||'').toUpperCase()!=='INACTIVA'?'<span class="badge badge-success">✅ Activa</span>':'<span class="badge badge-danger">🚫 Inactiva</span>'}</td>
        <td class="row-actions">
          <button class="${String(g.estado||'').toUpperCase()!=='INACTIVA'?'danger':'success'}" style="font-size:12px;padding:6px 10px;min-height:32px;"
            onclick="toggleIgreja('${g.id_igreja}')">${String(g.estado||'').toUpperCase()!=='INACTIVA'?'🚫 Desactivar':'✅ Activar'}</button>
        </td>
      </tr>`).join('')}</tbody></table></div>`;
  }, function(err){ const w=document.getElementById('igrejaTableWrap'); if(w) w.innerHTML=`<div class="err">❌ ${err?.message}</div>`; });
}

function abrirFormIgreja(){
  const wrap=document.getElementById('formIgrejaWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>＋ Nova Igreja</h3>
      <div class="section-grid">
        <div>
          <label>Nome *</label><input type="text" id="fi_nome" placeholder="Nome da igreja">
          <label>Código</label><input type="text" id="fi_codigo" placeholder="Ex: IGR-001">
          <label>Zona</label><input type="text" id="fi_zona" placeholder="Ex: Norte, Sul...">
        </div>
        <div>
          <label>Circuito</label><input type="text" id="fi_circuito" placeholder="Circuito">
          <label>Tesoureiro</label><input type="text" id="fi_tes" placeholder="Nome do tesoureiro">
          <label>Contacto</label><input type="text" id="fi_cont" placeholder="Telefone">
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormIgreja()">✖ Cancelar</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarIgreja()">💾 Criar</button>
      </div>
      <div id="msgIgreja" class="msg"></div>
    </div>`;
  wrap.scrollIntoView({behavior:'smooth', block:'start'});
}

function fecharFormIgreja(){ const w=document.getElementById('formIgrejaWrap'); if(w) w.innerHTML=''; }

function guardarIgreja(){
  const nome    =document.getElementById('fi_nome')?.value?.trim();
  const codigo  =document.getElementById('fi_codigo')?.value?.trim();
  const zona    =document.getElementById('fi_zona')?.value?.trim();
  const circuito=document.getElementById('fi_circuito')?.value?.trim();
  const tes     =document.getElementById('fi_tes')?.value?.trim();
  const cont    =document.getElementById('fi_cont')?.value?.trim();
  if(!nome){ showMessage('❌ O nome é obrigatório.', false, 'msgIgreja'); return; }
  showMessage('⏳ A criar...', true, 'msgIgreja');
  serverCall('Igreja_create',[{nome_igreja:nome, codigo_igreja:codigo, zona, circuito, tesoureiro_nome:tes, tesoureiro_contacto:cont}],function(){
    showMessage('✅ Igreja criada!', true, 'msgIgreja');
    setTimeout(()=>{ fecharFormIgreja(); adminIgrejas(); }, 1200);
  }, function(err){ showMessage('❌ '+err?.message, false, 'msgIgreja'); });
}

function toggleIgreja(id){
  if(!confirm('Alterar estado desta igreja?')) return;
  serverCall('Igreja_toggleActive',[{id_igreja:id}],function(){ adminIgrejas(); },
    function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */

window.addEventListener('load', function(){
  const rawUser=sessionStorage.getItem('app_user');
  const rawMenu=sessionStorage.getItem('app_menu');
  if(rawUser){ renderApp(JSON.parse(rawUser), rawMenu?JSON.parse(rawMenu):[]); }
});

document.addEventListener('DOMContentLoaded', function(){
  const pwd=document.getElementById('password');
  const usr=document.getElementById('username');
  if(pwd) pwd.addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
  if(usr) usr.addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
});
