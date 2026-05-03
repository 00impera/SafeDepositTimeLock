require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { ethers } = require("ethers");
const http = require("http");

// ── CONFIG ──────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";

// ── CONTRACTS ───────────────────────────────────────────────────
const VAULT_ADDR = "0x653b0fF0d62c41DFF514D7543784e9F6426020aB";
const NFT_ADDR   = "0x1C905DE49797b33cc368FC9868aBb2cBa1178773";
const OWNER_ADDR = "0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e";

// ── URLS ─────────────────────────────────────────────────────────
const MONAD_RPC  = "https://rpc.monad.xyz";
const DAPP_URL   = "https://safedeposittimelock.pages.dev";
const EXPLORER   = "https://monadscan.com";
const VISION     = "https://monadvision.com";
const DONATE_URL = `${VISION}/address/0xF5fE634114751Ef4E71799f3dD4491223416E5df`;
const COIN_LOGO  = "https://raw.githubusercontent.com/00impera/SafeDepositTimeLock/6fdd7e05f1f5c99534dade02e66eb28cca579b26/5.png.png";

// ── ABIs ─────────────────────────────────────────────────────────
const VAULT_ABI = [
  "function depositMON(uint256 lockDays) external payable",
  "function depositMONFixed(uint256 periodIndex) external payable",
  "function depositERC20(address token, uint256 amount, uint256 lockDays) external",
  "function withdraw(uint256 nftTokenId) external",
  "function earlyWithdraw(uint256 nftTokenId) external",
  "function withdrawFees() external",
  "function getUserLocks(address user) external view returns (uint256[])",
  "function getLock(uint256 lockId) external view returns (tuple(address owner, address token, uint256 amount, uint256 lockedAt, uint256 unlockTime, bool withdrawn))",
  "function accumulatedFees() external view returns (uint256)",
  "function FEE_PERCENT() external view returns (uint256)",
  "function EARLY_FEE_PERCENT() external view returns (uint256)",
  "event Deposited(uint256 indexed lockId, address indexed user, address token, uint256 amount, uint256 unlockTime, uint256 nftTokenId)",
];

// ── KEEP-ALIVE HTTP SERVER ────────────────────────────────────────
http.createServer((req, res) => res.end("OK")).listen(process.env.PORT || 3000);

// ── INIT ─────────────────────────────────────────────────────────
const bot      = new TelegramBot(BOT_TOKEN, { polling: true });
const provider = new ethers.JsonRpcProvider(MONAD_RPC);
const vault    = new ethers.Contract(VAULT_ADDR, VAULT_ABI, provider);

// ── STATE MAPS ────────────────────────────────────────────────────
const sessions   = new Map();
const referrals  = new Map();
const userLangs  = new Map();
const walletWatchers  = new Map();
const watchedBalances = new Map();

// ── FIXED PERIODS ─────────────────────────────────────────────────
const PERIODS     = [30, 90, 180, 365];
const PERIOD_LBEL = ["🥉 30 days", "🥈 90 days", "🥇 180 days", "💎 365 days"];

// ── i18n ──────────────────────────────────────────────────────────
const I18N = {
  en: {
    welcome_title:  "🏦 *SafeDeposit TimeLock* — Official Bot",
    welcome_sub:    "🔒 *Time-lock your MON tokens on Monad Mainnet!*",
    how_to_stake:   "🟢 *How to Stake / Lock MON:*\n1️⃣ Add Monad Mainnet to your wallet\n2️⃣ Get MON tokens\n3️⃣ Tap *Stake / Lock MON* below & choose a period!",
    choose_action:  "Choose an action below 👇",
    rpc_error:      "❌ RPC is slow or unavailable. Try again in a moment.",
    invalid_address:"❌ Invalid address. Please provide a valid 0x... Ethereum address.",
    invalid_amount: "❌ Invalid amount. Enter a positive number (e.g. 1.5):",
    fetching:       "⏳ Fetching data...",
    referral_msg:   "🔗 *Your Referral Link:*\n`{link}`\n\nShare to invite friends!\n\n👥 *Your referrals:* {count}",
  },
  es: {
    welcome_title:  "🏦 *SafeDeposit TimeLock* — Bot Oficial",
    welcome_sub:    "🔒 *¡Bloquea tus tokens MON en Monad Mainnet!*",
    how_to_stake:   "🟢 *Cómo bloquear MON:*\n1️⃣ Añade Monad Mainnet a tu wallet\n2️⃣ Consigue tokens MON\n3️⃣ Pulsa *Stake / Lock MON* abajo!",
    choose_action:  "Elige una acción 👇",
    rpc_error:      "❌ RPC lento. Inténtalo de nuevo.",
    invalid_address:"❌ Dirección inválida.",
    invalid_amount: "❌ Cantidad inválida:",
    fetching:       "⏳ Obteniendo datos...",
    referral_msg:   "🔗 *Tu Enlace de Referido:*\n`{link}`\n\n👥 *Referidos:* {count}",
  },
  fr: {
    welcome_title:  "🏦 *SafeDeposit TimeLock* — Bot Officiel",
    welcome_sub:    "🔒 *Bloquez vos tokens MON sur Monad Mainnet!*",
    how_to_stake:   "🟢 *Comment bloquer du MON:*\n1️⃣ Ajoutez Monad Mainnet à votre wallet\n2️⃣ Obtenez des MON\n3️⃣ Appuyez sur *Stake / Lock MON* ci-dessous!",
    choose_action:  "Choisissez une action 👇",
    rpc_error:      "❌ RPC lent. Réessayez.",
    invalid_address:"❌ Adresse invalide.",
    invalid_amount: "❌ Montant invalide:",
    fetching:       "⏳ Récupération des données...",
    referral_msg:   "🔗 *Votre Lien de Parrainage:*\n`{link}`\n\n👥 *Parrainages:* {count}",
  },
};

