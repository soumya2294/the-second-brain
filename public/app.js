document.addEventListener('DOMContentLoaded', () => {
    console.log("🔵 N.E.X.U.S v10.1 (STABILITY PATCHED) - ACTIVE");

    // ==========================================
    // 0. GLOBAL HELPERS (STABILITY GUARDS)
    // ==========================================
    
    // 🛡️ GUARD 1: Safe Annyang Starter
    // 🛡️ GUARD 1: Safe Annyang Starter (UPDATED)
let isAnnyangStarted = false;

function safeStartAnnyang() {
    if (typeof annyang !== 'undefined' && !annyang.isListening()) {
        try {
            // Changed to continuous: true so it doesn't fall asleep
            annyang.start({ autoRestart: true, continuous: true });
            isAnnyangStarted = true;
            console.log("🟢 NEXUS AUDIO SENSORS ONLINE (Listening for Wake Word)");
        } catch (e) {
            console.warn("Annyang start failed (Waiting for user interaction):", e);
        }
    }
}

// 🚀 THE BROWSER BYPASS: Force start on your first click anywhere on the screen
document.body.addEventListener('click', () => {
    if (!isAnnyangStarted && typeof annyang !== 'undefined') {
        console.log("🔓 Browser Mic Policy Bypassed via Click.");
        safeStartAnnyang();
    }
}, { once: true });

    // 🛡️ GUARD 2: Native Speech Recognition Guard
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognizer = null;
    if (Recognition) {
        recognizer = new Recognition();
        recognizer.lang = 'en-US';
        recognizer.continuous = false;
    } else {
        console.warn("⚠️ Native Speech Recognition (Vision Mode) not supported.");
    }

    // ==========================================
    // 1. MEMORY & SIDEBAR SYSTEM
    // ==========================================
    const sessionList = document.getElementById('session-list');
    const tasksList = document.getElementById('active-orders-list'); 
    const newChatBtn = document.getElementById('newChatBtn');

    async function loadSessions() {
        try {
            const res = await fetch('/api/sessions');
            const sessions = await res.json();
            if(sessionList) {
                sessionList.innerHTML = ''; 
                sessions.forEach(session => {
                    const div = document.createElement('div');
                    div.className = 'menu-item';
                    const dateObj = new Date(session.last_active || session.created_at);
                    const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    div.innerHTML = `${session.title || 'Protocol #' + session.id} <span style="font-size:10px; opacity:0.5; float:right">${timeStr}</span>`;
                    div.onclick = () => loadChatHistory(session.id);
                    sessionList.appendChild(div);
                });
            }
        } catch (e) { if(sessionList) sessionList.innerHTML = '<div style="color:red; font-size:12px">Offline</div>'; }
    }

    async function loadTasks() {
        if (!tasksList) return;
        try {
            const res = await fetch('/api/tasks');
            const tasks = await res.json();
            tasksList.innerHTML = ''; 
            if (tasks.length === 0) {
                tasksList.innerHTML = '<div style="opacity:0.5; font-size:12px; padding:5px;">No active directives.</div>';
                return;
            }
            tasks.forEach(task => {
                const div = document.createElement('div');
                div.className = 'menu-item';
                div.style.color = "#00ff88"; 
                div.innerHTML = `⚡ ${task.description}`;
                tasksList.appendChild(div);
            });
        } catch (e) { console.error("Task Error", e); }
    }

    async function loadChatHistory(sessionId) {
        try {
            await fetch(`/api/activate-session/${sessionId}`, { method: 'POST' });
            const res = await fetch(`/api/chat/${sessionId}`);
            const messages = await res.json();
            feed.innerHTML = ''; 
            messages.forEach(msg => {
                const sender = msg.sender === 'user' ? 'user' : 'ai';
                addMessage(msg.content, sender);
            });
            loadSessions();
        } catch (e) { console.error("Failed to load chat", e); }
    }

    async function createNewSession() {
        try {
            await fetch('/api/new-session', { method: 'POST' });
            feed.innerHTML = ''; 
            loadSessions(); 
            addMessage("New Protocol Initiated.", 'ai');
        } catch (e) { console.error("Session Error"); }
    }

    // ==========================================
    // 2. LIVE DASHBOARD
    // ==========================================
    function startDashboard() {
        const greetingEl = document.getElementById('live-greeting');
        const clockEl = document.getElementById('live-clock');
        const dateEl = document.getElementById('live-date');
        if (!greetingEl || !clockEl) return;
        function tick() {
            const now = new Date();
            const hours = now.getHours();
            let greet = hours < 12 ? "GOOD MORNING" : hours < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
            greetingEl.innerText = `${greet}, COMMANDER`;
            clockEl.innerText = now.toLocaleTimeString('en-US', { hour12: false });
            dateEl.innerText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
        }
        tick(); setInterval(tick, 1000);
    }

    // ==========================================
    // 3. VOICE OUTPUT
    // ==========================================
    let availableVoices = [];
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            availableVoices = window.speechSynthesis.getVoices();
        };
    }

    function speak(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); 
            const speech = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            
            // 🎯 PRIORITY: FIND FEMALE VOICE
            let preferredVoice = voices.find(v => v.name.includes("Zira")) 
                              || voices.find(v => v.name.includes("Google US English"))
                              || voices.find(v => v.name.toLowerCase().includes("female"));

            if (!preferredVoice && voices.length > 0) preferredVoice = voices[0];
            if (preferredVoice) speech.voice = preferredVoice;

            speech.pitch = 1.0; 
            speech.rate = 1.0;

            speech.onend = () => { 
                setStatus('online'); 
                safeStartAnnyang(); 
            };
            
            window.speechSynthesis.speak(speech);
        } else {
            // Fallback
            setTimeout(() => { 
                setStatus('online'); 
                safeStartAnnyang(); 
            }, 1000);
        }
    }

    // ✅ THE ULTIMATE WAKE WORD FIX (Fuzzy Matching)
