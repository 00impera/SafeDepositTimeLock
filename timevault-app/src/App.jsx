import { useState, useEffect, useCallback } from "react";
import { createThirdwebClient, defineChain } from "thirdweb";
import { ThirdwebProvider, ConnectButton, BuyWidget, useActiveAccount } from "thirdweb/react";
// useActiveAccount — detects wallet connected via ConnectButton automatically
import { walletConnect, createWallet, inAppWallet } from "thirdweb/wallets";
import { OpenAPI, OneClickService } from "@defuse-protocol/one-click-sdk-typescript";

// ─── Thirdweb config ──────────────────────────────────────────────────────────
const CLIENT_ID = "821819db832d1a313ae3b1a62fbeafb7";
const client = createThirdwebClient({ clientId: CLIENT_ID });
const monad = defineChain(143);
const WALLETS = [
  inAppWallet({ auth: { options: ["email", "google", "apple"] } }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  walletConnect(),
];

// ─── Defuse Protocol One-Click SDK ───────────────────────────────────────────
OpenAPI.BASE  = "https://1click.chaindefuser.com";
OpenAPI.TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjUtMDEtMTItdjEifQ.eyJ2IjoxLCJrZXlfdHlwZSI6ImRpc3RyaWJ1dGlvbl9jaGFubmVsIiwicGFydG5lcl9pZCI6ImNyeXB0b2Nhc2gtbmZ0IiwiaWF0IjoxNzczMDc3MzExLCJleHAiOjE4MDQ2MTMzMTF9.Wi55S8cwVmAXPtOG0ymr7ldX-5CXVygzuanbjAAJHP-Am14_52C6i4cQG5FvjcAorw0KD8k8JD_YX5AM4QKhNqYtU5gsI4-KKe0KavO5_69NowzUKc_ubtjYn85eFjWskzZQvICMqSZkdGOSnMT_hNEePA8qYi_wSov4a4bQh4zIfNA0znEdDIV3rGI_bDM9dgOk0PnJRIpwi_aXOQ8Q4e50IO2UMrZEDtBVmUhK5-Mno3S_iS7tZl4QSui_4_bNCapQolFwUPB9Zqyxay_6rPVEr7j-8Ez5-htwkR5ZYvTb1mJaj3DVPpWPL9QTxhjvhbJ7nKrWpibcWX3AVoXZ6g";

const DEFUSE_TOKENS = [
  { label: "USDC (Arbitrum)", asset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", decimals: 6,  chain: "ARB"  },
  { label: "USDC (Ethereum)", asset: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near", decimals: 6,  chain: "ETH"  },
  { label: "USDC (Base)",     asset: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", decimals: 6,  chain: "BASE" },
  { label: "USDT (Arbitrum)", asset: "nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near", decimals: 6,  chain: "ARB"  },
  { label: "WETH (Arbitrum)", asset: "nep141:arb-0x82af49447d8a07e3bd95bd0d56f35241523fbab1.omft.near", decimals: 18, chain: "ARB"  },
  { label: "NEAR (NEAR)",     asset: "nep141:wrap.near",                                                  decimals: 24, chain: "NEAR" },
  { label: "SOL (Solana)",    asset: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",    decimals: 9,  chain: "SOL"  },
];

// ─── Vault config ─────────────────────────────────────────────────────────────
const VAULT_ADDR = "0x653b0fF0d62c41DFF514D7543784e9F6426020aB";
const NFT_ADDR   = "0x1C905DE49797b33cc368FC9868aBb2cBa1178773";
const BANNER_IMG = "https://raw.githubusercontent.com/00impera/SafeDepositTimeLock/6fdd7e05f1f5c99534dade02e66eb28cca579b26/5.png.png";
const VAULT_ABI = [
  "function depositMON(uint256 lockDays) external payable",
  "function depositMONFixed(uint256 periodIndex) external payable",
  "function depositERC20(address token, uint256 amount, uint256 lockDays) external",
  "function withdraw(uint256 nftTokenId) external",
  "function earlyWithdraw(uint256 nftTokenId) external",
  "function withdrawFees() external",
  "function getUserLocks(address user) external view returns (uint256[])",
  "function getLock(uint256 lockId) external view returns (tuple(address owner, address token, uint256 amount, uint256 lockedAt, uint256 unlockTime, bool withdrawn))",
  "function nftToLock(uint256) external view returns (uint256)",
  "function accumulatedFees() external view returns (uint256)",
  "function nftContract() external view returns (address)",
  "function owner() external view returns (address)",
  "function FEE_PERCENT() external view returns (uint256)",
  "function EARLY_FEE_PERCENT() external view returns (uint256)",
  "function getFixedPeriods() external view returns (uint256[])",
  "event Deposited(uint256 indexed lockId, address indexed user, address token, uint256 amount, uint256 unlockTime, uint256 nftTokenId)",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n) { return String(Math.floor(n)).padStart(2, "0"); }
function fmt(wei) {
  if (!wei) return "0.0000";
  try { return (Number(BigInt(String(wei))) / 1e18).toFixed(4); } catch { return "0.0000"; }
}
function fmtDate(ts) {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function shortAddr(a) { if (!a) return ""; return a.slice(0, 6) + "..." + a.slice(-4); }

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─── NEAR Wallet Widget ───────────────────────────────────────────────────────
function NearWalletWidget({ onClose }) {
  const [nearAccount, setNearAccount] = useState(null);
  const [nearBalance, setNearBalance] = useState(null);
  const [nearLoading, setNearLoading] = useState(false);
  const [nearError, setNearError] = useState("");

  useEffect(() => {
    // Load near-api-js from CDN
    if (!window.nearApi) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/near-api-js@2.1.4/dist/near-api-js.min.js";
      script.async = true;
      script.onload = () => initNear();
      document.head.appendChild(script);
    } else {
      initNear();
    }
  }, []);

  async function initNear() {
    try {
      if (!window.nearApi) return;
      const { connect, keyStores, WalletConnection } = window.nearApi;
      const ks = new keyStores.BrowserLocalStorageKeyStore();
      const near = await connect({
        networkId: "mainnet",
        keyStore: ks,
        nodeUrl: "https://rpc.mainnet.near.org",
        walletUrl: "https://wallet.near.org",
        helperUrl: "https://helper.mainnet.near.org",
        explorerUrl: "https://nearblocks.io",
      });
      const wallet = new WalletConnection(near, "timevault-near");
      if (wallet.isSignedIn()) {
        const accId = wallet.getAccountId();
        setNearAccount(accId);
        try {
          const acc = await near.account(accId);
          const bal = await acc.getAccountBalance();
          const available = (Number(bal.available) / 1e24).toFixed(4);
          setNearBalance(available);
        } catch {}
      }
    } catch (e) {
      setNearError("NEAR init error: " + e.message);
    }
  }

  async function loginNear() {
    if (!window.nearApi) { setNearError("near-api-js not loaded yet, please wait..."); return; }
    setNearLoading(true);
    try {
      const { connect, keyStores, WalletConnection } = window.nearApi;
      const ks = new keyStores.BrowserLocalStorageKeyStore();
      const near = await connect({
        networkId: "mainnet",
        keyStore: ks,
        nodeUrl: "https://rpc.mainnet.near.org",
        walletUrl: "https://wallet.near.org",
        helperUrl: "https://helper.mainnet.near.org",
        explorerUrl: "https://nearblocks.io",
      });
      const wallet = new WalletConnection(near, "timevault-near");
      await wallet.requestSignIn({ contractId: "wrap.near", methodNames: [] });
    } catch (e) { setNearError(e.message); }
    setNearLoading(false);
  }

  async function logoutNear() {
    if (!window.nearApi) return;
    const { connect, keyStores, WalletConnection } = window.nearApi;
    const ks = new keyStores.BrowserLocalStorageKeyStore();
    const near = await connect({
      networkId: "mainnet", keyStore: ks,
      nodeUrl: "https://rpc.mainnet.near.org",
      walletUrl: "https://wallet.near.org",
      helperUrl: "https://helper.mainnet.near.org",
      explorerUrl: "https://nearblocks.io",
    });
    const wallet = new WalletConnection(near, "timevault-near");
    wallet.signOut();
    setNearAccount(null);
    setNearBalance(null);
  }

  return (
    <div style={{ padding: 8 }}>
      {nearError && <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 12 }}>{nearError}</div>}
      {nearAccount ? (
        <div>
          <div style={{ background: "#0a1a0a", border: "1px solid #003300", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 6 }}>CONNECTED ACCOUNT</div>
            <div style={{ color: "var(--cyan)", fontSize: 14, fontWeight: 700, wordBreak: "break-all" }}>{nearAccount}</div>
            {nearBalance !== null && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 4 }}>AVAILABLE BALANCE</div>
                <div style={{ color: "#FFD700", fontSize: 22, fontWeight: 700 }}>{nearBalance} <span style={{ fontSize: 14, color: "var(--gold)" }}>NEAR</span></div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-go" style={{ flex: 2 }}
              onClick={() => window.open(`https://nearblocks.io/address/${nearAccount}`, "_blank")}>
              🔍 VIEW ON NEARBLOCKS
            </button>
            <button className="lc-btn-e" style={{ flex: 1 }} onClick={logoutNear}>LOGOUT</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ background: "#050f05", border: "1px solid #003300", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 11, color: "#888", lineHeight: 1.7 }}>
            Connect your NEAR wallet to view balance, interact with NEAR contracts, and use the Defuse bridge.<br />
            <span style={{ color: "var(--cyan)", fontSize: 10 }}>You will be redirected to wallet.near.org to sign in.</span>
          </div>
          <button className="btn-go" disabled={nearLoading} onClick={loginNear} style={{ width: "100%" }}>
            {nearLoading ? <span className="spin" /> : "◎"} CONNECT NEAR WALLET
          </button>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="pbtn" style={{ flex: 1 }} onClick={() => window.open("https://wallet.near.org", "_blank")}>wallet.near.org</button>
            <button className="pbtn" style={{ flex: 1 }} onClick={() => window.open("https://mynearwallet.com", "_blank")}>MyNearWallet</button>
            <button className="pbtn" style={{ flex: 1 }} onClick={() => window.open("https://app.mynearwallet.com/", "_blank")}>Near Wallet</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Buy with Card Widget ─────────────────────────────────────────────────────
function BuyCardWidget() {
  return (
    <div>
      <div style={{ background: "#050f05", border: "1px solid #003300", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 11, color: "var(--green)", lineHeight: 1.7 }}>
        Buy MON tokens directly with your credit/debit card via Thirdweb Payments. Powered by on/off-ramp providers.
      </div>
      <BuyWidget
        client={client}
        chain={monad}
        theme="dark"
        style={{ width: "100%", borderRadius: 10 }}
      />
    </div>
  );
}

// ─── Swap Widget ──────────────────────────────────────────────────────────────
function SwapWidget({ wallet, showToast }) {
  const [swFrom, setSwFrom] = useState(0);
  const [swTo, setSwTo] = useState(1);
  const [swAmt, setSwAmt] = useState("");
  const [swRecipient, setSwRecipient] = useState(wallet?.addr || "");
  const [swQuote, setSwQuote] = useState(null);
  const [swLoading, setSwLoading] = useState(false);
  const [swStep, setSwStep] = useState(0);
  const [swTxHash, setSwTxHash] = useState("");
  const [swStatus, setSwStatus] = useState("");

  async function getSwapQuote() {
    if (!swAmt || isNaN(swAmt) || Number(swAmt) <= 0) { showToast("Enter amount!", "err"); return; }
    if (!swRecipient) { showToast("Enter recipient address!", "err"); return; }
    const fromTok = DEFUSE_TOKENS[swFrom];
    const toTok   = DEFUSE_TOKENS[swTo];
    if (fromTok.asset === toTok.asset) { showToast("Select different tokens!", "err"); return; }
    try {
      setSwLoading(true);
      const amountRaw = String(Math.round(Number(swAmt) * Math.pow(10, fromTok.decimals)));
      const quote = await OneClickService.getQuote({
        dry: false,
        swapType: "EXACT_INPUT",
        slippageTolerance: 100,
        originAsset: fromTok.asset,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: toTok.asset,
        amount: amountRaw,
        refundTo: wallet?.addr || swRecipient,
        refundType: "ORIGIN_CHAIN",
        recipient: swRecipient,
        recipientType: "DESTINATION_CHAIN",
        deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      setSwQuote(quote);
      setSwStep(1);
      showToast("✓ Swap quote ready!");
    } catch (e) { showToast("Quote error: " + (e.message || String(e)).slice(0, 80), "err"); }
    finally { setSwLoading(false); }
  }

  async function submitSwapTx() {
    if (!swTxHash || !swQuote) return;
    try {
      setSwLoading(true);
      await OneClickService.submitDepositTx({ depositAddress: swQuote.depositAddress, txHash: swTxHash });
      setSwStep(2);
      showToast("TX submitted! Monitoring...");
      let attempts = 0;
      const poll = async () => {
        try {
          const s = await OneClickService.getExecutionStatus(swQuote.depositAddress);
          setSwStatus(s.status || "PENDING");
          if (["SUCCESS", "REFUNDED", "FAILED"].includes(s.status)) {
            setSwStep(3);
            showToast(s.status === "SUCCESS" ? "✓ Swap SUCCESS!" : "Swap " + s.status, s.status === "SUCCESS" ? "ok" : "err");
            return;
          }
          attempts++;
          if (attempts < 60) setTimeout(poll, 5000);
        } catch { attempts++; if (attempts < 60) setTimeout(poll, 8000); }
      };
      poll();
    } catch (e) { showToast("Submit error: " + (e.message || String(e)).slice(0, 80), "err"); }
    finally { setSwLoading(false); }
  }

  const reset = () => { setSwStep(0); setSwQuote(null); setSwStatus(""); setSwTxHash(""); };

  return (
    <div>
      <div className="step-row" style={{ marginBottom: 18 }}>
        {["QUOTE","DEPOSIT","SUBMIT","DONE"].map((s,i) => (
          <div key={s} className={`step${swStep>i?" done":swStep===i?" on":""}`} title={s} />
        ))}
      </div>

      {swStep === 0 && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="fl">FROM</label>
              <select className="br-sel" value={swFrom} onChange={e => setSwFrom(Number(e.target.value))}>
                {DEFUSE_TOKENS.map((t,i) => <option key={i} value={i}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ color: "var(--cyan)", fontSize: 22, paddingTop: 18 }}>⇄</div>
            <div style={{ flex: 1 }}>
              <label className="fl">TO</label>
              <select className="br-sel" value={swTo} onChange={e => setSwTo(Number(e.target.value))}>
                {DEFUSE_TOKENS.map((t,i) => <option key={i} value={i}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="fl">AMOUNT ({DEFUSE_TOKENS[swFrom].label.split(" ")[0]})</label>
            <input className="fi" type="number" placeholder="1.0" value={swAmt} onChange={e => setSwAmt(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">RECIPIENT ({DEFUSE_TOKENS[swTo].chain})</label>
            <input className="fi" type="text" placeholder="Destination address..." value={swRecipient} onChange={e => setSwRecipient(e.target.value)} />
          </div>
          <div className="fee-n">Slippage: 1% • Powered by Defuse Protocol</div>
          <button className="btn-go" style={{ marginTop: 8, width: "100%" }} disabled={swLoading || !swAmt || !swRecipient} onClick={getSwapQuote}>
            {swLoading ? <span className="spin" /> : null}⇄ GET SWAP QUOTE
          </button>
        </>
      )}

      {swStep === 1 && swQuote && (
        <>
          <div className="br-box">
            <div className="br-row"><span className="br-lbl">FROM</span><span className="br-val">{DEFUSE_TOKENS[swFrom].label}</span></div>
            <div className="br-row"><span className="br-lbl">TO</span><span className="br-val">{DEFUSE_TOKENS[swTo].label}</span></div>
            <div className="br-row"><span className="br-lbl">AMOUNT IN</span><span className="br-val">{swAmt} {DEFUSE_TOKENS[swFrom].label.split(" ")[0]}</span></div>
            <div className="br-row">
              <span className="br-lbl">AMOUNT OUT</span>
              <span className="br-val" style={{ color: "var(--green)" }}>
                ~{swQuote.amountOut ? (Number(swQuote.amountOut) / Math.pow(10, DEFUSE_TOKENS[swTo].decimals)).toFixed(6) : "?"} {DEFUSE_TOKENS[swTo].label.split(" ")[0]}
              </span>
            </div>
          </div>
          <label className="fl" style={{ display: "block", marginBottom: 6 }}>DEPOSIT ADDRESS — send tokens here:</label>
          <div className="br-addr" onClick={() => { navigator.clipboard?.writeText(swQuote.depositAddress); showToast("✓ Copied!"); }}>
            📋 {swQuote.depositAddress}
          </div>
          <div className="fg" style={{ marginTop: 12 }}>
            <label className="fl">YOUR TX HASH (after sending)</label>
            <input className="fi" type="text" placeholder="0x..." value={swTxHash} onChange={e => setSwTxHash(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-go" style={{ flex: 2, marginTop: 6 }} disabled={swLoading || !swTxHash} onClick={submitSwapTx}>
              {swLoading ? <span className="spin" /> : null}✓ SUBMIT TX
            </button>
            <button className="lc-btn-e" style={{ flex: 1 }} onClick={reset}>← BACK</button>
          </div>
        </>
      )}

      {swStep === 2 && (
        <div className="br-status pending">
          <div className="spin" style={{ width: 24, height: 24, borderWidth: 3, margin: "0 auto 14px" }} />
          SWAP IN PROGRESS<br />
          <span style={{ fontSize: 11, color: "#555" }}>STATUS: {swStatus || "PENDING"}</span>
        </div>
      )}

      {swStep === 3 && (
        <>
          <div className={`br-status ${swStatus === "SUCCESS" ? "ok" : "fail"}`}>
            {swStatus === "SUCCESS" ? "✓ SWAP COMPLETE!" : "⚠ " + swStatus}
          </div>
          <button className="btn-go" style={{ marginTop: 14, width: "100%" }} onClick={reset}>⇄ NEW SWAP</button>
        </>
      )}
    </div>
  );
}

// ─── VibButton ────────────────────────────────────────────────────────────────
function VibButton({ className, disabled, onClick, children, style }) {
  const [vib, setVib] = useState(false);
  const [smoke, setSmoke] = useState(false);
  function handleClick(e) {
    if (disabled) return;
    setVib(true); setSmoke(true);
    if (window.navigator.vibrate) window.navigator.vibrate(30);
    setTimeout(() => setVib(false), 350);
    setTimeout(() => setSmoke(false), 800);
    onClick?.(e);
  }
  return (
    <button
      type="button"
      className={`${className || ""}${vib ? " vibrate" : ""}`}
      style={{ position: "relative", overflow: "visible", ...style }}
      disabled={disabled}
      onClick={handleClick}
    >
      {smoke && (
        <span className="smoke-puff" style={{ pointerEvents: "none" }} onAnimationEnd={() => setSmoke(false)} />
      )}
      {children}
    </button>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function Countdown({ unlockTime, withdrawn }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Number(unlockTime) * 1000 - now;
  const done = diff <= 0;
  if (withdrawn) return (
    <div className="countdown"><div className="cd-label">STATUS</div>
      <div style={{ fontSize: 13, color: "#555", letterSpacing: 2 }}>WITHDRAWN</div>
    </div>
  );
  const secs = Math.max(0, diff / 1000);
  const dd = Math.floor(secs / 86400), hh = Math.floor((secs % 86400) / 3600);
  const mm = Math.floor((secs % 3600) / 60), ss = Math.floor(secs % 60);
  return (
    <div className={done ? "countdown done" : "countdown"}>
      <div className="cd-label">{done ? "✓ READY TO WITHDRAW" : "TIME REMAINING"}</div>
      <div className="cd-units">
        <span className="cu"><span className="cu-val">{pad(dd)}</span><span className="cu-lbl">DAYS</span></span>
        <span className="cd-sep">:</span>
        <span className="cu"><span className="cu-val">{pad(hh)}</span><span className="cu-lbl">HRS</span></span>
        <span className="cd-sep">:</span>
        <span className="cu"><span className="cu-val">{pad(mm)}</span><span className="cu-lbl">MIN</span></span>
        <span className="cd-sep">:</span>
        <span className="cu"><span className="cu-val">{pad(ss)}</span><span className="cu-lbl">SEC</span></span>
      </div>
    </div>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function Progress({ lockedAt, unlockTime, withdrawn }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  if (withdrawn) return null;
  const total = Number(unlockTime) - Number(lockedAt);
  const elapsed = Math.min(now / 1000 - Number(lockedAt), total);
  const pct = total > 0 ? Math.min(100, Math.round(elapsed * 100 / total)) : 0;
  return (
    <div className="prog-wrap">
      <div className="prog-bar"><div className={pct >= 100 ? "prog-fill done" : "prog-fill"} style={{ width: pct + "%" }} /></div>
      <div className="prog-txt">{pct}% ELAPSED</div>
    </div>
  );
}

// ─── LockCard ─────────────────────────────────────────────────────────────────
function LockCard({ lockId, nftId, lockData, onWithdraw, onEarlyWithdraw, loading }) {
  const { token, amount, lockedAt, unlockTime, withdrawn } = lockData;
  const unlocked = Date.now() / 1000 >= Number(unlockTime);
  const isERC20 = token !== "0x0000000000000000000000000000000000000000";
  let cls = "lock-card";
  if (withdrawn) cls += " withdrawn"; else if (unlocked) cls += " unlocked";
  return (
    <div className={cls}>
      <div className="lc-top">
        <div><div className="lc-id">LOCK #{lockId.toString()}</div><div className="lc-nft">NFT TVLOCK #{nftId.toString()}</div></div>
        <span className={withdrawn ? "badge badge-withdrawn" : unlocked ? "badge badge-unlocked" : "badge badge-locked"}>
          {withdrawn ? "WITHDRAWN" : unlocked ? "✓ UNLOCKED" : "LOCKED"}
        </span>
      </div>
      <div className="lc-amount">{fmt(amount)} <span className="lc-sym">{isERC20 ? "ERC20" : "MON"}</span></div>
      <div className="lc-token">{isERC20 ? shortAddr(token) : "MONAD NATIVE"}</div>
      <Countdown unlockTime={unlockTime} withdrawn={withdrawn} />
      <Progress lockedAt={lockedAt} unlockTime={unlockTime} withdrawn={withdrawn} />
      <div className="lc-dates">
        <div className="lc-di"><div className="lc-dl">LOCKED AT</div><div className="lc-dv">{fmtDate(lockedAt)}</div></div>
        <div className="lc-di"><div className="lc-dl">UNLOCK AT</div><div className="lc-dv">{fmtDate(unlockTime)}</div></div>
      </div>
      {!withdrawn && (
        <div className="lc-btns">
          <VibButton className="lc-btn" style={{ flex: 1 }} disabled={!unlocked || loading} onClick={() => onWithdraw(nftId)}>
            {loading ? <span className="spin" /> : null}{unlocked ? "WITHDRAW" : "LOCKED"}
          </VibButton>
          <VibButton className="lc-btn-e" style={{ flex: 1 }} disabled={unlocked || withdrawn || loading} onClick={() => onEarlyWithdraw(nftId)}>
            EARLY EXIT
          </VibButton>
        </div>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return <div className={type === "err" ? "toast err" : "toast"}>{msg}</div>;
}

// ─── AppInner ─────────────────────────────────────────────────────────────────
function AppInner() {
  const [tab, setTab] = useState("locks");
  const [wallet, setWallet] = useState(null);
  const [locks, setLocks] = useState([]);
  const [nftMap, setNftMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ balance: "0", lockCount: 0, lockedMon: "0", fees: "0" });
  const [adminOwner, setAdminOwner] = useState("");
  const [depAmt, setDepAmt] = useState("");
  const [depDays, setDepDays] = useState(30);
  const [depMode, setDepMode] = useState("fixed");
  const [depToken, setDepToken] = useState("");
  const [depErcAmt, setDepErcAmt] = useState("");
  const [depErcDays, setDepErcDays] = useState(30);

  // Bridge state
  const [brFrom, setBrFrom] = useState(0);
  const [brTo, setBrTo] = useState(6);
  const [brAmt, setBrAmt] = useState("");
  const [brRecipient, setBrRecipient] = useState("");
  const [brRefund, setBrRefund] = useState("");
  const [brQuote, setBrQuote] = useState(null);
  const [brStatus, setBrStatus] = useState("");
  const [brTxHash, setBrTxHash] = useState("");
  const [brLoading, setBrLoading] = useState(false);
  const [brStep, setBrStep] = useState(0);

  // Modal state
  const [modal, setModal] = useState(null); // "near" | "buy" | "swap"

  const showToast = (msg, type = "ok") => setToast({ msg, type });
  const PERIODS = [30, 90, 180, 365];

  // ─── Auto-sync: detect wallet from ConnectButton (thirdweb) ───────────────
  const activeAccount = useActiveAccount();

  useEffect(() => {
    if (!activeAccount?.address) {
      // wallet disconnected — reset state
      setWallet(null);
      setLocks([]);
      setNftMap({});
      setStats({ balance: "0", lockCount: 0, lockedMon: "0", fees: "0" });
      return;
    }
    const addr = activeAccount.address;
    async function syncWallet() {
      try {
        const { ethers } = await import("ethers");
        // Use injected provider (MetaMask / any browser wallet)
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : new ethers.JsonRpcProvider("https://rpc.monad.xyz");
        let signer = null;
        try { signer = await provider.getSigner(); } catch {}
        setWallet({ addr, provider, signer, ethers });
        loadData(addr, provider, ethers);
      } catch (e) {
        showToast("Wallet sync error: " + e.message, "err");
      }
    }
    syncWallet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccount?.address]);

  // ─── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async (addr, provider, ethers) => {
    try {
      setLoading(true);
      // Always use a reliable RPC for read operations on Monad mainnet
      let readProvider = provider;
      try {
        // Test provider works
        await provider.getBlockNumber();
      } catch {
        readProvider = new ethers.JsonRpcProvider("https://rpc.monad.xyz");
      }
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, readProvider);
      const lockIds = await vault.getUserLocks(addr);
      const fees = await vault.accumulatedFees();
      const ownerAddr = await vault.owner();
      setAdminOwner(ownerAddr);
      const balance = await readProvider.getBalance(addr);
      const lockDatas = await Promise.all(lockIds.map(id => vault.getLock(id)));

      // Get NFT mapping from events — use last 50000 blocks to avoid timeout
      let nftMapping = {};
      try {
        const latestBlock = await readProvider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 50000);
        const events = await vault.queryFilter(vault.filters.Deposited(), fromBlock, "latest");
        for (const ev of events) nftMapping[ev.args.lockId.toString()] = ev.args.nftTokenId;
      } catch {
        // fallback: try without block range
        try {
          const events = await vault.queryFilter(vault.filters.Deposited(), 0, "latest");
          for (const ev of events) nftMapping[ev.args.lockId.toString()] = ev.args.nftTokenId;
        } catch {}
      }
      setNftMap(nftMapping);

      const lockObjs = lockIds.map((id, i) => ({ id, data: lockDatas[i] }));
      setLocks(lockObjs);
      const lockedMon = lockObjs
        .filter(l => !l.data.withdrawn && l.data.token === "0x0000000000000000000000000000000000000000")
        .reduce((acc, l) => acc + BigInt(String(l.data.amount)), BigInt(0));
      setStats({
        balance: (Number(balance) / 1e18).toFixed(4),
        lockCount: lockIds.length,
        lockedMon: (Number(lockedMon) / 1e18).toFixed(4),
        fees: (Number(fees) / 1e18).toFixed(4),
      });
    } catch (e) { showToast("Load error: " + e.message, "err"); }
    finally { setLoading(false); }
  }, []);

  // ─── Helper: get fresh signer ─────────────────────────────────────────────
  const getSigner = async () => {
    const { ethers } = await import("ethers");
    if (!window.ethereum) throw new Error("No wallet detected. Please connect MetaMask.");
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    return { ethers, provider, signer };
  };

  // ─── Vault actions ────────────────────────────────────────────────────────
  const depositMON = async () => {
    if (!wallet) { showToast("Connect wallet first!", "err"); return; }
    if (!depAmt || isNaN(depAmt)) { showToast("Enter amount!", "err"); return; }
    try {
      setTxLoading(true);
      const { ethers, signer } = await getSigner();
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
      const value = ethers.parseEther(depAmt);
      let tx;
      if (depMode === "fixed" && PERIODS.includes(depDays)) {
        tx = await vault.depositMONFixed(PERIODS.indexOf(depDays), { value });
      } else {
        tx = await vault.depositMON(depDays, { value });
      }
      showToast("TX sent...");
      await tx.wait();
      showToast("✓ Deposit success! " + depAmt + " MON locked for " + depDays + " days");
      setDepAmt("");
      loadData(wallet.addr, wallet.provider, ethers);
    } catch (e) { showToast(e.message.slice(0, 80), "err"); }
    finally { setTxLoading(false); }
  };

  const depositERC20 = async () => {
    if (!wallet) { showToast("Connect wallet first!", "err"); return; }
    if (!depToken || !depErcAmt || isNaN(depErcAmt)) { showToast("Enter token address and amount!", "err"); return; }
    try {
      setTxLoading(true);
      const { ethers, signer } = await getSigner();
      const erc20Abi = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function decimals() external view returns (uint8)",
      ];
      const tokenContract = new ethers.Contract(depToken, erc20Abi, signer);
      let decimals = 18;
      try { decimals = await tokenContract.decimals(); } catch {}
      const parsedAmt = ethers.parseUnits(depErcAmt, decimals);
      showToast("Approving token...");
      const approveTx = await tokenContract.approve(VAULT_ADDR, parsedAmt);
      await approveTx.wait();
      showToast("Approved! Depositing...");
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
      const tx = await vault.depositERC20(depToken, parsedAmt, depErcDays);
      await tx.wait();
      showToast("✓ ERC20 deposited! " + depErcAmt + " tokens locked for " + depErcDays + " days");
      setDepToken(""); setDepErcAmt("");
      loadData(wallet.addr, wallet.provider, ethers);
    } catch (e) { showToast(e.message.slice(0, 80), "err"); }
    finally { setTxLoading(false); }
  };

  const doWithdraw = async (nftId) => {
    if (!wallet) { showToast("Connect wallet!", "err"); return; }
    try {
      setTxLoading(true);
      const { ethers, signer } = await getSigner();
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
      const tx = await vault.withdraw(nftId);
      await tx.wait();
      showToast("✓ Withdraw success!");
      loadData(wallet.addr, wallet.provider, ethers);
    } catch (e) { showToast(e.message.slice(0, 80), "err"); }
    finally { setTxLoading(false); }
  };

  const doEarlyWithdraw = async (nftId) => {
    if (!wallet) { showToast("Connect wallet!", "err"); return; }
    if (!window.confirm("Are you sure? 2% early exit penalty applies!")) return;
    try {
      setTxLoading(true);
      const { ethers, signer } = await getSigner();
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
      const tx = await vault.earlyWithdraw(nftId);
      await tx.wait();
      showToast("✓ Early withdraw success!");
      loadData(wallet.addr, wallet.provider, ethers);
    } catch (e) { showToast(e.message.slice(0, 80), "err"); }
    finally { setTxLoading(false); }
  };

  const doCollectFees = async () => {
    if (!wallet) { showToast("Connect wallet!", "err"); return; }
    try {
      setTxLoading(true);
      const { ethers, signer } = await getSigner();
      const vault = new ethers.Contract(VAULT_ADDR, VAULT_ABI, signer);
      const tx = await vault.withdrawFees();
      await tx.wait();
      showToast("✓ Fees collected!");
      loadData(wallet.addr, wallet.provider, ethers);
    } catch (e) { showToast(e.message.slice(0, 80), "err"); }
    finally { setTxLoading(false); }
  };

  // ─── Bridge (Defuse Protocol SDK) ─────────────────────────────────────────
  const brGetQuote = async () => {
    if (!brAmt || isNaN(brAmt) || Number(brAmt) <= 0) { showToast("Enter amount!", "err"); return; }
    if (!brRecipient) { showToast("Enter recipient address!", "err"); return; }
    const fromTok = DEFUSE_TOKENS[brFrom];
    const toTok   = DEFUSE_TOKENS[brTo];
    if (fromTok.asset === toTok.asset) { showToast("Select different tokens!", "err"); return; }
    try {
      setBrLoading(true);
      const amountRaw = String(Math.round(Number(brAmt) * Math.pow(10, fromTok.decimals)));
      const refundAddr = brRefund || wallet?.addr || brRecipient;
      const quote = await OneClickService.getQuote({
        dry: false,
        swapType: "EXACT_INPUT",
        slippageTolerance: 100,
        originAsset: fromTok.asset,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: toTok.asset,
        amount: amountRaw,
        refundTo: refundAddr,
        refundType: "ORIGIN_CHAIN",
        recipient: brRecipient,
        recipientType: "DESTINATION_CHAIN",
        deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      setBrQuote(quote);
      setBrStep(1);
      showToast("✓ Quote received! Send tokens to deposit address.");
    } catch (e) { showToast("Quote error: " + (e.message || String(e)).slice(0, 80), "err"); }
    finally { setBrLoading(false); }
  };

  const brSubmitTx = async () => {
    if (!brTxHash || !brQuote) return;
    try {
      setBrLoading(true);
      await OneClickService.submitDepositTx({
        depositAddress: brQuote.depositAddress,
        txHash: brTxHash,
      });
      setBrStep(2);
      showToast("TX submitted! Monitoring...");
      brPollStatus(brQuote.depositAddress);
    } catch (e) { showToast("Submit error: " + (e.message || String(e)).slice(0, 80), "err"); }
    finally { setBrLoading(false); }
  };

  const brPollStatus = (depositAddr) => {
    let attempts = 0;
    const poll = async () => {
      try {
        const s = await OneClickService.getExecutionStatus(depositAddr);
        setBrStatus(s.status || "PENDING");
        if (["SUCCESS", "REFUNDED", "FAILED"].includes(s.status)) {
          setBrStep(3);
          showToast(s.status === "SUCCESS" ? "✓ Bridge SUCCESS!" : "Bridge " + s.status,
            s.status === "SUCCESS" ? "ok" : "err");
          return;
        }
        attempts++;
        if (attempts < 60) setTimeout(poll, 5000);
      } catch { attempts++; if (attempts < 60) setTimeout(poll, 8000); }
    };
    poll();
  };

  const brReset = () => { setBrStep(0); setBrQuote(null); setBrStatus(""); setBrTxHash(""); };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--gold:#C8960C;--bright:#FFD700;--lg:#FFE566;--green:#39FF14;--dark:#020608;--bg2:#070d10;--border:#1a3a1a;--purple:#a259ff;--cyan:#00eaff;--pink:#ff6ec7;--red:#ff4444;--mono:'Share Tech Mono',monospace;--sans:'Rajdhani',sans-serif;}
        body{background:var(--dark);color:#FFD700;font-family:var(--mono);min-height:100vh}
        .scanline{position:fixed;inset:0;pointer-events:none;z-index:9999;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)}
        .app{max-width:1100px;margin:0 auto;padding:0 20px 80px}
        .banner-wrap{width:100%;overflow:hidden;border-bottom:2px solid var(--gold);max-height:220px;display:flex;align-items:center;justify-content:center;background:#000}
        .banner-img{width:100%;max-height:220px;object-fit:cover;display:block}
        .nav{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--dark);z-index:100}
        .nav-brand{display:flex;align-items:center;gap:10px}
        .nav-logo{width:32px;height:32px;object-fit:contain;border-radius:6px}
        .nav-title{font-family:var(--sans);font-size:22px;font-weight:700;letter-spacing:4px;color:#FFD700}
        .nav-sub{font-size:10px;color:var(--green);letter-spacing:3px;margin-top:2px}
        .nav-right{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .tag{font-size:10px;padding:3px 8px;border-radius:4px;font-weight:bold;letter-spacing:1px}
        .tag-c{background:#0a1a0a;border:1px solid var(--green);color:var(--green)}
        .tag-p{background:#0a0a1a;border:1px solid var(--purple);color:var(--purple);font-size:9px}
        .supp-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;margin:12px 0;background:#050f05;border:1px solid #003300;border-radius:8px}
        .supp-txt{font-size:11px;color:var(--green);opacity:.7}
        .btn-supp{padding:8px 20px;background:var(--dark);border:none;border-radius:6px;cursor:pointer;font-family:var(--mono);font-size:12px;font-weight:bold;box-shadow:0 0 8px #003300;transition:all .2s;text-decoration:none;display:inline-block}
        .btn-supp:hover{box-shadow:0 0 20px #00FF0066,0 0 0 1px #004400;transform:scale(1.04)}
        .shimmer{background:linear-gradient(90deg,#39FF14 0%,#00FF00 30%,#fff 50%,#00FF00 70%,#39FF14 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:sh 2s linear infinite;letter-spacing:2px}
        @keyframes sh{0%{background-position:200% center}100%{background-position:0% center}}
        .wbar{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0;overflow:visible}
        .wbtn{padding:9px 18px;border-radius:6px;font-family:var(--mono);font-size:11px;font-weight:bold;cursor:pointer;transition:all .2s;letter-spacing:1px;background:transparent;outline:none;display:inline-flex;align-items:center;gap:6px}
        .wbtn-near{border:1px solid var(--cyan);color:var(--cyan)}.wbtn-near:hover{box-shadow:0 0 12px #00eaff66;background:#0a1a1a66}
        .wbtn-card{border:1px solid var(--pink);color:var(--pink)}.wbtn-card:hover{box-shadow:0 0 12px #ff6ec766;background:#1a0a1466}
        .wbtn-swap{border:1px solid var(--cyan);color:var(--cyan)}.wbtn-swap:hover{box-shadow:0 0 12px #00eaff66;background:#0a121866}
        .wbtn-ok{border:1px solid var(--green);color:var(--green)}.wbtn-ok:hover{box-shadow:0 0 12px #39FF1466;background:#0a1a0a66}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
        .stat{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center}
        .stat-val{font-family:var(--sans);font-size:24px;font-weight:700;color:#FFD700;line-height:1}
        .stat-lbl{font-size:9px;color:var(--green);margin-top:5px;letter-spacing:2px;opacity:.8}
        .tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:22px;flex-wrap:wrap}
        .tab{padding:12px 22px;cursor:pointer;font-size:12px;font-weight:bold;color:#444;border-bottom:2px solid transparent;transition:all .2s;letter-spacing:2px}
        .tab.on{color:#FFD700;border-bottom-color:var(--gold)}.tab:hover:not(.on){color:#888}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px}
        .card-t{font-size:11px;color:var(--gold);letter-spacing:3px;margin-bottom:18px;font-weight:bold}
        .fg{margin-bottom:14px}
        .fl{font-size:10px;color:var(--green);letter-spacing:2px;margin-bottom:6px;display:block;opacity:.8}
        .fi{width:100%;padding:10px 12px;background:var(--dark);border:1px solid var(--border);border-radius:6px;color:#FFD700;font-family:var(--mono);font-size:13px;outline:none;transition:border-color .2s}
        .fi:focus{border-color:var(--gold)}
        .prow{display:flex;gap:6px;flex-wrap:wrap}
        .pbtn{padding:7px 14px;border-radius:5px;cursor:pointer;font-size:11px;border:1px solid var(--border);background:var(--dark);color:#666;font-family:var(--mono);transition:all .2s;letter-spacing:1px;outline:none}
        .pbtn.on,.pbtn:hover{border-color:var(--gold);color:#FFD700;background:#0a1a0a}
        .fee-n{background:#050f05;border:1px solid #003300;border-radius:6px;padding:8px 12px;font-size:11px;color:var(--green);margin-bottom:12px;opacity:.8}
        .btn-go{width:100%;padding:13px;border-radius:8px;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:bold;border:none;background:linear-gradient(90deg,var(--gold),#FFD700,#FFE566);color:var(--dark);letter-spacing:2px;transition:all .2s;margin-top:6px;outline:none;position:relative;overflow:hidden}
        .btn-go:hover:not(:disabled){box-shadow:0 0 20px #39FF1444,0 0 0 1px #003300;transform:scale(1.01)}
        .btn-go:disabled{opacity:.4;cursor:not-allowed}
        .btn-adm{width:100%;padding:13px;border-radius:8px;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:bold;border:1px solid var(--purple);background:#120a1a;color:var(--purple);letter-spacing:2px;transition:all .2s;margin-top:6px;outline:none;position:relative;overflow:hidden}
        .btn-adm:hover:not(:disabled){box-shadow:0 0 16px #a259ff66}
        .btn-adm:disabled{opacity:.4;cursor:not-allowed}
        .vibrate{animation:vibrate-btn 0.35s linear}
        @keyframes vibrate-btn{0%,100%{transform:translate(0,0) rotate(0deg)}12%{transform:translate(-2px,2px) rotate(-2deg)}25%{transform:translate(2px,-2px) rotate(2deg)}50%{transform:translate(2px,3px) rotate(1.5deg)}75%{transform:translate(3px,-2px) rotate(2deg)}}
        .smoke-puff{position:absolute;left:50%;top:0;transform:translate(-50%,-60%) scale(0.8);width:44px;height:44px;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,255,255,0.6) 0%,rgba(255,220,80,0.3) 40%,rgba(255,255,255,0) 80%);border-radius:50%;z-index:999;animation:smoke-pop 0.8s forwards}
        @keyframes smoke-pop{0%{opacity:0.8;transform:translate(-50%,-60%) scale(0.8)}40%{opacity:0.6;transform:translate(-50%,-130%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-220%) scale(1.8)}}
        .locks-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
        .lock-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;position:relative;overflow:hidden;transition:border-color .3s}
        .lock-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--gold),#FFD700,var(--green))}
        .lock-card.unlocked{border-color:#39FF1444}.lock-card.unlocked::before{background:linear-gradient(90deg,var(--green),#00FF00)}
        .lock-card.withdrawn{border-color:#1a1a1a;opacity:.6}.lock-card.withdrawn::before{background:#1a1a1a}
        .lc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
        .lc-id{font-family:var(--sans);font-size:20px;font-weight:700;color:#FFD700}
        .lc-nft{font-size:9px;color:var(--purple);letter-spacing:1px;margin-top:3px}
        .badge{padding:4px 10px;border-radius:20px;font-size:9px;font-weight:bold;letter-spacing:1px}
        .badge-locked{background:#1a0a00;color:var(--gold);border:1px solid #C8960C44}
        .badge-unlocked{background:#0a1a0a;color:var(--green);border:1px solid #39FF1444;animation:pg 2s infinite}
        .badge-withdrawn{background:#111;color:#555;border:1px solid #222}
        @keyframes pg{0%,100%{box-shadow:0 0 0 0 #39FF1422}50%{box-shadow:0 0 0 6px transparent}}
        .lc-amount{font-family:var(--sans);font-size:28px;font-weight:700;color:#FFD700;margin-bottom:4px}
        .lc-sym{font-size:16px;color:var(--gold)}
        .lc-token{font-size:10px;color:var(--green);letter-spacing:2px;margin-bottom:16px}
        .countdown{background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px}
        .countdown.done{border-color:#39FF1444}
        .cd-label{font-size:9px;color:#555;letter-spacing:2px;margin-bottom:8px}
        .countdown.done .cd-label{color:var(--green)}
        .cd-units{display:flex;align-items:center;gap:4px}
        .cu{display:inline-flex;flex-direction:column;align-items:center;flex:1}
        .cu-val{font-family:var(--sans);font-size:22px;font-weight:700;color:#FFD700;line-height:1}
        .countdown.done .cu-val{color:var(--green)}
        .cu-lbl{font-size:8px;color:#555;letter-spacing:1px;margin-top:3px}
        .cd-sep{font-size:18px;color:#333;padding-bottom:8px}
        .prog-wrap{margin-bottom:14px}
        .prog-bar{height:4px;background:#0a1a0a;border-radius:2px;overflow:hidden}
        .prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--gold),#FFD700);transition:width .5s}
        .prog-fill.done{background:linear-gradient(90deg,var(--green),#00FF00)}
        .prog-txt{font-size:9px;color:#444;margin-top:4px;letter-spacing:1px}
        .lc-dates{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
        .lc-di{background:var(--dark);border-radius:6px;padding:8px 10px}
        .lc-dl{font-size:9px;color:#555;letter-spacing:1px;margin-bottom:3px}
        .lc-dv{font-size:11px;color:#FFD700}
        .lc-btns{display:flex;gap:8px}
        .lc-btn{flex:1;padding:10px;border-radius:6px;cursor:pointer;font-family:var(--mono);font-size:11px;font-weight:bold;border:none;letter-spacing:1px;transition:all .2s;background:linear-gradient(90deg,var(--gold),#FFD700);color:var(--dark);outline:none;position:relative;overflow:hidden}
        .lc-btn:hover:not(:disabled){box-shadow:0 0 12px #39FF1444;transform:scale(1.02)}
        .lc-btn:disabled{opacity:.3;cursor:not-allowed}
        .lc-btn-e{flex:1;padding:10px;border-radius:6px;cursor:pointer;font-family:var(--mono);font-size:11px;font-weight:bold;border:1px solid #ff444488;background:#1a0505;color:#ff8888;letter-spacing:1px;transition:all .2s;outline:none;position:relative;overflow:hidden}
        .lc-btn-e:hover:not(:disabled){box-shadow:0 0 10px #ff444444}
        .lc-btn-e:disabled{opacity:.3;cursor:not-allowed}
        .empty{text-align:center;padding:60px 20px;color:#333}
        .empty-logo{width:60px;height:60px;object-fit:contain;margin-bottom:16px;opacity:.4}
        .empty-txt{font-size:13px;letter-spacing:2px}
        .adm-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #0f2a0f}
        .adm-row:last-of-type{border-bottom:none}
        .adm-l{font-size:10px;color:#555;letter-spacing:1px}
        .adm-v{font-size:13px;color:#FFD700}
        .toast{position:fixed;bottom:24px;right:24px;z-index:99999;background:#0a1a0a;border:1px solid var(--green);border-radius:8px;padding:14px 20px;font-size:12px;color:var(--green);box-shadow:0 0 20px #39FF1422;animation:ti .3s ease;max-width:320px;letter-spacing:1px}
        .toast.err{border-color:var(--red);color:#ff8888;background:#1a0505}
        @keyframes ti{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        .spin{display:inline-block;width:14px;height:14px;border:2px solid #333;border-top-color:var(--green);border-radius:50%;animation:sp .8s linear infinite;margin-right:6px;vertical-align:middle}
        @keyframes sp{to{transform:rotate(360deg)}}
        .mode-row{display:flex;gap:8px;margin-bottom:8px}
        .br-sel{width:100%;padding:10px 12px;background:var(--dark);border:1px solid var(--border);border-radius:6px;color:#FFD700;font-family:var(--mono);font-size:12px;outline:none;cursor:pointer;transition:border-color .2s}
        .br-sel:focus{border-color:var(--gold)}
        .br-sel option{background:var(--dark);color:#FFD700}
        .br-arrow{text-align:center;font-size:22px;color:var(--cyan);padding:6px 0;letter-spacing:2px}
        .br-box{background:#020f02;border:1px solid #003300;border-radius:10px;padding:14px;margin-bottom:14px;font-size:11px}
        .br-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #0a1a0a}
        .br-row:last-child{border-bottom:none}
        .br-lbl{color:#555;letter-spacing:1px}
        .br-val{color:#FFD700;word-break:break-all;text-align:right;max-width:60%;font-size:10px}
        .br-addr{background:#000;border:1px solid var(--cyan);border-radius:6px;padding:10px 14px;font-size:11px;color:var(--cyan);letter-spacing:1px;word-break:break-all;margin:10px 0;cursor:pointer}
        .br-addr:hover{box-shadow:0 0 10px #00eaff44}
        .br-status{text-align:center;padding:20px;font-size:14px;letter-spacing:3px}
        .br-status.ok{color:var(--green)}
        .br-status.fail{color:var(--red)}
        .br-status.pending{color:var(--gold)}
        .step-row{display:flex;gap:6px;margin-bottom:18px}
        .step{flex:1;height:3px;border-radius:2px;background:#0a1a0a;transition:background .4s}
        .step.on{background:var(--cyan)}
        .step.done{background:var(--green)}

        /* ── Modal ── */
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
        .modal-box{background:#070d10;border:1px solid var(--gold);border-radius:14px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 0 40px #C8960C33}
        .modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid var(--border)}
        .modal-title{font-size:12px;font-weight:bold;color:var(--gold);letter-spacing:3px}
        .modal-close{background:none;border:none;color:#555;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:all .2s;font-family:var(--mono)}
        .modal-close:hover{color:var(--red);background:#1a0505}
        .modal-body{padding:20px}

        @media(max-width:700px){.stats{grid-template-columns:repeat(2,1fr)}.g2{grid-template-columns:1fr}.lc-dates{grid-template-columns:1fr}.wbar{gap:6px}.wbtn{padding:7px 12px;font-size:10px}}
      `}</style>

      <div className="scanline" />
      <div className="banner-wrap">
        <img src={BANNER_IMG} alt="TimeVault" className="banner-img" onError={e => { e.target.style.display = 'none'; }} />
      </div>

      <div className="app">
        <nav className="nav">
          <div className="nav-brand">
            <img src={BANNER_IMG} alt="logo" className="nav-logo" onError={e => { e.target.style.display = 'none'; }} />
            <div>
              <div className="nav-title">TIMEVAULT</div>
              <div className="nav-sub">MONAD MAINNET</div>
            </div>
          </div>
          <div className="nav-right">
            <span className="tag tag-c">⬡ MONAD #143</span>
            <span className="tag tag-p">2 CONTRACTS LIVE</span>
            <ConnectButton client={client} chain={monad} wallets={WALLETS} theme="dark" />
          </div>
        </nav>

        <div className="supp-bar">
          <span className="supp-txt">⬇ Support TimeVault Protocol Development</span>
          <a href="https://monadvision.com/address/0xF5fE634114751Ef4E71799f3dD4491223416E5df"
            target="_blank" rel="noreferrer" className="btn-supp">
            <span className="shimmer">⬇ SUPPORT DONATE</span>
          </a>
        </div>

        {/* ── Quick Action Bar — only functional widget buttons ── */}
        <div className="wbar">
          <VibButton className="wbtn wbtn-near" onClick={() => setModal("near")}>
            ◎ NEAR WALLET
          </VibButton>
          <VibButton className="wbtn wbtn-card" onClick={() => setModal("buy")}>
            💳 BUY WITH CARD
          </VibButton>
          <VibButton className="wbtn wbtn-swap" onClick={() => setModal("swap")}>
            ⇄ QUICK SWAP
          </VibButton>
          {wallet && (
            <VibButton className="wbtn wbtn-ok" onClick={() => loadData(wallet.addr, wallet.provider, wallet.ethers)}>
              {loading ? <span className="spin" /> : "↻"} REFRESH
            </VibButton>
          )}
          {wallet && (
            <span className="wbtn wbtn-ok" style={{ cursor: "default" }}>{shortAddr(wallet.addr)}</span>
          )}
        </div>

        <div className="stats">
          <div className="stat"><div className="stat-val">{stats.balance}</div><div className="stat-lbl">MON BALANCE</div></div>
          <div className="stat"><div className="stat-val">{stats.lockCount}</div><div className="stat-lbl">ACTIVE LOCKS</div></div>
          <div className="stat"><div className="stat-val">{stats.lockedMon}</div><div className="stat-lbl">MON LOCKED</div></div>
          <div className="stat"><div className="stat-val">{stats.fees}</div><div className="stat-lbl">FEES ACCUMULATED</div></div>
        </div>

        <div className="tabs">
          {[["locks","MY LOCKS"],["deposit","DEPOSIT"],["bridge","⇄ BRIDGE"],["admin","ADMIN"]].map(([k,l]) => (
            <div key={k} className={tab===k?"tab on":"tab"} onClick={() => setTab(k)}>{l}</div>
          ))}
        </div>

        {tab==="locks" && (
          locks.length===0
            ? <div className="empty">
                <img src={BANNER_IMG} alt="logo" className="empty-logo" />
                <div className="empty-txt">{loading ? "LOADING..." : "NO ACTIVE LOCKS"}</div>
                {!wallet && <div style={{fontSize:11,color:"#333",marginTop:12,letterSpacing:2}}>CONNECT YOUR WALLET</div>}
              </div>
            : <div className="locks-grid">
                {locks.map(({id,data}) => (
                  <LockCard key={id.toString()} lockId={id}
                    nftId={nftMap[id.toString()]!=null?nftMap[id.toString()]:id}
                    lockData={data} onWithdraw={doWithdraw} onEarlyWithdraw={doEarlyWithdraw} loading={txLoading} />
                ))}
              </div>
        )}

        {tab==="deposit" && (
          <div className="g2">
            <div className="card">
              <div className="card-t">DEPOSIT MON</div>
              <div className="fee-n">Fee: 2% on deposit • NFT minted automatically per lock</div>
              <div className="fg">
                <label className="fl">AMOUNT (MON)</label>
                <input className="fi" type="number" placeholder="1.0" value={depAmt}
                  onChange={e => setDepAmt(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="fg">
                <label className="fl">LOCK PERIOD</label>
                <div className="mode-row">
                  <button type="button" className={depMode==="fixed"?"pbtn on":"pbtn"} onClick={()=>setDepMode("fixed")}>FIXED</button>
                  <button type="button" className={depMode==="custom"?"pbtn on":"pbtn"} onClick={()=>setDepMode("custom")}>CUSTOM</button>
                </div>
                {depMode==="fixed"
                  ? <div className="prow">{PERIODS.map(d=><button type="button" key={d} className={depDays===d?"pbtn on":"pbtn"} onClick={()=>setDepDays(d)}>{d}d</button>)}</div>
                  : <input className="fi" type="number" placeholder="30" value={depDays} onChange={e=>setDepDays(Number(e.target.value))} min="1" max="3650" />
                }
              </div>
              {depAmt && <div className="fee-n">Fee: {(Number(depAmt)*0.02).toFixed(4)} MON → Locked: {(Number(depAmt)*0.98).toFixed(4)} MON</div>}
              <VibButton className="btn-go" style={{ marginTop: 6 }} disabled={txLoading||!depAmt} onClick={depositMON}>
                {txLoading?<span className="spin"/>:null}⏳ DEPOSIT {depAmt||"0"} MON — {depDays} DAYS
              </VibButton>
            </div>
            <div className="card">
              <div className="card-t">DEPOSIT ERC20</div>
              <div className="fee-n">Fee: 2% on deposit • Approve token first</div>
              <div className="fg">
                <label className="fl">TOKEN ADDRESS</label>
                <input className="fi" type="text" placeholder="0x..." value={depToken} onChange={e=>setDepToken(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">AMOUNT</label>
                <input className="fi" type="number" placeholder="100.0" value={depErcAmt} onChange={e=>setDepErcAmt(e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">LOCK PERIOD (DAYS)</label>
                <div className="prow">{PERIODS.map(d=><button type="button" key={d} className={depErcDays===d?"pbtn on":"pbtn"} onClick={()=>setDepErcDays(d)}>{d}d</button>)}</div>
              </div>
              <VibButton className="btn-go" style={{ marginTop: 6 }} disabled={txLoading||!depToken||!depErcAmt} onClick={depositERC20}>
                {txLoading?<span className="spin"/>:null}APPROVE + DEPOSIT ERC20
              </VibButton>
            </div>
          </div>
        )}

        {tab==="bridge" && (
          <div style={{maxWidth:560,margin:"0 auto"}}>
            <div className="card">
              <div className="card-t">⇄ CROSS-CHAIN BRIDGE — DEFUSE PROTOCOL</div>
              <div className="step-row">
                {["QUOTE","DEPOSIT","SUBMIT","DONE"].map((s,i)=>(
                  <div key={s} className={`step${brStep>i?" done":brStep===i?" on":""}`} title={s} />
                ))}
              </div>

              {brStep===0 && (<>
                <div className="fg">
                  <label className="fl">FROM TOKEN</label>
                  <select className="br-sel" value={brFrom} onChange={e=>setBrFrom(Number(e.target.value))}>
                    {DEFUSE_TOKENS.map((t,i)=><option key={i} value={i}>{t.label}</option>)}
                  </select>
                </div>
                <div className="br-arrow">↓</div>
                <div className="fg">
                  <label className="fl">TO TOKEN</label>
                  <select className="br-sel" value={brTo} onChange={e=>setBrTo(Number(e.target.value))}>
                    {DEFUSE_TOKENS.map((t,i)=><option key={i} value={i}>{t.label}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">AMOUNT ({DEFUSE_TOKENS[brFrom].label.split(" ")[0]})</label>
                  <input className="fi" type="number" placeholder="1.0" value={brAmt}
                    onChange={e=>setBrAmt(e.target.value)} min="0" step="0.01" />
                </div>
                <div className="fg">
                  <label className="fl">RECIPIENT ADDRESS (on {DEFUSE_TOKENS[brTo].chain})</label>
                  <input className="fi" type="text" placeholder="Destination address..."
                    value={brRecipient} onChange={e=>setBrRecipient(e.target.value)} />
                </div>
                <div className="fg">
                  <label className="fl">REFUND ADDRESS (on {DEFUSE_TOKENS[brFrom].chain}) — optional</label>
                  <input className="fi" type="text" placeholder={wallet?.addr||"Your origin chain address..."}
                    value={brRefund} onChange={e=>setBrRefund(e.target.value)} />
                </div>
                <div className="fee-n">Slippage: 1% • Deadline: 5 min • Powered by Defuse Protocol</div>
                <VibButton className="btn-go" style={{ marginTop: 6 }} disabled={brLoading||!brAmt||!brRecipient} onClick={brGetQuote}>
                  {brLoading?<span className="spin"/>:null}⇄ GET QUOTE
                </VibButton>
              </>)}

              {brStep===1 && brQuote && (<>
                <div className="fee-n" style={{marginBottom:14}}>✓ Quote ready — send tokens to the deposit address below</div>
                <div className="br-box">
                  <div className="br-row"><span className="br-lbl">FROM</span><span className="br-val">{DEFUSE_TOKENS[brFrom].label}</span></div>
                  <div className="br-row"><span className="br-lbl">TO</span><span className="br-val">{DEFUSE_TOKENS[brTo].label}</span></div>
                  <div className="br-row"><span className="br-lbl">AMOUNT IN</span><span className="br-val">{brAmt} {DEFUSE_TOKENS[brFrom].label.split(" ")[0]}</span></div>
                  <div className="br-row">
                    <span className="br-lbl">AMOUNT OUT</span>
                    <span className="br-val" style={{color:"var(--green)"}}>
                      {brQuote.amountOut?(Number(brQuote.amountOut)/Math.pow(10,DEFUSE_TOKENS[brTo].decimals)).toFixed(6):"~"} {DEFUSE_TOKENS[brTo].label.split(" ")[0]}
                    </span>
                  </div>
                  <div className="br-row"><span className="br-lbl">RECIPIENT</span><span className="br-val">{shortAddr(brRecipient)}</span></div>
                  <div className="br-row">
                    <span className="br-lbl">EXPIRES</span>
                    <span className="br-val">{brQuote.deadline?new Date(brQuote.deadline).toLocaleTimeString():"5 min"}</span>
                  </div>
                </div>
                <label className="fl" style={{marginBottom:6,display:"block"}}>DEPOSIT ADDRESS — send your tokens here:</label>
                <div className="br-addr" onClick={()=>{navigator.clipboard?.writeText(brQuote.depositAddress);showToast("✓ Copied!");}}>
                  📋 {brQuote.depositAddress}
                </div>
                <div className="fg" style={{marginTop:14}}>
                  <label className="fl">(OPTIONAL) PASTE YOUR TX HASH AFTER SENDING</label>
                  <input className="fi" type="text" placeholder="0x... or tx signature..."
                    value={brTxHash} onChange={e=>setBrTxHash(e.target.value)} />
                </div>
                <div style={{display:"flex",gap:8}}>
                  <VibButton className="btn-go" style={{flex:2, marginTop:6}} disabled={brLoading||!brTxHash} onClick={brSubmitTx}>
                    {brLoading?<span className="spin"/>:null}✓ SUBMIT TX HASH
                  </VibButton>
                  <VibButton className="lc-btn-e" style={{flex:1}} onClick={()=>{brPollStatus(brQuote.depositAddress);setBrStep(2);}}>
                    SKIP → MONITOR
                  </VibButton>
                </div>
                <button type="button" className="pbtn" style={{marginTop:10,width:"100%"}} onClick={brReset}>← NEW BRIDGE</button>
              </>)}

              {brStep===2 && (<>
                <div className="br-status pending">
                  <div className="spin" style={{width:24,height:24,borderWidth:3,margin:"0 auto 14px"}} />
                  BRIDGE IN PROGRESS<br/>
                  <span style={{fontSize:11,color:"#555",letterSpacing:1}}>STATUS: {brStatus||"PENDING_DEPOSIT"}</span>
                </div>
                <div className="fee-n" style={{textAlign:"center"}}>Checking every 5 seconds... do not close this tab</div>
                <button type="button" className="pbtn" style={{width:"100%",marginTop:10}} onClick={brReset}>← NEW BRIDGE</button>
              </>)}

              {brStep===3 && (<>
                <div className={`br-status ${brStatus==="SUCCESS"?"ok":"fail"}`}>
                  {brStatus==="SUCCESS"?"✓ BRIDGE COMPLETE!":"⚠ "+brStatus}
                </div>
                {brStatus==="SUCCESS" && (
                  <div className="fee-n" style={{textAlign:"center",marginTop:10}}>
                    Tokens sent to {shortAddr(brRecipient)} on {DEFUSE_TOKENS[brTo].chain}
                  </div>
                )}
                <VibButton className="btn-go" style={{marginTop:14}} onClick={brReset}>⇄ NEW BRIDGE</VibButton>
              </>)}
            </div>
          </div>
        )}

        {tab==="admin" && (
          <div className="card" style={{maxWidth:600}}>
            <div className="card-t">ADMIN PANEL — OWNER ONLY</div>
            <div className="adm-row"><span className="adm-l">VAULT</span><span className="adm-v" style={{fontSize:11,color:"var(--cyan)"}}>{shortAddr(VAULT_ADDR)}</span></div>
            <div className="adm-row"><span className="adm-l">NFT</span><span className="adm-v" style={{fontSize:11,color:"var(--cyan)"}}>{shortAddr(NFT_ADDR)}</span></div>
            <div className="adm-row"><span className="adm-l">OWNER</span><span className="adm-v" style={{fontSize:11,color:"var(--purple)"}}>{shortAddr(adminOwner||"0x592B35c8917eD36c39Ef73D0F5e92B0173560b2e")}</span></div>
            <div className="adm-row"><span className="adm-l">FEES ACCUMULATED</span><span className="adm-v">{stats.fees} MON</span></div>
            <div className="adm-row"><span className="adm-l">NFT CONTRACT</span><span style={{color:"var(--green)",fontSize:12}}>✓ FINALIZED</span></div>
            <VibButton className="btn-adm" style={{marginTop:6}} disabled={txLoading||Number(stats.fees)===0} onClick={doCollectFees}>
              {txLoading?<span className="spin"/>:null}💎 COLLECT FEES — {stats.fees} MON
            </VibButton>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === "near" && (
        <Modal title="◎ NEAR WALLET" onClose={() => setModal(null)}>
          <NearWalletWidget onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === "buy" && (
        <Modal title="💳 BUY MON WITH CARD" onClose={() => setModal(null)}>
          <BuyCardWidget />
        </Modal>
      )}
      {modal === "swap" && (
        <Modal title="⇄ QUICK SWAP — DEFUSE PROTOCOL" onClose={() => setModal(null)}>
          <SwapWidget wallet={wallet} showToast={showToast} />
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

export default function App() {
  return <ThirdwebProvider><AppInner /></ThirdwebProvider>;
}