function t(chatId, key, vars) {
  const lang = userLangs.get(chatId) || "en";
  const dict = I18N[lang] || I18N.en;
  let str    = dict[key] || I18N.en[key] || key;
  if (vars) Object.keys(vars).forEach(k => { str = str.replace("{" + k + "}", vars[k]); });
  return str;
}

function detectLang(msg) {
  const code = (msg.from?.language_code || "en").slice(0, 2).toLowerCase();
  return I18N[code] ? code : "en";
}

// ── UTILS ─────────────────────────────────────────────────────────
function fmt(wei) {
  try { return (Number(BigInt(String(wei))) / 1e18).toFixed(4); } catch { return "0.0000"; }
}
function fmtDate(ts) {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function countdown(unlockTime) {
  const diff = Number(unlockTime) * 1000 - Date.now();
  if (diff <= 0) return "✅ READY TO WITHDRAW";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `⏳ ${d}d ${h}h ${m}m remaining`;
}
function shortAddr(a) { if (!a) return ""; return a.slice(0, 6) + "..." + a.slice(-4); }
function isAddress(s) { return /^0x[0-9a-fA-F]{40}$/.test(s); }
function isKey(s)     { return /^(0x)?[0-9a-fA-F]{64}$/.test(s); }

// ── SESSION HELPERS ───────────────────────────────────────────────
function setSession(chatId, step, data = {}) { sessions.set(chatId, { step, data }); }
function getSession(chatId) { return sessions.get(chatId) || { step: null, data: {} }; }
function clearSession(chatId) { sessions.delete(chatId); }

// ── REFERRAL HELPERS ──────────────────────────────────────────────
function getReferralCount(userId) {
  const s = referrals.get(String(userId));
  return s ? s.size : 0;
}
function recordReferral(referrerId, newUserId) {
  if (!referrerId || String(referrerId) === String(newUserId)) return;
  if (!referrals.has(String(referrerId))) referrals.set(String(referrerId), new Set());
  referrals.get(String(referrerId)).add(String(newUserId));
}

// ── CHAIN READ HELPERS ────────────────────────────────────────────
async function getUserLocks(address) {
  const ids   = await vault.getUserLocks(address);
  const datas = await Promise.all(ids.map(id => vault.getLock(id)));
  let nftMap  = {};
  try {
    const latest = await provider.getBlockNumber();
    const from   = Math.max(0, latest - 100000);
    const evts   = await vault.queryFilter(vault.filters.Deposited(), from, "latest");
    for (const ev of evts) nftMap[ev.args.lockId.toString()] = ev.args.nftTokenId.toString();
  } catch {}
  return ids.map((id, i) => ({
    lockId: id.toString(),
    nftId:  nftMap[id.toString()] || id.toString(),
    data:   datas[i],
  }));
}

async function getProtocolStats() {
  const [fees, feePct, earlyPct, vaultBal] = await Promise.all([
    vault.accumulatedFees(),
    vault.FEE_PERCENT(),
    vault.EARLY_FEE_PERCENT(),
    provider.getBalance(VAULT_ADDR),
  ]);
  return { fees, feePct, earlyPct, vaultBal };
}

// ── KEYBOARDS ─────────────────────────────────────────────────────
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "⏳ Stake / Lock MON",    callback_data: "stake_menu"   },
        { text: "🔓 Unstake / Withdraw",  callback_data: "unstake_menu" },
      ],
      [
        { text: "📋 My Locks",            callback_data: "my_locks"     },
        { text: "📊 Protocol Stats",      callback_data: "stats"        },
      ],
      [
        { text: "👁️ Watch Wallet",        callback_data: "watch"        },
        { text: "🔗 Referral",            callback_data: "referral"     },
      ],
      [
        { text: "📄 Contracts",           callback_data: "contracts"    },
        { text: "🌐 Open dApp",           url: DAPP_URL                 },
      ],
      [
        { text: "📈 MonadVision",         url: `${VISION}/address/${VAULT_ADDR}` },
        { text: "🔍 Explorer",            url: `${EXPLORER}/address/${VAULT_ADDR}` },
      ],
      [
        { text: "💚 Support / Donate",    url: DONATE_URL               },
        { text: "ℹ️ Help",               callback_data: "help_inline"  },
      ],
    ],
  },
};