function initWakeWord() {
    if (typeof annyang !== 'undefined') {
        console.log("🟢 Initializing Wake Word System..."); 
        annyang.debug(true); // Shows in console what it hears

        // 1. Exact Matches (The ideal scenario)
        const commands = {
            'hey nexus': () => { console.log("🚀 Exact Match: HEY NEXUS"); triggerAssistant(); },
            'hello nexus': () => { console.log("🚀 Exact Match: HELLO NEXUS"); triggerAssistant(); },
            'nexus': () => { console.log("🚀 Exact Match: NEXUS"); triggerAssistant(); }
        };
        annyang.addCommands(commands);
        
        // 2. The Net: Catch everything the browser hears
        annyang.addCallback('result', (phrases) => {
            // 'phrases' is an array of what the browser thinks you said
            const heardText = phrases[0].toLowerCase();
            console.log(`🗣️ System heard: "${heardText}"`);

            // Fuzzy matching: If it mishears "nexus" as any of these, trigger anyway!
            if (
                heardText.includes('lexus') || 
                heardText.includes('nex is') || 
                heardText.includes('next us') ||
                heardText.includes('nexas') ||
                heardText.includes('hey neck')
            ) {
                console.log("🚀 Fuzzy Match Triggered for 'Nexus'!");
                triggerAssistant();
            }
        });
        
        // Catch errors (like mic blocked)
        annyang.addCallback('error', (err) => {
            console.warn("❌ Annyang Error:", err);
            if (err.error === 'not-allowed') {
               addMessage("⚠️ Microphone blocked. Click Allow.", "ai");
            }
        });

        safeStartAnnyang();
    }
}
// Paste this right below your initWakeWord function
    function triggerAssistant() {
        console.log("🔔 Waking up Nexus...");
        
        // 1. Play a beep sound to let you know it heard you
        const audio = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3'); 
        audio.volume = 0.5; 
        audio.play().catch(e => { console.warn("Audio play blocked by browser", e); });
        
        // 2. Stop the wake-word engine temporarily so it doesn't double-record
        if (typeof annyang !== 'undefined') {
            annyang.abort(); 
        }
        
        // 3. Trigger your main recording function to send voice to Gemini
        if (typeof startRecording === 'function') {
            startRecording();
        } else {
            console.error("🚨 ERROR: startRecording function is also missing!");
        }
    }

    // ==========================================
    // 4. VISION SYSTEM (CAMERA)
    // ==========================================
    const visionBtn = document.getElementById('visionBtn');
    const webcamVideo = document.getElementById('webcam');
    const visionCanvas = document.getElementById('vision-canvas');
    let stream = null;

    async function activateVision() {
    if (!stream) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            if(webcamVideo) webcamVideo.srcObject = stream;
            
            addMessage("👁️ Vision Active. Click Mic to ask about what you see.", "ai");
            
            if(visionBtn) {
                visionBtn.style.color = "#ff3333"; 
                visionBtn.classList.add("pulse-animation");
            }
        } catch (e) { 
            addMessage("❌ Camera Access Denied.", "ai"); 
        }
    } else {
        stopCamera();
    }
}

