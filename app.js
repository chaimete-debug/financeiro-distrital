/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */

function showMessage(text, ok, elementId='msg'){
  const el=document.getElementById(elementId); if(!el) return;
  el.className='msg '+(ok?'ok':'err'); el.textContent=text||'';
  if(ok) setTimeout(()=>{ if(el.textContent===text) el.innerHTML=''; },5000);
}

/* Modal de confirmação — sem mostrar nome do servidor */
function confirmar(texto, onSim){
  const over=document.createElement('div');
  over.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
  over.innerHTML=`<div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
    <p style="font-size:15px;color:#2c3e50;margin:0 0 22px;line-height:1.5;">${texto}</p>
    <div style="display:flex;gap:12px;justify-content:center;">
      <button id="_cfNo" style="padding:10px 24px;border-radius:10px;border:2px solid #dee2e6;background:#fff;font-weight:600;cursor:pointer;font-size:14px;">Cancelar</button>
      <button id="_cfSim" style="padding:10px 24px;border-radius:10px;border:0;background:linear-gradient(135deg,#123b7a,#1e4d8f);color:#fff;font-weight:700;cursor:pointer;font-size:14px;">Confirmar</button>
    </div>
  </div>`;
  document.body.appendChild(over);
  over.querySelector('#_cfNo').onclick=()=>over.remove();
  over.querySelector('#_cfSim').onclick=()=>{ over.remove(); onSim(); };
}

/* Mensagem de erro sem alert() nativo */
function mostrarErro(texto){
  const over=document.createElement('div');
  over.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
  over.innerHTML=`<div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
    <p style="font-size:15px;color:#721c24;margin:0 0 22px;line-height:1.5;">❌ ${texto}</p>
    <button style="padding:10px 28px;border-radius:10px;border:0;background:linear-gradient(135deg,#dc3545,#c82333);color:#fff;font-weight:700;cursor:pointer;font-size:14px;" onclick="this.closest('div').parentElement.remove()">Fechar</button>
  </div>`;
  document.body.appendChild(over);
}
function setLoading(state,btnId='btnLogin'){
  const btn=document.getElementById(btnId); if(!btn) return;
  btn.disabled=state;
  if(btnId==='btnLogin') btn.textContent=state?'⏳ A processar...':'Iniciar sessão';
}
function formatMoney(v){ return Number(v||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})+' MZN'; }
function safeText(v){ return v==null||v===''?'-':String(v); }
function getToken(){ return sessionStorage.getItem('app_token')||''; }
function getUser(){ try{ return JSON.parse(sessionStorage.getItem('app_user')||'{}'); }catch(e){ return {}; } }

function statusBadge(s){
  const m={'APROVADO':['badge-success','✅ Aprovado'],'SUBMETIDO':['badge-warning','📤 Submetido'],
           'RASCUNHO':['badge-info','📝 Rascunho'],'REJEITADO':['badge-danger','❌ Rejeitado']};
  const [cls,lbl]=m[String(s||'').toUpperCase()]||['badge-info',safeText(s)];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

/* ══════════════════════════════════════════════════════
   API  — com cache e deduplicação de pedidos
══════════════════════════════════════════════════════ */

/* Cache geral: fnName+args → resultado, expira após TTL */
const _cache = {};
const _TTL   = { default: 30000, list: 60000, opts: 120000 }; // ms

/* Pedidos em curso: evita chamadas duplicadas simultâneas */
const _pending = {};

async function apiCall(action,args=[]){
  const r=await fetch(APP_CONFIG.API_URL,{method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action,args})});
  if(!r.ok) throw new Error('Falha de comunicação com o servidor.');
  return await r.json();
}