// ── WELCOME BANNER ────────────────────────────────────────────────
async function sendWelcome(chatId) {
  const text =
`${t(chatId, "welcome_title")}

${t(chatId, "welcome_sub")}

🏦 *Vault Contract:*
\`${VAULT_ADDR}\`

🎫 *NFT Contract:*
\`${NFT_ADDR}\`

🌐 *Network:* Monad Mainnet · Chain 143
📐 *Standard:* ERC-20 · NFT per lock

━━━━━━━━━━━━━━━━━━━━
${t(chatId, "how_to_stake")}
━━━━━━━━━━━━━━━━━━━━

💸 *Fee:* 2% on deposit · 2% early exit penalty
⏰ *Periods:* 30 / 90 / 180 / 365 days or custom
🎫 *NFT minted automatically per lock*

${t(chatId, "choose_action")}`;

  try {
    await bot.sendPhoto(chatId, COIN_LOGO, {
      caption: text,
      parse_mode: "Markdown",
      ...mainMenu,
    });
  } catch {
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown", ...mainMenu });
  }
}

// ── /start ────────────────────────────────────────────────────────
bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  userLangs.set(chatId, detectLang(msg));
  clearSession(chatId);
  if (match && match[1]) recordReferral(match[1], chatId);
  await sendWelcome(chatId);
});

// ── /menu ─────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  clearSession(msg.chat.id);
  bot.sendMessage(msg.chat.id, "🏦 *SafeDeposit TimeLock — Main Menu*", {
    parse_mode: "Markdown", ...mainMenu,
  });
});

// ── /stake ────────────────────────────────────────────────────────
bot.onText(/\/stake/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const s = getSession(msg.chat.id);
  if (!s.data.privateKey) {
    return bot.sendMessage(msg.chat.id,
      "⚠️ Connect your wallet first!\n\nUse /connect to link your wallet.",
      { reply_markup: { inline_keyboard: [[{ text: "🔑 Connect Wallet", callback_data: "connect" }]] } }
    );
  }
  await showStakeMenu(msg.chat.id);
});

// ── /unstake ──────────────────────────────────────────────────────
bot.onText(/\/unstake/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const s = getSession(msg.chat.id);
  if (!s.data.privateKey) {
    return bot.sendMessage(msg.chat.id,
      "⚠️ Connect your wallet first!\n\nUse /connect to link your wallet.",
      { reply_markup: { inline_keyboard: [[{ text: "🔑 Connect Wallet", callback_data: "connect" }]] } }
    );
  }
  await showUnstakeMenu(msg.chat.id);
});

// ── /locks ────────────────────────────────────────────────────────
bot.onText(/\/locks (.+)/, async (msg, match) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const addr = match[1].trim();
  if (!isAddress(addr)) return bot.sendMessage(msg.chat.id, t(msg.chat.id, "invalid_address"));
  await handleMyLocks(msg.chat.id, addr);
});

// ── /stats ────────────────────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await handleStats(msg.chat.id);
});

// ── /contracts ────────────────────────────────────────────────────
bot.onText(/\/contracts/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  await handleContracts(msg.chat.id);
});

// ── /connect ─────────────────────────────────────────────────────
bot.onText(/\/connect/, async (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  setSession(msg.chat.id, "await_key", {});
  bot.sendMessage(msg.chat.id,
    `🔑 *Connect Wallet*\n\nSend your *private key* (hex, 0x...) to sign transactions.\n\n⚠️ _Stored in memory only — never written to disk. Use a dedicated wallet with small amounts._\n\nType or paste your private key:`,
    { parse_mode: "Markdown" }
  );
});

// ── /referral ─────────────────────────────────────────────────────
bot.onText(/\/referral/, async (msg) => {
  const chatId  = msg.chat.id;
  userLangs.set(chatId, detectLang(msg));
  const refLink = `https://t.me/LiquidStakingVault_Bot?start=ref_${msg.from.id}`;
  const count   = getReferralCount(msg.from.id);
  bot.sendMessage(chatId, t(chatId, "referral_msg", { link: refLink, count }), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📤 Share Link", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Lock your MON on Monad! 🏦🔒")}` }],
        [{ text: "🏠 Menu", callback_data: "menu" }],
      ],
    },
  });
});

// ── /watch ────────────────────────────────────────────────────────
bot.onText(/\/watch (.+)/, async (msg, match) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  const addr = match[1].trim();
  if (!isAddress(addr)) return bot.sendMessage(msg.chat.id, t(msg.chat.id, "invalid_address"));
  walletWatchers.set(msg.chat.id, addr.toLowerCase());
  bot.sendMessage(msg.chat.id,
    `👁️ *Watching wallet:*\n\`${addr}\`\n\nYou'll receive lock updates every 5 minutes.\nUse /stopwatch to stop.`,
    { parse_mode: "Markdown" }
  );
});

// ── /stopwatch ────────────────────────────────────────────────────
bot.onText(/\/stopwatch/, (msg) => {
  walletWatchers.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, "🛑 Wallet watch stopped.");
});

// ── /help ─────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  userLangs.set(msg.chat.id, detectLang(msg));
  sendHelp(msg.chat.id);
});

