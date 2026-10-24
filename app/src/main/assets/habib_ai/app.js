// HABIB AI Frontend Application Logic
const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = "habib_settings";
const CHATS_KEY = "habib_chats";
const ACTIVE_KEY = "habib_active_chat";

const defaultSettings = {
  backendUrl: "",
  voiceLanguage: "bn-BD",
  speakReplies: true,
  continuousVoice: false,
  saveHistory: true,
};

function readStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

let settings = { ...defaultSettings, ...readStorage(SETTINGS_KEY, {}) };
let chats = readStorage(CHATS_KEY, []);
let activeChatId = localStorage.getItem(ACTIVE_KEY);
let recognition = null;
let isListening = false;
let cameraStream = null;

// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("ServiceWorker registration skipped:", err.message);
    });
  });
}

// Toast notification helper
function showToast(msg) {
  const toast = $("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

// Navigation between views
function switchView(viewId) {
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("active", v.id === viewId);
  });
  document.querySelectorAll("nav [data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });

  if (viewId === "settingsView") loadSettingsToUI();
  if (viewId === "historyView") renderHistory();
  if (viewId === "chatView") renderMessages();
}

// Get effective backend base URL (empty string means current server origin)
function getApiBaseUrl() {
  if (settings.backendUrl && settings.backendUrl.trim()) {
    return settings.backendUrl.trim().replace(/\/+$/, "");
  }
  // Default to same origin where the app is loaded
  return "";
}

// Settings management
function loadSettingsToUI() {
  $("backendUrl").value = settings.backendUrl || "";
  $("voiceLanguage").value = settings.voiceLanguage;
  $("speakReplies").checked = settings.speakReplies;
  $("continuousVoice").checked = settings.continuousVoice;
  $("saveHistory").checked = settings.saveHistory;

  if (settings.backendUrl) {
    $("connectionStatus").textContent = "কাস্টম Backend URL সেট করা আছে: " + settings.backendUrl;
  } else {
    $("connectionStatus").textContent = "স্বয়ংক্রিয় ডিটেকশন সক্রিয় (বর্তমান হোস্ট ব্যবহার হচ্ছে)";
  }
}

function saveSettingsFromUI() {
  settings = {
    backendUrl: $("backendUrl").value.trim().replace(/\/+$/, ""),
    voiceLanguage: $("voiceLanguage").value,
    speakReplies: $("speakReplies").checked,
    continuousVoice: $("continuousVoice").checked,
    saveHistory: $("saveHistory").checked,
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  if (!settings.saveHistory) {
    localStorage.removeItem(CHATS_KEY);
  } else {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }

  showToast("সেটিংস সফলভাবে সংরক্ষিত হয়েছে ✓");
  loadSettingsToUI();
}

// Chat session helpers
function getActiveChat() {
  let found = chats.find((c) => c.id === activeChatId);
  if (!found) {
    found = {
      id: String(Date.now()),
      title: "নতুন কথোপকথন",
      messages: [],
      timestamp: Date.now(),
    };
    chats.unshift(found);
    activeChatId = found.id;
    localStorage.setItem(ACTIVE_KEY, activeChatId);
  }
  return found;
}

function persistChats() {
  if (settings.saveHistory) {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }
}

function appendMessage(role, text) {
  const c = getActiveChat();
  c.messages.push({ role, text, time: Date.now() });

  // Update chat title based on the first user query
  if (c.messages.length === 1 && role === "user") {
    c.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
  }

  persistChats();
  renderMessages();
}

function renderMessages() {
  const container = $("messages");
  container.replaceChildren();

  const c = chats.find((item) => item.id === activeChatId);

  if (!c || !c.messages.length) {
    const welcome = document.createElement("div");
    welcome.className = "message assistant";
    welcome.innerHTML = `
      <span class="role">HABIB AI 🇧🇩</span>
      <div>আসসালামু আলাইকুম! আমি <b>HABIB AI</b>, আপনার ব্যক্তিগত বুদ্ধিমত্তা সহকারী। আমাকে বাংলায় বা ইংরেজিতে যেকোনো প্রশ্ন করতে পারেন।</div>
    `;
    container.append(welcome);
    return;
  }

  c.messages.forEach((msg) => {
    const msgDiv = document.createElement("div");
    msgDiv.className = "message " + msg.role;

    const roleSpan = document.createElement("span");
    roleSpan.className = "role";
    roleSpan.textContent = msg.role === "user" ? "আপনি" : "HABIB AI 🇧🇩";

    const contentDiv = document.createElement("div");
    contentDiv.textContent = msg.text;

    msgDiv.append(roleSpan, contentDiv);

    if (msg.role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "msg-actions";

      const speakBtn = document.createElement("button");
      speakBtn.className = "msg-btn";
      speakBtn.innerHTML = "🔊 শুনুন";
      speakBtn.onclick = () => speakText(msg.text);

      const copyBtn = document.createElement("button");
      copyBtn.className = "msg-btn";
      copyBtn.innerHTML = "📋 কপি";
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(msg.text).then(() => showToast("কপি করা হয়েছে ✓"));
      };

      actions.append(speakBtn, copyBtn);
      msgDiv.append(actions);
    }

    container.append(msgDiv);
  });

  container.scrollTop = container.scrollHeight;
}

// Send message to Gemini API via backend
async function sendMessage(customText) {
  const input = $("messageInput");
  const text = (customText || input.value).trim();
  if (!text) return;

  const currentChat = getActiveChat();
  appendMessage("user", text);

  input.value = "";
  input.style.height = "auto";
  $("chatStatus").textContent = "উত্তর তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন…";
  $("send").disabled = true;

  const baseUrl = getApiBaseUrl();

  try {
    const response = await fetch((baseUrl || "") + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: currentChat.messages.slice(0, -1).slice(-10),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `সার্ভার ত্রুটি (${response.status})`);
    }

    appendMessage("assistant", data.reply);
    $("chatStatus").textContent = "প্রস্তুত";

    if (settings.speakReplies) {
      speakText(data.reply);
    }

    if (settings.continuousVoice) {
      setTimeout(() => startVoiceRecognition(), 800);
    }
  } catch (err) {
    console.error("Chat error:", err);
    appendMessage(
      "assistant",
      `দুঃখিত, সংযোগে সমস্যা হয়েছে:\n"${err.message}"\n\nপরামর্শ: আপনি যদি Render-এ ডিপ্লয় করে থাকেন, তবে Render ড্যাশবোর্ডে GEMINI_API_KEY সঠিকভাবে দিয়েছেন কিনা এবং সার্ভিসটি চালু আছে কিনা পরীক্ষা করুন।`
    );
    $("chatStatus").textContent = "সংযোগ বিঘ্নিত";
  } finally {
    $("send").disabled = false;
  }
}