async function serverCall(fnName,args,onSuccess,onFailure){
  const key = fnName + '|' + JSON.stringify(args||[]);

  // Funções que NÃO devem ser cacheadas (escrita/mutação)
  const noCache = ['Lancamento_create','Lancamento_submit','Approval_decide',
    'User_create','User_toggleActive','Igreja_create','Igreja_toggleActive',
    'Departamento_create','Departamento_toggleActive','Auth_logout'];

  const useCache = !noCache.includes(fnName);
  const ttl = fnName.includes('getFormOptions')||fnName.includes('Opts') ? _TTL.opts
             : fnName.includes('list')||fnName.includes('List')||fnName.includes('listar') ? _TTL.list
             : _TTL.default;

  // Servir do cache se válido
  if(useCache && _cache[key] && Date.now() - _cache[key].ts < ttl){
    if(onSuccess) onSuccess(_cache[key].data);
    return;
  }

  // Se já há pedido igual em curso, encadear callback
  if(useCache && _pending[key]){
    _pending[key].push({onSuccess,onFailure});
    return;
  }

  if(useCache) _pending[key] = [{onSuccess,onFailure}];

  try{
    const res=await apiCall('Server_call',[getToken(),fnName,args||[]]);
    if(res&&res.success===false) throw new Error(res.message||'Erro no servidor.');

    if(useCache){
      _cache[key] = {data:res, ts:Date.now()};
      const cbs = _pending[key]||[];
      delete _pending[key];
      cbs.forEach(cb=>{ try{ if(cb.onSuccess) cb.onSuccess(res); }catch(e){} });
    } else {
      // Invalidar cache de listas relacionadas após mutação
      Object.keys(_cache).forEach(k=>{
        if(k.includes('listAll')||k.includes('listPending')||k.includes('getSummary')||
           k.includes('resumo')||k.includes('getFormOptions')) delete _cache[k];
      });
      if(onSuccess) onSuccess(res);
    }
  }catch(err){
    if(useCache){
      const cbs = _pending[key]||[];
      delete _pending[key];
      cbs.forEach(cb=>{ try{ if(cb.onFailure) cb.onFailure(err); }catch(e){} });
    } else {
      if(onFailure) onFailure(err);
    }
  }
}

/* ── Cache de opções do formulário ── */
let _opts=null;

function getOpts(cb){
  if(_opts){ cb(_opts); return; }
  serverCall('Lancamento_getFormOptions',[],function(res){ _opts=res; cb(res); },function(){ cb(null); });
}

function invalidarCache(){
  Object.keys(_cache).forEach(k=>delete _cache[k]);
  _opts=null;
}

/* helpers para resolver nomes a partir do cache */
function nomeDepto(id){
  if(!_opts||!id) return safeText(id);
  const d=(_opts.departamentos||[]).find(x=>String(x.id_departamento)===String(id));
  return d?safeText(d.nome_departamento):safeText(id);
}
function nomeRubrica(id){
  if(!_opts||!id) return safeText(id);
  const r=(_opts.rubricas||[]).find(x=>String(x.id_rubrica)===String(id));
  return r?safeText(r.nome_rubrica):safeText(id);
}
function nomeGrupo(id){
  if(!_opts||!id) return safeText(id);
  const g=(_opts.grupos||[]).find(x=>String(x.id_grupo)===String(id));
  return g?safeText(g.nome_grupo):safeText(id);
}
function nomeIgreja(id){
  if(!_opts||!id) return safeText(id);
  const i=(_opts.igrejas||[]).find(x=>String(x.id_igreja)===String(id));
  return i?safeText(i.nome_igreja):safeText(id);
}
function nomeConta(id){
  if(!_opts||!id) return safeText(id);
  const c=(_opts.contas||[]).find(x=>String(x.id_conta)===String(id));
  return c?safeText(c.nome_conta):safeText(id);
}

/* ══════════════════════════════════════════════════════
   SHELL
══════════════════════════════════════════════════════ */