function sendHelp(chatId) {
  bot.sendMessage(chatId,
`🏦 *SafeDeposit TimeLock Bot — Commands*

/start — Welcome screen
/menu — Main menu
/connect — Connect wallet (private key)
/stake — Stake / Lock MON
/unstake — Unstake / Withdraw
/locks \`<address>\` — View locks for any address
/stats — Protocol stats
/contracts — All contract addresses
/referral — Get your referral link
/watch \`<address>\` — Watch wallet (5min updates)
/stopwatch — Stop watching
/help — This message

*Quick links:*
⏳ [Stake on dApp](${DAPP_URL})
🌐 [Open dApp](${DAPP_URL})
📈 [MonadVision](${VISION}/address/${VAULT_ADDR})
🔍 [Explorer](${EXPLORER}/address/${VAULT_ADDR})`,
    {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏳ Stake Now", callback_data: "stake_menu" }, { text: "🔓 Unstake", callback_data: "unstake_menu" }],
          [{ text: "🔗 My Referral", callback_data: "referral" }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    }
  );
}

// ── INLINE QUERY ──────────────────────────────────────────────────
bot.on("inline_query", async (query) => {
  const addr = query.query.trim();
  if (!addr) {
    return bot.answerInlineQuery(query.id, [{
      type: "article", id: "help",
      title: "🏦 SafeDeposit TimeLock",
      description: "Type a 0x wallet address to look up locks",
      input_message_content: {
        message_text: `🏦 *SafeDeposit TimeLock Bot*\n\nType a wallet address after @LiquidStakingVault_Bot to look up locks!\n\nExample: \`@LiquidStakingVault_Bot 0x1234...abcd\``,
        parse_mode: "Markdown",
      },
    }], { cache_time: 0 });
  }

  if (!isAddress(addr)) {
    return bot.answerInlineQuery(query.id, [{
      type: "article", id: "invalid",
      title: "❌ Invalid address",
      description: "Please type a valid 0x... address",
      input_message_content: { message_text: "❌ Invalid address." },
    }], { cache_time: 0 });
  }

  try {
    const locks   = await getUserLocks(addr);
    const active  = locks.filter(l => !l.data.withdrawn);
    const unlocked = active.filter(l => Date.now() / 1000 >= Number(l.data.unlockTime));
    bot.answerInlineQuery(query.id, [{
      type: "article", id: "locks",
      title: `🔒 ${active.length} active locks — ${unlocked.length} ready`,
      description: `${shortAddr(addr)} — tap to see details`,
      input_message_content: {
        message_text:
`🏦 *SafeDeposit TimeLock*

*Address:* \`${addr}\`
*Active Locks:* ${active.length}
*Ready to Withdraw:* ${unlocked.length}

[Open dApp](${DAPP_URL}) | [Explorer](${EXPLORER}/address/${addr})`,
        parse_mode: "Markdown",
      },
      reply_markup: {
        inline_keyboard: [[
          { text: "⏳ Stake Now", url: DAPP_URL },
          { text: "🔍 Explorer",  url: `${EXPLORER}/address/${addr}` },
        ]],
      },
    }], { cache_time: 30 });
  } catch {
    bot.answerInlineQuery(query.id, [{
      type: "article", id: "error",
      title: "❌ RPC Error",
      description: "Could not fetch locks. Try again.",
      input_message_content: {
        message_text: `❌ Could not fetch locks for \`${shortAddr(addr)}\`. Try again.`,
        parse_mode: "Markdown",
      },
    }], { cache_time: 0 });
  }
});

// ── CALLBACK HANDLER ──────────────────────────────────────────────
bot.on("callback_query", async (cq) => {
  const chatId = cq.message.chat.id;
  const data   = cq.data;
  await bot.answerCallbackQuery(cq.id);

  if (data === "menu") {
    clearSession(chatId);
    return bot.sendMessage(chatId, "🏦 *SafeDeposit TimeLock — Main Menu*", { parse_mode: "Markdown", ...mainMenu });
  }
  if (data === "connect") {
    setSession(chatId, "await_key", getSession(chatId).data);
    return bot.sendMessage(chatId,
      `🔑 *Connect Wallet*\n\nPaste your *private key* (0x...):\n\n⚠️ _Memory only — never stored on disk._`,
      { parse_mode: "Markdown" }
    );
  }
  if (data === "logout") {
    const s = getSession(chatId);
    setSession(chatId, null, { ...s.data, privateKey: null, address: null });
    return bot.sendMessage(chatId, "✅ Wallet disconnected.", { ...mainMenu });
  }
  if (data === "wallet_info") {
    const s = getSession(chatId);
    if (!s.data.privateKey) return bot.sendMessage(chatId, "⚠️ No wallet connected.", { reply_markup: { inline_keyboard: [[{ text: "🔑 Connect", callback_data: "connect" }]] } });
    try {
      const w   = new ethers.Wallet(s.data.privateKey, provider);
      const bal = await provider.getBalance(w.address);
      return bot.sendMessage(chatId,
        `💼 *Wallet Info*\n\n📬 \`${w.address}\`\n💰 Balance: *${fmt(bal)} MON*\n🔗 Chain: Monad #143`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔓 Logout", callback_data: "logout" }, { text: "🏠 Menu", callback_data: "menu" }]] } }
      );
    } catch (e) { return bot.sendMessage(chatId, `❌ ${e.message.slice(0, 80)}`); }
  }
  if (data === "stake_menu")   { return showStakeMenu(chatId, getSession(chatId).data); }
  if (data === "unstake_menu") { return showUnstakeMenu(chatId, getSession(chatId).data); }
  if (data === "my_locks") {
    const s = getSession(chatId);
    if (!s.data.address) {
      setSession(chatId, "await_locks_address", s.data);
      return bot.sendMessage(chatId, "📋 Enter the wallet address to check locks:");
    }
    return handleMyLocks(chatId, s.data.address);
  }
  if (data === "stats")     { return handleStats(chatId); }
  if (data === "contracts") { return handleContracts(chatId); }
  if (data === "help_inline") { return sendHelp(chatId); }
  if (data === "referral") {
    const refLink = `https://t.me/LiquidStakingVault_Bot?start=ref_${cq.from.id}`;
    const count   = getReferralCount(cq.from.id);
    return bot.sendMessage(chatId, t(chatId, "referral_msg", { link: refLink, count }), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Share Link", url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Lock your MON! 🏦🔒")}` }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    });
  }
  if (data === "watch") {
    setSession(chatId, "await_watch_address", getSession(chatId).data);
    return bot.sendMessage(chatId, "👁️ Enter the wallet address to watch:");
  }

  // ── Period select ──────────────────────────────────────────────
  if (data.startsWith("period_")) {
    const val = data.replace("period_", "");
    const s   = getSession(chatId);
    if (val === "custom") {
      setSession(chatId, "await_custom_days", s.data);
      return bot.sendMessage(chatId, "✏️ Enter number of days to lock (1–3650):");
    }
    const idx = parseInt(val);
    setSession(chatId, "await_amount", { ...s.data, periodIndex: idx, days: PERIODS[idx] });
    return bot.sendMessage(chatId,
      `💰 *Lock for ${PERIODS[idx]} days*\n\nEnter amount of *MON* to lock (e.g. \`1.5\`):`,
      { parse_mode: "Markdown" }
    );
  }

  // ── Lock action ────────────────────────────────────────────────
  if (data.startsWith("lock_action_")) {
    const parts  = data.split("_");
    const nftId  = parts[2];
    const lockId = parts[3];
    try {
      const lockData = await vault.getLock(lockId);
      const unlocked = Date.now() / 1000 >= Number(lockData.unlockTime);
      const btns     = [];
      if (unlocked) btns.push([{ text: `✅ WITHDRAW ${fmt(lockData.amount)} MON`, callback_data: `do_withdraw_${nftId}` }]);
      btns.push([{ text: `⚡ EARLY EXIT (2% fee)`, callback_data: `do_early_${nftId}` }]);
      btns.push([{ text: "← Back", callback_data: "unstake_menu" }]);
      return bot.sendMessage(chatId,
        `🔐 *Lock #${lockId}*\n\n💰 Amount: *${fmt(lockData.amount)} MON*\n📅 Locked: ${fmtDate(lockData.lockedAt)}\n⏰ Unlock: ${fmtDate(lockData.unlockTime)}\n⏳ ${countdown(lockData.unlockTime)}\n🎫 NFT #${nftId}`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: btns } }
      );
    } catch (e) { return bot.sendMessage(chatId, `❌ ${e.message.slice(0, 80)}`); }
  }

  // ── Withdraw confirm ───────────────────────────────────────────
  if (data.startsWith("do_withdraw_")) {
    const nftId = data.replace("do_withdraw_", "");
    return bot.sendMessage(chatId,
      `✅ *Confirm Withdrawal*\n\nNFT #${nftId} — 0% fee (time expired)\n\nProceed?`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "✅ CONFIRM WITHDRAW", callback_data: `exec_withdraw_${nftId}` }],
          [{ text: "❌ Cancel", callback_data: "unstake_menu" }],
        ]},
      }
    );
  }
  if (data.startsWith("exec_withdraw_")) {
    const nftId = data.replace("exec_withdraw_", "");
    return execTx(chatId, "withdraw", nftId);
  }

  // ── Early withdraw ─────────────────────────────────────────────
  if (data.startsWith("do_early_")) {
    const nftId = data.replace("do_early_", "");
    return bot.sendMessage(chatId,
      `⚡ *Early Exit*\n\n⚠️ A *2% penalty fee* applies!\n\nNFT #${nftId} — Are you sure?`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "⚡ YES, EARLY EXIT", callback_data: `exec_early_${nftId}` }],
          [{ text: "❌ Cancel", callback_data: "unstake_menu" }],
        ]},
      }
    );
  }
  if (data.startsWith("exec_early_")) {
    const nftId = data.replace("exec_early_", "");
    return execTx(chatId, "earlyWithdraw", nftId);
  }

  // ── Stake confirm ──────────────────────────────────────────────
  if (data === "exec_stake_now") {
    return execStake(chatId);
  }
});