// Text to Speech
function speakText(text) {
  if (!("speechSynthesis" in window)) {
    showToast("আপনার ব্রাউজারে ভয়েস আউটপুট সমর্থিত নয়");
    return;
  }

  speechSynthesis.cancel();
  // Strip markdown formatting symbols for clean TTS
  const clean = text.replace(/[*_#`~>]/g, " ").trim();
  const utterance = new SpeechSynthesisUtterance(clean);

  const hasBengali = /[\u0980-\u09FF]/.test(clean);
  utterance.lang = hasBengali ? "bn-BD" : "en-US";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  speechSynthesis.speak(utterance);
}

// Voice Recognition
function startVoiceRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showToast("ভয়েস রেকগনিশনের জন্য Google Chrome ব্রাউজার ব্যবহার করুন");
    return;
  }

  if (isListening && recognition) {
    recognition.stop();
    return;
  }

  try {
    recognition = new SpeechRec();
    recognition.lang = settings.voiceLanguage || "bn-BD";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      $("orb").classList.add("listening");
      $("voiceStatus").textContent = "শুনছি… আপনার কথা বলুন";
      switchView("homeView");
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      isListening = false;
      $("orb").classList.remove("listening");
      $("voiceStatus").textContent = "ভয়েস ইনপুট বন্ধ হয়েছে";
      if (e.error === "not-allowed") {
        showToast("ব্রাউজার মাইক্রোফোন পারমিশন দিন");
      }
    };

    recognition.onend = () => {
      isListening = false;
      $("orb").classList.remove("listening");
      if ($("voiceStatus").textContent.startsWith("শুনছি")) {
        $("voiceStatus").textContent = "HABIB AI প্রস্তুত";
      }
    };

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      $("voiceStatus").textContent = `আপনি বলেছেন: "${text}"`;
      handleVoiceCommand(text);
    };

    recognition.start();
  } catch (err) {
    console.error("Speech recognition start failed:", err);
    showToast("ভয়েস সেবা চালু করা যায়নি");
  }
}

// Voice command parsing
function handleVoiceCommand(text) {
  const lower = text.toLowerCase();

  // YouTube command
  if (/youtube|ইউটিউব/.test(lower) && /(open|খোলো|খুলুন|চালু|play)/.test(lower)) {
    executeCommand("youtube");
    return;
  }

  // Camera command
  if (/camera|ক্যামেরা/.test(lower) && /(open|খোলো|খুলুন|চালু)/.test(lower)) {
    executeCommand("camera");
    return;
  }

  // Google Search command
  if (/google|chrome|সার্চ|ব্রাউজার/.test(lower) && /(open|খোলো|খুলুন|চালু|search)/.test(lower)) {
    executeCommand("chrome");
    return;
  }

  // Standard chat query
  switchView("chatView");
  sendMessage(text);
}

// External and System commands
function executeCommand(cmd) {
  if (cmd === "youtube") {
    window.open("https://www.youtube.com/", "_blank", "noopener");
    showToast("YouTube খোলা হচ্ছে…");
  } else if (cmd === "chrome") {
    window.open("https://www.google.com/", "_blank", "noopener");
    showToast("Google Search খোলা হচ্ছে…");
  } else if (cmd === "camera") {
    openCameraModal();
  }
}