function setMainIdentity(user){
  document.getElementById('welcomeText').textContent='👋 Sessão iniciada por '+safeText(user.nome_completo)+'.';
  document.getElementById('kpiUser').textContent   =safeText(user.nome_completo);
  document.getElementById('kpiPerfil').textContent =safeText(user.id_perfil);
  document.getElementById('kpiIgreja').textContent =safeText(user.nome_igreja||user.id_igreja||'-');
}
function setActiveMenu(lbl){ document.querySelectorAll('#menuList li').forEach(li=>li.classList.toggle('active',li.textContent===lbl)); }
function toggleMenu(){
  const btn=document.getElementById('menuToggle'),list=document.getElementById('menuList');
  if(!btn||!list) return; const o=list.classList.toggle('open'); btn.classList.toggle('open',o);
}
function closeMenuOnMobile(){
  if(window.innerWidth<=680){ document.getElementById('menuList')?.classList.remove('open'); document.getElementById('menuToggle')?.classList.remove('open'); }
}
function renderMenu(menu){
  const ul=document.getElementById('menuList'); ul.innerHTML='';
  const src=Array.isArray(menu)&&menu.length?menu:[
    {label:'📊 Dashboard'},{label:'📝 Lançamentos'},{label:'✓ Aprovações'},
    {label:'📈 Orçamentos'},{label:'📄 Relatórios'},{label:'⚙️ Administração'}];
  src.forEach(function(item){
    const lbl=typeof item==='string'?item:(item.label||item.nome||item.modulo||'Sem nome');
    const li=document.createElement('li'); li.textContent=lbl;
    li.addEventListener('click',function(){
      closeMenuOnMobile();
      const k=String(lbl).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
      if(k.includes('dashboard'))     openDashboard();
      else if(k.includes('lancament')) openLancamentos();
      else if(k.includes('aprovac'))   openApprovals();
      else if(k.includes('orcament'))  openOrcamentos();
      else if(k.includes('relator'))   openRelatorios();
      else if(k.includes('administrac')) openAdministracao();
    });
    ul.appendChild(li);
  });
}
function renderApp(user,menu){
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  setMainIdentity(user||{}); renderMenu(menu||[]); _opts=null;
  // pré-carregar opções em background
  getOpts(function(){});
  openDashboard();
  // Mostrar boas-vindas com áudio após login (apenas uma vez)
  setTimeout(showWelcomeAudio, 2000);
}

/* ══════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════ */