// ── MESSAGE HANDLER ───────────────────────────────────────────────
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const chatId  = msg.chat.id;
  const text    = msg.text.trim();
  const session = getSession(chatId);

  // ── Await private key ────────────────────────────────────────
  if (session.step === "await_key") {
    try { await bot.deleteMessage(chatId, msg.message_id); } catch {}
    if (!isKey(text)) return bot.sendMessage(chatId, "❌ Invalid private key. Must be 64 hex characters.\n\nTry again:");
    const normalizedKey = text.startsWith("0x") ? text : "0x" + text;
    try {
      const w   = new ethers.Wallet(normalizedKey, provider);
      const bal = await provider.getBalance(w.address);
      setSession(chatId, null, { ...session.data, privateKey: normalizedKey, address: w.address });
      return bot.sendMessage(chatId,
        `✅ *Wallet Connected!*\n\n📬 \`${w.address}\`\n💰 Balance: *${fmt(bal)} MON*`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [
            [{ text: "⏳ Stake Now", callback_data: "stake_menu" }, { text: "🏠 Menu", callback_data: "menu" }],
            [{ text: "💼 Wallet Info", callback_data: "wallet_info" }, { text: "🔓 Logout", callback_data: "logout" }],
          ]},
        }
      );
    } catch (e) {
      setSession(chatId, null, session.data);
      return bot.sendMessage(chatId, `❌ Invalid key: ${e.message.slice(0, 60)}`);
    }
  }

  // ── Await custom days ────────────────────────────────────────
  if (session.step === "await_custom_days") {
    const days = parseInt(text);
    if (isNaN(days) || days < 1 || days > 3650) return bot.sendMessage(chatId, "❌ Enter a valid number (1–3650):");
    setSession(chatId, "await_amount", { ...session.data, days, periodIndex: null });
    return bot.sendMessage(chatId,
      `💰 Lock for *${days} days*\n\nEnter amount of MON (e.g. \`1.5\`):`,
      { parse_mode: "Markdown" }
    );
  }

  // ── Await amount ─────────────────────────────────────────────
  if (session.step === "await_amount") {
    const amt = parseFloat(text.replace(",", "."));
    if (isNaN(amt) || amt <= 0) return bot.sendMessage(chatId, t(chatId, "invalid_amount"));
    const fee    = (amt * 0.02).toFixed(4);
    const locked = (amt * 0.98).toFixed(4);
    const label  = session.data.periodIndex !== null ? PERIOD_LBEL[session.data.periodIndex] : `${session.data.days} days`;
    setSession(chatId, "confirm_stake", { ...session.data, amount: amt });
    return bot.sendMessage(chatId,
      `⏳ *Confirm Stake*\n\n📦 Amount: *${amt} MON*\n📅 Period: *${label}*\n💸 Fee (2%): *${fee} MON*\n✅ Locked: *${locked} MON*\n\nProceed?`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
          [{ text: "✅ CONFIRM STAKE", callback_data: "exec_stake_now" }],
          [{ text: "❌ Cancel", callback_data: "menu" }],
        ]},
      }
    );
  }

  // ── Await watch address ──────────────────────────────────────
  if (session.step === "await_watch_address") {
    clearSession(chatId);
    if (!isAddress(text)) return bot.sendMessage(chatId, t(chatId, "invalid_address"));
    walletWatchers.set(chatId, text.toLowerCase());
    return bot.sendMessage(chatId,
      `👁️ *Now watching:*\n\`${text}\`\n\nUpdates every 5 minutes. Use /stopwatch to stop.`,
      { parse_mode: "Markdown" }
    );
  }

  // ── Await locks address ──────────────────────────────────────
  if (session.step === "await_locks_address") {
    clearSession(chatId);
    if (!isAddress(text)) return bot.sendMessage(chatId, t(chatId, "invalid_address"));
    return handleMyLocks(chatId, text);
  }
});