// Safe In-App Camera implementation
function openCameraModal() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("আপনার ব্রাউজার ক্যামেরা সাপোর্ট করে না");
    return;
  }

  const modal = $("cameraModal");
  const video = $("cameraVideo");

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "user" } })
    .then((stream) => {
      cameraStream = stream;
      video.srcObject = stream;
      modal.classList.add("active");
      showToast("ক্যামেরা লাইভ ভিউ চালু হয়েছে ✓");
    })
    .catch((err) => {
      console.error("Camera access failed:", err);
      showToast("ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি");
    });
}

function closeCameraModal() {
  const modal = $("cameraModal");
  modal.classList.remove("active");
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
}

// Chat History View
function renderHistory() {
  const container = $("historyList");
  container.replaceChildren();

  const query = ($("search").value || "").toLowerCase().trim();

  const filtered = chats.filter((c) => {
    const textMatch = c.messages.some((m) => m.text.toLowerCase().includes(query));
    const titleMatch = c.title.toLowerCase().includes(query);
    return titleMatch || textMatch;
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "hint center";
    empty.textContent = "কোনো কথোপকথন খুঁজে পাওয়া যায়নি";
    container.append(empty);
    return;
  }

  filtered.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "history-item";

    const titleEl = document.createElement("b");
    titleEl.textContent = c.title || "কথোপকথন";

    const lastMsg = c.messages[c.messages.length - 1];
    const previewEl = document.createElement("small");
    previewEl.textContent = lastMsg ? lastMsg.text : "খালি চ্যাট";

    btn.append(titleEl, previewEl);
    btn.onclick = () => {
      activeChatId = c.id;
      localStorage.setItem(ACTIVE_KEY, activeChatId);
      switchView("chatView");
    };

    container.append(btn);
  });
}

// Health check and connection test
async function testServerConnection() {
  saveSettingsFromUI();
  const statusEl = $("connectionStatus");
  statusEl.textContent = "সার্ভারের সাথে সংযোগ যাচাই করা হচ্ছে…";

  const baseUrl = getApiBaseUrl();

  try {
    const response = await fetch((baseUrl || "") + "/health");
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();

    if (data.status === "ok") {
      const keyInfo = data.hasApiKey
        ? "✓ Gemini API Key সক্রিয় আছে"
        : "⚠️ সতর্কবার্তা: সার্ভারে GEMINI_API_KEY পাওয়া যায়নি";
      statusEl.textContent = `সার্ভার সক্রিয় আছে (${keyInfo})`;
      showToast("সার্ভার সফলভাবে যুক্ত হয়েছে ✓");
    } else {
      statusEl.textContent = "সার্ভার উত্তর দিয়েছে কিন্তু স্ট্যাটাস ত্রুটিযুক্ত";
    }
  } catch (err) {
    statusEl.textContent = `সংযোগ ব্যর্থ হয়েছে: ${err.message}। URL ও ইন্টারনেট সংযোগ পরীক্ষা করুন।`;
    showToast("সার্ভারে সংযোগ করা যায়নি ✕");
  }
}

// Event Listeners initialization
function initEvents() {
  // Navigation tabs
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  $("settingsOpen").onclick = () => switchView("settingsView");
  $("orb").onclick = startVoiceRecognition;
  $("navOrb").onclick = startVoiceRecognition;
  $("chatMic").onclick = startVoiceRecognition;

  $("send").onclick = () => sendMessage();

  // Auto-resize and Enter-to-send for textarea
  const textarea = $("messageInput");
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + "px";
  });

  // Settings
  $("saveSettings").onclick = saveSettingsFromUI;
  $("testConnection").onclick = testServerConnection;

  // New Chat
  $("newChat").onclick = () => {
    activeChatId = null;
    getActiveChat();
    renderMessages();
    showToast("নতুন চ্যাট শুরু হয়েছে");
  };

  // Clear history
  const clearAllChats = () => {
    if (confirm("আপনি কি সমস্ত চ্যাট হিস্ট্রি মুছে ফেলতে চান?")) {
      chats = [];
      activeChatId = null;
      localStorage.removeItem(CHATS_KEY);
      localStorage.removeItem(ACTIVE_KEY);
      renderHistory();
      renderMessages();
      showToast("সমস্ত হিস্ট্রি মুছে ফেলা হয়েছে");
    }
  };

  $("clearHistory").onclick = clearAllChats;
  $("forgetMemory").onclick = clearAllChats;

  // Search
  $("search").addEventListener("input", renderHistory);

  // Quick Action Prompts
  document.querySelectorAll("[data-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchView("chatView");
      sendMessage(btn.dataset.prompt);
    });
  });

  // Quick Commands
  document.querySelectorAll("[data-command]").forEach((btn) => {
    btn.addEventListener("click", () => {
      executeCommand(btn.dataset.command);
    });
  });

  // Camera modal close
  $("closeCamera").onclick = closeCameraModal;

  // Auto-save setting changes
  ["voiceLanguage", "speakReplies", "continuousVoice", "saveHistory"].forEach((id) => {
    const el = $(id);
    el.addEventListener("change", () => {
      settings[id] = el.type === "checkbox" ? el.checked : el.value;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      if (id === "saveHistory") persistChats();
    });
  });

  // Initial load
  loadSettingsToUI();
  renderMessages();
}

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", initEvents);
