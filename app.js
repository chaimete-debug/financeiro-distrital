/* ========== TOUR GUIADO E ÁUDIO ========== */

let currentStep = 0;
const totalSteps = 7;

function startTour() {
  const modal = document.getElementById('tourModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  currentStep = 0;
  showTourStep(0);
  highlightUITour(0);
}

function closeTour() {
  const modal = document.getElementById('tourModal');
  if (modal) modal.classList.add('hidden');
  document.querySelectorAll('.highlight-element').forEach(el => {
    el.classList.remove('highlight-element');
  });
}

function showTourStep(step) {
  const slides = document.querySelectorAll('.tour-slide');
  slides.forEach((slide, idx) => {
    slide.classList.toggle('active', idx === step);
  });
  const prevBtn = document.querySelector('.tour-prev');
  const nextBtn = document.querySelector('.tour-next');
  if (prevBtn) prevBtn.disabled = step === 0;
  if (nextBtn) nextBtn.textContent = step === totalSteps - 1 ? '✅ Concluir' : 'Próximo ▶';
  narrateStep(step);
}

function tourNext() {
  if (currentStep < totalSteps - 1) {
    currentStep++;
    showTourStep(currentStep);
    highlightUITour(currentStep);
  } else {
    closeTour();
    showMessage('🎓 Tour concluído! Explore o sistema à vontade.', true);
  }
}

function tourPrev() {
  if (currentStep > 0) {
    currentStep--;
    showTourStep(currentStep);
    highlightUITour(currentStep);
  }
}

function highlightUITour(step) {
  document.querySelectorAll('.highlight-element').forEach(el => {
    el.classList.remove('highlight-element');
  });
  
  const highlights = {
    2: () => {
      const dashboardCards = document.querySelectorAll('.grid .card');
      dashboardCards.forEach(card => card.classList.add('highlight-element'));
      setTimeout(() => {
        dashboardCards.forEach(card => card.classList.remove('highlight-element'));
      }, 3000);
    },
    3: () => {
      const menuItems = document.querySelectorAll('#menuList li');
      const lancamentoItem = Array.from(menuItems).find(li => li.textContent.includes('Lançamento'));
      if (lancamentoItem) lancamentoItem.classList.add('highlight-element');
    },
    4: () => {
      const menuItems = document.querySelectorAll('#menuList li');
      const aprovItem = Array.from(menuItems).find(li => li.textContent.includes('Aprovação'));
      if (aprovItem) aprovItem.classList.add('highlight-element');
    },
    6: () => {
      const menuItems = document.querySelectorAll('#menuList li');
      const adminItem = Array.from(menuItems).find(li => li.textContent.includes('Administração'));
      if (adminItem) adminItem.classList.add('highlight-element');
    }
  };
  
  if (highlights[step]) highlights[step]();
}

function narrateStep(step) {
  const texts = [
    "Bem-vindo ao Sistema Financeiro Distrital. Este tour vai explicar as principais funcionalidades.",
    "Faça login com as suas credenciais para aceder ao sistema.",
    "No Dashboard, acompanhe receitas, despesas, saldo e lançamentos pendentes.",
    "Na secção Lançamentos, crie novos registos financeiros e anexe comprovativos.",
    "Nas Aprovações, acompanhe o fluxo de aprovação em dois níveis.",
    "Nos Orçamentos e Relatórios, analise dados financeiros detalhados.",
    "Na Administração, gestione utilizadores, perfis, departamentos e igrejas."
  ];
  
  if (window.speechSynthesis && texts[step]) {
    const utterance = new SpeechSynthesisUtterance(texts[step]);
    utterance.lang = 'pt-PT';
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
}

let isSpeaking = false;

function playAudioExplanation() {
  if (isSpeaking) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    const btn = document.getElementById('audioFab');
    if (btn) {
      btn.style.opacity = '1';
      btn.innerHTML = '🔊';
    }
    return;
  }
  
  const explanationText = `Bem-vindo ao Sistema Financeiro Distrital. Este sistema gere finanças de igrejas e departamentos a nível distrital. O fluxo principal: primeiro, faça login com as suas credenciais. No Dashboard, vê receitas, despesas, saldo e pendentes. Nos Lançamentos, crie receitas ou despesas, anexe comprovativos e submeta para aprovação. As Aprovações têm dois níveis: Tesoureiro Distrital aprova primeiro, depois Administrador Geral. Nos Orçamentos e Relatórios, analise dados financeiros. Na Administração, gestione utilizadores, perfis, departamentos e igrejas. Cada perfil tem permissões específicas. Para mais detalhes, contacte o suporte.`;
  
  if (!window.speechSynthesis) {
    mostrarErro('O seu navegador não suporta síntese de voz.');
    return;
  }
  
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(explanationText);
  utterance.lang = 'pt-PT';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1;
  
  utterance.onstart = () => {
    isSpeaking = true;
    const btn = document.getElementById('audioFab');
    if (btn) {
      btn.style.opacity = '0.7';
      btn.innerHTML = '⏹️';
      btn.title = 'Parar explicação';
    }
    showMessage('🎤 A explicar o funcionamento do sistema...', true);
  };
  
  utterance.onend = () => {
    isSpeaking = false;
    const btn = document.getElementById('audioFab');
    if (btn) {
      btn.style.opacity = '1';
      btn.innerHTML = '🔊
