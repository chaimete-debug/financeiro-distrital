function showMessage(text, ok, elementId = 'msg'){
  const el = document.getElementById(elementId);
  if(!el) return;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text || '';
  if(ok){
    setTimeout(() => {
      if(el.textContent === text) el.innerHTML = '';
    }, 5000);
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

async function apiCall(action, args = []) {
  const response = await fetch(APP_CONFIG.API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action,
      args
    })
  });

  if (!response.ok) {
    throw new Error('Falha de comunicação com o servidor.');
  }

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

function setMainIdentity(user){
  document.getElementById('welcomeText').textContent =
    '👋 Sessão iniciada por ' + safeText(user.nome_completo) + '.';
  document.getElementById('kpiUser').textContent = safeText(user.nome_completo);
  document.getElementById('kpiPerfil').textContent = safeText(user.id_perfil);
  document.getElementById('kpiIgreja').textContent = safeText(user.igreja_nome || user.id_igreja || '-');
}

function setActiveMenu(label){
  document.querySelectorAll('#menuList li').forEach(li => {
    li.classList.toggle('active', li.textContent === label);
  });
}

function renderMenu(menu){
  const ul = document.getElementById('menuList');
  ul.innerHTML = '';

  const source = Array.isArray(menu) && menu.length ? menu : [
    {label:'📊 Dashboard'},
    {label:'💰 Operações'},
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
      const key = String(label || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

      if (key.includes('dashboard')) {
        openDashboard();
      } else if (key.includes('operacoes') || key.includes('operacao')) {
        openOperacoes();
      } else if (key.includes('lancamentos') || key.includes('lancamento')) {
        openLancamentos();
      } else if (key.includes('aprovacoes') || key.includes('aprovacao')) {
        openApprovals();
      } else if (key.includes('orcamentos') || key.includes('orcamento')) {
        openOrcamentos();
      } else if (key.includes('relatorios') || key.includes('relatorio')) {
        openRelatorios();
      } else if (key.includes('administracao')) {
        openAdministracao();
      }
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

async function login(){
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  document.getElementById('username').value = username;

  if (!username || !password) {
    showMessage('❌ Preencha username e palavra-passe.', false);
    return;
  }

  setLoading(true);
  showMessage('⏳ A autenticar...', true);

  try {
    const res = await apiCall('Auth_login', [username, password]);

    setLoading(false);

    if (!res || !res.success) {
      showMessage('❌ ' + (res && res.message ? res.message : 'Credenciais inválidas.'), false);
      document.getElementById('password').value = '';
      return;
    }

    sessionStorage.setItem('app_token', res.token || '');
    sessionStorage.setItem('app_user', JSON.stringify(res.user || {}));
    sessionStorage.setItem('app_menu', JSON.stringify(res.menu || []));

    showMessage('✅ Login efectuado!', true);

    setTimeout(function(){
      renderApp(res.user || {}, res.menu || []);
    }, 500);

  } catch (err) {
    setLoading(false);
    showMessage('❌ Erro: ' + (err.message || 'Tente novamente.'), false);
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
    alert('❌ ' + (err.message || 'Falha ao terminar sessão'));
  }
}

function openDashboard(){
  setActiveMenu('📊 Dashboard');
  document.getElementById('contentTitle').textContent = '📊 Dashboard Financeiro';

  const agora = new Date();
  const anoActual = agora.getFullYear();
  const mesActual = agora.getMonth() + 1;
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  let anosHtml = '';
  for (let a = anoActual + 1; a >= anoActual - 3; a--) {
    anosHtml += `<option value="${a}" ${a === anoActual ? 'selected' : ''}>${a}</option>`;
  }

  const mesesHtml = meses.map(function(m, i){
    const v = i + 1;
    return `<option value="${v}" ${v === mesActual ? 'selected' : ''}>${m}</option>`;
  }).join('');

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
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <select id="dash_mes" style="width:auto;padding:8px 12px;">${mesesHtml}</select>
          <select id="dash_ano" style="width:auto;padding:8px 12px;">${anosHtml}</select>
          <button class="info" style="width:auto;margin-top:0;padding:8px 20px;" onclick="loadDashDeptos()">Actualizar</button>
        </div>
      </div>
      <div id="dashDeptosWrap" class="muted">A carregar...</div>
    </div>
  `;

  serverCall('Dashboard_getSummary', [{}], function(stats){
    console.log('Dashboard_getSummary:', stats);

    const receitas   = Number(stats?.receitas_aprovadas ?? 0);
    const despesas   = Number(stats?.despesas_aprovadas ?? 0);
    const saldo      = Number(stats?.saldo ?? 0);
    const pendentes  = Number(stats?.pendentes ?? 0);
    const rascunhos  = Number(stats?.rascunhos ?? 0);
    const rejeitados = Number(stats?.rejeitados ?? 0);
    const igrejaNome = stats?.igreja_nome || stats?.id_igreja || '-';

    document.getElementById('dashReceitas').textContent   = formatMoney(receitas);
    document.getElementById('dashDespesas').textContent   = formatMoney(despesas);
    document.getElementById('dashSaldo').textContent      = formatMoney(saldo);
    document.getElementById('dashPendentes').textContent  = String(pendentes);
    document.getElementById('dashRascunhos').textContent  = String(rascunhos);
    document.getElementById('dashRejeitados').textContent = String(rejeitados);

    document.getElementById('kpiSaldo').textContent = formatMoney(saldo);
    document.getElementById('kpiIgreja').textContent = safeText(igrejaNome);
  }, function(err){
    console.error('Dashboard_getSummary error:', err);
    document.getElementById('dashDeptosWrap').innerHTML =
      '<div class="err">❌ Erro ao carregar dashboard: ' + (err.message || 'Falha') + '</div>';
  });

  loadDashDeptos();
}

function openOperacoes(){
  setActiveMenu('💰 Operações');
  document.getElementById('contentTitle').textContent = '💰 Centro de Operações';
  document.getElementById('contentArea').innerHTML = `<div class="box">Módulo em preparação.</div>`;
}

function openLancamentos(){
  setActiveMenu('📝 Lançamentos');
  document.getElementById('contentTitle').textContent = '📝 Gestão de Lançamentos';
  document.getElementById('contentArea').innerHTML = `<div class="box">Módulo em preparação.</div>`;
}

function openApprovals(){
  setActiveMenu('✓ Aprovações');
  document.getElementById('contentTitle').textContent = '✓ Aprovações Pendentes';
  document.getElementById('contentArea').innerHTML = `<div class="box">Módulo em preparação.</div>`;
}

function openOrcamentos(){
  setActiveMenu('📈 Orçamentos');
  document.getElementById('contentTitle').textContent = '📈 Gestão de Orçamentos';
  document.getElementById('contentArea').innerHTML = `<div class="box">Módulo em preparação.</div>`;
}

function openRelatorios(){
  setActiveMenu('📄 Relatórios');
  document.getElementById('contentTitle').textContent = '📄 Relatórios Financeiros';
  document.getElementById('contentArea').innerHTML = `<div class="box">Módulo em preparação.</div>`;
}

function openAdministracao(){
  setActiveMenu('⚙️ Administração');
  document.getElementById('contentTitle').textContent = '⚙️ Administração do Sistema';
  document.getElementById('contentArea').innerHTML = `<div class="box">Módulo em preparação.</div>`;
}

window.addEventListener('load', function(){
  const rawUser = sessionStorage.getItem('app_user');
  const rawMenu = sessionStorage.getItem('app_menu');
  if (rawUser) {
    renderApp(JSON.parse(rawUser), rawMenu ? JSON.parse(rawMenu) : []);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const password = document.getElementById('password');
  const username = document.getElementById('username');

  if (password) {
    password.addEventListener('keydown', function(e){
      if (e.key === 'Enter') login();
    });
  }

  if (username) {
    username.addEventListener('keydown', function(e){
      if (e.key === 'Enter') login();
    });
  }
});

function loadDashDeptos(){
  const wrap = document.getElementById('dashDeptosWrap');
  if (!wrap) return;

  wrap.innerHTML = '⏳ A carregar...';

  const mes = Number(document.getElementById('dash_mes')?.value || new Date().getMonth() + 1);
  const ano = Number(document.getElementById('dash_ano')?.value || new Date().getFullYear());
  const meses = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  serverCall('Dashboard_resumoDeptos', [{ ano: ano, mes: mes }], function(res){
    console.log('Dashboard_resumoDeptos:', res);

    const linhas = Array.isArray(res?.linhas) ? res.linhas : [];
    const periodo = `${meses[res?.mes] || mes} ${res?.ano || ano}`;
    const igreja = res?.igreja_nome || res?.id_igreja || '';

    if (!linhas.length) {
      wrap.innerHTML = `<div class="info">ℹ️ Sem lançamentos aprovados${igreja ? ' em ' + igreja : ''} em ${periodo}.</div>`;
      return;
    }

    wrap.innerHTML = `
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Departamento</th>
              <th style="text-align:right;">Entrada</th>
              <th style="text-align:right;">Saída</th>
              <th style="text-align:right;">Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${linhas.map(function(l){
              const cor = Number(l.saldo || 0) >= 0 ? '#28a745' : '#dc3545';
              return `
                <tr>
                  <td>${safeText(l.nome_departamento)}</td>
                  <td style="text-align:right;">${formatMoney(l.entrada)}</td>
                  <td style="text-align:right;">${formatMoney(l.saida)}</td>
                  <td style="text-align:right;font-weight:700;color:${cor};">${formatMoney(l.saldo)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid #dee2e6;font-weight:700;background:#f8f9fa;">
              <td>TOTAL</td>
              <td style="text-align:right;">${formatMoney(res.totalEntrada)}</td>
              <td style="text-align:right;">${formatMoney(res.totalSaida)}</td>
              <td style="text-align:right;color:${Number(res.totalSaldo || 0) >= 0 ? '#28a745' : '#dc3545'};">${formatMoney(res.totalSaldo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }, function(err){
    console.error('Dashboard_resumoDeptos error:', err);
    wrap.innerHTML = '<div class="err">❌ Erro: ' + (err && err.message ? err.message : 'falha ao carregar') + '</div>';
  });
}
