import dotenv from "dotenv";
dotenv.config();

import express from "express";
import multer from "multer";
import fs from "fs";
import pg from 'pg';
import { exec } from "child_process";

import { GoogleGenerativeAI } from "@google/generative-ai";
import pkg from 'whatsapp-web.js';
import qrcode from "qrcode-terminal"

// Import your system functions
import { openApp, setVolume, getSystemStats, controlMedia, controlPower, searchWeb } from './system.js';

const { Client, LocalAuth } = pkg;
const { Pool } = pg;
const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const upload = multer({ dest: 'uploads/' });

// --- DATABASE CONNECTION ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- AI SETUP ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); 

// ==================================================
// 1. ROBUST JSON PARSER
// ==================================================
function cleanAndParseJSON(text) {
    if (!text) return { type: "chat", response: "..." };

    try {
        let clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstOpen = clean.indexOf('{');
        const lastClose = clean.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1) {
            clean = clean.substring(firstOpen, lastClose + 1);
        }
        return JSON.parse(clean);
    } catch (e) {
        console.warn("⚠️ JSON Parse Failed. Fallback to chat mode.");
        return { type: "chat", response: text };
    }
}

// ==================================================
// 2. WHATSAPP CLIENT (With "Force Ready" Fix)
// ==================================================
let isWhatsAppReady = false;
let whatsappClient;

try {
    whatsappClient = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: { 
            headless: true, // ✅ Set to TRUE for Ghost Mode (change to false only to scan QR)
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu' 
            ] 
        }
    });

    // --- Detailed Logging for Debugging ---
    whatsappClient.on('qr', (qr) => {
    console.log('\n📸 NEXUS WAITING FOR WHATSAPP LINK...');
    console.log('Please scan this QR code with your WhatsApp app:\n');
    qrcode.generate(qr, { small: true });
});

    whatsappClient.on('loading_screen', (percent, message) => {
        console.log(`⏳ WhatsApp Loading: ${percent}% - ${message}`);
    });

    whatsappClient.on('authenticated', () => {
        console.log('🔑 Authentication Successful! Syncing chats, please wait...');
    });
    whatsappClient.on('ready', () => { 
        console.log('✅ WhatsApp Ready!'); 
        isWhatsAppReady = true; 
    });
    
    // Prevent crashes
    whatsappClient.on('disconnected', (reason) => {
        console.warn("⚠️ WhatsApp Disconnected:", reason);
        isWhatsAppReady = false;
    });

    whatsappClient.initialize().catch(err => console.error("⚠️ WhatsApp Init Error (Non-fatal):", err.message));

} catch (err) {
    console.error("⚠️ WhatsApp Client Construction Failed:", err.message);
}

async function sendWhatsAppMessage(to, msg) {
    if (!isWhatsAppReady || !whatsappClient) return "WhatsApp is not ready yet.";
    try {
        const cleanNumber = to.replace(/[^0-9]/g, '');
        let chatId;

        if (cleanNumber.length >= 10) {
            chatId = `${cleanNumber.length === 10 ? '91' + cleanNumber : cleanNumber}@c.us`;
        } else {
            const contacts = await whatsappClient.getContacts();
            const validContacts = contacts.filter(c => c.id._serialized.endsWith('@c.us'));
            const contact = validContacts.find(c => c.name && c.name.toLowerCase().includes(to.toLowerCase()));
            
            if (contact) {
                console.log(`🎯 FOUND CONTACT: "${contact.name}" (ID: ${contact.id._serialized})`); 
                chatId = contact.id._serialized; 
            } else {
                console.log(`❌ Contact "${to}" not found in valid contact list.`);
                const fallback = validContacts.find(c => c.number && c.number.includes(to));
                if (fallback) {
                     console.log(`🎯 FOUND CONTACT BY NUMBER MATCH: "${fallback.name || fallback.number}"`);
                     chatId = fallback.id._serialized;
                } else {
                    return "Contact not found";
                }
            }
        }

        console.log(`🚀 ATTEMPTING TO SEND MESSAGE TO: ${chatId}...`);
        
        // This is where it's freezing. Let's see if it passes this line.
        await whatsappClient.sendMessage(chatId, msg);
        
        console.log(`✅ MESSAGE SUCCESSFULLY DISPATCHED!`);
        return `Message sent to ${to}`;
        
    } catch (e) { 
        // 🚨 WE NEED TO SEE THIS ERROR!
        console.error("🚨 CRITICAL WHATSAPP SEND ERROR:", e);
        return "WhatsApp failed to send. Check the terminal for errors."; 
    }
}
        

