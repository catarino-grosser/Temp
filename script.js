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
  deleteDoc,
  updateDoc
} from "./firebase.js";

const $ = (id) => document.getElementById(id);
const screens = { auth: $("authScreen"), home: $("homeScreen"), chat: $("chatScreen"), diary: $("diaryScreen"), memories: $("memoriesScreen"), settings: $("settingsScreen"), payment: $("paymentScreen") };
const logoutButton = $("logoutButton"), authForm = $("authForm"), toggleAuthButton = $("toggleAuthButton"), authSubmitButton = $("authSubmitButton"), authMessage = $("authMessage"), nameInput = $("nameInput"), emailInput = $("emailInput"), passwordInput = $("passwordInput");
const welcomeTitle = $("welcomeTitle"), dailyGreeting = $("dailyGreeting"), memoryText = $("memoryText"), friendshipText = $("friendshipText"), accessText = $("accessText"), brandButton = $("brandButton");
const chat = $("chat"), chatForm = $("chatForm"), messageInput = $("messageInput"), sendButton = $("sendButton"), connectionStatus = $("connectionStatus"), avatar = $("avatar"), quotaText = $("quotaText");
const voiceButton = $("voiceButton"), stopVoiceButton = $("stopVoiceButton");
const moodSelect = $("moodSelect"), diaryInput = $("diaryInput"), diaryList = $("diaryList"), memoriesList = $("memoriesList"), manualMemoryInput = $("manualMemoryInput");
const paymentAccessText = $("paymentAccessText"), payNameInput = $("payNameInput"), payLastnameInput = $("payLastnameInput"), payEmailInput = $("payEmailInput"), payCpfInput = $("payCpfInput"), generatePixButton = $("generatePixButton"), pixCard = $("pixCard"), pixQrImage = $("pixQrImage"), pixCodeText = $("pixCodeText"), copyPixButton = $("copyPixButton"), pixStatusText = $("pixStatusText"), cancelPixButton = $("cancelPixButton");
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
let pixCheckTimer = null;
let currentPaymentId = null;

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

function formatDate(date) {
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date); }
  catch { return ""; }
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function accessUntilDate() {
  return toDate(profile?.accessUntil);
}

function hasActiveAccess() {
  const until = accessUntilDate();
  return !!until && until.getTime() > Date.now();
}

function accessStatusText() {
  const until = accessUntilDate();
  if (!until) return "Acesso não liberado.";
  if (until.getTime() > Date.now()) return `Acesso liberado até ${formatDate(until)}.`;
  return `Acesso expirado em ${formatDate(until)}.`;
}

