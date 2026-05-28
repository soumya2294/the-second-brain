import { exec } from 'child_process';
import loudness from 'loudness';
import si from 'systeminformation';
import path from 'path';
import puppeteer from 'puppeteer';

// ==========================================
// 🚀 OPTIMIZATION: Singleton Browser (Fixes Lag)
// ==========================================
let browserInstance = null;

async function getBrowser() {
    if (!browserInstance) {
        console.log("🚀 Launching Headless Browser (Singleton)...");
        browserInstance = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });
        browserInstance.on('disconnected', () => { browserInstance = null; });
    }
    return browserInstance;
}

// ==========================================
// 📂 APP CONTROL (Your Smart Logic)
// ==========================================
export async function openApp(appName) {
    const name = appName.toLowerCase().replace(/[^a-z0-9 .]/g, '').trim();


    const quickApps = {
        'chrome': 'start chrome',
        'google': 'start chrome',
        'youtube': 'start chrome youtube.com',
        'calculator': 'calc',
        'notepad': 'notepad',
        'paint': 'mspaint',
        'settings': 'start ms-settings:',
        'explorer': 'explorer',
        'cmd': 'start cmd',
        'terminal': 'start wt',
        'task manager': 'taskmgr',
        'control panel': 'control',
        'steam': 'start steam',
        'discord': 'start discord',
        'spotify': 'start spotify',
        'word': 'start winword',
        'excel': 'start excel',
        'powerpoint': 'start powerpnt',
        'vscode': 'code'
    };

    if (quickApps[name]) {
        return runCommand(quickApps[name], name);
    }

    if (name.includes('.') && !name.includes(' ')) {
        return runCommand(`start https://${name}`, `Website ${name}`);
    }

    // 🔍 SMART SEARCH: Keeps your PowerShell Auto-Find
    return new Promise((resolve) => {
        const psCommand = `
            $paths = @(
                "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
                "$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs"
            );
            Get-ChildItem -Path $paths -Recurse -Include *.lnk,*.exe | 
            Where-Object { $_.Name -like "*${name}*" } | 
            Select-Object -First 1 -ExpandProperty FullName
        `;

        exec(`powershell -command "${psCommand}"`, (err, stdout) => {
            const foundPath = stdout.trim();
            
            if (foundPath) {
                exec(`start "" "${foundPath}"`, (error) => {
                    if (error) resolve(`Found "${foundPath}" but failed to open.`);
                    else resolve(`${path.basename(foundPath, '.lnk')}`);
                });
            } else {
                // Fallback attempt
                exec(`start "" "${name}"`, (err) => {
                    if (err) resolve(`Could not find app: "${appName}"`);
                    else resolve(`Attempting generic launch: "${appName}"`);
                });
            }
        });
    });
}

function runCommand(cmd, display) {
    return new Promise(resolve => {
        exec(cmd, (err) => {
            if (err) resolve(`Error opening ${display}`);
            else resolve(`Opening ${display}...`);
        });
    });
}

// ==========================================
// 🔊 VOLUME (Your Library Logic)
// ==========================================
export async function setVolume(level) {
    try {
        if (level === 'mute') {
            await loudness.setMuted(true);
            return "System Muted.";
        }
        if (level === 'unmute') {
            await loudness.setMuted(false);
            return "System Unmuted.";
        }
        
        let val = parseInt(level);
        if (isNaN(val)) return "Invalid volume level.";
        
        val = Math.max(0, Math.min(100, val));
        
        await loudness.setVolume(val);
        return `Volume set to ${val}%`;
    } catch (e) { 
        return "Volume control failed (Library Error)."; 
    }
}

// ==========================================
// 📊 STATS (Your Library Logic)
// ==========================================
export async function getSystemStats() {
    try {
        const battery = await si.battery();
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        
        const battText = battery.hasBattery 
            ? `Battery: ${battery.percent}% (${battery.isCharging ? 'Charging' : 'Draining'})` 
            : "Plugged In";
            
        return `CPU: ${cpu.currentLoad.toFixed(0)}%  |  RAM: ${((mem.active/mem.total)*100).toFixed(0)}%\n${battText}`;
    } catch (e) { return "Cannot access stats."; }
}

// ==========================================
// ⏯️ MEDIA (Your PowerShell Logic)
// ==========================================
export async function controlMedia(action) {
    const commands = {
        'play': '$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]179)',
        'pause': '$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]179)',
        'next': '$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]176)',
        'previous': '$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]177)',
        'prev': '$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]177)',
        'stop': '$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]178)'
    };

    const cmd = commands[action.toLowerCase()];
    if (!cmd) return "Unknown media command.";

    return new Promise((resolve) => {
        exec(`powershell -command "${cmd}"`, (err) => {
            if (err) resolve(`Failed to ${action} media.`);
            else resolve(`Media Action: ${action.toUpperCase()}`);
        });
    });
}

// ==========================================
// 🛡️ POWER (With Safety Lock)
// ==========================================
export async function controlPower(action) {
    const SAFE_MODE = true; // ⚠️ CHANGE TO FALSE TO ENABLE SHUTDOWN

    const commands = {
        'lock': 'rundll32.exe user32.dll,LockWorkStation',
        'sleep': 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0',
        'shutdown': 'shutdown /s /t 10',
        'restart': 'shutdown /r /t 10'
    };

    const cmd = commands[action.toLowerCase()];
    if (!cmd) return "Unknown power command.";

    // Safety Check for destructive commands
    if ((action === 'shutdown' || action === 'restart') && SAFE_MODE) {
        return `⚠️ SAFETY LOCK ACTIVE: '${action}' disabled. Change SAFE_MODE in system.js to false.`;
    }

    if (action === 'shutdown' || action === 'restart') {
        exec(cmd); 
        return `System will ${action} in 10 seconds.`;
    }

    return new Promise((resolve) => {
        exec(cmd, (err) => {
            if (err) resolve(`Failed to ${action} PC.`);
            else resolve(`System Action: ${action.toUpperCase()}`);
        });
    });
}

// ==========================================
// 🌐 SEARCH (Optimized Singleton)
// ==========================================
export async function searchWeb(query) {
    try {
        const browser = await getBrowser(); // Uses the Singleton!
        const page = await browser.newPage();

        // Faster loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });

        const result = await page.evaluate(() => {
            let snippet = document.querySelector('.hgKElc') || 
                          document.querySelector('.BNeawe.iBp4i.DS7uy') || 
                          document.querySelector('.VwiC3b');
            return snippet ? snippet.innerText : "I couldn't find a direct answer.";
        });

        await page.close(); // Close tab, keep browser open
        return result;

    } catch (error) {
        console.error("Search Error:", error);
        return "Search failed due to network error.";
    }
}