// ── SHOW STAKE MENU ───────────────────────────────────────────────
async function showStakeMenu(chatId, data = {}) {
  const s = getSession(chatId);
  if (!s.data.privateKey) {
    return bot.sendMessage(chatId, "⚠️ Connect your wallet first!",
      { reply_markup: { inline_keyboard: [[{ text: "🔑 Connect Wallet", callback_data: "connect" }]] } }
    );
  }
  return bot.sendMessage(chatId,
    `⏳ *Stake / Lock MON*\n\nSelect a lock period:`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [
        PERIODS.map((d, i) => ({ text: PERIOD_LBEL[i], callback_data: `period_${i}` })),
        [{ text: "✏️ Custom days", callback_data: "period_custom" }],
        [{ text: "← Back", callback_data: "menu" }],
      ]},
    }
  );
}

// ── SHOW UNSTAKE MENU ─────────────────────────────────────────────
async function showUnstakeMenu(chatId) {
  const s = getSession(chatId);
  if (!s.data.privateKey) {
    return bot.sendMessage(chatId, "⚠️ Connect your wallet first!",
      { reply_markup: { inline_keyboard: [[{ text: "🔑 Connect Wallet", callback_data: "connect" }]] } }
    );
  }
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching"));
  try {
    const locks  = await getUserLocks(s.data.address);
    const active = locks.filter(l => !l.data.withdrawn);
    if (!active.length) {
      await bot.editMessageText("📭 No active locks found.", {
        chat_id: chatId, message_id: loading.message_id,
        reply_markup: { inline_keyboard: [[{ text: "⏳ Stake Now", callback_data: "stake_menu" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      });
      return;
    }
    const rows = active.map(l => {
      const unlocked = Date.now() / 1000 >= Number(l.data.unlockTime);
      const label    = unlocked
        ? `✅ Lock #${l.lockId} — ${fmt(l.data.amount)} MON — READY`
        : `🔒 Lock #${l.lockId} — ${fmt(l.data.amount)} MON — ${(() => { const d=Math.floor((Number(l.data.unlockTime)*1000-Date.now())/86400000); return d+"d"; })()}`;
      return [{ text: label, callback_data: `lock_action_${l.nftId}_${l.lockId}` }];
    });
    rows.push([{ text: "← Back", callback_data: "menu" }]);
    await bot.editMessageText(`🔓 *Unstake / Withdraw*\n\nSelect a lock to manage:`, {
      chat_id: chatId, message_id: loading.message_id,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: rows },
    });
  } catch (e) {
    await bot.editMessageText(`❌ Error: ${e.message.slice(0, 80)}`, {
      chat_id: chatId, message_id: loading.message_id,
    });
  }
}

// ── HANDLE MY LOCKS ───────────────────────────────────────────────
async function handleMyLocks(chatId, address) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching"));
  try {
    const locks = await getUserLocks(address);
    if (!locks.length) {
      return bot.editMessageText(`📭 *No locks found.*\n\n\`${shortAddr(address)}\` has no locks yet.`, {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "⏳ Stake Now", callback_data: "stake_menu" }, { text: "🏠 Menu", callback_data: "menu" }]] },
      });
    }
    let text = `📋 *Locks for* \`${shortAddr(address)}\`\n\n`;
    for (const { lockId, nftId, data } of locks) {
      const unlocked = Date.now() / 1000 >= Number(data.unlockTime);
      const emo = data.withdrawn ? "⬜" : unlocked ? "✅" : "🔒";
      text += `${emo} *Lock #${lockId}* — NFT #${nftId}\n`;
      text += `   💰 ${fmt(data.amount)} MON\n`;
      text += `   📅 ${fmtDate(data.lockedAt)} → ${fmtDate(data.unlockTime)}\n`;
      text += `   ${data.withdrawn ? "WITHDRAWN" : countdown(data.unlockTime)}\n\n`;
    }
    return bot.editMessageText(text, {
      chat_id: chatId, message_id: loading.message_id,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔓 Manage", callback_data: "unstake_menu" }, { text: "🔍 Explorer", url: `${EXPLORER}/address/${address}` }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    });
  } catch (e) {
    bot.editMessageText(`${t(chatId, "rpc_error")}\n\n[${EXPLORER}/address/${address}](${EXPLORER}/address/${address})`, {
      chat_id: chatId, message_id: loading.message_id, parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menu", callback_data: "menu" }]] },
    });
  }
}

