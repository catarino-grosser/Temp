import {
  auth, db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  deleteDoc
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const screens = { auth: $("authScreen"), home: $("homeScreen"), chat: $("chatScreen"), diary: $("diaryScreen"), memories: $("memoriesScreen"), settings: $("settingsScreen") };
const logoutButton = $("logoutButton"), authForm = $("authForm"), toggleAuthButton = $("toggleAuthButton"), authSubmitButton = $("authSubmitButton"), authMessage = $("authMessage"), nameInput = $("nameInput"), emailInput = $("emailInput"), passwordInput = $("passwordInput");
const welcomeTitle = $("welcomeTitle"), dailyGreeting = $("dailyGreeting"), memoryText = $("memoryText"), friendshipText = $("friendshipText"), brandButton = $("brandButton");
const accessCard = $("accessCard"), accessTitle = $("accessTitle"), accessText = $("accessText"), openPaymentButton = $("openPaymentButton"), paymentBox = $("paymentBox"), createPixButton = $("createPixButton"), pixArea = $("pixArea"), pixQrImage = $("pixQrImage"), pixCodeInput = $("pixCodeInput"), copyPixButton = $("copyPixButton"), checkPixButton = $("checkPixButton"), paymentStatus = $("paymentStatus");
const chat = $("chat"), chatForm = $("chatForm"), messageInput = $("messageInput"), sendButton = $("sendButton"), connectionStatus = $("connectionStatus"), avatar = $("avatar"), quotaText = $("quotaText");
const voiceButton = $("voiceButton"), stopVoiceButton = $("stopVoiceButton");
const moodSelect = $("moodSelect"), diaryInput = $("diaryInput"), diaryList = $("diaryList"), memoriesList = $("memoriesList"), manualMemoryInput = $("manualMemoryInput");
const voiceEnabledInput = $("voiceEnabledInput"), dailyLimitInput = $("dailyLimitInput"), personalitySelect = $("personalitySelect");

let isRegisterMode = false;
let currentUser = null;
let profile = null;
let messages = [];
let memories = [];
let diaryEntries = [];
let settings = { voiceEnabled: true, dailyLimit: 30, personality: "amigo" };
let dailyUsage = 0;
let isSending = false;
let currentPaymentId = null;
let accessUntilDate = null;

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function firstName() {
  return (profile?.name || currentUser?.displayName || "amigo").split(" ")[0];
}
function getAccessUntilDate() {
  const raw = profile?.accessUntil || profile?.freeTrialUntil;
  if (!raw) return null;
  if (raw.toDate) return raw.toDate();
  if (typeof raw === "string" || typeof raw === "number") return new Date(raw);
  if (raw.seconds) return new Date(raw.seconds * 1000);
  return null;
}

function hasActiveAccess() {
  accessUntilDate = getAccessUntilDate();
  return accessUntilDate && accessUntilDate.getTime() > Date.now();
}

function formatAccessDate(date) {
  if (!date) return "sem acesso ativo";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function renderAccess() {
  const active = hasActiveAccess();
  accessCard.classList.toggle("expired", !active);
  openPaymentButton.classList.toggle("hidden", active);
  accessTitle.textContent = active ? "Acesso liberado" : "Acesso expirado";
  accessText.textContent = active
    ? `Você pode conversar com o Ted até ${formatAccessDate(accessUntilDate)}.`
    : "Para conversar com o Ted, desbloqueie mais 24 horas por R$ 1,00 via Pix.";
}

async function callJsonFunction(path, payload = {}) {
  const token = await currentUser.getIdToken();
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Resposta inválida da Function: ${text.slice(0, 120)}`); }
  if (!response.ok) throw new Error(data.detail || data.error || "Erro na Function.");
  return data;
}

async function refreshProfile() {
  await loadProfile();
  renderAccess();
}


function formatDate(date) {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
  catch { return ""; }
}

function setAuthMode(register) {
  isRegisterMode = register;
  nameInput.classList.toggle("hidden", !register);
  authSubmitButton.textContent = register ? "Criar conta" : "Entrar";
  toggleAuthButton.textContent = register ? "Já tenho conta. Quero entrar." : "Ainda não tenho conta. Quero me cadastrar.";
  authMessage.textContent = "";
}

function friendlyFirebaseError(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "Este e-mail já está cadastrado.";
  if (code.includes("invalid-email")) return "Digite um e-mail válido.";
  if (code.includes("weak-password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (code.includes("invalid-credential")) return "E-mail ou senha incorretos.";
  if (code.includes("user-not-found")) return "Usuário não encontrado.";
  if (code.includes("wrong-password")) return "Senha incorreta.";
  return "Não consegui completar esta ação. Tente novamente.";
}

async function loadProfile() {
  const ref = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    profile = snap.data();
  } else {
    // Perfil temporário local. O cadastro real e o acesso grátis são criados pela Function init-user.
    profile = { name: currentUser.displayName || "amigo", email: currentUser.email, plan: "free" };
  }
}

async function loadSettings() {
  const snap = await getDoc(doc(db, "users", currentUser.uid, "settings", "main"));
  settings = snap.exists() ? { ...settings, ...snap.data() } : settings;
  voiceEnabledInput.checked = !!settings.voiceEnabled;
  dailyLimitInput.value = settings.dailyLimit || 30;
  personalitySelect.value = settings.personality || "amigo";
}

async function saveSettings() {
  await setDoc(doc(db, "users", currentUser.uid, "settings", "main"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

async function loadMemories() {
  memories = [];
  const snap = await getDocs(query(collection(db, "users", currentUser.uid, "memories"), orderBy("createdAt", "desc"), limit(30)));
  snap.forEach((item) => memories.push({ id: item.id, ...item.data() }));
}

async function loadDiary() {
  diaryEntries = [];
  const snap = await getDocs(query(collection(db, "users", currentUser.uid, "diary"), orderBy("createdAt", "desc"), limit(12)));
  snap.forEach((item) => diaryEntries.push({ id: item.id, ...item.data() }));
}

async function loadMessages() {
  messages = [];
  chat.innerHTML = "";
  const snap = await getDocs(query(collection(db, "users", currentUser.uid, "messages"), orderBy("createdAt", "asc"), limit(60)));
  snap.forEach((item) => {
    const data = { id: item.id, ...item.data() };
    messages.push(data);
    addMessage(data.text, data.role);
  });
  if (messages.length === 0) {
    addMessage(`Oi, ${firstName()}! Eu sou o Ted. Como você está hoje?`, "ted");
  }
}

async function loadDailyUsage() {
  const snap = await getDoc(doc(db, "users", currentUser.uid, "usage", todayKey()));
  dailyUsage = snap.exists() ? Number(snap.data().count || 0) : 0;
  updateQuotaText();
}

async function incrementDailyUsage() {
  dailyUsage += 1;
  await setDoc(doc(db, "users", currentUser.uid, "usage", todayKey()), { count: dailyUsage, updatedAt: serverTimestamp() }, { merge: true });
  updateQuotaText();
}

function updateQuotaText() {
  quotaText.textContent = `Uso de hoje: ${dailyUsage}/${settings.dailyLimit || 30} mensagens com IA.`;
}

function friendshipLevel() {
  const score = messages.length + memories.length * 3 + diaryEntries.length * 2;
  if (score >= 80) return "companheiro de jornada";
  if (score >= 40) return "grande amigo";
  if (score >= 12) return "amigo";
  return "novo amigo";
}

function renderHome() {
  welcomeTitle.textContent = `Olá, ${firstName()}!`;
  const hour = new Date().getHours();
  const part = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const lastMood = diaryEntries[0]?.mood;
  dailyGreeting.textContent = lastMood ? `${part}. No último diário você marcou que estava: ${lastMood}. Como está agora?` : `${part}. Como você está se sentindo hoje?`;
  friendshipText.textContent = `Nível de amizade: ${friendshipLevel()}`;
  memoryText.textContent = memories.length ? memories.slice(0, 5).map((m) => `• ${m.text}`).join("\n") : "Ainda não tenho memórias salvas. Você pode adicionar uma memória ou me contar algo importante no chat.";
  renderAccess();
}

function renderMemories() {
  memoriesList.innerHTML = memories.length ? "" : `<div class="list-item">Nenhuma memória salva ainda.</div>`;
  memories.forEach((m) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.textContent = m.text;
    const small = document.createElement("small");
    small.textContent = m.source === "auto" ? "Memória criada automaticamente" : "Memória adicionada por você";
    div.appendChild(small);
    memoriesList.appendChild(div);
  });
}

function renderDiary() {
  diaryList.innerHTML = diaryEntries.length ? "" : `<div class="list-item">Nenhum registro no diário ainda.</div>`;
  diaryEntries.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.textContent = entry.text;
    const small = document.createElement("small");
    const date = entry.createdAt?.toDate ? formatDate(entry.createdAt.toDate()) : "";
    small.textContent = `Humor: ${entry.mood || "não informado"}${date ? " • " + date : ""}`;
    div.appendChild(small);
    diaryList.appendChild(div);
  });
}

function addMessage(text, role, loading = false) {
  const div = document.createElement("div");
  div.className = `message ${role}${loading ? " loading" : ""}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

async function saveMessage(text, role) {
  const data = { text, role, createdAt: serverTimestamp() };
  await addDoc(collection(db, "users", currentUser.uid, "messages"), data);
  messages.push({ text, role });
}

function setAvatarMood(mood) {
  avatar.classList.remove("mood-happy", "mood-calm", "mood-sad", "mood-thinking", "mood-excited");
  avatar.classList.add(`mood-${mood}`);
}

function detectMood(text) {
  const lower = text.toLowerCase();
  if (/(parabéns|ótimo|legal|feliz|boa|excelente|bacana|conseguiu)/.test(lower)) return "excited";
  if (/(triste|difícil|cansado|preocupado|ansioso|sinto muito)/.test(lower)) return "sad";
  if (/(pensar|ideia|talvez|vamos organizar|passo)/.test(lower)) return "thinking";
  if (/(calma|respira|tranquilo|leve)/.test(lower)) return "calm";
  return "happy";
}

function speak(text) {
  if (!settings.voiceEnabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onstart = () => avatar.classList.add("talking");
  utterance.onend = () => avatar.classList.remove("talking");
  utterance.onerror = () => avatar.classList.remove("talking");
  window.speechSynthesis.speak(utterance);
}

async function talkToTed(message) {
  const response = await fetch("/.netlify/functions/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      userName: firstName(),
      personality: settings.personality,
      history: messages.slice(-10),
      memories: memories.slice(0, 12),
      diary: diaryEntries.slice(0, 3)
    })
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Resposta inválida da Function: ${text.slice(0, 120)}`); }
  if (!response.ok) throw new Error(data.detail || data.error || "Erro desconhecido na Function.");
  return data;
}

async function maybeCaptureMemory(message) {
  const lower = message.toLowerCase();
  const patterns = ["meu nome é", "eu trabalho", "eu estudo", "eu moro", "eu vendo", "eu gosto", "minha meta", "meu objetivo", "estou aprendendo", "quero criar"];
  if (!patterns.some((p) => lower.includes(p))) return;
  const text = message.slice(0, 260);
  try {
    await addDoc(collection(db, "users", currentUser.uid, "memories"), { text, createdAt: serverTimestamp(), source: "auto" });
    await loadMemories();
    renderHome();
  } catch (e) { console.error("Erro ao criar memória:", e); }
}

async function sendMessage(raw) {
  if (isSending) return;
  const message = String(raw || "").trim();
  if (!message) return;

  await refreshProfile();
  if (!hasActiveAccess()) {
    addMessage("Seu acesso ao Ted expirou. Volte à página inicial e desbloqueie mais 24 horas por R$ 1,00 no Pix.", "ted");
    speak("Seu acesso ao Ted expirou. Volte à página inicial e desbloqueie mais 24 horas no Pix.");
    return;
  }

  if (dailyUsage >= Number(settings.dailyLimit || 30) && !isLikelyLocal(message)) {
    addMessage(`Você atingiu o limite diário de ${settings.dailyLimit} mensagens com IA. Ainda posso responder saudações simples hoje.`, "ted");
    return;
  }

  isSending = true;
  sendButton.disabled = true;
  connectionStatus.textContent = "Ted está pensando...";
  avatar.classList.add("thinking");
  setAvatarMood("thinking");
  messageInput.value = "";

  addMessage(message, "user");
  try { await saveMessage(message, "user"); } catch (e) { console.error("Erro ao salvar mensagem:", e); }

  const loading = addMessage("Ted está digitando...", "ted", true);

  try {
    const data = await talkToTed(message);
    const reply = data.reply || "Estou aqui com você. Pode me contar um pouco mais?";
    loading.remove();
    addMessage(reply, "ted");
    setAvatarMood(detectMood(reply));
    try { await saveMessage(reply, "ted"); } catch (e) { console.error("Erro ao salvar resposta:", e); }
    if (data.source === "gemini") await incrementDailyUsage();
    await maybeCaptureMemory(message);
    speak(reply);
  } catch (error) {
    console.error(error);
    loading.remove();
    addMessage(`Tive uma dificuldade técnica para responder agora. Detalhe: ${error.message}`, "ted");
    setAvatarMood("sad");
  } finally {
    isSending = false;
    sendButton.disabled = false;
    avatar.classList.remove("thinking");
    connectionStatus.textContent = "Pronto para conversar";
    messageInput.focus();
  }
}

function isLikelyLocal(message) {
  const t = normalize(message);
  return ["oi", "ola", "bom dia", "boa tarde", "boa noite", "obrigado", "obrigada", "valeu", "tchau", "o que voce consegue fazer", "voce consegue fazer o que por aqui"].includes(t);
}

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.,]/g, "").trim();
}

// Eventos
toggleAuthButton.addEventListener("click", () => setAuthMode(!isRegisterMode));
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";
  authSubmitButton.disabled = true;
  const name = nameInput.value.trim(), email = emailInput.value.trim(), password = passwordInput.value.trim();
  try {
    if (isRegisterMode) {
      if (!name) { authMessage.textContent = "Digite seu nome para criar a conta."; return; }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      currentUser = cred.user;
      await updateProfile(cred.user, { displayName: name });
      await callJsonFunction("/.netlify/functions/init-user", { name, email });
      await setDoc(doc(db, "users", cred.user.uid, "settings", "main"), settings, { merge: true });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (e) {
    console.error(e);
    authMessage.textContent = friendlyFirebaseError(e);
  } finally {
    authSubmitButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    logoutButton.classList.add("hidden");
    showScreen("auth");
    return;
  }
  logoutButton.classList.remove("hidden");
  try { await callJsonFunction("/.netlify/functions/init-user", { name: user.displayName || "amigo", email: user.email }); } catch (e) { console.warn("init-user:", e.message); }
  await loadProfile();
  await loadSettings();
  await loadMemories();
  await loadDiary();
  await loadDailyUsage();
  await loadMessages();
  renderHome();
  showScreen("home");
});

logoutButton.addEventListener("click", () => signOut(auth));
brandButton.addEventListener("click", () => currentUser ? showScreen("home") : showScreen("auth"));
$("openChatButton").addEventListener("click", async () => {
  await refreshProfile();
  if (!hasActiveAccess()) {
    paymentBox.classList.remove("hidden");
    paymentStatus.textContent = "Seu acesso expirou. Gere um Pix para liberar mais 24 horas.";
    paymentStatus.className = "small-text payment-wait";
    return;
  }
  showScreen("chat");
  await loadMessages();
  await loadDailyUsage();
  messageInput.focus();
});
$("openDiaryButton").addEventListener("click", () => { renderDiary(); showScreen("diary"); });
$("openMemoriesButton").addEventListener("click", () => { renderMemories(); showScreen("memories"); });
$("openSettingsButton").addEventListener("click", () => showScreen("settings"));
document.querySelectorAll(".backHomeButton").forEach((b) => b.addEventListener("click", () => { renderHome(); showScreen("home"); }));
chatForm.addEventListener("submit", (e) => { e.preventDefault(); sendMessage(messageInput.value); });
document.querySelectorAll(".quick-replies button").forEach((b) => b.addEventListener("click", () => sendMessage(b.dataset.msg)));

voiceButton.addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { alert("Seu navegador não suporta reconhecimento de voz. Tente pelo Chrome."); return; }
  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voiceButton.textContent = "🎧 Ouvindo...";
  recognition.start();
  recognition.onresult = (event) => sendMessage(event.results[0][0].transcript);
  recognition.onerror = () => alert("Não consegui ouvir bem. Tente novamente.");
  recognition.onend = () => voiceButton.textContent = "🎤 Falar";
});

stopVoiceButton.addEventListener("click", () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  avatar.classList.remove("talking");
});

$("saveDiaryButton").addEventListener("click", async () => {
  const text = diaryInput.value.trim();
  if (!text) return alert("Escreva algo antes de salvar.");
  await addDoc(collection(db, "users", currentUser.uid, "diary"), { text, mood: moodSelect.value, createdAt: serverTimestamp() });
  diaryInput.value = "";
  await loadDiary();
  renderDiary();
  renderHome();
  alert("Registro salvo.");
});

$("addMemoryButton").addEventListener("click", async () => {
  const text = manualMemoryInput.value.trim();
  if (!text) return alert("Digite uma memória.");
  await addDoc(collection(db, "users", currentUser.uid, "memories"), { text, createdAt: serverTimestamp(), source: "manual" });
  manualMemoryInput.value = "";
  await loadMemories();
  renderMemories();
  renderHome();
});

$("saveSettingsButton").addEventListener("click", async () => {
  settings = { voiceEnabled: voiceEnabledInput.checked, dailyLimit: Number(dailyLimitInput.value || 30), personality: personalitySelect.value };
  await saveSettings();
  updateQuotaText();
  alert("Configurações salvas.");
});

$("clearHistoryButton").addEventListener("click", async () => {
  if (!confirm("Apagar todo o histórico do chat?")) return;
  const snap = await getDocs(query(collection(db, "users", currentUser.uid, "messages")));
  for (const item of snap.docs) await deleteDoc(doc(db, "users", currentUser.uid, "messages", item.id));
  messages = [];
  chat.innerHTML = "";
  addMessage(`Histórico apagado. Estou aqui de novo, ${firstName()}.`, "ted");
  renderHome();
  alert("Histórico apagado.");
});

openPaymentButton.addEventListener("click", () => {
  paymentBox.classList.toggle("hidden");
  if (!paymentBox.classList.contains("hidden")) paymentBox.scrollIntoView({ behavior: "smooth", block: "center" });
});

createPixButton.addEventListener("click", async () => {
  createPixButton.disabled = true;
  paymentStatus.textContent = "Gerando Pix...";
  paymentStatus.className = "small-text payment-wait";
  try {
    const data = await callJsonFunction("/.netlify/functions/create-pix", {});
    currentPaymentId = data.paymentId;
    pixArea.classList.remove("hidden");
    pixQrImage.src = data.qrCodeBase64 ? `data:image/png;base64,${data.qrCodeBase64}` : "";
    pixQrImage.classList.toggle("hidden", !data.qrCodeBase64);
    pixCodeInput.value = data.qrCode || "";
    paymentStatus.textContent = "Pix gerado. Após pagar, toque em verificar.";
    paymentStatus.className = "small-text payment-wait";
  } catch (error) {
    console.error(error);
    paymentStatus.textContent = `Erro ao gerar Pix: ${error.message}`;
    paymentStatus.className = "small-text payment-error";
  } finally {
    createPixButton.disabled = false;
  }
});

copyPixButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(pixCodeInput.value);
    paymentStatus.textContent = "Código Pix copiado.";
    paymentStatus.className = "small-text payment-ok";
  } catch {
    pixCodeInput.select();
    document.execCommand("copy");
    paymentStatus.textContent = "Código Pix copiado.";
    paymentStatus.className = "small-text payment-ok";
  }
});

checkPixButton.addEventListener("click", async () => {
  if (!currentPaymentId) return alert("Gere um Pix primeiro.");
  checkPixButton.disabled = true;
  paymentStatus.textContent = "Verificando pagamento...";
  paymentStatus.className = "small-text payment-wait";
  try {
    const data = await callJsonFunction("/.netlify/functions/check-pix", { paymentId: currentPaymentId });
    if (data.approved) {
      await refreshProfile();
      paymentStatus.textContent = `Pagamento aprovado. Acesso liberado até ${formatAccessDate(accessUntilDate)}.`;
      paymentStatus.className = "small-text payment-ok";
      renderHome();
    } else {
      paymentStatus.textContent = `Pagamento ainda não aprovado. Status: ${data.status || "pendente"}.`;
      paymentStatus.className = "small-text payment-wait";
    }
  } catch (error) {
    console.error(error);
    paymentStatus.textContent = `Erro ao verificar: ${error.message}`;
    paymentStatus.className = "small-text payment-error";
  } finally {
    checkPixButton.disabled = false;
  }
});


setAuthMode(false);