async function login(){
  const username=document.getElementById('username').value.trim();
  const password=document.getElementById('password').value;
  document.getElementById('username').value=username;
  if(!username||!password){ showMessage('❌ Preencha username e palavra-passe.',false); return; }
  setLoading(true); showMessage('⏳ A autenticar...',true);
  try{
    const res=await apiCall('Auth_login',[username,password]);
    setLoading(false);
    if(!res||!res.success){ showMessage('❌ '+(res?.message||'Credenciais inválidas.'),false); document.getElementById('password').value=''; return; }
    sessionStorage.setItem('app_token',res.token||'');
    sessionStorage.setItem('app_user',JSON.stringify(res.user||{}));
    sessionStorage.setItem('app_menu',JSON.stringify(res.menu||[]));
    showMessage('✅ Login efectuado!',true);
    setTimeout(()=>renderApp(res.user||{},res.menu||[]),500);
  }catch(err){ setLoading(false); showMessage('❌ Erro: '+(err.message||'Tente novamente.'),false); document.getElementById('password').value=''; }
}
async function logout(){
  // Parar áudio se estiver a tocar
  if(window.speechSynthesis) window.speechSynthesis.cancel();
  try{
    await apiCall('Auth_logout',[getToken()]); sessionStorage.clear(); invalidarCache();
    document.getElementById('appView').classList.add('hidden');
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('username').value=''; document.getElementById('password').value='';
    showMessage('',true);
  }catch(err){ mostrarErro('❌ '+(err.message||'Falha ao terminar sessão')); }
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */

function openDashboard(){
  setActiveMenu('📊 Dashboard');
  document.getElementById('contentTitle').textContent='📊 Dashboard Financeiro';
  const agora=new Date(),anoActual=agora.getFullYear(),mesActual=agora.getMonth()+1;
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosH=''; for(let a=anoActual+1;a>=anoActual-3;a--) anosH+=`<option value="${a}"${a===anoActual?' selected':''}>${a}</option>`;
  const mesesH=meses.map((m,i)=>`<option value="${i+1}"${i+1===mesActual?' selected':''}>${m}</option>`).join('');

  document.getElementById('contentArea').innerHTML=`
    <div class="grid" style="margin-top:0;">
      <div class="card"><div class="card-title">📈 Receitas Aprovadas</div><div id="dashReceitas" class="card-value">0,00 MZN</div></div>
      <div class="card"><div class="card-title">📉 Despesas Aprovadas</div><div id="dashDespesas" class="card-value">0,00 MZN</div></div>
      <div class="card"><div class="card-title">💰 Saldo Aprovado</div><div id="dashSaldo" class="card-value">0,00 MZN</div></div>
      <div class="card"><div class="card-title">⏳ Submetidos</div><div id="dashPendentes" class="card-value">0</div></div>
      <div class="card"><div class="card-title">📝 Rascunhos</div><div id="dashRascunhos" class="card-value">0</div></div>
      <div class="card"><div class="card-title">❌ Rejeitados</div><div id="dashRejeitados" class="card-value">0</div></div>
    </div>
    <div class="box" style="margin-top:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px;">
        <strong>📊 Resumo por Departamento</strong>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%;">
          <select id="dash_mes" style="flex:1;min-width:110px;padding:10px 12px;">${mesesH}</select>
          <select id="dash_ano" style="flex:1;min-width:80px;padding:10px 12px;">${anosH}</select>
          <button class="info" style="width:auto;margin-top:0;padding:10px 18px;" onclick="loadDashDeptos()">Actualizar</button>
        </div>
      </div>
      <div id="dashDeptosWrap" class="muted">A carregar...</div>
    </div>`;

  serverCall('Dashboard_getSummary',[{}],function(s){
    document.getElementById('dashReceitas').textContent  =formatMoney(s?.receitas_aprovadas);
    document.getElementById('dashDespesas').textContent  =formatMoney(s?.despesas_aprovadas);
    document.getElementById('dashSaldo').textContent     =formatMoney(s?.saldo);
    document.getElementById('dashPendentes').textContent =String(s?.pendentes??0);
    document.getElementById('dashRascunhos').textContent =String(s?.rascunhos??0);
    document.getElementById('dashRejeitados').textContent=String(s?.rejeitados??0);
    document.getElementById('kpiSaldo').textContent=formatMoney(s?.saldo);
    const igNome=s?.igreja_nome||'';
    if(igNome) document.getElementById('kpiIgreja').textContent=igNome;
  },function(err){
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
  const nomeMes=['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  serverCall('Dashboard_resumoDeptos',[{ano,mes}],function(res){
    const linhas=Array.isArray(res?.linhas)?res.linhas:[];
    const periodo=`${nomeMes[res?.mes]||mes} ${res?.ano||ano}`;
    const igNome=res?.igreja_nome?` — ${res.igreja_nome}`:'';
    if(!linhas.length){ wrap.innerHTML=`<div class="info">ℹ️ Sem lançamentos aprovados em ${periodo}${igNome}.</div>`; return; }
    wrap.innerHTML=tabelaDeptos(linhas,res)+`<div class="muted" style="margin-top:6px;font-size:12px;">📅 ${periodo}${igNome}</div>`;
  },function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha'}</div>`; });
}

function tabelaDeptos(linhas,res){
  return `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
    <thead><tr><th>Departamento</th><th style="text-align:right;">Entradas</th><th style="text-align:right;">Saídas</th><th style="text-align:right;">Saldo</th></tr></thead>
    <tbody>${linhas.map(l=>`<tr>
      <td><strong>${safeText(l.nome_departamento)}</strong></td>
      <td style="text-align:right;color:#28a745;">${formatMoney(l.entrada)}</td>
      <td style="text-align:right;color:#dc3545;">${formatMoney(l.saida)}</td>
      <td style="text-align:right;font-weight:700;color:${Number(l.saldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(l.saldo)}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr style="border-top:2px solid #dee2e6;font-weight:700;background:#f8f9fa;">
      <td>TOTAL</td>
      <td style="text-align:right;color:#28a745;">${formatMoney(res.totalEntrada)}</td>
      <td style="text-align:right;color:#dc3545;">${formatMoney(res.totalSaida)}</td>
      <td style="text-align:right;color:${Number(res.totalSaldo||0)>=0?'#28a745':'#dc3545'};">${formatMoney(res.totalSaldo)}</td>
    </tr></tfoot>
  </table></div>`;
}

/* ══════════════════════════════════════════════════════
   LANÇAMENTOS
══════════════════════════════════════════════════════ */

function openLancamentos(){
  setActiveMenu('📝 Lançamentos');
  document.getElementById('contentTitle').textContent='📝 Gestão de Lançamentos';
  const agora=new Date();
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let anosH=''; for(let a=agora.getFullYear()+1;a>=agora.getFullYear()-3;a--) anosH+=`<option value="${a}"${a===agora.getFullYear()?' selected':''}>${a}</option>`;
  const mesesH=meses.map((m,i)=>`<option value="${i+1}"${i+1===agora.getMonth()+1?' selected':''}>${m}</option>`).join('');

  document.getElementById('contentArea').innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <strong>📋 Lista de Lançamentos</strong>
        <button class="success" style="width:auto;margin-top:0;padding:9px 18px;" onclick="mostrarFormLancamento()">＋ Novo Lançamento</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <select id="lanc_mes" style="flex:1;min-width:110px;padding:9px 12px;">${mesesH}</select>
        <select id="lanc_ano" style="flex:1;min-width:80px;padding:9px 12px;">${anosH}</select>
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
    </div>`;

  // garantir cache antes de carregar lista
  getOpts(function(){ carregarLancamentos(); });
}

function carregarLancamentos(){
  const wrap=document.getElementById('lancTableWrap'); if(!wrap) return;
  wrap.innerHTML='⏳ A carregar...';
  const estado=document.getElementById('lanc_estado')?.value||'';
  const mes=Number(document.getElementById('lanc_mes')?.value||0);
  const ano=Number(document.getElementById('lanc_ano')?.value||0);
  // Construir filtros apenas com valores válidos (sem undefined)
  const filtros={};
  if(estado) filtros.estado=estado;
  if(mes>0)  filtros.mes=mes;
  if(ano>0)  filtros.ano=ano;
  serverCall('Lancamento_listAll',[filtros],function(res){
    const rows=Array.isArray(res)?res:[];
    if(!rows.length){ wrap.innerHTML='<div class="info">ℹ️ Sem lançamentos para este filtro.</div>'; return; }
    wrap.innerHTML=`<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table>
      <thead><tr><th>Data</th><th>Nº Doc.</th><th>Descrição</th><th>Grupo</th><th>Rubrica</th><th>Departamento</th>
      <th style="text-align:right;">Valor</th><th>Tipo</th><th>Estado</th><th>Acções</th></tr></thead>
      <tbody>${rows.map(l=>`<tr>
        <td style="white-space:nowrap;">${safeText(l.data_movimento)}</td>
        <td style="white-space:nowrap;font-size:11px;color:#6c757d;">${safeText(l.numero_documento)}</td>
        <td>${safeText(l.descricao)}</td>
        <td>${nomeGrupo(l.id_grupo)}</td>
        <td>${nomeRubrica(l.id_rubrica)}</td>
        <td>${nomeDepto(l.id_departamento)}</td>
        <td style="text-align:right;font-weight:600;">${formatMoney(l.valor)}</td>
        <td style="white-space:nowrap;">${l.tipo_movimento==='RECEITA'?'📈 Receita':'📉 Despesa'}</td>
        <td>${statusBadge(l.estado)}</td>
        <td class="row-actions">${l.estado==='RASCUNHO'?`
          <button class="success" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="submeterLancamento('${l.id_lancamento}')">📤 Submeter</button>`:''}
          <button class="info" style="font-size:12px;padding:6px 10px;min-height:32px;" onclick="abrirAnexos('${l.id_lancamento}','${safeText(l.descricao).replace(/'/g,"\\'")}',${l.tem_anexo?'true':'false'})">${l.tem_anexo?'📎 Ver':'📎 Anexar'}</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  },function(err){ wrap.innerHTML=`<div class="err">❌ ${err?.message||'Falha ao carregar lançamentos'}</div>`; });
}

function mostrarFormLancamento(){
  const agora=new Date();
  document.getElementById('contentArea').innerHTML=`
    <div class="box" style="margin-top:0;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
        <button class="secondary" style="width:auto;margin-top:0;padding:8px 16px;font-size:14px;" onclick="openLancamentos()">← Voltar à lista</button>
        <strong style="font-size:16px;">＋ Novo Lançamento</strong>
      </div>
      <div id="msgLanc" class="msg" style="margin-bottom:4px;"></div>
      <div class="section-grid">
        <div>
          <label>Tipo de Movimento *</label>
          <select id="fl_tipo" onchange="actualizarRubricas()">
            <option value="RECEITA">📈 Receita</option>
            <option value="DESPESA">📉 Despesa</option>
          </select>
          <label>Data *</label>
          <input type="date" id="fl_data" value="${agora.toISOString().split('T')[0]}">
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

      <hr class="soft">

      <!-- Comprovativo -->
      <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:12px;padding:16px;margin-bottom:4px;">
        <label style="margin:0 0 8px;display:block;">📎 Comprovativo <span style="color:#6c757d;font-weight:400;font-size:12px;">(opcional — PDF, imagem, Word, Excel — máx. 10MB)</span></label>
        <input type="file" id="fl_comprovativo" accept=".pdf,.jpg,.jpeg,.png,.gif,.xlsx,.xls,.doc,.docx"
          style="width:100%;padding:10px;border:2px dashed #dee2e6;border-radius:10px;font-size:13px;cursor:pointer;background:#fff;">
        <div id="fl_comp_preview" style="margin-top:8px;font-size:12px;color:#6c757d;"></div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
        <button class="secondary" style="width:auto;margin-top:0;padding:11px 22px;" onclick="openLancamentos()">✖ Cancelar</button>
        <button class="info" style="width:auto;margin-top:0;padding:11px 22px;" onclick="guardarLancamento('RASCUNHO')">💾 Guardar Rascunho</button>
        <button class="success" style="width:auto;margin-top:0;padding:11px 22px;" onclick="guardarLancamento('SUBMETER')">📤 Submeter para Aprovação</button>
      </div>
    </div>`;

  // Preview do ficheiro seleccionado
  document.getElementById('fl_comprovativo')?.addEventListener('change', function(){
    const f=this.files[0];
    const prev=document.getElementById('fl_comp_preview');
    if(!f){ prev.innerHTML=''; return; }
    const size=(f.size/1024).toFixed(0);
    prev.innerHTML=`✅ <strong>${f.name}</strong> (${size} KB) — pronto para carregar`;
    prev.style.color='#155724';
  });

  getOpts(function(opts){
    if(!opts){ showMessage('❌ Erro ao carregar opções do formulário.',false,'msgLanc'); return; }
    const selI=document.getElementById('fl_igreja');
    if(selI){
      selI.innerHTML='<option value="">Todas / N/A</option>'+
        (opts.igrejas||[]).map(i=>`<option value="${i.id_igreja}">${safeText(i.nome_igreja)}</option>`).join('');
      if(opts.contexto?.id_igreja) selI.value=opts.contexto.id_igreja;
    }
    const selD=document.getElementById('fl_depto');
    if(selD){
      selD.innerHTML='<option value="">Seleccione departamento</option>'+
        (opts.departamentos||[]).map(d=>`<option value="${d.id_departamento}">${safeText(d.nome_departamento)}</option>`).join('');
      if(opts.contexto?.id_departamento) selD.value=opts.contexto.id_departamento;
    }
    const selG=document.getElementById('fl_grupo');
    if(selG){
      selG.innerHTML='<option value="">Seleccione grupo</option>'+
        (opts.grupos||[]).map(g=>`<option value="${g.id_grupo}">${safeText(g.nome_grupo)}</option>`).join('');
    }
    const selC=document.getElementById('fl_conta');
    if(selC){
      selC.innerHTML='<option value="">Seleccione conta</option>'+
        (opts.contas||[]).map(c