// ── HANDLE STATS ──────────────────────────────────────────────────
async function handleStats(chatId) {
  const loading = await bot.sendMessage(chatId, t(chatId, "fetching"));
  try {
    const { fees, feePct, earlyPct, vaultBal } = await getProtocolStats();
    await bot.editMessageText(
`📊 *Protocol Stats*

🏦 Vault Balance: *${fmt(vaultBal)} MON*
💸 Fees Accumulated: *${fmt(fees)} MON*
📉 Deposit Fee: *${feePct}%*
⚡ Early Exit Fee: *${earlyPct}%*

📄 Vault: \`${shortAddr(VAULT_ADDR)}\`
🎫 NFT: \`${shortAddr(NFT_ADDR)}\`
🌐 Network: Monad Mainnet · Chain 143

🔗 [Open dApp](${DAPP_URL}) | [MonadVision](${VISION}/address/${VAULT_ADDR})`,
      {
        chat_id: chatId, message_id: loading.message_id,
        parse_mode: "Markdown", disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏳ Stake Now", callback_data: "stake_menu" }, { text: "🌐 dApp", url: DAPP_URL }],
            [{ text: "🏠 Menu", callback_data: "menu" }],
          ],
        },
      }
    );
  } catch (e) {
    bot.editMessageText(`${t(chatId, "rpc_error")}`, {
      chat_id: chatId, message_id: loading.message_id,
      reply_markup: { inline_keyboard: [[{ text: "🔄 Retry", callback_data: "stats" }, { text: "🏠 Menu", callback_data: "menu" }]] },
    });
  }
}

