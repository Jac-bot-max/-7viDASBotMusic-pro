import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// --- SERVIDOR WEB ---
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Online e Seguro 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    
    // RECUPERAR SESSÃO VIA SESSION_ID (Se existir)
    const sessionID = process.env.SESSION_ID;
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        try {
            const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
            if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data', { recursive: true });
            fs.writeFileSync('./session_data/creds.json', decoded);
            console.log("📂 Sessão restaurada via SESSION_ID!");
        } catch (e) { console.log("❌ Erro na SESSION_ID"); }
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            const reason = u.lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") {
            console.log("✅ @7viDASBotMusic: TUDO PRONTO!");
        }
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // --- 🛡️ XERIFE AUTOMÁTICO (STATUS / LINK) ---
            if (isGroup) {
                const meta = await socket.groupMetadata(from);
                const admins = meta.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com)/gi.test(textRaw);

                if ((isStatus || isLink) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(500);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA
                    return;
                }
            }

            // --- 🎹 CÉREBRO DE ÁUDIO ---
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // --- 📝 COMANDOS (.) ---
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");

            if (command === "menu") {
                await socket.sendMessage(from, { text: "╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .link | .ban | .marcar\n║ ◽ .key (Gera sua chave de login)\n║\n║ ⚪ *PRODUÇÃO*\n║ ◽ .yt | .play | .drums\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n╚══════════════════════════╝" });
            }

            // --- COMANDO PARA GERAR A KEY NOVA ---
            if (command === "key") {
                try {
                    const creds = fs.readFileSync('./session_data/creds.json');
                    const sessionString = Buffer.from(creds).toString('base64');
                    await socket.sendMessage(sender, { text: `🔐 *SUA NOVA SESSION_ID:* \n\n${sessionString}` });
                    await socket.sendMessage(from, { text: "✅ Jackson, enviei sua nova chave de segurança no seu privado! Salve-a no Render para nunca mais deslogar." });
                } catch (e) { await socket.sendMessage(from, { text: "❌ Erro ao gerar chave." }); }
            }

            if (command === "ping") await socket.sendMessage(from, { text: "🛰️ Jackson Beatz Online!" });

        } catch (e) { console.log(e); }
    });
}
startBot();
