import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: ESTABILIDADE RENDER (LIGA ANTES DE TUDO)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO Online 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
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

    // =========================================================================
    // REGIÃO 2: BOAS-VINDAS PROFISSIONAL (COM FOTO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para navegar.\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO OPERACIONAL");
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // REGIÃO 3: XERIFE MÃO DE FERRO (DETECTA TUDO E APAGA)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                // DETECTOR DE STATUS (TIPO DO PRINT), LINKS E LIXO
                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("estado de") || textLow.includes("status de") || textLow.includes("@ este grupo foi mencionado");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);
                const isMidiaLixo = (type === 'imageMessage' || type === 'videoMessage') && !textRaw.startsWith('.');

                if ((isStatus || isLink || isMidiaLixo) && !isSenderAdmin && isBotAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA NA HORA
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Conteúdo proibido removido automaticamente. Mantenha o grupo limpo! 🇲🇿🇦🇴` });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 4: CÉREBRO DE MÍDIA (Voz vs Beat/Vídeo)
            // =====================================================================
            if (type === 'audioMessage') {
                if (msg.message.audioMessage.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } }); // Gravação de Voz
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } }); // MP3/Arquivo
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }
            if (type === 'videoMessage') {
                await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                return;
            }

            // =====================================================================
            // REGIÃO 5: AUTO-RESPONDER SOCIAL (PARA TODOS)
            // =====================================================================
            const saudações = ["oi", "olá", "ola", "kmk família", "kmk beatmakers", "bom dia", "boa noite"];
            if (saudações.includes(textLow)) {
                const r = `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Bem-vindo à sessão. Como está a produção hoje? 🇲🇿🇦🇴`;
                await socket.sendMessage(from, { text: r, mentions: [sender] }, { quoted: msg });
                return;
            }
            if (textLow.includes("obrigado")) return socket.sendMessage(from, { react: { text: "❤️", key: msg.key } });

            // =====================================================================
            // REGIÃO 6: COMANDOS MANUAIS (ESPECÍFICOS)
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            const aviso = async () => await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });

            switch (command) {
                case "menu":
                    await socket.sendMessage(from, { text: `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .marcar | .link | .ban\n║ ◽ .infoadm | .infogrupo\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ .play | .yt | .drums | .vst\n║ ◽ .foto | .dicas | .apps\n║\n║ 🔵 *SISTEMA*\n║ ◽ .ping | .key\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════════╝` });
                    break;

                case "marcar":
                    const group = await socket.groupMetadata(from);
                    const promo = `📢 *ATENÇÃO MEMBROS!*\n\n🚀 Vamos promover o grupo para crescer a nossa comunidade de produtores! Atualmente o nosso número de membros é pequeno, vamos crescer juntos! 🇲🇿🇦🇴\n\n🔗 *PARTILHEM O LINK:* https://chat.whatsapp.com/${await socket.groupInviteCode(from)}`;
                    await socket.sendMessage(from, { text: promo, mentions: group.participants.map(p => p.id) });
                    break;

                case "link":
                    const code = await socket.groupInviteCode(from);
                    await socket.sendMessage(from, { text: `🔗 *LINK OFICIAL:* https://chat.whatsapp.com/${code}` });
                    break;

                case "infogrupo":
                    const gMeta = await socket.groupMetadata(from);
                    await socket.sendMessage(from, { text: `╔════ 🔵 *INFO GRUPO* 🔵 ════╗\n║\n║ 👥 *Membros:* ${gMeta.participants.length}\n║ 📜 *Dono:* @${gMeta.owner?.split('@')[0]}\n║ 🇲🇿 *Zona:* MZ & AO 🇦🇴\n║\n╚════════════════════════╝`, mentions: [gMeta.owner] });
                    break;

                case "infoadm":
                    await socket.sendMessage(from, { text: `👑 *JACKSON@7VIDAS*\n🎵 Cantor, Compositor & Produtor\n💳 Agente Vodacom & Movitel\n💻 Programador & Estudante\n📞 +258 87 733 8300\n🇲🇿 MZ & AO 🇦🇴` });
                    break;

                case "play": case "yt": case "drums": case "vst": case "apps": case "dicas":
                    await aviso();
                    const s = await yts(query + (command === "apps" ? " download" : " production music"));
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO*\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;

                case "ban":
                    if (target) {
                        await socket.groupParticipantsUpdate(from, [target], "remove");
                        await socket.sendMessage(from, { text: "🔴 *Ação concluída:* Usuário removido." });
                    }
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - m.messageTimestamp * 1000}ms` });
                    break;
                
                case "key":
                    const creds = fs.readFileSync('./session_data/creds.json');
                    await socket.sendMessage(sender, { text: `🔐 *SESSION_ID:* \n\n${Buffer.from(creds).toString('base64')}` });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