// ── HANDLE CONTRACTS ──────────────────────────────────────────────
async function handleContracts(chatId) {
  bot.sendMessage(chatId,
`📄 *All Contract Addresses*

🏦 *Vault (SafeDeposit TimeLock):*
\`${VAULT_ADDR}\`

🎫 *NFT Contract (TVLOCK):*
\`${NFT_ADDR}\`

👑 *Owner / Treasury:*
\`${OWNER_ADDR}\`

🌐 *Network:* Monad Mainnet · Chain 143
🔗 *dApp:* ${DAPP_URL}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔍 Vault", url: `${EXPLORER}/address/${VAULT_ADDR}` }, { text: "🔍 NFT", url: `${EXPLORER}/address/${NFT_ADDR}` }],
          [{ text: "📈 MonadVision", url: `${VISION}/address/${VAULT_ADDR}` }],
          [{ text: "🌐 Open dApp", url: DAPP_URL }],
          [{ text: "🏠 Menu", callback_data: "menu" }],
        ],
      },
    }
  );
}

// ── EXECUTE STAKE ─────────────────────────────────────────────────
async function execStake(chatId) {
  const s = getSession(chatId);
  if (!s.data.privateKey || !s.data.amount) return;
  const sent = await bot.sendMessage(chatId, "⏳ Sending stake transaction...");
  try {
    const signer = new ethers.Wallet(s.data.privateKey, provider);
    const vaultW = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
    const value  = ethers.parseEther(String(s.data.amount));
    let tx;
    if (s.data.periodIndex !== null && s.data.periodIndex >= 0) {
      tx = await vaultW.depositMONFixed(s.data.periodIndex, { value });
    } else {
      tx = await vaultW.depositMON(s.data.days, { value });
    }
    await bot.editMessageText(`⏳ TX sent! Confirming...\n\`${tx.hash}\``, {
      chat_id: chatId, message_id: sent.message_id, parse_mode: "Markdown"
    });
    const receipt = await tx.wait();
    const savedKey = s.data.privateKey;
    const savedAddr = s.data.address;
    clearSession(chatId);
    setSession(chatId, null, { privateKey: savedKey, address: savedAddr });
    await bot.editMessageText(
      `✅ *Stake Successful!*\n\n💰 ${s.data.amount} MON locked for ${s.data.days} days\n🔗 TX: \`${tx.hash}\`\n📦 Block: ${receipt.blockNumber}\n🎫 NFT minted automatically`,
      { chat_id: chatId, message_id: sent.message_id, parse_mode: "Markdown" }
    );
    return bot.sendMessage(chatId, "What next?", {
      reply_markup: { inline_keyboard: [
        [{ text: "📋 My Locks", callback_data: "my_locks" }, { text: "⏳ Stake More", callback_data: "stake_menu" }],
        [{ text: "🏠 Menu", callback_data: "menu" }],
      ]},
    });
  } catch (e) {
    await bot.editMessageText(`❌ *Stake Failed*\n\n${e.message.slice(0, 150)}`, {
      chat_id: chatId, message_id: sent.message_id, parse_mode: "Markdown"
    });
  }
}

// ── EXECUTE WITHDRAW / EARLY WITHDRAW ────────────────────────────
async function execTx(chatId, method, nftId) {
  const s    = getSession(chatId);
  if (!s.data.privateKey) return;
  const sent = await bot.sendMessage(chatId, `⏳ Sending ${method === "withdraw" ? "withdrawal" : "early exit"} transaction...`);
  try {
    const signer = new ethers.Wallet(s.data.privateKey, provider);
    const vaultW = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
    const tx     = await vaultW[method](BigInt(nftId));
    await bot.editMessageText(`⏳ TX sent! Confirming...\n\`${tx.hash}\``, {
      chat_id: chatId, message_id: sent.message_id, parse_mode: "Markdown"
    });
    const receipt = await tx.wait();
    await bot.editMessageText(
      `✅ *${method === "withdraw" ? "Withdrawal" : "Early Exit"} Successful!*\n\n🎫 NFT #${nftId} settled\n🔗 TX: \`${tx.hash}\`\n📦 Block: ${receipt.blockNumber}`,
      { chat_id: chatId, message_id: sent.message_id, parse_mode: "Markdown" }
    );
    return bot.sendMessage(chatId, "What next?", {
      reply_markup: { inline_keyboard: [
        [{ text: "📋 My Locks", callback_data: "my_locks" }, { text: "⏳ Stake More", callback_data: "stake_menu" }],
        [{ text: "🏠 Menu", callback_data: "menu" }],
      ]},
    });
  } catch (e) {
    await bot.editMessageText(`❌ *Transaction Failed*\n\n${e.message.slice(0, 150)}`, {
      chat_id: chatId, message_id: sent.message_id, parse_mode: "Markdown"
    });
  }
}

// ── WALLET WATCHER (every 5 min) ──────────────────────────────────
setInterval(async () => {
  for (const [chatId, address] of walletWatchers.entries()) {
    try {
      const locks   = await getUserLocks(address);
      const active  = locks.filter(l => !l.data.withdrawn);
      const ready   = active.filter(l => Date.now() / 1000 >= Number(l.data.unlockTime));
      const key     = `${chatId}:${address}`;
      const prevReady = watchedBalances.get(key);
      if (prevReady !== undefined && prevReady !== ready.length) {
        bot.sendMessage(chatId,
          `👁️ *Wallet Update*\n\n\`${shortAddr(address)}\`\n\n📋 Active Locks: ${active.length}\n✅ Ready to Withdraw: *${ready.length}*`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "🔓 Unstake Now", callback_data: "unstake_menu" }, { text: "🏠 Menu", callback_data: "menu" }]] },
          }
        );
      }
      watchedBalances.set(key, ready.length);
    } catch {}
  }
}, 5 * 60 * 1000);

// ── ERROR HANDLING ────────────────────────────────────────────────
bot.on("polling_error", (err) => console.error("Polling error:", err.message));

console.log("🏦 @LiquidStakingVault_Bot started on Monad Mainnet");
console.log(`   dApp:  ${DAPP_URL}`);
console.log(`   Vault: ${VAULT_ADDR}`);
console.log(`   NFT:   ${NFT_ADDR}`);