// ==================================================
// 3. EVENT / CALENDAR HELPER (Restored Feature 📅)
// ==================================================
async function scheduleEvent(title, time) {
    try {
        // Saving event to database tasks table marked as 'event' for now
        // You can expand this to a real Google Calendar API integration later
        await pool.query("INSERT INTO tasks (description, status) VALUES ($1, 'event')", [`Event: ${title} at ${time}`]);
        return `Event scheduled: "${title}" for ${time}`;
    } catch (e) {
        return "Failed to schedule event.";
    }
}

// ==================================================
// 4. MEMORY & HELPERS
// ==================================================
async function getActiveSession() {
    try {
        const res = await pool.query('SELECT id FROM sessions ORDER BY last_active DESC LIMIT 1');
        if (res.rows.length === 0) {
            const newSession = await pool.query("INSERT INTO sessions (title) VALUES ('System Init') RETURNING id");
            return newSession.rows[0].id;
        }
        return res.rows[0].id;
    } catch (e) { return 1; }
}

async function saveMessage(sender, content) {
    try {
        if (!content) return;
        let clean = String(content).trim();
        if (clean === "undefined" || clean === "null" || clean === "") return;

        const sessionId = await getActiveSession();
        const role = sender === 'user' ? 'user' : 'ai'; 
        
        await pool.query('INSERT INTO messages (session_id, sender, content) VALUES ($1, $2, $3)', 
            [sessionId, role, clean]);
    } catch (err) { console.error("Write Error:", err.message); }
}

async function getRecentContext(sessionId) {
    try {
        const res = await pool.query(
            'SELECT sender, content FROM messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10',
            [sessionId]
        );
        return res.rows.reverse().map(msg => 
            `${msg.sender === 'user' ? 'USER' : 'AI'}: ${msg.content}`
        ).join('\n');
    } catch (e) { return ""; }
}

async function addToDoList(task) {
    if (!task || task.trim() === "undefined") return "Error: Missing task details.";
    try {
        await pool.query('INSERT INTO tasks (description) VALUES ($1)', [task]);
        return `Active Order Updated: "${task}"`;
    } catch (e) { return "Database write failed."; }
}
async function completeTask(taskName) {
    if (!taskName) return "Error: Missing task name.";
    try {
        const res = await pool.query(
            "UPDATE tasks SET status = 'completed' WHERE description ILIKE $1 RETURNING description", 
            [`%${taskName}%`]
        );
        if (res.rows.length > 0) {
            return `Crossed off: "${res.rows[0].description}"`;
        } else {
            return `Could not find a pending task matching "${taskName}".`;
        }
    } catch (e) { 
        return "Database update failed."; 
    }
}
// ==================================================
// 5. CORE PROCESSOR
// ==================================================
async function processInput(userInput, filePart = null) {
    if (!userInput && !filePart) return { type: "chat", response: "I didn't hear anything." };

    await saveMessage('user', userInput);

    const sessionId = await getActiveSession();
    const chatHistory = await getRecentContext(sessionId);

    let activeTasks = "None";
    try {
        const tasksRes = await pool.query("SELECT description FROM tasks WHERE status = 'pending'");
        if (tasksRes.rows.length > 0) {
            activeTasks = tasksRes.rows.map(t => t.description).join(', ');
        }
    } catch (e) {
        activeTasks = "Database error reading tasks.";
    }

    let promptParts = [`
    SYSTEM: You are the core intelligence of The Second Brain.
    PERSONALITY: Intelligent, witty, and helpful.
    CONTEXT: Today is ${new Date().toLocaleString()}.
    
    CURRENT PENDING TASKS & EVENTS:
    ${activeTasks}
    
    MEMORY (Last 10 interactions):
    ${chatHistory}
    
    INSTRUCTION: Analyze current USER INPUT. Return strictly JSON.
    
    ACTION TYPES:
    - Open App -> {"type": "system_op", "action": "open", "target": "app_name"}
    - Volume -> {"type": "system_op", "action": "volume", "value": "50/mute/unmute"}
    - Stats -> {"type": "system_op", "action": "stats"}
    - Media -> {"type": "system_op", "action": "media", "command": "play/pause/next"}
    - Power -> {"type": "system_op", "action": "power", "command": "lock/sleep"}
    - Search -> {"type": "system_op", "action": "search", "query": "search query"}
    - WhatsApp -> {"type": "whatsapp", "to": "name/number", "message": "content"}
    - Schedule -> {"type": "event", "title": "Meeting name", "time": "5 PM"}
    - ToDo -> {"type": "todo", "task": "Buy milk"}
    - Complete Task -> {"type": "complete_task", "task": "Buy milk"}
    - Chat -> {"type": "chat", "response": "Your reply here"}
    
    USER INPUT: "${userInput}"
    RETURN RAW JSON ONLY.
    `];
    
    if (filePart) promptParts.push(filePart);

    try {
        const result = await model.generateContent(promptParts);
        const response = await result.response;
        const text = response.text();

        let data = cleanAndParseJSON(text);

        if (!data || !data.type) {
            data = { type: "chat", response: text || "Processing complete." };
        }
        if (typeof data.response === 'object') data.response = JSON.stringify(data.response);

        if (data.type === 'system_op') {
            if (data.action === 'open') data.response = await openApp(data.target);
            else if (data.action === 'volume') data.response = await setVolume(data.value);
            else if (data.action === 'stats') data.response = await getSystemStats();
            else if (data.action === 'media') data.response = await controlMedia(data.command); 
            else if (data.action === 'power') data.response = await controlPower(data.command);
            else if (data.action === 'search') data.response = await searchWeb(data.query);
        }

        if (data.type === 'whatsapp') { 
            const status = await sendWhatsAppMessage(data.to, data.message); 
            data.response = status;
        }
        
        if (data.type === 'todo') {
            const task = data.task || userInput.replace(/add|to my list/gi, "").trim();
            data.response = await addToDoList(task); 
        }

        if (data.type === 'complete_task') {
            data.response = await completeTask(data.task);
        }

        if (data.type === 'event') {
            data.response = await scheduleEvent(data.title, data.time);
        }

        if (!data.response) data.response = "Command executed.";

        await saveMessage('ai', data.response);
        return data;

    } catch (error) {
        console.error("Critical Processing Error:", error);
        return { type: "chat", response: "I encountered a neural interference. Please try again." };
    }
}
// ==================================================
// 6. API ROUTES
// ==================================================
app.post('/app/smart-add', async (req, res) => { 
    try { 
        const result = await processInput(req.body.text);
        res.json({ status: "success", data: result }); 
    } catch (e) { 
        res.json({ status: "error", data: { type: "chat", response: "Server communication failed." } }); 
    } 
});

