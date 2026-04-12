/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */

function showMessage(text, ok, elementId = 'msg'){
  const el = document.getElementById(elementId);
  if(!el) return;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text || '';
  if(ok){
    setTimeout(() => { if(el.textContent === text) el.innerHTML = ''; }, 5000);
  }
}

function setLoading(state, btnId = 'btnLogin'){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  btn.disabled = state;
  if (btnId === 'btnLogin') {
    btn.textContent = state ? '⏳ A processar...' : 'Iniciar sessão';
  }
}

function formatMoney(value){
  const n = Number(value || 0);
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MZN';
}

function safeText(v){
  return v == null || v === '' ? '-' : String(v);
}

function getToken(){
  return sessionStorage.getItem('app_token') || '';
}

function getUser(){
  try { return JSON.parse(sessionStorage.getItem('app_user') || '{}'); } catch(e){ return {}; }
}

function statusBadge(s){
  const map = {
    'APROVADO':  ['badge-success','✅ Aprovado'],
    'PENDENTE':  ['badge-warning','⏳ Pendente'],
    'RASCUNHO':  ['badge-info','📝 Rascunho'],
    'REJEITADO': ['badge-danger','❌ Rejeitado'],
  };
  const key = String(s||'').toUpperCase();
  const [cls, label] = map[key] || ['badge-info', safeText(s)];
  return `<span class="badge ${cls}">${label}</span>`;
}

/* ══════════════════════════════════════════════════════
   API LAYER
══════════════════════════════════════════════════════ */

async function apiCall(action, args = []) {
  const response = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, args })
  });
  if (!response.ok) throw new Error('Falha de comunicação com o servidor.');
  return await response.json();
}

async function serverCall(fnName, args, onSuccess, onFailure){
  try {
    const token = getToken();
    const res = await apiCall('Server_call', [token, fnName, args || []]);
    if (onSuccess) onSuccess(res);
  } catch (err) {
    if (onFailure) onFailure(err);
  }
}

/* ══════════════════════════════════════════════════════
   SHELL / LAYOUT
══════════════════════════════════════════════════════ */

function setMainIdentity(user){
  document.getElementById('welcomeText').textContent =
    '👋 Sessão iniciada por ' + safeText(user.nome_completo) + '.';
  document.getElementById('kpiUser').textContent    = safeText(user.nome_completo);
  document.getElementById('kpiPerfil').textContent  = safeText(user.id_perfil);
  document.getElementById('kpiIgreja').textContent  = safeText(user.igreja_nome || user.id_igreja || '-');
}

function setActiveMenu(label){
  document.querySelectorAll('#menuList li').forEach(li => {
    li.classList.toggle('active', li.textContent === label);
  });
}

function toggleMenu(){
  const btn  = document.getElementById('menuToggle');
  const list = document.getElementById('menuList');
  if (!btn || !list) return;
  const isOpen = list.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
}

function closeMenuOnMobile(){
  if (window.innerWidth <= 680) {
    const btn  = document.getElementById('menuToggle');
    const list = document.getElementById('menuList');
    if (list) list.classList.remove('open');
    if (btn)  btn.classList.remove('open');
  }
}

