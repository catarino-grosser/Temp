const chatForm = document.querySelector('#chatForm');
const messageInput = document.querySelector('#messageInput');
const chatMessages = document.querySelector('#chatMessages');
const avatar = document.querySelector('#avatar3d');
const voiceToggle = document.querySelector('#voiceToggle');
const stopVoice = document.querySelector('#stopVoice');
const micButton = document.querySelector('#micButton');
const connectionStatus = document.querySelector('#connectionStatus');
const avatarBubble = document.querySelector('#avatarBubble');

let voiceEnabled = true;
let conversation = [
  {
    role: 'model',
    text: 'Oi! Eu sou o Ted. Que bom ver você por aqui. Como você está se sentindo hoje?'
  }
];

function addMessage(text, sender = 'bot', extraClass = '') {
  const article = document.createElement('article');
  article.className = `message ${sender} ${extraClass}`.trim();
  article.innerHTML = `<p>${escapeHTML(text)}</p>`;
  chatMessages.appendChild(article);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return article;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

function setSpeaking(isSpeaking) {
  avatar.classList.toggle('speaking', isSpeaking);
  avatar.classList.toggle('idle', !isSpeaking);
}

function shortBubble(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  avatarBubble.textContent = clean.length > 55 ? `${clean.slice(0, 55)}...` : clean || 'Estou aqui.';
}

function choosePortugueseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang.startsWith('pt')) || null;
}

function speak(text) {
  shortBubble(text);
  if (!voiceEnabled || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.94;
  utterance.pitch = 1.04;

  const voice = choosePortugueseVoice();
  if (voice) utterance.voice = voice;

  utterance.onstart = () => setSpeaking(true);
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  window.speechSynthesis.speak(utterance);
}

async function sendToFriend(userText) {
  const loading = addMessage('Estou pensando com carinho no que você disse...', 'bot', 'loading');
  setSpeaking(true);
  shortBubble('Estou pensando...');

  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, history: conversation.slice(-12) })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro ao conversar com a IA.');

    loading.remove();
    conversation.push({ role: 'user', text: userText });
    conversation.push({ role: 'model', text: data.reply });
    addMessage(data.reply, 'bot');
    connectionStatus.textContent = 'Online';
    speak(data.reply);
  } catch (error) {
    loading.remove();
    connectionStatus.textContent = 'Modo local';
    const fallback = 'Eu não consegui acessar a IA agora, mas estou aqui com você. Me conte um pouco mais, com calma.';
    addMessage(fallback, 'bot');
    speak(fallback);
    console.error(error);
  } finally {
    setTimeout(() => {
      if (!window.speechSynthesis?.speaking) setSpeaking(false);
    }, 500);
  }
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const userText = messageInput.value.trim();
  if (!userText) return;
  addMessage(userText, 'user');
  messageInput.value = '';
  await sendToFriend(userText);
});

voiceToggle.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  voiceToggle.textContent = voiceEnabled ? '🔊 Voz ligada' : '🔇 Voz desligada';
  if (!voiceEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }
});

stopVoice.addEventListener('click', () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  setSpeaking(false);
});

micButton.addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addMessage('Seu navegador não liberou reconhecimento de voz. Você pode digitar normalmente.', 'bot');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  micButton.textContent = '🎧';
  recognition.start();

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    messageInput.value = text;
    micButton.textContent = '🎙️';
    chatForm.requestSubmit();
  };
  recognition.onerror = () => {
    micButton.textContent = '🎙️';
    addMessage('Não consegui ouvir bem. Tente de novo ou digite a mensagem.', 'bot');
  };
  recognition.onend = () => {
    micButton.textContent = '🎙️';
  };
});

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = choosePortugueseVoice;
}