async function grantAccess24h() {
  const base = Math.max(Date.now(), accessUntilDate()?.getTime() || 0);
  const newUntil = new Date(base + 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, "users", currentUser.uid), { accessUntil: newUntil, lastPaymentAt: serverTimestamp() });
  profile = { ...profile, accessUntil: newUntil };
  renderHome();
  updatePaymentText();
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
    profile = { name: currentUser.displayName || "amigo", email: currentUser.email, createdAt: serverTimestamp(), plan: "free", accessUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) };
    await setDoc(ref, profile, { merge: true });
  }
  if (!profile.accessUntil) {
    profile.accessUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await setDoc(ref, { accessUntil: profile.accessUntil }, { merge: true });
  }
  await setDoc(ref, { lastSeenAt: serverTimestamp() }, { merge: true });
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
  accessText.textContent = accessStatusText();
  accessText.className = hasActiveAccess() ? "access-text active" : "access-text expired";
  memoryText.textContent = memories.length ? memories.slice(0, 5).map((m) => `• ${m.text}`).join("\n") : "Ainda não tenho memórias salvas. Você pode adicionar uma memória ou me contar algo importante no chat.";
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

  if (!hasActiveAccess()) {
    addMessage("Seu acesso ao Ted expirou. Faça um Pix de R$ 1,00 para liberar mais 24 horas de conversa.", "ted");
    updatePaymentText();
    showScreen("payment");
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

\nfunction updatePaymentText() {\n  const text = accessStatusText();\n  paymentAccessText.textContent = `${text} Cada Pix de R$ 1,00 libera mais 24 horas de conversa com o Ted.`;\n  const parts = (profile?.name || currentUser?.displayName || "").trim().split(/\s+/);\n  payNameInput.value = payNameInput.value || parts[0] || "";\n  payLastnameInput.value = payLastnameInput.value || parts.slice(1).join(" ") || "Cliente";\n  payEmailInput.value = payEmailInput.value || currentUser?.email || profile?.email || "";\n}\n\nfunction stopPixChecker() {\n  if (pixCheckTimer) clearInterval(pixCheckTimer);\n  pixCheckTimer = null;\n  currentPaymentId = null;\n}\n\nfunction resetPixCard() {\n  stopPixChecker();\n  pixCard.classList.add("hidden");\n  pixQrImage.removeAttribute("src");\n  pixCodeText.value = "";\n  pixStatusText.textContent = "Aguardando pagamento...";\n}\n\nasync function gerarPix() {\n  const name = payNameInput.value.trim();\n  const lastname = payLastnameInput.value.trim();\n  const email = payEmailInput.value.trim();\n  const cpf = payCpfInput.value.replace(/\D/g, "");\n\n  if (!name || !lastname || !email || cpf.length < 11) {\n    alert("Preencha nome, sobrenome, e-mail e CPF para gerar o Pix.");\n    return;\n  }\n\n  resetPixCard();\n  generatePixButton.disabled = true;\n  generatePixButton.textContent = "Gerando Pix...";\n\n  try {\n    const response = await fetch("/.netlify/functions/gerar-pix", {\n      method: "POST",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ name, lastname, email, cpf })\n    });\n\n    const data = await response.json();\n    if (!response.ok) throw new Error(data.error || "Não consegui gerar o Pix.");\n\n    currentPaymentId = data.payment_id;\n    pixQrImage.src = `data:image/png;base64,${data.qr_code_base64}`;\n    pixCodeText.value = data.qr_code || "";\n    pixCard.classList.remove("hidden");\n    pixStatusText.textContent = "Aguardando pagamento...";\n\n    pixCheckTimer = setInterval(() => verificarPagamento(currentPaymentId), 5000);\n  } catch (error) {\n    console.error(error);\n    alert(error.message || "Erro ao gerar Pix.");\n  } finally {\n    generatePixButton.disabled = false;\n    generatePixButton.textContent = "Gerar Pix de R$ 1,00";\n  }\n}\n\nasync function verificarPagamento(paymentId) {\n  if (!paymentId) return;\n\n  try {\n    const response = await fetch(`/.netlify/functions/verificar-pagamento?id=${encodeURIComponent(paymentId)}`);\n    const data = await response.json();\n    if (!response.ok) throw new Error(data.error || "Não consegui verificar o pagamento.");\n\n    if (data.status === "approved") {\n      stopPixChecker();\n      pixStatusText.textContent = "Pagamento aprovado! Liberando seu acesso...";\n      await grantAccess24h();\n      pixStatusText.textContent = "Acesso liberado por mais 24 horas.";\n      alert("Pagamento aprovado. O Ted foi liberado por mais 24 horas.");\n      showScreen("home");\n      return;\n    }\n\n    const labels = { pending: "Aguardando pagamento...", in_process: "Pagamento em análise...", rejected: "Pagamento recusado.", cancelled: "Pagamento cancelado.", expired: "Pagamento expirado." };\n    pixStatusText.textContent = labels[data.status] || `Status do pagamento: ${data.status}`;\n  } catch (error) {\n    console.error(error);\n    pixStatusText.textContent = "Ainda não consegui confirmar. Vou tentar novamente em alguns segundos.";\n  }\n}\n
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
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), { name, email, createdAt: serverTimestamp(), plan: "free", accessUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) }, { merge: true });
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
  if (!hasActiveAccess()) {
    updatePaymentText();
    showScreen("payment");
    return;
  }
  showScreen("chat");
  await loadMessages();
  await loadDailyUsage();
  messageInput.focus();
});
$("openPaymentButton").addEventListener("click", () => { updatePaymentText(); showScreen("payment"); });
$("openDiaryButton").addEventListener("click", () => { renderDiary(); showScreen("diary"); });
$("openMemoriesButton").addEventListener("click", () => { renderMemories(); showScreen("memories"); });
$("openSettingsButton").addEventListener("click", () => showScreen("settings"));
document.querySelectorAll(".backHomeButton").forEach((b) => b.addEventListener("click", () => { renderHome(); showScreen("home"); }));
chatForm.addEventListener("submit", (e) => { e.preventDefault(); sendMessage(messageInput.value); });
document.querySelectorAll(".quick-replies button").forEach((b) => b.addEventListener("click", () => sendMessage(b.dataset.msg)));
generatePixButton.addEventListener("click", gerarPix);
copyPixButton.addEventListener("click", async () => {
  if (!pixCodeText.value) return;
  await navigator.clipboard.writeText(pixCodeText.value);
  copyPixButton.textContent = "Código copiado!";
  setTimeout(() => copyPixButton.textContent = "Copiar código Pix", 1600);
});
cancelPixButton.addEventListener("click", () => {
  resetPixCard();
  pixStatusText.textContent = "Compra cancelada.";
});

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

setAuthMode(false);