function renderMenu(menu){
  const ul = document.getElementById('menuList');
  ul.innerHTML = '';

  const source = Array.isArray(menu) && menu.length ? menu : [
    {label:'📊 Dashboard'},
    {label:'📝 Lançamentos'},
    {label:'✓ Aprovações'},
    {label:'📈 Orçamentos'},
    {label:'📄 Relatórios'},
    {label:'⚙️ Administração'}
  ];

  source.forEach(function(item){
    const label = typeof item === 'string' ? item : (item.label || item.nome || item.modulo || 'Sem nome');
    const li = document.createElement('li');
    li.textContent = label;

    li.addEventListener('click', function(){
      closeMenuOnMobile();
      const key = String(label||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if      (key.includes('dashboard'))                                    openDashboard();
      else if (key.includes('lancamentos')||key.includes('lancamento'))      openLancamentos();
      else if (key.includes('aprovacoes') ||key.includes('aprovacao'))       openApprovals();
      else if (key.includes('orcamentos') ||key.includes('orcamento'))       openOrcamentos();
      else if (key.includes('relatorios') ||key.includes('relatorio'))       openRelatorios();
      else if (key.includes('administracao'))                                openAdministracao();
    });
    ul.appendChild(li);
  });
}

function renderApp(user, menu){
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  setMainIdentity(user || {});
  renderMenu(menu || []);
  openDashboard();
}

/* ══════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════ */

async function login(){
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  document.getElementById('username').value = username;
  if (!username || !password) { showMessage('❌ Preencha username e palavra-passe.', false); return; }
  setLoading(true);
  showMessage('⏳ A autenticar...', true);
  try {
    const res = await apiCall('Auth_login', [username, password]);
    setLoading(false);
    if (!res || !res.success) {
      showMessage('❌ ' + (res&&res.message ? res.message : 'Credenciais inválidas.'), false);
      document.getElementById('password').value = '';
      return;
    }
    sessionStorage.setItem('app_token', res.token || '');
    sessionStorage.setItem('app_user',  JSON.stringify(res.user || {}));
    sessionStorage.setItem('app_menu',  JSON.stringify(res.menu || []));
    showMessage('✅ Login efectuado!', true);
    setTimeout(function(){ renderApp(res.user||{}, res.menu||[]); }, 500);
  } catch (err) {
    setLoading(false);
    showMessage('❌ Erro: ' + (err.message||'Tente novamente.'), false);
    document.getElementById('password').value = '';
  }
}

async function logout(){
  const token = sessionStorage.getItem('app_token') || '';
  try {
    await apiCall('Auth_logout', [token]);
    sessionStorage.clear();
    document.getElementById('appView').classList.add('hidden');
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showMessage('', true);
  } catch (err) {
    alert('❌ ' + (err.message||'Falha ao terminar sessão'));
  }
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */

function openDashboard(){
  setActiveMenu('📊 Dashboard');
  document.getElementById('contentTitle').textContent = '📊 Dashboard Financeiro';
  const agora = new Date(), anoActual = agora.getFullYear(), mesActual = agora.getMonth()+1;
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosHtml = '';
  for(let a=anoActual+1;a>=anoActual-3;a--) anosHtml+=`<option value="${a}"${a===anoActual?' selected':''}>${a}</option>`;
  const mesesHtml = meses.map((m,i)=>`<option value="${i+1}"${i+1===mesActual?' selected':''}>${m}</option>`).join('');

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
          <button class="info" style="width:auto;margin-top:0;padding:10px 18px;flex-shrink:0;" onclick="loadDashDeptos()">Actualizar</button>
        </div>
      </div>
      <div id="dashDeptosWrap" class="muted">A carregar...</div>
    </div>`;

  serverCall('Dashboard_getSummary',[{}],function(stats){
    document.getElementById('dashReceitas').textContent   = formatMoney(stats?.receitas_aprovadas);
    document.getElementById('dashDespesas').textContent   = formatMoney(stats?.despesas_aprovadas);
    document.getElementById('dashSaldo').textContent      = formatMoney(stats?.saldo);
    document.getElementById('dashPendentes').textContent  = String(stats?.pendentes??0);
    document.getElementById('dashRascunhos').textContent  = String(stats?.rascunhos??0);
    document.getElementById('dashRejeitados').textContent = String(stats?.rejeitados??0);
    document.getElementById('kpiSaldo').textContent       = formatMoney(stats?.saldo);
    document.getElementById('kpiIgreja').textContent      = safeText(stats?.igreja_nome||stats?.id_igreja||'-');
  },function(err){
    const w=document.getElementById('dashDeptosWrap');
    if(w) w.innerHTML=`<div class="err">❌ Erro: ${err.message||'Falha'}</div>`;
  });
  loadDashDeptos();
}

function loadDashDeptos(){
  const wrap = document.getElementById('dashDeptosWrap');
  if(!wrap) return;
  wrap.innerHTML = '⏳ A carregar...';
  const mes = Number(document.getElementById('dash_mes')?.value||new Date().getMonth()+1);
  const ano = Number(document.getElementById('dash_ano')?.value||new Date().getFullYear());
  const meses=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  serverCall('Dashboard_resumoDeptos',[{ano,mes}],function(res){
    const linhas = Array.isArray(res?.linhas) ? res.linhas : [];
    const periodo = `${meses[res?.mes]||mes} ${res?.ano||ano}`;
    const igreja = res?.igreja_nome||res?.id_igreja||'';
    if(!linhas.length){
      wrap.innerHTML=`<div class="info">ℹ️ Sem lançamentos aprovados${igreja?' em '+igreja:''} em ${periodo}.</div>`;
      return;
    }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Departamento</th><th style="text-align:right;">Entrada</th><th style="text-align:right;">Saída</th><th style="text-align:right;">Saldo</th></tr></thead>
      <tbody>${linhas.map(l=>`<tr>
        <td>${safeText(l.nome_departamento)}</td>
        <td style="text-align:right;">${formatMoney(l.entrada)}</td>
        <td style="text-align:right;">${formatMoney(l.saida)}</td>
        <td style="text-align:right;font-weight:700;color:${Number(l.saldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(l.saldo)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="border-top:2px solid #dee2e6;font-weight:700;background:#f8f9fa;">
        <td>TOTAL</td>
        <td style="text-align:right;">${formatMoney(res.totalEntrada)}</td>
        <td style="text-align:right;">${formatMoney(res.totalSaida)}</td>
        <td style="text-align:right;color:${Number(res.totalSaldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(res.totalSaldo)}</td>
      </tr></tfoot>
    </table></div>`;
  },function(err){
    wrap.innerHTML=`<div class="err">❌ Erro: ${err?.message||'falha ao carregar'}</div>`;
  });
}

/* ══════════════════════════════════════════════════════
   LANÇAMENTOS
══════════════════════════════════════════════════════ */

function openLancamentos(){
  setActiveMenu('📝 Lançamentos');
  document.getElementById('contentTitle').textContent = '📝 Gestão de Lançamentos';
  const agora = new Date();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosHtml=''; for(let a=agora.getFullYear()+1;a>=agora.getFullYear()-3;a--) anosHtml+=`<option value="${a}"${a===agora.getFullYear()?' selected':''}>${a}</option>`;
  const mesesHtml = meses.map((m,i)=>`<option value="${i+1}"${i+1===agora.getMonth()+1?' selected':''}>${m}</option>`).join('');

  document.getElementById('contentArea').innerHTML = `
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>📋 Lista de Lançamentos</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormLancamento()">＋ Novo Lançamento</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <select id="lanc_mes" style="flex:1;min-width:110px;padding:9px 12px;">${mesesHtml}</select>
        <select id="lanc_ano" style="flex:1;min-width:80px;padding:9px 12px;">${anosHtml}</select>
        <select id="lanc_status" style="flex:1;min-width:130px;padding:9px 12px;">
          <option value="">Todos os estados</option>
          <option value="RASCUNHO">📝 Rascunho</option>
          <option value="PENDENTE">⏳ Pendente</option>
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
  const wrap = document.getElementById('lancTableWrap');
  if(!wrap) return;
  wrap.innerHTML = '⏳ A carregar...';
  const mes    = Number(document.getElementById('lanc_mes')?.value||0);
  const ano    = Number(document.getElementById('lanc_ano')?.value||0);
  const status = document.getElementById('lanc_status')?.value||'';
  serverCall('Lancamentos_listar',[{mes,ano,status}],function(res){
    const rows = Array.isArray(res?.lancamentos||res) ? (res?.lancamentos||res) : [];
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem lançamentos para este filtro.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr>
        <th>Data</th><th>Descrição</th><th>Departamento</th>
        <th style="text-align:right;">Valor</th><th>Tipo</th><th>Estado</th><th>Acções</th>
      </tr></thead>
      <tbody>${rows.map(l=>`<tr>
        <td style="white-space:nowrap;">${safeText(l.data||l.data_lancamento)}</td>
        <td>${safeText(l.descricao)}</td>
        <td>${safeText(l.nome_departamento||l.id_departamento)}</td>
        <td style="text-align:right;font-weight:600;">${formatMoney(l.valor)}</td>
        <td>${l.tipo==='ENTRADA'?'📈 Entrada':'📉 Saída'}</td>
        <td>${statusBadge(l.status||l.estado)}</td>
        <td class="row-actions">
          ${(l.status==='RASCUNHO'||l.estado==='RASCUNHO')?`<button class="info" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="editarLancamento('${l.id}')">✏️ Editar</button>
          <button class="success" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="submeterLancamento('${l.id}')">📤 Submeter</button>
          <button class="danger" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="eliminarLancamento('${l.id}')">🗑️</button>`
          :''}
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  },function(err){
    wrap.innerHTML=`<div class="err">❌ Erro: ${err?.message||'Falha'}</div>`;
  });
}

function abrirFormLancamento(dados){
  const wrap = document.getElementById('formLancWrap');
  const isEdit = dados && dados.id;
  let deptoOpts = '<option value="">A carregar departamentos...</option>';

  wrap.innerHTML = `
    <div class="box" style="margin-top:16px;">
      <h3>${isEdit?'✏️ Editar':'＋ Novo'} Lançamento</h3>
      <div class="section-grid">
        <div>
          <label>Tipo *</label>
          <select id="fl_tipo">
            <option value="ENTRADA"${dados?.tipo==='ENTRADA'?' selected':''}>📈 Entrada</option>
            <option value="SAIDA"${dados?.tipo==='SAIDA'?' selected':''}>📉 Saída</option>
          </select>
          <label>Data *</label>
          <input type="date" id="fl_data" value="${dados?.data||new Date().toISOString().split('T')[0]}">
          <label>Valor (MZN) *</label>
          <input type="number" id="fl_valor" step="0.01" min="0" placeholder="0.00" value="${dados?.valor||''}">
          <label>Departamento *</label>
          <select id="fl_depto">${deptoOpts}</select>
        </div>
        <div>
          <label>Descrição *</label>
          <textarea id="fl_descricao" rows="3" placeholder="Descreva o lançamento...">${dados?.descricao||''}</textarea>
          <label>Categoria</label>
          <input type="text" id="fl_categoria" placeholder="Ex: Dízimos, Aluguer..." value="${dados?.categoria||''}">
          <label>Comprovativo / Referência</label>
          <input type="text" id="fl_ref" placeholder="Nº recibo, transferência..." value="${dados?.referencia||''}">
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormLanc()">✖ Cancelar</button>
        <button class="info" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarLancamento('RASCUNHO','${dados?.id||''}')">💾 Guardar Rascunho</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarLancamento('PENDENTE','${dados?.id||''}')">📤 Submeter para Aprovação</button>
      </div>
      <div id="msgLanc" class="msg"></div>
    </div>`;

  // carregar departamentos
  serverCall('Departamentos_listar',[{}],function(res){
    const deptos = Array.isArray(res?.departamentos||res) ? (res?.departamentos||res) : [];
    const sel = document.getElementById('fl_depto');
    if(!sel) return;
    sel.innerHTML = '<option value="">Seleccione departamento</option>' +
      deptos.map(d=>`<option value="${d.id}"${dados?.id_departamento===d.id?' selected':''}>${safeText(d.nome)}</option>`).join('');
  },function(){
    const sel=document.getElementById('fl_depto');
    if(sel) sel.innerHTML='<option value="">Erro ao carregar departamentos</option>';
  });

  wrap.scrollIntoView({behavior:'smooth', block:'start'});
}

function fecharFormLanc(){
  const wrap = document.getElementById('formLancWrap');
  if(wrap) wrap.innerHTML='';
}

function guardarLancamento(status, id){
  const tipo      = document.getElementById('fl_tipo')?.value;
  const data      = document.getElementById('fl_data')?.value;
  const valor     = document.getElementById('fl_valor')?.value;
  const depto     = document.getElementById('fl_depto')?.value;
  const descricao = document.getElementById('fl_descricao')?.value?.trim();
  const categoria = document.getElementById('fl_categoria')?.value?.trim();
  const ref       = document.getElementById('fl_ref')?.value?.trim();

  if(!tipo||!data||!valor||!depto||!descricao){
    showMessage('❌ Preencha todos os campos obrigatórios (*).', false, 'msgLanc');
    return;
  }

  const payload = { id:id||null, tipo, data, valor:Number(valor), id_departamento:depto, descricao, categoria, referencia:ref, status };
  const fn = id ? 'Lancamentos_actualizar' : 'Lancamentos_criar';
  showMessage('⏳ A guardar...', true, 'msgLanc');
  serverCall(fn,[payload],function(res){
    if(res && res.success===false){
      showMessage('❌ '+(res.message||'Erro ao guardar.'), false, 'msgLanc');
      return;
    }
    showMessage('✅ '+(status==='RASCUNHO'?'Rascunho guardado!':'Submetido para aprovação!'), true, 'msgLanc');
    setTimeout(()=>{ fecharFormLanc(); carregarLancamentos(); }, 1200);
  },function(err){
    showMessage('❌ Erro: '+(err?.message||'Falha'), false, 'msgLanc');
  });
}

function editarLancamento(id){
  serverCall('Lancamentos_obter',[{id}],function(l){
    abrirFormLancamento(l?.lancamento||l);
  },function(err){
    alert('❌ Erro ao carregar lançamento: '+(err?.message||'Falha'));
  });
}

function submeterLancamento(id){
  if(!confirm('Submeter este lançamento para aprovação?')) return;
  serverCall('Lancamentos_submeter',[{id}],function(res){
    if(res&&res.success===false){ alert('❌ '+(res.message||'Erro')); return; }
    carregarLancamentos();
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

function eliminarLancamento(id){
  if(!confirm('Eliminar este lançamento? Esta acção é irreversível.')) return;
  serverCall('Lancamentos_eliminar',[{id}],function(res){
    if(res&&res.success===false){ alert('❌ '+(res.message||'Erro')); return; }
    carregarLancamentos();
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ══════════════════════════════════════════════════════
   APROVAÇÕES
══════════════════════════════════════════════════════ */

function openApprovals(){
  setActiveMenu('✓ Aprovações');
  document.getElementById('contentTitle').textContent = '✓ Aprovações Pendentes';
  document.getElementById('contentArea').innerHTML = `
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
  const wrap = document.getElementById('aprovTableWrap');
  if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  serverCall('Aprovacoes_listar',[{}],function(res){
    const rows = Array.isArray(res?.lancamentos||res) ? (res?.lancamentos||res) : [];
    if(!rows.length){ wrap.innerHTML='<div class="info">✅ Sem lançamentos pendentes de aprovação.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr>
        <th>Data</th><th>Descrição</th><th>Departamento</th><th>Submetido por</th>
        <th style="text-align:right;">Valor</th><th>Tipo</th><th>Acções</th>
      </tr></thead>
      <tbody>${rows.map(l=>`<tr>
        <td style="white-space:nowrap;">${safeText(l.data||l.data_lancamento)}</td>
        <td>${safeText(l.descricao)}</td>
        <td>${safeText(l.nome_departamento||l.id_departamento)}</td>
        <td>${safeText(l.submetido_por||l.criado_por||'-')}</td>
        <td style="text-align:right;font-weight:600;">${formatMoney(l.valor)}</td>
        <td>${l.tipo==='ENTRADA'?'📈 Entrada':'📉 Saída'}</td>
        <td class="row-actions">
          <button class="success" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="aprovarLancamento('${l.id}')">✅ Aprovar</button>
          <button class="danger"  style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="rejeitarLancamento('${l.id}')">❌ Rejeitar</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  },function(err){
    wrap.innerHTML=`<div class="err">❌ Erro: ${err?.message||'Falha'}</div>`;
  });
}

function aprovarLancamento(id){
  if(!confirm('Aprovar este lançamento?')) return;
  serverCall('Aprovacoes_aprovar',[{id}],function(res){
    if(res&&res.success===false){ alert('❌ '+(res.message||'Erro')); return; }
    carregarAprovacoes();
    // refresh kpi saldo
    serverCall('Dashboard_getSummary',[{}],function(s){
      const el=document.getElementById('kpiSaldo');
      if(el) el.textContent=formatMoney(s?.saldo);
    },()=>{});
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

function rejeitarLancamento(id){
  const motivo = prompt('Motivo da rejeição (opcional):');
  serverCall('Aprovacoes_rejeitar',[{id, motivo:motivo||''}],function(res){
    if(res&&res.success===false){ alert('❌ '+(res.message||'Erro')); return; }
    carregarAprovacoes();
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ══════════════════════════════════════════════════════
   ORÇAMENTOS
══════════════════════════════════════════════════════ */

function openOrcamentos(){
  setActiveMenu('📈 Orçamentos');
  document.getElementById('contentTitle').textContent = '📈 Gestão de Orçamentos';
  const ano = new Date().getFullYear();
  let anosHtml=''; for(let a=ano+1;a>=ano-3;a--) anosHtml+=`<option value="${a}"${a===ano?' selected':''}>${a}</option>`;

  document.getElementById('contentArea').innerHTML = `
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>📋 Orçamentos por Departamento</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormOrcamento()">＋ Novo Orçamento</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <select id="orc_ano" style="flex:1;min-width:100px;padding:9px 12px;">${anosHtml}</select>
        <button class="info" style="width:auto;margin-top:0;padding:9px 18px;" onclick="carregarOrcamentos()">🔍 Filtrar</button>
      </div>
      <div id="orcTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formOrcWrap"></div>`;
  carregarOrcamentos();
}

function carregarOrcamentos(){
  const wrap = document.getElementById('orcTableWrap');
  if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  const ano = Number(document.getElementById('orc_ano')?.value||new Date().getFullYear());
  serverCall('Orcamentos_listar',[{ano}],function(res){
    const rows = Array.isArray(res?.orcamentos||res) ? (res?.orcamentos||res) : [];
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem orçamentos para este ano.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr>
        <th>Departamento</th><th>Ano</th>
        <th style="text-align:right;">Orçamento</th>
        <th style="text-align:right;">Executado</th>
        <th style="text-align:right;">Saldo</th>
        <th>% Exec.</th><th>Acções</th>
      </tr></thead>
      <tbody>${rows.map(o=>{
        const pct = o.orcamento>0 ? Math.round((o.executado/o.orcamento)*100) : 0;
        const cor = pct>100?'#dc3545':pct>80?'#ffc107':'#28a745';
        return `<tr>
          <td>${safeText(o.nome_departamento||o.id_departamento)}</td>
          <td>${safeText(o.ano)}</td>
          <td style="text-align:right;">${formatMoney(o.orcamento)}</td>
          <td style="text-align:right;">${formatMoney(o.executado)}</td>
          <td style="text-align:right;font-weight:700;color:${o.orcamento-o.executado>=0?'#28a745':'#dc3545'};">${formatMoney(o.orcamento-o.executado)}</td>
          <td><div style="background:#e9ecef;border-radius:6px;height:8px;min-width:60px;overflow:hidden;">
            <div style="background:${cor};height:100%;width:${Math.min(pct,100)}%;border-radius:6px;"></div>
          </div><small style="color:${cor};font-weight:600;">${pct}%</small></td>
          <td class="row-actions">
            <button class="info" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="editarOrcamento('${o.id}')">✏️ Editar</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  },function(err){
    wrap.innerHTML=`<div class="err">❌ Erro: ${err?.message||'Falha'}</div>`;
  });
}

function abrirFormOrcamento(dados){
  const wrap = document.getElementById('formOrcWrap');
  const isEdit = dados&&dados.id;
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>${isEdit?'✏️ Editar':'＋ Novo'} Orçamento</h3>
      <div class="section-grid">
        <div>
          <label>Departamento *</label>
          <select id="fo_depto"><option value="">A carregar...</option></select>
          <label>Ano *</label>
          <input type="number" id="fo_ano" value="${dados?.ano||new Date().getFullYear()}" min="2020" max="2035">
        </div>
        <div>
          <label>Valor Orçamentado (MZN) *</label>
          <input type="number" id="fo_valor" step="0.01" min="0" placeholder="0.00" value="${dados?.orcamento||''}">
          <label>Observações</label>
          <textarea id="fo_obs" rows="2" placeholder="Notas...">${dados?.observacoes||''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormOrc()">✖ Cancelar</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarOrcamento('${dados?.id||''}')">💾 Guardar</button>
      </div>
      <div id="msgOrc" class="msg"></div>
    </div>`;

  serverCall('Departamentos_listar',[{}],function(res){
    const deptos=Array.isArray(res?.departamentos||res)?(res?.departamentos||res):[];
    const sel=document.getElementById('fo_depto');
    if(!sel) return;
    sel.innerHTML='<option value="">Seleccione departamento</option>'+
      deptos.map(d=>`<option value="${d.id}"${dados?.id_departamento===d.id?' selected':''}>${safeText(d.nome)}</option>`).join('');
  },()=>{});
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

function fecharFormOrc(){ const w=document.getElementById('formOrcWrap'); if(w) w.innerHTML=''; }

function guardarOrcamento(id){
  const depto = document.getElementById('fo_depto')?.value;
  const ano   = document.getElementById('fo_ano')?.value;
  const valor = document.getElementById('fo_valor')?.value;
  const obs   = document.getElementById('fo_obs')?.value?.trim();
  if(!depto||!ano||!valor){ showMessage('❌ Preencha todos os campos obrigatórios.', false, 'msgOrc'); return; }
  const fn = id ? 'Orcamentos_actualizar' : 'Orcamentos_criar';
  showMessage('⏳ A guardar...', true, 'msgOrc');
  serverCall(fn,[{id:id||null,id_departamento:depto,ano:Number(ano),orcamento:Number(valor),observacoes:obs}],function(res){
    if(res&&res.success===false){ showMessage('❌ '+(res.message||'Erro'), false, 'msgOrc'); return; }
    showMessage('✅ Orçamento guardado!', true, 'msgOrc');
    setTimeout(()=>{ fecharFormOrc(); carregarOrcamentos(); }, 1200);
  },function(err){ showMessage('❌ '+(err?.message||'Falha'), false, 'msgOrc'); });
}

function editarOrcamento(id){
  serverCall('Orcamentos_obter',[{id}],function(res){
    abrirFormOrcamento(res?.orcamento||res);
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ══════════════════════════════════════════════════════
   RELATÓRIOS
══════════════════════════════════════════════════════ */

function openRelatorios(){
  setActiveMenu('📄 Relatórios');
  document.getElementById('contentTitle').textContent = '📄 Relatórios Financeiros';
  const agora=new Date(), ano=agora.getFullYear(), mes=agora.getMonth()+1;
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosHtml=''; for(let a=ano+1;a>=ano-3;a--) anosHtml+=`<option value="${a}"${a===ano?' selected':''}>${a}</option>`;
  const mesesHtml=meses.map((m,i)=>`<option value="${i+1}"${i+1===mes?' selected':''}>${m}</option>`).join('');

  document.getElementById('contentArea').innerHTML = `
    <div class="section-grid" style="margin-top:0;">
      <div class="box" style="margin-top:0;">
        <h3>📊 Relatório Mensal</h3>
        <label>Mês</label><select id="rel_mes" style="padding:9px 12px;">${mesesHtml}</select>
        <label>Ano</label><select id="rel_ano" style="padding:9px 12px;">${anosHtml}</select>
        <button class="info" style="margin-top:14px;" onclick="gerarRelatorioMensal()">📥 Gerar Relatório</button>
      </div>
      <div class="box" style="margin-top:0;">
        <h3>📅 Relatório por Período</h3>
        <label>Data Início</label><input type="date" id="rel_inicio" value="${ano}-01-01">
        <label>Data Fim</label><input type="date" id="rel_fim" value="${agora.toISOString().split('T')[0]}">
        <button class="info" style="margin-top:14px;" onclick="gerarRelatorioPeriodo()">📥 Gerar Relatório</button>
      </div>
    </div>
    <div id="relResultWrap"></div>`;
}

function gerarRelatorioMensal(){
  const mes = Number(document.getElementById('rel_mes')?.value);
  const ano = Number(document.getElementById('rel_ano')?.value);
  const wrap = document.getElementById('relResultWrap');
  wrap.innerHTML='<div class="box" style="margin-top:16px;">⏳ A gerar relatório...</div>';
  serverCall('Relatorios_mensal',[{mes,ano}],function(res){
    renderRelatorio(res, `Relatório Mensal — ${['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][mes]} ${ano}`);
  },function(err){
    wrap.innerHTML=`<div class="box" style="margin-top:16px;"><div class="err">❌ ${err?.message||'Erro ao gerar relatório'}</div></div>`;
  });
}

function gerarRelatorioPeriodo(){
  const inicio = document.getElementById('rel_inicio')?.value;
  const fim    = document.getElementById('rel_fim')?.value;
  if(!inicio||!fim){ alert('Seleccione as datas de início e fim.'); return; }
  const wrap = document.getElementById('relResultWrap');
  wrap.innerHTML='<div class="box" style="margin-top:16px;">⏳ A gerar relatório...</div>';
  serverCall('Relatorios_periodo',[{data_inicio:inicio,data_fim:fim}],function(res){
    renderRelatorio(res, `Relatório: ${inicio} → ${fim}`);
  },function(err){
    wrap.innerHTML=`<div class="box" style="margin-top:16px;"><div class="err">❌ ${err?.message||'Erro'}</div></div>`;
  });
}

function renderRelatorio(res, titulo){
  const wrap = document.getElementById('relResultWrap');
  const linhas = Array.isArray(res?.linhas||res) ? (res?.linhas||res) : [];
  if(!linhas.length){
    wrap.innerHTML=`<div class="box" style="margin-top:16px;"><div class="info">ℹ️ Sem dados para o período seleccionado.</div></div>`;
    return;
  }
  const totalEnt = linhas.reduce((s,l)=>s+Number(l.entrada||0),0);
  const totalSai = linhas.reduce((s,l)=>s+Number(l.saida||0),0);
  const totalSal = totalEnt-totalSai;
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <h3 style="margin:0;">📄 ${titulo}</h3>
      </div>
      <div class="grid" style="margin-top:0;margin-bottom:16px;">
        <div class="card" style="cursor:default;"><div class="card-title">Total Entradas</div><div class="card-value" style="color:#28a745;font-size:20px;">${formatMoney(totalEnt)}</div></div>
        <div class="card" style="cursor:default;"><div class="card-title">Total Saídas</div><div class="card-value" style="color:#dc3545;font-size:20px;">${formatMoney(totalSai)}</div></div>
        <div class="card" style="cursor:default;"><div class="card-title">Saldo</div><div class="card-value" style="color:${totalSal>=0?'#28a745':'#dc3545'};font-size:20px;">${formatMoney(totalSal)}</div></div>
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
        <thead><tr>
          <th>${res?.agrupado_por==='departamento'?'Departamento':'Data'}</th>
          <th>Descrição</th>
          <th style="text-align:right;">Entrada</th>
          <th style="text-align:right;">Saída</th>
          <th style="text-align:right;">Saldo</th>
          <th>Estado</th>
        </tr></thead>
        <tbody>${linhas.map(l=>`<tr>
          <td style="white-space:nowrap;">${safeText(l.agrupador||l.data||l.nome_departamento)}</td>
          <td>${safeText(l.descricao||'-')}</td>
          <td style="text-align:right;color:#28a745;">${formatMoney(l.entrada)}</td>
          <td style="text-align:right;color:#dc3545;">${formatMoney(l.saida)}</td>
          <td style="text-align:right;font-weight:700;color:${Number(l.saldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(l.saldo)}</td>
          <td>${statusBadge(l.status||l.estado||'')}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr style="border-top:2px solid #dee2e6;font-weight:700;background:#f8f9fa;">
          <td colspan="2">TOTAL</td>
          <td style="text-align:right;color:#28a745;">${formatMoney(totalEnt)}</td>
          <td style="text-align:right;color:#dc3545;">${formatMoney(totalSai)}</td>
          <td style="text-align:right;color:${totalSal>=0?'#28a745':'#dc3545'};">${formatMoney(totalSal)}</td>
          <td></td>
        </tr></tfoot>
      </table></div>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   ADMINISTRAÇÃO
══════════════════════════════════════════════════════ */

function openAdministracao(){
  setActiveMenu('⚙️ Administração');
  document.getElementById('contentTitle').textContent = '⚙️ Administração do Sistema';
  document.getElementById('contentArea').innerHTML = `
    <div class="section-grid" style="margin-top:0;">
      <div class="box" style="margin-top:0;cursor:pointer;" onclick="adminTab('utilizadores')" id="tab_utilizadores">
        <h3>👥 Utilizadores</h3><p class="muted">Gerir contas e permissões de acesso.</p>
      </div>
      <div class="box" style="margin-top:0;cursor:pointer;" onclick="adminTab('departamentos')" id="tab_departamentos">
        <h3>🏢 Departamentos</h3><p class="muted">Gerir departamentos e centros de custo.</p>
      </div>
      <div class="box" style="margin-top:0;cursor:pointer;" onclick="adminTab('igrejas')" id="tab_igrejas">
        <h3>⛪ Igrejas</h3><p class="muted">Gerir igrejas e entidades.</p>
      </div>
      <div class="box" style="margin-top:0;cursor:pointer;" onclick="adminTab('diagnostico')" id="tab_diagnostico">
        <h3>🔬 Diagnóstico</h3><p class="muted">Testar funções disponíveis no backend.</p>
      </div>
    </div>
    <div id="adminContentWrap" style="margin-top:4px;"></div>`;
}

function adminTab(tab){
  ['utilizadores','departamentos','igrejas','diagnostico'].forEach(t=>{
    const el=document.getElementById('tab_'+t);
    if(el) el.style.border = t===tab?'2px solid #123b7a':'1px solid #e9ecef';
  });
  if(tab==='utilizadores')   adminUtilizadores();
  if(tab==='departamentos')  adminDepartamentos();
  if(tab==='igrejas')        adminIgrejas();
  if(tab==='diagnostico')    adminDiagnostico();
}

/* ── Diagnóstico ── */
function adminDiagnostico(){
  const wrap = document.getElementById('adminContentWrap');

  wrap.innerHTML = `
    <div class="box" style="margin-top:0;">
      <h3>🔬 Diagnóstico do Backend</h3>
      <p class="muted">As funções-chave são testadas automaticamente abaixo com os dados reais expandidos. Use o campo em baixo para testar qualquer outra função.</p>
      <div id="diagAuto"></div>
      <hr class="soft">
      <div style="margin-bottom:8px;">
        <label style="margin:0 0 6px;">🔧 Testar outra função:</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="text" id="diagFnInput" placeholder="Ex: Lancamentos_criar" style="flex:1;min-width:200px;padding:9px 12px;">
          <button class="info" style="width:auto;margin-top:0;padding:9px 18px;" onclick="diagTestarUm()">▶ Testar</button>
        </div>
      </div>
      <div id="diagExtra"></div>
    </div>`;

  // Testar automaticamente as funções-chave com dados EXPANDIDOS
  const autoFns = [
    { fn:'Departamentos_listar', titulo:'🏢 Departamentos' },
    { fn:'Rubricas_listar',      titulo:'📂 Rubricas' },
    { fn:'Admin_listarIgrejas',  titulo:'⛪ Igrejas' },
  ];
  const autoWrap = document.getElementById('diagAuto');
  autoFns.forEach(({fn, titulo}) => diagTestarExpandido(fn, titulo, autoWrap));
}

function diagTestarExpandido(fn, titulo, container){
  const rowId = 'diagE_' + fn.replace(/[^a-zA-Z0-9]/g,'_');
  const div = document.createElement('div');
  div.style.marginBottom = '16px';
  div.innerHTML = `
    <strong style="display:block;margin:12px 0 6px;color:#2c3e50;">${titulo} — <code style="color:#123b7a;">${fn}</code></strong>
    <div id="${rowId}" style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:10px;padding:14px;font-size:13px;">
      ⏳ A carregar dados reais...
    </div>`;
  container.appendChild(div);

  serverCall(fn, [{}], function(res){
    const el = document.getElementById(rowId);
    if(!el) return;

    // Mostrar JSON RAW completo sempre
    const jsonStr = JSON.stringify(res, null, 2);

    // Tentar extrair array
    let arr = null;
    let arrKey = null;
    if(Array.isArray(res)){ arr = res; arrKey = '(raiz)'; }
    else if(res && typeof res === 'object'){
      for(const k of Object.keys(res)){
        if(Array.isArray(res[k]) && res[k].length){ arr = res[k]; arrKey = k; break; }
      }
      // mesmo que vazio
      if(!arr) for(const k of Object.keys(res)){
        if(Array.isArray(res[k])){ arr = res[k]; arrKey = k; break; }
      }
    }

    let camposHtml = '';
    let amostraHtml = '';
    if(arr && arr.length){
      const campos = Object.keys(arr[0]);
      camposHtml = `<div style="margin-bottom:8px;padding:8px;background:#d4edda;border-radius:8px;color:#155724;">
        ✅ <strong>${arr.length}</strong> registo(s) na chave <code>"${arrKey}"</code><br>
        📋 Campos disponíveis: <code style="font-weight:700;">${campos.join(' | ')}</code>
      </div>`;
      amostraHtml = `<div style="margin-bottom:6px;font-weight:600;color:#2c3e50;">📄 Todos os registos:</div>
        <div style="overflow-x:auto;"><table style="font-size:12px;">
          <thead><tr>${campos.map(c=>`<th style="background:#e9f7ef;padding:6px 8px;">${c}</th>`).join('')}</tr></thead>
          <tbody>${arr.map(r=>`<tr>${campos.map(c=>`<td style="padding:5px 8px;">${safeText(r[c])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
    } else if(arr && arr.length === 0){
      camposHtml = `<div style="padding:8px;background:#fff3cd;border-radius:8px;color:#856404;">
        ⚠️ A função existe mas retornou um array <strong>vazio</strong> na chave <code>"${arrKey}"</code>. Verifique se há dados na base de dados.
      </div>`;
    } else {
      camposHtml = `<div style="padding:8px;background:#fff3cd;border-radius:8px;color:#856404;">
        ⚠️ Resposta não contém array. Veja o JSON completo abaixo.
      </div>`;
    }

    el.style.borderColor = '#28a745';
    el.innerHTML = camposHtml + amostraHtml +
      `<details style="margin-top:8px;"><summary style="cursor:pointer;color:#123b7a;font-size:12px;">Ver JSON completo</summary>
        <pre style="background:#f1f3f5;padding:8px;border-radius:6px;overflow-x:auto;font-size:11px;margin-top:4px;">${jsonStr}</pre>
      </details>`;
  }, function(err){
    const el = document.getElementById(rowId);
    if(el) el.innerHTML = `<div style="color:#721c24;">❌ Erro: ${err?.message||'Função não encontrada ou sem permissão'}</div>`;
  });
}

function diagTestarUm(){
  const fn = document.getElementById('diagFnInput')?.value?.trim();
  if(!fn){ alert('Escreva o nome da função.'); return; }
  const wrap = document.getElementById('diagExtra');
  diagTestarExpandido(fn, '🔧 Teste manual', wrap);
}

/* ── Utilizadores ── */
function adminUtilizadores(){
  const wrap=document.getElementById('adminContentWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>👥 Utilizadores do Sistema</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormUtilizador()">＋ Novo Utilizador</button>
      </div>
      <div id="utilTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formUtilWrap"></div>`;
  carregarUtilizadores();
}

function carregarUtilizadores(){
  const wrap=document.getElementById('utilTableWrap');
  if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  serverCall('Admin_listarUtilizadores',[{}],function(res){
    const rows=Array.isArray(res?.utilizadores||res)?(res?.utilizadores||res):[];
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem utilizadores.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Nome</th><th>Username</th><th>Perfil</th><th>Igreja</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(u=>`<tr>
        <td>${safeText(u.nome_completo)}</td>
        <td>${safeText(u.username)}</td>
        <td><span class="badge badge-info">${safeText(u.id_perfil)}</span></td>
        <td>${safeText(u.igreja_nome||u.id_igreja||'-')}</td>
        <td>${u.activo!==false?'<span class="badge badge-success">✅ Activo</span>':'<span class="badge badge-danger">🚫 Inactivo</span>'}</td>
        <td class="row-actions">
          <button class="info" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="editarUtilizador('${u.id}')">✏️ Editar</button>
          <button class="${u.activo!==false?'danger':'success'}" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="toggleUtilizador('${u.id}',${!u.activo})">${u.activo!==false?'🚫 Desactivar':'✅ Activar'}</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  },function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

function abrirFormUtilizador(dados){
  const wrap=document.getElementById('formUtilWrap');
  const isEdit=dados&&dados.id;
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>${isEdit?'✏️ Editar':'＋ Novo'} Utilizador</h3>
      <div class="section-grid">
        <div>
          <label>Nome Completo *</label>
          <input type="text" id="fu_nome" placeholder="Nome completo" value="${dados?.nome_completo||''}">
          <label>Username *</label>
          <input type="text" id="fu_username" placeholder="username" value="${dados?.username||''}">
          <label>${isEdit?'Nova Palavra-passe (deixe vazio p/ manter)':'Palavra-passe *'}</label>
          <input type="password" id="fu_pass" placeholder="••••••••">
        </div>
        <div>
          <label>Perfil *</label>
          <select id="fu_perfil">
            <option value="ADMIN_GERAL"${dados?.id_perfil==='ADMIN_GERAL'?' selected':''}>ADMIN_GERAL</option>
            <option value="ADMIN_DISTRITAL"${dados?.id_perfil==='ADMIN_DISTRITAL'?' selected':''}>ADMIN_DISTRITAL</option>
            <option value="TESOUREIRO"${dados?.id_perfil==='TESOUREIRO'?' selected':''}>TESOUREIRO</option>
            <option value="APROVADOR"${dados?.id_perfil==='APROVADOR'?' selected':''}>APROVADOR</option>
            <option value="VISUALIZADOR"${dados?.id_perfil==='VISUALIZADOR'?' selected':''}>VISUALIZADOR</option>
          </select>
          <label>Igreja</label>
          <select id="fu_igreja"><option value="">A carregar...</option></select>
          <label>E-mail</label>
          <input type="email" id="fu_email" placeholder="email@exemplo.com" value="${dados?.email||''}">
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormUtil()">✖ Cancelar</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarUtilizador('${dados?.id||''}')">💾 Guardar</button>
      </div>
      <div id="msgUtil" class="msg"></div>
    </div>`;

  serverCall('Admin_listarIgrejas',[{}],function(res){
    const igrejas=Array.isArray(res?.igrejas||res)?(res?.igrejas||res):[];
    const sel=document.getElementById('fu_igreja');
    if(!sel) return;
    sel.innerHTML='<option value="">Sem igreja específica</option>'+
      igrejas.map(g=>`<option value="${g.id}"${dados?.id_igreja===g.id?' selected':''}>${safeText(g.nome)}</option>`).join('');
  },()=>{});
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

function fecharFormUtil(){ const w=document.getElementById('formUtilWrap'); if(w) w.innerHTML=''; }

function guardarUtilizador(id){
  const nome    = document.getElementById('fu_nome')?.value?.trim();
  const uname   = document.getElementById('fu_username')?.value?.trim();
  const pass    = document.getElementById('fu_pass')?.value;
  const perfil  = document.getElementById('fu_perfil')?.value;
  const igreja  = document.getElementById('fu_igreja')?.value;
  const email   = document.getElementById('fu_email')?.value?.trim();
  if(!nome||!uname||(!id&&!pass)||!perfil){ showMessage('❌ Preencha os campos obrigatórios.', false, 'msgUtil'); return; }
  const fn=id?'Admin_actualizarUtilizador':'Admin_criarUtilizador';
  showMessage('⏳ A guardar...', true, 'msgUtil');
  serverCall(fn,[{id:id||null,nome_completo:nome,username:uname,password:pass||null,id_perfil:perfil,id_igreja:igreja||null,email}],function(res){
    if(res&&res.success===false){ showMessage('❌ '+(res.message||'Erro'), false, 'msgUtil'); return; }
    showMessage('✅ Utilizador guardado!', true, 'msgUtil');
    setTimeout(()=>{ fecharFormUtil(); carregarUtilizadores(); }, 1200);
  },function(err){ showMessage('❌ '+(err?.message||'Falha'), false, 'msgUtil'); });
}

function editarUtilizador(id){
  serverCall('Admin_obterUtilizador',[{id}],function(res){
    abrirFormUtilizador(res?.utilizador||res);
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

function toggleUtilizador(id, activar){
  if(!confirm((activar?'Activar':'Desactivar')+' este utilizador?')) return;
  serverCall('Admin_toggleUtilizador',[{id, activo:activar}],function(res){
    if(res&&res.success===false){ alert('❌ '+(res.message||'Erro')); return; }
    carregarUtilizadores();
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ── Departamentos ── */
function adminDepartamentos(){
  const wrap=document.getElementById('adminContentWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>🏢 Departamentos</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormDepto()">＋ Novo Departamento</button>
      </div>
      <div id="deptoTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formDeptoWrap"></div>`;
  carregarDeptosAdmin();
}

function carregarDeptosAdmin(){
  const wrap=document.getElementById('deptoTableWrap');
  if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  serverCall('Departamentos_listar',[{}],function(res){
    const rows=Array.isArray(res?.departamentos||res)?(res?.departamentos||res):[];
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem departamentos.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Nome</th><th>Igreja</th><th>Código</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(d=>`<tr>
        <td><strong>${safeText(d.nome)}</strong></td>
        <td>${safeText(d.igreja_nome||d.id_igreja||'-')}</td>
        <td>${safeText(d.codigo||'-')}</td>
        <td>${d.activo!==false?'<span class="badge badge-success">✅ Activo</span>':'<span class="badge badge-danger">🚫 Inactivo</span>'}</td>
        <td class="row-actions">
          <button class="info" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="editarDepto('${d.id}')">✏️ Editar</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  },function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

function abrirFormDepto(dados){
  const wrap=document.getElementById('formDeptoWrap');
  const isEdit=dados&&dados.id;
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>${isEdit?'✏️ Editar':'＋ Novo'} Departamento</h3>
      <div class="section-grid">
        <div>
          <label>Nome *</label>
          <input type="text" id="fd_nome" placeholder="Nome do departamento" value="${dados?.nome||''}">
          <label>Código</label>
          <input type="text" id="fd_codigo" placeholder="Ex: DEPT-001" value="${dados?.codigo||''}">
        </div>
        <div>
          <label>Igreja</label>
          <select id="fd_igreja"><option value="">A carregar...</option></select>
          <label>Descrição</label>
          <textarea id="fd_desc" rows="2">${dados?.descricao||''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormDepto()">✖ Cancelar</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarDepto('${dados?.id||''}')">💾 Guardar</button>
      </div>
      <div id="msgDepto" class="msg"></div>
    </div>`;
  serverCall('Admin_listarIgrejas',[{}],function(res){
    const igrejas=Array.isArray(res?.igrejas||res)?(res?.igrejas||res):[];
    const sel=document.getElementById('fd_igreja');
    if(!sel) return;
    sel.innerHTML='<option value="">Sem igreja específica</option>'+
      igrejas.map(g=>`<option value="${g.id}"${dados?.id_igreja===g.id?' selected':''}>${safeText(g.nome)}</option>`).join('');
  },()=>{});
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

function fecharFormDepto(){ const w=document.getElementById('formDeptoWrap'); if(w) w.innerHTML=''; }

function guardarDepto(id){
  const nome   = document.getElementById('fd_nome')?.value?.trim();
  const codigo = document.getElementById('fd_codigo')?.value?.trim();
  const igreja = document.getElementById('fd_igreja')?.value;
  const desc   = document.getElementById('fd_desc')?.value?.trim();
  if(!nome){ showMessage('❌ O nome é obrigatório.', false, 'msgDepto'); return; }
  const fn=id?'Departamentos_actualizar':'Departamentos_criar';
  showMessage('⏳ A guardar...', true, 'msgDepto');
  serverCall(fn,[{id:id||null,nome,codigo,id_igreja:igreja||null,descricao:desc}],function(res){
    if(res&&res.success===false){ showMessage('❌ '+(res.message||'Erro'), false, 'msgDepto'); return; }
    showMessage('✅ Departamento guardado!', true, 'msgDepto');
    setTimeout(()=>{ fecharFormDepto(); carregarDeptosAdmin(); }, 1200);
  },function(err){ showMessage('❌ '+(err?.message||'Falha'), false, 'msgDepto'); });
}

function editarDepto(id){
  serverCall('Departamentos_obter',[{id}],function(res){
    abrirFormDepto(res?.departamento||res);
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ── Igrejas ── */
function adminIgrejas(){
  const wrap=document.getElementById('adminContentWrap');
  wrap.innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>⛪ Igrejas / Entidades</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="abrirFormIgreja()">＋ Nova Igreja</button>
      </div>
      <div id="igrejaTableWrap" class="muted">A carregar...</div>
    </div>
    <div id="formIgrejaWrap"></div>`;
  carregarIgrejasAdmin();
}

function carregarIgrejasAdmin(){
  const wrap=document.getElementById('igrejaTableWrap');
  if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  serverCall('Admin_listarIgrejas',[{}],function(res){
    const rows=Array.isArray(res?.igrejas||res)?(res?.igrejas||res):[];
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem igrejas registadas.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Nome</th><th>Código</th><th>Localidade</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(g=>`<tr>
        <td><strong>${safeText(g.nome)}</strong></td>
        <td>${safeText(g.codigo||'-')}</td>
        <td>${safeText(g.localidade||'-')}</td>
        <td>${g.activo!==false?'<span class="badge badge-success">✅ Activa</span>':'<span class="badge badge-danger">🚫 Inactiva</span>'}</td>
        <td class="row-actions">
          <button class="info" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="editarIgreja('${g.id}')">✏️ Editar</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  },function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

function abrirFormIgreja(dados){
  const wrap=document.getElementById('formIgrejaWrap');
  const isEdit=dados&&dados.id;
  wrap.innerHTML=`
    <div class="box" style="margin-top:16px;">
      <h3>${isEdit?'✏️ Editar':'＋ Nova'} Igreja</h3>
      <div class="section-grid">
        <div>
          <label>Nome *</label>
          <input type="text" id="fi_nome" placeholder="Nome da igreja" value="${dados?.nome||''}">
          <label>Código</label>
          <input type="text" id="fi_codigo" placeholder="Ex: IGR-001" value="${dados?.codigo||''}">
        </div>
        <div>
          <label>Localidade</label>
          <input type="text" id="fi_local" placeholder="Cidade / Bairro" value="${dados?.localidade||''}">
          <label>Observações</label>
          <textarea id="fi_obs" rows="2">${dados?.observacoes||''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:10px 20px;" onclick="fecharFormIgreja()">✖ Cancelar</button>
        <button class="success" style="width:auto;margin-top:0;padding:10px 20px;" onclick="guardarIgreja('${dados?.id||''}')">💾 Guardar</button>
      </div>
      <div id="msgIgreja" class="msg"></div>
    </div>`;
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

function fecharFormIgreja(){ const w=document.getElementById('formIgrejaWrap'); if(w) w.innerHTML=''; }

function guardarIgreja(id){
  const nome   = document.getElementById('fi_nome')?.value?.trim();
  const codigo = document.getElementById('fi_codigo')?.value?.trim();
  const local  = document.getElementById('fi_local')?.value?.trim();
  const obs    = document.getElementById('fi_obs')?.value?.trim();
  if(!nome){ showMessage('❌ O nome é obrigatório.', false, 'msgIgreja'); return; }
  const fn=id?'Admin_actualizarIgreja':'Admin_criarIgreja';
  showMessage('⏳ A guardar...', true, 'msgIgreja');
  serverCall(fn,[{id:id||null,nome,codigo,localidade:local,observacoes:obs}],function(res){
    if(res&&res.success===false){ showMessage('❌ '+(res.message||'Erro'), false, 'msgIgreja'); return; }
    showMessage('✅ Igreja guardada!', true, 'msgIgreja');
    setTimeout(()=>{ fecharFormIgreja(); carregarIgrejasAdmin(); }, 1200);
  },function(err){ showMessage('❌ '+(err?.message||'Falha'), false, 'msgIgreja'); });
}

function editarIgreja(id){
  serverCall('Admin_obterIgreja',[{id}],function(res){
    abrirFormIgreja(res?.igreja||res);
  },function(err){ alert('❌ '+(err?.message||'Falha')); });
}

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */

window.addEventListener('load', function(){
  const rawUser = sessionStorage.getItem('app_user');
  const rawMenu = sessionStorage.getItem('app_menu');
  if(rawUser){ renderApp(JSON.parse(rawUser), rawMenu ? JSON.parse(rawMenu) : []); }
});

document.addEventListener('DOMContentLoaded', function(){
  const pwd = document.getElementById('password');
  const usr = document.getElementById('username');
  if(pwd) pwd.addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
  if(usr) usr.addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
});