app.post('/app/voice-add', upload.single('audio'), async (req, res) => { 
    try { 
        const audioBase64 = fs.readFileSync(req.file.path).toString('base64'); 
        
        // 1. Log the MIME type to ensure the browser isn't sending a corrupted format
        console.log(`🎙️ Incoming Audio MIME: ${req.file.mimetype}`);

        // 2. Use the dynamic MIME type instead of hardcoding "audio/webm"
        const result = await model.generateContent([
            "Transcribe this audio.", 
            { 
                inlineData: { 
                    mimeType: req.file.mimetype || "audio/webm", 
                    data: audioBase64 
                } 
            }
        ]); 
        
        const transcription = result.response.text();
        
        // 3. Log what the AI actually heard
        console.log(`🗣️ Transcribed: "${transcription}"`);
        
        const finalData = await processInput(transcription); 
        fs.unlinkSync(req.file.path); 
        res.json({ status: "success", data: finalData }); 
        
    } catch (e) { 
        // 🚨 4. THE SECRET WEAPON: This will force the terminal to print the exact crash reason
        console.error("🚨 CRITICAL VOICE PROCESSING ERROR:", e); 
        res.status(500).json({ error: "Voice processing failed" }); 
    } 
});

app.post('/app/analyze-file', upload.single('file'), async (req, res) => { 
    try { 
        const fileBase64 = fs.readFileSync(req.file.path).toString('base64'); 
        const finalData = await processInput(req.body.text || "Analyze.", { inlineData: { mimeType: req.file.mimetype, data: fileBase64 } }); 
        fs.unlinkSync(req.file.path); 
        res.json({ status: "success", data: finalData }); 
    } catch (e) { 
        res.status(500).json({ error: "File processing failed" }); 
    } 
});

app.post('/api/activate-session/:id', async (req, res) => { 
    try { await pool.query('UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]); res.json({ status: "activated" }); } catch (e) { res.status(500).json({ error: "DB Error" }); } 
});
app.get('/api/sessions', async (req, res) => { 
    try { const result = await pool.query('SELECT * FROM sessions ORDER BY last_active DESC'); res.json(result.rows); } catch (e) { res.status(500).json({ error: "DB Error" }); } 
});
app.get('/api/tasks', async (req, res) => { 
    try { const result = await pool.query("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC"); res.json(result.rows); } catch (e) { res.status(500).json({ error: "DB Error" }); } 
});
app.get('/api/chat/:id', async (req, res) => { 
    try { const result = await pool.query('SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC', [req.params.id]); res.json(result.rows); } catch (e) { res.status(500).json({ error: "DB Error" }); } 
});
app.post('/api/new-session', async (req, res) => { 
    try { const result = await pool.query("INSERT INTO sessions (title) VALUES ('New Protocol') RETURNING id"); res.json({ id: result.rows[0].id }); } catch (e) { res.status(500).json({ error: "DB Error" }); } 
});

app.listen(port, () => { 
    console.log(`✅ N.E.X.U.S Server running at http://localhost:${port}`); 
});