function captureAndAnalyze(promptText) {
    if (!stream || !visionCanvas || !webcamVideo) return;
    
    visionCanvas.width = webcamVideo.videoWidth;
    visionCanvas.height = webcamVideo.videoHeight;
    const ctx = visionCanvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0);

    const dataUrl = visionCanvas.toDataURL('image/jpeg', 0.5);
    const imgHTML = `<img src="${dataUrl}" style="max-width: 200px; border-radius: 10px; margin-top: 10px; border: 1px solid #00ff88; box-shadow: 0 0 10px rgba(0,255,136,0.2);">`;

    visionCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob, "vision_capture.jpg");
        
        const finalPrompt = promptText || userInput.value.trim() || "Describe this image.";
        formData.append('text', finalPrompt);

        addMessage(`📸 [Vision Scan]: "${finalPrompt}"<br>${imgHTML}`, 'user');
        setStatus('thinking');

        try {
            const response = await fetch('/app/analyze-file', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.status === "success") {
                setStatus('generating');
                renderResponse(result.data);
            }
        } catch (e) { 
            addMessage("❌ Analysis Failed.", "ai"); 
            setStatus('online'); 
            safeStartAnnyang(); 
        }
    }, 'image/jpeg', 0.8);
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        if(visionBtn) {
            visionBtn.style.color = "#00ff88"; 
            visionBtn.classList.remove("pulse-animation");
        }
        addMessage("👁️ Vision Offline.", "ai");
    }
}
    // ==========================================
    // 5. CORE INTERFACE & INPUT
    // ==========================================
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const micBtn = document.getElementById('micBtn');
    const feed = document.getElementById('feed');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    const statusLight = document.getElementById('statusLight');
    const statusText = document.getElementById('statusText');
    const voiceOverlay = document.getElementById('voice-overlay');
    const voiceStatusText = document.querySelector('.voice-status');

    let isVoiceInteraction = false;
    let audioContext, analyser, microphone, silenceTimer, mediaRecorder;
    let audioChunks = [];

    if(attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => { if(fileInput.files.length) userInput.placeholder = `📄 ${fileInput.files[0].name} attached`; });
    }

    function setStatus(state) {
        if(!statusLight) return;
        statusLight.className = 'status-light';
        if (state === 'listening') { statusLight.classList.add('red'); statusText.innerText = "LISTENING"; statusText.style.color = "#ff3333"; } 
        else if (state === 'thinking') { statusLight.classList.add('orange'); statusText.innerText = "THINKING"; statusText.style.color = "#ffaa00"; } 
        else if (state === 'generating') { statusLight.classList.add('blue'); statusText.innerText = "GENERATING"; statusText.style.color = "#00ccff"; } 
        else { statusLight.classList.add('green'); statusText.innerText = "ONLINE"; statusText.style.color = "#00ff88"; }

        if (isVoiceInteraction) {
            if (window.setVoiceOrbState) window.setVoiceOrbState(state);
            if (state !== 'online') { 
                if(voiceOverlay) voiceOverlay.classList.remove('hidden'); 
                if(voiceStatusText) voiceStatusText.innerText = state.toUpperCase(); 
            } else { 
                if(voiceOverlay) voiceOverlay.classList.add('hidden'); 
            }
        }
    }

    async function sendMessage() {
        const text = userInput.value.trim();
        const file = fileInput.files[0];
        if (!text && !file) return;
        if (typeof annyang !== 'undefined') annyang.abort();

        isVoiceInteraction = false; 
        addMessage(text || (file ? `[Attached: ${file.name}]` : "..."), 'user');
        userInput.value = ''; userInput.placeholder = "Awaiting command...";
        setStatus('thinking');

        try {
            let response;
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('text', text);
                response = await fetch('/app/analyze-file', { method: 'POST', body: formData });
                fileInput.value = ''; 
            } else {
                response = await fetch('/app/smart-add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: text })
                });
            }
            const result = await response.json();
            if (result.status === "success") { 
                setStatus('generating'); 
                setTimeout(() => {
                    renderResponse(result.data);
                    loadSessions(); 
                    loadTasks(); 
                }, 500); 
            }
        } catch (error) { addMessage("⚠️ ERROR", "ai"); setStatus('online'); safeStartAnnyang(); }
    }

    // --- 🎙️ INTEGRATED VOICE LOGIC WITH MIME GUARD ---
    async function startRecording() {
        if (!micBtn) return;
        isVoiceInteraction = true;
        
        // 🛑 MODE A: VISION + VOICE
        if (stream) {
            if (!recognizer) {
                addMessage("⚠️ Voice API missing. Type request.", "ai");
                captureAndAnalyze("What is this?"); 
                return;
            }
            setStatus('listening');
            recognizer.start();
            recognizer.onresult = (event) => {
                const spokenText = event.results[0][0].transcript;
                recognizer.stop();
                captureAndAnalyze(spokenText);
            };
            recognizer.onerror = (e) => captureAndAnalyze("What do you see?");
            return;
        }

        // 🛑 MODE B: NORMAL VOICE CHAT (MIME GUARDED)
        try {
            const streamAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // ✅ FIXED: FORCE RESUME IF BROWSER SUSPENDED AUDIO
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(streamAudio);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // 🔥 MIME TYPE GUARD
            // Check if WebM is supported, otherwise fallback to MP4
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            console.log("🎙️ Microphone using MIME:", mimeType);

            mediaRecorder = new MediaRecorder(streamAudio, { mimeType: mimeType });
            audioChunks = [];
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            
            mediaRecorder.onstop = async () => {
                // 🔥 Ensure Blob matches the Recorder's MIME type
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                sendVoice(audioBlob);
                streamAudio.getTracks().forEach(track => track.stop());
                audioContext.close();
            };
            
            mediaRecorder.start();
            setStatus('listening');
            analyzeAudio(dataArray, bufferLength);

        } catch (err) { console.error(err); addMessage("⚠️ MIC DENIED", "ai"); setStatus('online'); safeStartAnnyang(); }
    }

    async function sendVoice(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob);
        setStatus('thinking');
        try {
            const response = await fetch('/app/voice-add', { method: 'POST', body: formData });
            const result = await response.json();
            if(result.status === "success") { setStatus('generating'); renderResponse(result.data); loadSessions(); loadTasks(); }
        } catch (error) { addMessage("⚠️ VOICE ERROR", "ai"); setStatus('online'); safeStartAnnyang(); }
    }

    function analyzeAudio(dataArray, bufferLength) {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0; for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
        let average = sum / bufferLength;
        if (window.setMicVolume) window.setMicVolume(Math.min(average / 50, 1));
        
        if (average < 10) { 
            if (!silenceTimer) silenceTimer = setTimeout(() => { 
                if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); 
            }, 2000); 
        } else { 
            if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; } 
        }
        if (mediaRecorder && mediaRecorder.state === "recording") requestAnimationFrame(() => analyzeAudio(dataArray, bufferLength));
    }

    function addMessage(text, sender) {
        if (!text) return;
        const clean = String(text).trim();
        if (clean.toLowerCase() === "undefined") return;
        const div = document.createElement('div');
        div.className = sender === 'user' ? 'message user-message' : 'message ai-message';
        div.innerHTML = clean;
        feed.appendChild(div);
        feed.scrollTop = feed.scrollHeight;
    }

    function renderResponse(data) {
        if (data.type === 'system_op') addMessage(`⚙️ ${data.response}`, 'ai');
        else if (data.type === 'chat') addMessage(data.response, 'ai');
        else if (data.type === 'call') { 
            const div = document.createElement('div'); 
            div.innerHTML = `📞 <b>Calling ${data.name || data.number}...</b>`; 
            div.className = "message ai-message"; 
            feed.appendChild(div); 
        } 
        else if (data.type === 'whatsapp') { 
            const div = document.createElement('div'); 
            div.innerHTML = `💬 <b>WhatsApp Sent</b><br>"${data.message}"`; 
            div.className = "message ai-message"; 
            feed.appendChild(div); 
        }
        else if (data.type === 'todo') addMessage(`📝 <b>Task Added:</b><br>"${data.response}"`, 'ai'); 
        else if (data.type === 'event') { 
            const div = document.createElement('div'); 
            div.innerHTML = `📅 <b>Scheduled:</b> ${data.title}`; 
            div.className = "message ai-message"; 
            feed.appendChild(div); 
        }
        
        feed.scrollTop = feed.scrollHeight;
        if (isVoiceInteraction) speak(data.response); 
        else { setStatus('online'); safeStartAnnyang(); }
    }

    // ==========================================
    // 6. INITIALIZATION
    // ==========================================
    startDashboard();
    initWakeWord(); 
    loadSessions();
    loadTasks();

    if(newChatBtn) newChatBtn.addEventListener('click', createNewSession);
    if(visionBtn) visionBtn.addEventListener('click', activateVision);
    
    micBtn.addEventListener('click', () => { 
        if (typeof annyang !== 'undefined') annyang.abort(); 
        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); 
        else startRecording(); 
    });
    
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
});