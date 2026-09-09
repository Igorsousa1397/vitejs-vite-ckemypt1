import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  query,
  where,
  limit,
} from "./firebase";
import { useState, useMemo, useEffect, useRef } from "react";
import { messaging, getToken, onMessage } from "./firebase";
import { QRCodeCanvas } from "qrcode.react";

import { updatePassword } from 'firebase/auth';
// Bibliotecas pesadas carregadas só quando o recurso é usado, em vez de entrarem
// no bundle inicial: exceljs ~1,3 MB, html5-qrcode ~857 KB, jspdf ~615 KB.
// (Html5QrcodeScanner era importado e nunca usado — removido.)
const carregarExcelJS = () => import("exceljs").then((m) => m.default ?? m);
const carregarJsPDF = () => import("jspdf").then((m) => m.default ?? m);
const carregarHtml5Qrcode = () => import("html5-qrcode").then((m) => m.Html5Qrcode);
import ReactDOM from "react-dom";
import { storage, ref, uploadBytes, getDownloadURL } from "./firebase";
import { Megaphone, Shirt, AlertTriangle, BedDouble, Bus, Home, Users, CheckSquare, FileText, Calendar, ShieldOff, Camera, Search, CreditCard, Pill as PillIcon, Package, Grid, HandHeart, Settings, ChefHat, List, LogOut, Image, Bell, Trash2, X, Plus, RotateCcw, CheckCircle2, Download, Banknote, User, SlidersHorizontal, ScanLine, UserSquare } from "lucide-react";

const vibrar = (ms = 50) => {
  if ("vibrate" in navigator) navigator.vibrate(ms);
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const iniciarNotificacoes = async (userId = null) => {
  try {
    // WebViews (Instagram/WhatsApp) não suportam notificações push
    if (!messaging || !('Notification' in window) || !('serviceWorker' in navigator)) return null;
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token && userId) {
      // salva sempre com userId como ID — sobrescreve automaticamente
      await setDoc(
        doc(db, "tokens", userId),
        { token, userId, data: new Date().toISOString() },
        { merge: false } // ← substitui completamente, não faz merge
      );
    }
    return token;
  } catch (err) {
    console.error("Erro FCM:", err);
    return null;
  }
};

const G = {
  bg: "#0a0a0a",
  green: "#00c851",
  card: "#161616",
  cb: "#222",
  t: "#fff",
  td: "rgba(255,255,255,.55)",
  tm: "rgba(255,255,255,.28)",
};
const css = `*{box-sizing:border-box;margin:0;padding:0;}html,body{background:#0a0a0a;font-family:'Inter',sans-serif;}
input,select,button,textarea{font-family:'Inter',sans-serif;}
input::placeholder,textarea::placeholder{color:rgba(255,255,255,.25);}
input:focus,select:focus,textarea:focus{outline:none!important;border-color:rgba(0,200,81,.6)!important;}
::-webkit-scrollbar{width:0}

/* ── MOTION ──────────────────────────────────────────────────────────────────
   Só transform e opacity (o compositor resolve sem layout), curvas de
   desaceleração sem overshoot. Entradas usam fill-mode "backwards": nenhum
   transform sobra no repouso, senão o elemento viraria containing block dos
   filhos position:fixed (Sheet, FAB, barra sticky). Saídas usam "both" porque
   quem desmonta é um timer no JS. */
:root{
  --d-fast:.18s;      /* press, chevrons, cor */
  --d-base:.24s;      /* entradas de conteúdo, título */
  --d-slow:.32s;      /* drawer/sheet entrando */
  --d-out:.22s;       /* saídas: sempre mais rápidas que a entrada */
  --e-out:cubic-bezier(.22,.61,.36,1);      /* desacelera — entradas */
  --e-in:cubic-bezier(.55,.06,.68,.19);     /* acelera — saídas */
  --e-sheet:cubic-bezier(.32,.72,0,1);      /* iOS sheet/drawer */
}
@keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes fo{from{opacity:1}to{opacity:0}}
@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes sd{from{transform:translateY(0)}to{transform:translateY(100%)}}
@keyframes dr{from{transform:translateX(-100%)}to{transform:translateX(0)}}
@keyframes drx{from{transform:translateX(0)}to{transform:translateX(-100%)}}
@keyframes tin{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
@keyframes tout{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-14px)}}
@keyframes pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
@keyframes tick{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* listas e cards */
.fu{animation:fu .35s var(--e-out) backwards}
/* teto de camadas simultâneas: listas longas (servos/encontristas) não animam além do 8º */
.fu:nth-child(n+9){animation:none}

/* Estado vazio com atraso: os snapshots do Firestore começam vazios, então
   "Nenhum..." piscava antes dos dados chegarem e lia como app quebrado. Com
   300ms de atraso, um snapshot em cache substitui o texto antes de ele pintar. */
.empty{animation:fi .4s var(--e-out) .3s backwards}

/* conteúdo do accordion: seguro de novo — os componentes que usam Acc agora
   estão no escopo do módulo, então isto não replaya a cada render do App */
.rv{animation:fu var(--d-fast) var(--e-out) backwards}

/* Containers de página e telas públicas: SÓ opacidade. Um translate aqui — mesmo
   durante a animação — faz o container virar containing block dos filhos
   position:fixed (Sheets, modais de confirmação, FABs), que saem de lugar por
   ~240ms. Medido no navegador: o filho fixo virava 480x16 em y=780 em vez de
   cobrir a viewport. */
.pg{animation:fi var(--d-base) var(--e-out) backwards}
.scr{animation:fi var(--d-base) var(--e-out) backwards}
/* título da top bar troca com crossfade (keyed no pg) */
.tt{animation:fi var(--d-base) var(--e-out) backwards}
.pop{animation:pop var(--d-base) var(--e-out) backwards}
.tick{animation:tick .3s var(--e-out) backwards}

/* overlays */
.scrim{animation:fi var(--d-slow) var(--e-out) backwards}
.scrim.out{animation:fo var(--d-out) var(--e-in) both}
.sheet{animation:su var(--d-slow) var(--e-sheet) backwards}
.sheet.out{animation:sd var(--d-out) var(--e-in) both}
.drawer{animation:dr var(--d-slow) var(--e-sheet) backwards}
.drawer.out{animation:drx var(--d-out) var(--e-in) both}
/* um overlay saindo nunca engole o toque seguinte */
.out{pointer-events:none}
.toast{animation:tin var(--d-base) var(--e-out) backwards;pointer-events:none}
.toast.out{animation:tout var(--d-out) var(--e-in) both}
/* splash: a saída é dirigida por estado (não por timer), então nunca sobra
   uma camada invisível em zIndex 1000 comendo os toques */
.splash{animation:fi .3s var(--e-out) backwards}
.splash.out{animation:fo .28s var(--e-in) both;pointer-events:none}
.splash-logo{animation:pop .5s var(--e-out) backwards}

/* feedback de toque: escala em botões, opacidade em linhas inteiras */
button,.press,.press-sc{-webkit-tap-highlight-color:transparent}
button:not(:disabled):active,.press-sc:active{transform:scale(.97)}
button,.press-sc{transition:transform var(--d-fast) var(--e-out)}
.press:active,button.press:active{transform:none;opacity:.55}
.press{transition:opacity var(--d-fast) var(--e-out)}

@media (prefers-reduced-motion:reduce){
  :root{--d-fast:.01s;--d-base:.01s;--d-slow:.01s;--d-out:.01s}
  /* animation:none (e não .01s): com fill both o toast pararia em opacity 0 */
  .fu,.pg,.scr,.tt,.rv,.empty,.pop,.tick,.toast,.scrim,.sheet,.drawer,.splash{animation:none}
  .toast.out,.scrim.out,.sheet.out,.drawer.out{animation:none;opacity:0}
  button:not(:disabled):active,.press-sc:active{transform:none}
}`;

// Uma única injeção. Antes esta folha era montada por 15 telas diferentes, então
// toda troca de tela reparsava o CSS inteiro. O check de textContent mantém o
// HMR funcionando sem empilhar <style> duplicados.
if (typeof document !== "undefined") {
  const ID_ESTILO = "app-css";
  let tag = document.getElementById(ID_ESTILO);
  if (!tag) {
    tag = document.createElement("style");
    tag.id = ID_ESTILO;
    document.head.appendChild(tag);
  }
  if (tag.textContent !== css) tag.textContent = css;
}

const I = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: "13px 15px",
  color: "#fff",
  fontSize: 16,
  width: "100%",
};
const GA = {
  color: "#00c851",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  marginTop: 10,
  display: "block",
};
const BG = (x = {}) => ({
  background: G.green,
  color: "#000",
  border: "none",
  borderRadius: 12,
  padding: "13px 18px",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  ...x,
});
const BK = (x = {}) => ({
  background: "transparent",
  border: "1px solid #2a2a2a",
  color: G.td,
  borderRadius: 12,
  padding: "11px 15px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  ...x,
});

const LIDER_MAP_DEFAULT = {
  // Líder Geral (só)
  "Intercessão": ["lider_geral"],
  "Malas": ["lider_geral"],
  "Crachá": ["lider_geral"],
  "Refeitório": ["lider_geral"],
  "Cantina": ["lider_geral"],
  "Louça": ["lider_geral"],
  "Louças": ["lider_geral"],
  "Servir Ceia": ["lider_geral"],
  "Panelas": ["lider_geral"],
  "Kit Sobrevivência": ["lider_geral"],
  "Etiquetar Sacolas": ["lider_geral"],
  "Dobrar Sacolas": ["lider_geral"],
  "Organizar itens do Templo": ["lider_geral"],
  "Cozinha": ["lider_geral"],
  "Check-in": ["lider_geral"],
  "Quartos": ["lider_geral", "lider_quartos"],
  "Organizar itens STAFF": ["lider_staff", "lider_geral"],
  "Cartas": ["lider_geral", "lider_cartas"],
  "Preparação da Uva": ["lider_geral", "lider_cartas"],
  "Decoração": ["lider_geral", "lider_cartas"],
  "Recepção Presentes/cartas": ["lider_geral", "lider_cartas"],
  "Correrias": ["lider_geral"],
  "Transitar com carro no sítio": ["lider_geral"],
  "Montagem da cruz": ["lider_geral", "lider_templo"],
  "Servo de Quarto": ["lider_geral", "lider_quartos"],
  // Líder Geral + específico
  "Templo": ["lider_geral", "lider_templo"],
  "Mídia": ["lider_midia"],
  "Presentes/Cartas": ["lider_geral", "lider_cartas"],
  // Líder Staff + Geral
  "Banheiro": ["lider_staff", "lider_geral"],
  "Camisetas": ["lider_staff", "lider_geral"],
  "Servir comida": ["lider_staff", "lider_geral"],
  "Limpeza refeitório": ["lider_staff", "lider_geral"],
  "Kit Cartas+Pecado": ["lider_staff", "lider_geral"],
  // Outros
  "Som": ["lider_som"],
  "Itens Teatro/Dança": ["lider_danca"],
};

const PERFIS = {
  admin: { l: "Admin", c: "#00c851" },
  lider_cartas: { l: "Líder Cartas", c: "#ff2d55" },
  lider_celula: { l: "Líder de Célula", c: "#ff6b35" },
  lider_geral: { l: "Líder Geral", c: "#0a84ff" },
  lider_midia: { l: "Líder Mídia", c: "#ffd60a" },
  lider_quartos: { l: "Líder Quartos", c: "#ff6b35" },
  lider_staff: { l: "Líder Staff", c: "#ff9f0a" },
  lider_templo: { l: "Líder Templo", c: "#64b5f6" },
  pastor: { l: "Pastor", c: "#bf5af2" },
  pastor_auxiliar: { l: "Pastor Auxiliar", c: "#bf5af2" },
  cozinha: { l: "Cozinha", c: "#ff6b35" },
  servo: { l: "Servo", c: "#636366" },
  staff: { l: "Staff", c: "#ff9f0a" },
  lider_som: { l: "Líder Som", c: "#30d158" },
  lider_danca: { l: "Líder Dança", c: "#ff375f" },
};

const canG = (p) =>
  ["admin", "lider_geral", "pastor", "lider_staff"].includes(p);
const canAvisos = (p) =>
  ["admin", "lider_geral", "pastor", "lider_staff", "lider_templo", "pastor_auxiliar"].includes(p);
const canQ = (p) => ["admin", "lider_geral", "lider_quartos"].includes(p);
const canC = (p) => ["admin", "lider_geral"].includes(p);
const canN = (p) => ["admin", "lider_geral", "pastor"].includes(p);
const canM = (p) => ["admin", "lider_geral", "lider_midia"].includes(p);

// ── motion helpers ───────────────────────────────────────────────────────────
// Lido a cada chamada (e não uma vez no load) porque o usuário pode trocar a
// preferência de movimento com o app aberto.
const semMovimento = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
const durMs = (ms) => (semMovimento() ? 0 : ms);

// Mantém o elemento montado durante a animação de saída.
// Devolve { montado, saindo } — aplique a classe "out" quando saindo.
function usePresenca(aberto, ms = 220) {
  const [montado, setMontado] = useState(aberto);
  const [saindo, setSaindo] = useState(false);
  const jaAbriu = useRef(aberto);
  useEffect(() => {
    if (aberto) {
      jaAbriu.current = true;
      setSaindo(false);
      setMontado(true);
      return;
    }
    // não dispara saída no primeiro render (nunca esteve aberto)
    if (!jaAbriu.current) return;
    setSaindo(true);
    const id = setTimeout(() => {
      setMontado(false);
      setSaindo(false);
    }, durMs(ms));
    return () => clearTimeout(id);
  }, [aberto, ms]);
  return { montado, saindo };
}

// WKWebView (Instagram/WhatsApp) só aplica :active de forma confiável em
// elementos não-form se a página tiver algum listener de touch.
if (typeof window !== "undefined") {
  try {
    window.addEventListener("touchstart", () => {}, { passive: true });
  } catch {}
}

// ── tiny components ──────────────────────────────────────────────────────────
const Pill = ({ c, bg, tc }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 50,
      padding: "3px 10px",
      fontSize: 11,
      fontWeight: 700,
      background: bg || "rgba(0,200,81,.12)",
      color: tc || G.green,
      whiteSpace: "nowrap",
    }}
  >
    {c}
  </span>
);
const Tag = ({ c, ax, onX }) => (
  <span
    style={{
      background: "#1e1e1e",
      border: `1px solid ${ax ? ax + "33" : "#2a2a2a"}`,
      borderLeft: ax ? `3px solid ${ax}` : undefined,
      borderRadius: 50,
      padding: "5px 11px",
      color: G.td,
      fontSize: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
    }}
  >
    {c}
    {onX && (
      <span
        onClick={onX}
        style={{
          cursor: "pointer",
          color: "rgba(255,80,80,.8)",
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        ×
      </span>
    )}
  </span>
);
const Tags = ({ items, ax, onX }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
    {items.map((s, i) => (
      <Tag key={i} c={s} ax={ax} onX={onX ? () => onX(i) : undefined} />
    ))}
  </div>
);
const SL = ({ c, mt = 14 }) => (
  <div
    style={{
      color: G.tm,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginTop: mt,
      marginBottom: 7,
    }}
  >
    {c}
  </div>
);
// O indicador ativo é um "thumb" branco absoluto que desliza por translateX
// (compositor) em vez de cada botão trocar de background.
const Seg = ({ opts, val, set }) => {
  const i = Math.max(0, opts.findIndex(([k]) => k === val));
  const n = opts.length;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        background: "#111",
        borderRadius: 12,
        padding: 3,
        gap: 3,
        border: "1px solid #1a1a1a",
      }}
    >
      {/* thumb: largura = fatia do trilho descontando os gaps de 3px */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 3,
          left: 3,
          bottom: 3,
          width: `calc((100% - 6px - ${(n - 1) * 3}px) / ${n})`,
          background: "#fff",
          borderRadius: 10,
          transform: `translateX(calc(${i} * (100% + 3px)))`,
          transition: "transform var(--d-base) var(--e-sheet)",
          pointerEvents: "none",
        }}
      />
      {opts.map(([k, v]) => (
        <button
          key={k}
          onClick={() => set(k)}
          className="press"
          style={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            background: "transparent",
            color: val === k ? "#000" : G.td,
            transition: "color var(--d-fast) var(--e-out)",
            border: "none",
            borderRadius: 10,
            padding: "9px 4px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
};
// O wrapper fixo centraliza; a animação vai no filho para o translateY do
// keyframe não brigar com o translateX(-50%) da centralização.
const Toast = ({ m, tp, saindo }) => (
  <div
    style={{
      position: "fixed",
      top: 20,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      pointerEvents: "none",
    }}
  >
    <div
      className={`toast${saindo ? " out" : ""}`}
      style={{
        background: tp === "w" ? "#ff3b30" : tp === "n" ? "#0a84ff" : G.green,
        color: tp ? "#fff" : "#000",
        borderRadius: 50,
        padding: "10px 20px",
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {tp === "n" ? "🔔 " : ""}
      {m}
    </div>
  </div>
);

function AddIn({ onAdd, ph = "Adicionar...", mt = 12 }) {
  const [v, setV] = useState("");
  const go = () => {
    if (v.trim()) {
      onAdd(v.trim());
      setV("");
    }
  };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: mt }}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder={ph}
        style={{
          ...I,
          flex: 1,
          padding: "11px 13px",
          fontSize: 13,
          borderRadius: 10,
        }}
      />
      <button
        onClick={go}
        style={BG({ padding: "11px 15px", borderRadius: 10, fontSize: 13 })}
      >
        +
      </button>
    </div>
  );
}

function Acc({ title, right, ax, children, onDel, def = false, open: openProp, onToggle }) {
  const [oInterno, setOInterno] = useState(def);
  const isOpen = openProp !== undefined ? openProp : oInterno;
  const toggle = onToggle || (() => setOInterno(!oInterno));
  return (
    <div
      style={{
        background: G.card,
        border: `1px solid ${G.cb}`,
        borderLeft: ax ? `3px solid ${ax}` : `1px solid ${G.cb}`,
        borderRadius: 16,
        marginBottom: 8,
        overflow: "visible", // ← era 'hidden', trocar para 'visible'
      }}
    >
      <div
        onClick={() => toggle()}
        className="press"
        style={{
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          style={{
            color: G.t,
            fontWeight: 600,
            fontSize: 16,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 8,
            flexShrink: 0,
          }}
        >
          {right}
          {onDel && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Deseja realmente excluir "${title}"?`)) {
                  onDel();
                }
              }}
              style={{
                color: "rgba(255,60,60,.7)",
                cursor: "pointer",
                padding: "2px 4px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Trash2 size={15} />
            </span>
          )}
          <span
            style={{
              color: G.tm,
              fontSize: 12,
              transition: "transform var(--d-fast) var(--e-out)",
              display: "inline-block",
              transform: isOpen ? "rotate(180deg)" : "none",
            }}
          >
            ▾
          </span>
        </div>
      </div>
      {/* Colapso instantâneo (animar altura custa layout por frame em listas
          longas sob header sticky); só o conteúdo entra com fade. */}
      {isOpen && (
        <>
          <div style={{ height: 1, background: "#1e1e1e" }} />
          <div className="rv" style={{ padding: "14px 16px" }}>{children}</div>
        </>
      )}
    </div>
  );
}

function Sheet({ open, onClose, title, children }) {
  const { montado, saindo } = usePresenca(open, 220);
  if (!montado) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300 }} className={saindo ? "out" : undefined}>
      <div
        onClick={onClose}
        className={`scrim${saindo ? " out" : ""}`}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }}
      />
      <div
        className={`sheet${saindo ? " out" : ""}`}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#141414",
          borderRadius: "20px 20px 0 0",
          padding: "0 0 40px",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 20px 16px",
            borderBottom: "1px solid #1e1e1e",
          }}
        >
          <span style={{ color: G.t, fontWeight: 700, fontSize: 16 }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={BK({ padding: "6px 12px", borderRadius: 10, fontSize: 13 })}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "20px 20px 0" }}>{children}</div>
      </div>
    </div>
  );
}

// ── DATA ─────────────────────────────────────────────────────────────────────
const TAMANHOS = ["P", "M", "G", "GG", "G1", "G2", "G3"];
const FUNCOES_INIT = [
  "Som", "Banheiro", "Cozinha", "Intercessão", "Templo", "Malas", "Check-in",
  "Refeitório", "Cantina", "Panelas", "Mídia", "Kit Sobrevivência",
  "Etiquetar Sacolas", "Dobrar Sacolas", "Presentes/Cartas", "Camisetas",
  "Kit Cartas+Pecado", "Organizar itens do Templo", "Itens Teatro/Dança",
  "Servir comida", "Servir Comida Pastores", "Limpeza refeitório", "Quartos", "Organizar itens STAFF",
  "Cartas", "Preparação da Uva", "Decoração", "Recepção Presentes/cartas",
  "Correrias", "Transitar com carro no sítio", "Montagem da cruz",
  "Servo de Quarto", "Louças", "Servir Ceia",
];

const QH_INIT = [];

const QM_INIT = [{ num: 12, maes: true, lim: 9, servos: [], enc: [] }];

const ON_INIT = [];
const MINS_INIT = [
  { id: 1, dia: "Quinta", nome: "Pré-Encontro", hora: "20:00", sent: false },
  { id: 2, dia: "Quinta", nome: "Envio", hora: "23:30", sent: false },
  {
    id: 3,
    dia: "Sexta",
    nome: "Encontro com o Mundo, Encontro com Deus",
    hora: "23:00",
    sent: false,
  },
  {
    id: 4,
    dia: "Sábado",
    nome: "Ministração Peniel",
    hora: "08:30",
    sent: false,
  },
  {
    id: 5,
    dia: "Sábado",
    nome: "Ministração Cura",
    hora: "10:30",
    sent: false,
  },
  {
    id: 6,
    dia: "Sábado",
    nome: "Ministração Escamas",
    hora: "15:30",
    sent: false,
  },
  {
    id: 7,
    dia: "Sábado",
    nome: "Ministração Libertação",
    hora: "17:00",
    sent: false,
  },
  {
    id: 8,
    dia: "Sábado",
    nome: "Ministração Amor de Deus",
    hora: "21:30",
    sent: false,
  },
  {
    id: 9,
    dia: "Domingo",
    nome: "Ministração Sonhos",
    hora: "08:30",
    sent: false,
  },
  {
    id: 10,
    dia: "Domingo",
    nome: "Unção de Multiplicação",
    hora: "09:30",
    sent: false,
  },
  {
    id: 11,
    dia: "Domingo",
    nome: "Batismo com Espírito Santo",
    hora: "10:30",
    sent: false,
  },
  {
    id: 12,
    dia: "Domingo",
    nome: "Oração Estilo de Vida",
    hora: "15:00",
    sent: false,
  },
  {
    id: 13,
    dia: "Domingo",
    nome: "Recados Pós Encontro",
    hora: "16:00",
    sent: false,
  },
];

const AVISOS_TEMPLATES = [
  { txt: "⏰ Faltam 15 minutos para o Ato. Preparem-se!" },
  { txt: "⏰ Faltam 10 minutos para o Ato. Preparem-se!" },
  { txt: "⏰ Faltam 5 minutos para o Ato. Preparem-se!" },
  { txt: "☕ Café da Manhã às 08h30." },
  { txt: "🍽️ Almoço às 13h. Retorno às 15h30." },
  { txt: "☕ Café da tarde às 16h40." },
  { txt: "🍽️ Jantar às 20h." },
  { txt: "🍽️ Almoço às 13h30. Retorno às 15h." },
  { txt: "📢 Recados pós encontro. Obrigado por servir!" },
  { txt: "🙏 Jejum - Lembre-se: retire ao menos 1 refeição por dia e mantenha 6h de jejum. Deus honra cada sacrifício! 💚" },
];

const REST_INIT = [
  {
    id: 1,
    cel: "Célula Ebenézer",
    ps: [
      "Rita Sousa",
      "Iraci Sousa",
      "Nelci Silva",
      "Aline Silva",
      "Kelly Cristina",
      "Gabrielli Ferreira",
    ],
  },
  {
    id: 2,
    cel: "Célula Getsêmani",
    ps: ["Nathalia Stefany", "Helen Christine", "Thalita Farias"],
  },
];
const LOUÇA_INIT = [
  {
    id: 1,
    r: "Sexta noite — Pratos",
    s: ["Ev. Bárbara", "Paulinha", "Larissa"],
  },
  { id: 2, r: "Sexta noite — Panelas", s: ["Ev. Gabriel", "Nicolas", "Luan"] },
  {
    id: 3,
    r: "Almoço Sábado — Pratos",
    s: ["Caroline", "Tauani", "Letícia", "Ana Clara"],
  },
  {
    id: 4,
    r: "Almoço Sábado — Panelas",
    s: ["Denis", "José", "Samuel", "Marcio"],
  },
  { id: 5, r: "Janta Sábado — Pratos", s: ["Luana", "Isabel", "Tais", "Duda"] },
  {
    id: 6,
    r: "Janta Sábado — Panelas",
    s: ["Bruno", "Igor", "Thalyson", "Tião"],
  },
  {
    id: 7,
    r: "Almoço Domingo — Pratos",
    s: ["Ev. Beatriz", "Jaqueline", "Leia", "Amanda"],
  },
  {
    id: 8,
    r: "Almoço Domingo — Panelas",
    s: ["Ev. Caíque", "João Clesio", "Davi", "Valter"],
  },
];
const USERS_INIT = [
  {
    id: 1,
    nome: "Admin",
    senha: "admin123",
    perfil: "admin",
    primeiro: false,
    funcoes: [],
    ativo: true,
    pago: true,
  },
  {
    id: 2,
    nome: "Pr. Eliel",
    senha: "123456",
    perfil: "pastor",
    primeiro: true,
    funcoes: [],
    ativo: true,
    pago: true,
  },
  {
    id: 3,
    nome: "Thamires Lima",
    senha: "123456",
    perfil: "lider_geral",
    primeiro: true,
    funcoes: [],
    ativo: true,
    pago: false,
  },
  {
    id: 4,
    nome: "Silas Costa",
    senha: "123456",
    perfil: "lider_staff",
    primeiro: true,
    funcoes: ["Banheiro"],
    ativo: true,
    pago: true,
  },
  {
    id: 5,
    nome: "Caio Silva",
    senha: "123456",
    perfil: "servo",
    primeiro: true,
    funcoes: ["Som"],
    ativo: false,
    pago: false,
  },
];
const UNI_INIT = [];
const DATA_LIMITE_UNI = "2025-12-01";
const CK_INIT = [
  { id: 1, nome: "Ana Paula Santos", gen: "M", ok: true, on: "1" },
  { id: 2, nome: "Maria Fernanda", gen: "M", ok: false, on: null },
  { id: 3, nome: "João Pedro Alves", gen: "H", ok: true, on: "2" },
  { id: 4, nome: "Marcos Vinícius", gen: "H", ok: false, on: null },
];
const LABELS = {
  home: "Início",
  servos: "Servos",
  checkin: "Check-in",
  mins: "Agenda",
  quartos: "Quartos",
  enc: "Encontristas",
  onibus: "Ônibus",
  rest: "Restrições",
  img: "Uso de Imagem",
  info: "Ocorrências",
  ach: "Achados & Perdidos",
  crac: "Crachás",
  saude: "Saúde",
  cozinha: "Cozinha",
  equipes: "Equipes",
  back: "Back Office",
  uniformes: "Uniformes",
  termo: "Termo",
  test: "Testemunhos",
  cartas: "Cartas",
};

// ── STATUS DO ENCONTRISTA ────────────────────────────────────────────────────
// Derivado dos flags pago/desistiu/pagarDepois (prioridade nessa ordem).
// "pago" vem do webhook do Mercado Pago ou de "Marcar como pago" (admin).
const ENC_STATUS = {
  pago: { l: "Pago", c: G.green },
  pendente: { l: "Pendente", c: "#ff3b30" },
  pagar_depois: { l: "Pagar depois", c: "#ff9f0a" },
  desistiu: { l: "Desistiu", c: "#8e8e93" },
};
// status que o admin pode setar à mão — "pago" não entra aqui
const ENC_STATUS_MANUAL = ["pendente", "pagar_depois", "desistiu"];
const encStatus = (e) =>
  e.pago ? "pago" : e.desistiu ? "desistiu" : e.pagarDepois ? "pagar_depois" : "pendente";
// aceita "YYYY-MM-DD" (input date) e devolve "DD/MM/YYYY"; outros formatos passam direto
const fmtISO = (s) =>
  s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("/") : s || "—";
const fmtCPF = (c) =>
  c ? String(c).replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—";
// monta o link do WhatsApp: limpa a máscara e prefixa 55 quando necessário
const waLink = (raw) => {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  const num = d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
  return `https://wa.me/${num}`;
};
const CampoInfo = ({ label, valor }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
      {label}
    </div>
    <div style={{ color: G.td, fontSize: 12, overflowWrap: "anywhere" }}>{valor}</div>
  </div>
);

// ── SPLASH ───────────────────────────────────────────────────────────────────
const BotaoAjuda = () => (
  <a
    href="https://wa.me/5511982222149?text=Olá!%20Preciso%20de%20ajuda%20com%20minha%20inscrição%20no%20Encontro%20com%20Deus."
    target="_blank"
    rel="noopener noreferrer"
    style={{ position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, boxShadow: "0 4px 16px rgba(37,211,102,.4)", textDecoration: "none" }}
  >
    <svg viewBox="0 0 24 24" width="32" height="32" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  </a>
);

const BotaoInsta = () => (
  <a
    href="https://www.instagram.com/ecomdeusfonte/"
    target="_blank"
    rel="noopener noreferrer"
    style={{ position: "fixed", bottom: 90, right: 24, width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, boxShadow: "0 4px 16px rgba(220,39,67,.4)", textDecoration: "none" }}
  >
    <svg viewBox="0 0 24 24" width="28" height="28" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  </a>
);
// A saída é dirigida pelo estado `sp` do App (via usePresenca), não por um
// timer de 2,2s: antes o overlay continuava montado em zIndex 1000 depois de
// ficar invisível e comia todos os toques até o Auth responder.
function Splash({ saindo }) {
  return (
    <div
      className={`splash${saindo ? " out" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img
          className="splash-logo"
          src="/IMG_2408.PNG"
          alt="Encontro com Deus"
          style={{
            width: 200,
            mixBlendMode: "screen",
            display: "block",
            margin: "0 auto",
          }}
        />
      </div>
    </div>
  );
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, onVoltar }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [e, setE] = useState("");
  const [load, setLoad] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoad, setResetLoad] = useState(false);

  const resetSenha = async () => {
    if (!email.trim()) { setE('Informe seu email para redefinir a senha.'); return; }
    setResetLoad(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetMsg('Email enviado! Verifique sua caixa de entrada.');
      setTimeout(() => setResetMsg(''), 4000);
    } catch (err) {
      setE('Email não encontrado.');
      setTimeout(() => setE(''), 4000);
    }
    setResetLoad(false);
  };

  const go = async () => {
    if (!email.trim() || !senha.trim()) {
      setE("Preencha todos os campos.");
      return;
    }
    setLoad(true);
    setE("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.data().ativo === false) {
        await signOut(auth);
        setE("Seu acesso está desativado. Fale com o administrador.");
        setLoad(false);
        return;
      }
      if (!snap.exists()) {
        setE("Usuário não encontrado no sistema.");
        setLoad(false);
        return;
      }
      onLogin({ id: cred.user.uid, ...snap.data() });
    } catch (err) {
      setE('Email ou senha incorretos.');
      setTimeout(() => setE(''), 4000);
    }
        setLoad(false);
      };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Botão voltar */}
      <button
        onClick={onVoltar}
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          background: "transparent",
          border: "1px solid #2a2a2a",
          color: "rgba(255,255,255,.6)",
          borderRadius: 10,
          padding: "8px 13px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        ←
      </button>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ marginBottom: 36, textAlign: "center" }}>
          <img
            src="/IMG_2408.PNG"
            alt="Encontro com Deus"
            style={{
              width: 180,
              mixBlendMode: "screen",
              display: "block",
              margin: "0 auto 4px",
            }}
          />
          <div
            style={{
              color: G.tm,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Portal do Encontro
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={I}
          />
          <div style={{ position: "relative" }}>
            <input
              placeholder="Senha"
              type={showSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
              style={{ ...I, paddingRight: 44 }}
            />
            <button
              onClick={() => setShowSenha(!showSenha)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: G.tm,
                cursor: "pointer",
                fontSize: 16,
                padding: 4,
              }}
            >
              {showSenha ? "◯" : "◉"}
            </button>
          </div>
          {e && (
            <div
              style={{
                color: "#ff3b30",
                fontSize: 12,
                background: "rgba(255,59,48,.1)",
                borderRadius: 10,
                padding: "10px 14px",
              }}
            >
              {e}
            </div>
          )}
          <button
            onClick={() => {
              vibrar();
              go();
            }}
            disabled={load}
            style={BG({
              width: "100%",
              padding: 14,
              borderRadius: 14,
              marginTop: 4,
              opacity: load ? 0.7 : 1,
            })}
          >
            {load ? "Entrando..." : "Entrar"}
          </button>
          <button
            onClick={resetSenha}
            disabled={resetLoad}
            style={{
              background: "none",
              border: "none",
              color: G.tm,
              fontSize: 12,
              cursor: "pointer",
              textAlign: "center",
              textDecoration: "underline",
            }}
          >
            {resetLoad ? "Enviando..." : "Esqueci minha senha"}
          </button>
          {resetMsg && (
            <div
              style={{
                color: G.green,
                fontSize: 12,
                background: "rgba(0,200,81,.1)",
                borderRadius: 10,
                padding: "10px 14px",
                textAlign: "center",
              }}
            >
              {resetMsg}
            </div>
          )}
          <div style={{ color: G.tm, fontSize: 12, textAlign: "center" }}>
            Solicite acesso ao administrador
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <img
            src="/IMG_2409.PNG"
            alt="Fonte - Comunidade Peniel"
            style={{ width: 110, mixBlendMode: "screen", opacity: 0.85 }}
          />
        </div>
      </div>
    </div>
  );
}

const BotaoFaq = ({ onFaq }) => {
  const [showLabel, setShowLabel] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowLabel(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      onClick={onFaq}
      style={{ position: "fixed", bottom: 156, right: 24, display: "flex", alignItems: "center", gap: 8, zIndex: 999, cursor: "pointer" }}
    >
      {showLabel && (
        <div style={{
          background: "#ff9f0a",
          color: "#000",
          fontSize: 12,
          fontWeight: 700,
          padding: "6px 12px",
          borderRadius: 50,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(255,159,10,.4)",
        }}>
          Dúvidas
        </div>
      )}
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ff9f0a", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(255,159,10,.4)" }}>
        <span style={{ fontSize: 28 }}>❓</span>
      </div>
    </div>
  );
};

function PrimeiroAcessoV({ user, onConcluido }) {
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirma, setShowConfirma] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const inputStyle = {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    padding: '14px 16px',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    paddingRight: 48,
  };

  const salvar = async () => {
    if (senha.length < 6) { setErro('Senha deve ter ao menos 6 caracteres.'); return; }
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return; }
    setSaving(true);
    try {
      await updatePassword(auth.currentUser, senha);
      await setDoc(doc(db, 'users', user.id), { primeiro: false }, { merge: true });
      onConcluido();
      window.location.reload();
    } catch (err) {
      setErro('Erro ao atualizar senha: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <img src="/IMG_2408.PNG" alt="" style={{ width: 160, mixBlendMode: 'screen', display: 'block', margin: '0 auto 24px' }} />
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Crie sua senha</div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
          Este é seu primeiro acesso.<br/>
          Crie uma nova senha para continuar.
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            type={showSenha ? 'text' : 'password'}
            placeholder="Nova senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => setShowSenha(!showSenha)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showSenha ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.28)', cursor: 'pointer', fontSize: 16, padding: 4 }}
          >
            {showSenha ? '◯' : '◉'}
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            type={showConfirma ? 'text' : 'password'}
            placeholder="Confirmar senha"
            value={confirma}
            onChange={e => setConfirma(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => setShowConfirma(!showConfirma)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: showConfirma ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.28)', cursor: 'pointer', fontSize: 16, padding: 4 }}
          >
            {showConfirma ? '◯' : '◉'}
          </button>
        </div>

        {erro && (
          <div style={{ background: 'rgba(255,59,48,.1)', border: '1px solid rgba(255,59,48,.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, color: '#ff6b6b', fontSize: 13 }}>
            {erro}
          </div>
        )}
        <button onClick={salvar} disabled={saving} style={BG({ width: '100%', padding: 16, borderRadius: 14, opacity: saving ? 0.7 : 1 })}>
          {saving ? 'Salvando...' : 'Criar senha e entrar'}
        </button>
      </div>
    </div>
  );
}

function ConfirmadoV({ encId, onVoltar }) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (!encId) return;
    getDoc(doc(db, 'encontristas', encId)).then(snap => {
      if (snap.exists()) setNome(snap.data().nome || '');
    });
  }, [encId]);

  return (
    <div className="scr" style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus" style={{ width: 140, mixBlendMode: "screen", display: "block", margin: "0 auto 20px" }} />

        {nome ? (
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, marginBottom: 20 }}>
            Olá, {nome.split(' ')[0]} 👋
          </div>
        ) : (
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>
            Pagamento confirmado!
          </div>
        )}

        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          Sua vaga está garantida. 🙏
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: 20, display: "inline-block", marginBottom: 16 }}>
          <QRCodeCanvas value={encId || "sem-id"} size={200} />
        </div>

        <div style={{ background: "rgba(251,146,60,.1)", border: "1px solid rgba(251,146,60,.3)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, textAlign: "left" }}>
          <div style={{ color: "#fb923c", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
            TIRE UM PRINT DESTA TELA AGORA
          </div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, lineHeight: 1.6 }}>
            Este QR Code é seu ingresso. Sem ele você não conseguirá fazer o check-in no evento. Não perca!
          </div>
        </div>

        <div style={{ color: "#ff9f0a", fontSize: 14, fontWeight: 600, lineHeight: 1.6, marginBottom: 12 }}>Avisos e comunicados durante o encontro serão enviados por este grupo. É importante que você esteja nele!</div>

        <a
          href="https://chat.whatsapp.com/GxUlwcNxBmOCXRtvotRmZ7?mode=gi_t"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", textDecoration: "none", marginBottom: 16 }}
        >
          <button style={{ ...BG({ width: "100%", padding: 14, borderRadius: 14, fontSize: 15 }), background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            Entrar no Grupo
          </button>
        </a>

        <button onClick={onVoltar} style={BK({ width: "100%", padding: 14, borderRadius: 14 })}>
          Voltar ao início
        </button>
      </div>
    </div>
  );
}

function JaInscritoV({ onVoltar, bloqueadas }) {
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [encontrista, setEncontrista] = useState(null);
  const [erro, setErro] = useState('');
  const [msgPagamento, setMsgPagamento] = useState('');
  const [encId, setEncId] = useState(null);
  const [done, setDone] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [termoPendente, setTermoPendente] = useState(false);

  if (confirmado && encId)
    return <ConfirmadoV encId={encId} onVoltar={onVoltar} />;

  // Termo pendente: assinar antes do pagamento
  if (termoPendente && encontrista)
    return (
      <TermoInscricao
        encId={encId}
        form={{ nome: encontrista.nome, sexo: encontrista.sexo, igreja: encontrista.igreja, cpf: encontrista.cpf, autorizaImagem: encontrista.autorizaImagem }}
        onAssinado={() => { setTermoPendente(false); setDone(true); }}
        onVoltar={() => { setTermoPendente(false); setEncontrista(null); setBusca(''); }}
      />
    );

  if (done && encontrista)
    return (
      <PagamentoV
        encId={encId}
        nome={encontrista.nome}
        igreja={encontrista.igreja}
        onVoltar={() => { setDone(false); setEncontrista(null); setBusca(''); }}
        onPago={() => setEncontrista({ ...encontrista, pago: true })}
      />
    );

  const buscar = async () => {
    if (!busca.trim()) return;
    setLoading(true);
    setErro('');
    setEncontrista(null);
    try {
      const snap = await getDocs(collection(db, 'encontristas'));
      const limpo = busca.replace(/\D/g, '');
      const found = snap.docs.find(d => {
        const data = d.data();
        return (
          data.cpf === limpo ||
          data.whatsapp?.replace(/\D/g, '') === limpo
        );
      });
      if (found) {
        const data = found.data();
        if (data.pago) {
          setEncId(found.id);
          setConfirmado(true);
        } else if (bloqueadas) {
          setEncId(found.id);
          setEncontrista({ id: found.id, ...data });
          // Inscrições encerradas: mostra status, mas não libera pagamento
        } else if (!data.termoAssinado) {
          // Termo ainda não assinado: redireciona para assinar antes do pagamento
          setEncId(found.id);
          setEncontrista({ id: found.id, ...data });
          setTermoPendente(true);
        } else {
          setEncId(found.id);
          setEncontrista({ id: found.id, ...data });
          setDone(true);
        }
      } else {
        setErro('Inscrição não encontrada. Verifique o CPF ou WhatsApp informado.');
      }
    } catch (err) {
      setErro('Erro ao buscar inscrição.');
    }
    setLoading(false);
  };

return (
  <div style={{ minHeight: '100vh', background: '#000' }}>
    <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '14px 16px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
      <button onClick={onVoltar} style={BK({ padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700 })}>←</button>
    </div>

    <div style={{ maxWidth: 400, margin: '0 auto', padding: '40px 20px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <img src="/IMG_2408.PNG" alt="Encontro com Deus" style={{ width: 160, mixBlendMode: 'screen', display: 'block', margin: '0 auto 16px' }} />

      {/* TÍTULO: muda quando encontrista é encontrado */}
      {!encontrista ? (
        <>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Já se inscreveu?</div>
          <div style={{ marginBottom: 24, color: 'rgba(255,255,255,.6)', fontSize: 15, lineHeight: 1.7 }}>
            Aqui você pode gerar novamente o link de pagamento ou obter seu <strong style={{ color: '#fff' }}>QR Code</strong> para o check-in. Informe seu <strong style={{ color: '#fff' }}>CPF</strong> ou <strong style={{ color: '#fff' }}>WhatsApp</strong> cadastrado.
          </div>
        </>
      ) : (
        <>
          <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, marginBottom: 4 }}>Olá,</div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            {encontrista.nome.split(' ')[0]} 👋
          </div>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, marginBottom: 24 }}>
            {encontrista.igreja} · {encontrista.celula || 'Sem célula'}
          </div>
        </>
      )}

      <div style={{ marginBottom: 16, width: '100%' }}>
        <input
          placeholder="CPF ou WhatsApp"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          style={{ width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
        />
        <button onClick={buscar} disabled={loading} style={BG({ width: '100%', padding: 14, borderRadius: 14, fontSize: 15, opacity: loading ? 0.7 : 1 })}>
          {loading ? '...' : 'Verificar'}
        </button>
      </div>

      {erro && (
        <div style={{ background: 'rgba(255,59,48,.1)', border: '1px solid rgba(255,59,48,.3)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, color: '#ff6b6b', fontSize: 13, lineHeight: 1.6, width: '100%' }}>
          {erro}
          <a href="https://wa.me/5511999999999?text=Olá! Preciso de ajuda com minha inscrição no Encontro com Deus." target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 10, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.3)', color: '#25d366', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
            💬 Falar com suporte
          </a>
        </div>
      )}

      {encontrista && (
        <div style={{ textAlign: 'center', width: '100%' }}>

          {encontrista.pago ? (
            <>
              <div style={{ background: 'rgba(0,200,81,.08)', border: '1px solid rgba(0,200,81,.2)', borderRadius: 14, padding: '12px 14px', marginBottom: 20, color: G.green, fontWeight: 700, fontSize: 14 }}>
                ✓ Pagamento confirmado
              </div>
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, display: 'inline-block', marginBottom: 16 }}>
                <QRCodeCanvas value={encontrista.id} size={200} />
              </div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, marginBottom: 16 }}>
                Apresente este QR Code no check-in
              </div>
              <div style={{ color: "#ff9f0a", fontSize: 14, fontWeight: 600, lineHeight: 1.6, marginBottom: 10 }}>Avisos e comunicados durante o encontro serão enviados por este grupo. É importante que você esteja nele!</div>
              <a
                href="https://chat.whatsapp.com/GxUlwcNxBmOCXRtvotRmZ7?mode=gi_t"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", textDecoration: "none", marginBottom: 8 }}
              >
                <button style={{ ...BG({ width: "100%", padding: 13, borderRadius: 14, fontSize: 14 }), background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  Entrar no Grupo
                </button>
              </a>
            </>
          ) : bloqueadas ? (
            <div style={{ background: 'rgba(255,59,48,.08)', border: '1px solid rgba(255,59,48,.25)', borderRadius: 14, padding: '14px 16px', color: '#ff6b6b', fontSize: 14, lineHeight: 1.7 }}>
              As inscrições estão encerradas no momento. Não é possível gerar um novo pagamento agora. Entre em contato com a liderança para mais informações.
            </div>
          ) : (
            <>
              <div style={{ background: 'rgba(255,159,10,.08)', border: '1px solid rgba(255,159,10,.2)', borderRadius: 14, padding: '12px 14px', marginBottom: 20, color: '#ff9f0a', fontSize: 13, lineHeight: 1.6 }}>
                Sua inscrição foi encontrada mas o pagamento ainda não foi confirmado. Gere o link abaixo para concluir.
              </div>
              {(() => {
                const isItajai = encontrista.igreja === 'Fonte Itajaí';
                const valPix = isItajai ? 200 : 360;
                const valCredito = isItajai ? Math.ceil(200 / 0.9501 * 100) / 100 : 384;
                return (<>
                  <button onClick={async () => {
                    vibrar(50);
                    try {
                      const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: encontrista.id, nome: encontrista.nome, email: '', tipo: 'pix', valor: valPix }) });
                      const data = await res.json();
                      if (data.init_point) window.location.href = data.init_point;
                      else setMsgPagamento('Erro ao gerar pagamento.');
                    } catch { setMsgPagamento('Erro ao gerar pagamento.'); }
                  }} style={{ ...BG({ width: '100%', padding: 16, borderRadius: 14, fontSize: 15, marginBottom: 8 }), background: '#009ee3' }}>
                    PIX ou Boleto — R$ {valPix.toFixed(2).replace('.', ',')}
                  </button>
                  <button onClick={async () => {
                    vibrar(50);
                    try {
                      const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: encontrista.id, nome: encontrista.nome, email: '', tipo: 'credito', valor: valCredito }) });
                      const data = await res.json();
                      if (data.init_point) window.location.href = data.init_point;
                      else setMsgPagamento('Erro ao gerar pagamento.');
                    } catch { setMsgPagamento('Erro ao gerar pagamento.'); }
                  }} style={{ ...BG({ width: '100%', padding: 16, borderRadius: 14, fontSize: 15 }), background: '#009ee3' }}>
                    Cartão de Crédito — R$ {valCredito.toFixed(2).replace('.', ',')}
                  </button>
                </>);
              })()}
              {msgPagamento && <div style={{ color: '#ff6b6b', fontSize: 13, marginTop: 10 }}>{msgPagamento}</div>}
            </>
          )}
        </div>
      )}
    </div>
    <BotaoAjuda />
    <BotaoInsta />
    <BotaoFaq onFaq={() => {}} />
  </div>
);
}

function PagamentoV({ encId, nome, igreja, onVoltar, onPago }) {
  const [msgPagamento, setMsgPagamento] = useState('');
  const isItajai = igreja === 'Fonte Itajaí';
  const valPix = isItajai ? 200 : 360;
  const valCredito = isItajai ? Math.ceil(200 / 0.9501 * 100) / 100 : 384;

  return (
    <div className="scr" style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus" style={{ width: 180, mixBlendMode: "screen", display: "block", margin: "0 auto 24px" }} />

        <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
          Olá, {nome.split(' ')[0]} 👋
        </div>
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          Para confirmar sua vaga, realize o pagamento abaixo.
        </div>

        <button onClick={async () => {
          vibrar(50);
          try {
            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encontristaId: encId, nome, email: '', tipo: 'pix', valor: valPix }),
            });
            const data = await res.json();
            if (data.init_point) window.location.href = data.init_point;
            else alert('Erro ao gerar pagamento.');
          } catch { alert('Erro ao gerar pagamento.'); }
        }} style={{ ...BG({ width: "100%", padding: 16, borderRadius: 14, fontSize: 15, marginBottom: 8 }), background: "#009ee3" }}>
          PIX ou Boleto — R$ {valPix.toFixed(2).replace('.', ',')}
        </button>
        <button onClick={async () => {
          vibrar(50);
          try {
            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encontristaId: encId, nome, email: '', tipo: 'credito', valor: valCredito }),
            });
            const data = await res.json();
            if (data.init_point) window.location.href = data.init_point;
            else alert('Erro ao gerar pagamento.');
          } catch { alert('Erro ao gerar pagamento.'); }
        }} style={{ ...BG({ width: "100%", padding: 16, borderRadius: 14, fontSize: 15, marginBottom: 12 }), background: "#009ee3" }}>
          Cartão de Crédito — R$ {valCredito.toFixed(2).replace('.', ',')}
        </button>
        <div style={{ background: "rgba(251,146,60,.1)", border: "1px solid rgba(251,146,60,.3)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, textAlign: "left" }}>
          <div style={{ color: "#fb923c", fontWeight: 800, fontSize: 13, marginBottom: 6, textAlign: "center" }}>IMPORTANTE</div>
          <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13, lineHeight: 1.6 }}>
            Após realizar o pagamento, retorne a este aplicativo e clique em "Já paguei — verificar" para obter seu QR Code de acesso ao encontro. Guarde-o com cuidado — ele será necessário no check-in.
          </div>
        </div>
        <button onClick={async () => {
          if (!encId) { setMsgPagamento('ID não encontrado. Tente novamente.'); return; }
          const snap = await getDoc(doc(db, 'encontristas', encId));
          if (snap.exists() && snap.data().pago) {
            onPago();
          } else {
            setMsgPagamento('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.');
          }
        }} style={BG({ width: '100%', padding: 14, borderRadius: 14, marginBottom: 12 })}>
          ✓ Já paguei — verificar
        </button>
        {msgPagamento && (
          <div style={{ background: "rgba(255,59,48,.1)", border: "1px solid rgba(255,59,48,.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, color: "#ff6b6b", fontSize: 13, lineHeight: 1.5 }}>
            {msgPagamento}
          </div>
        )}
        <button onClick={onVoltar} style={BK({ width: "100%", padding: 14, borderRadius: 14 })}>
          Voltar
        </button>
      </div>
    </div>
  );
}

// ── WELCOME ──────────────────────────────────────────────────────────────────
function Welcome({ onServos, onEncontrista, onFaq, onJaInscrito, bloqueadas }) {
  return (
    <div
      className="scr"
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        paddingBottom: 48,
      }}
    >
      <img
        src="/campo.jpg"
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: 360,
          textAlign: "center",
        }}
      >
        <img
          src="/IMG_2408.PNG"
          alt="Encontro com Deus"
          style={{
            width: 280,
            mixBlendMode: "screen",
            display: "block",
            margin: "0 auto 40px",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <button
            onClick={bloqueadas ? undefined : onEncontrista}
            disabled={bloqueadas}
            style={{
              ...BG({
                width: "100%",
                padding: 16,
                borderRadius: 16,
                fontSize: 16,
              }),
              ...(bloqueadas ? { background: "#3a3a3a", color: "#888", cursor: "not-allowed" } : {}),
            }}
          >
            {bloqueadas ? "Inscrições encerradas" : "Inscrições"}
          </button>
          <button
            onClick={onJaInscrito}
            style={{
              ...BK({
                width: "100%",
                padding: 16,
                borderRadius: 16,
                fontSize: 16,
              }),
              borderColor: "rgba(255,255,255,.3)",
              color: "#fff",
            }}
          >
            Já se inscreveu?
          </button>
          <button
            onClick={onServos}
            style={{
              ...BK({
                width: "100%",
                padding: 16,
                borderRadius: 16,
                fontSize: 16,
              }),
              borderColor: "rgba(255,255,255,.3)",
              color: "#fff",
            }}
          >
            Servo
          </button>
        </div>
        <img
          src="/IMG_2409.PNG"
          alt="Fonte - Comunidade Peniel"
          style={{
            width: 90,
            mixBlendMode: "screen",
            opacity: 0.8,
            margin: "0 auto",
          }}
        />
      </div>
      <BotaoAjuda />
      <BotaoInsta />
      <BotaoFaq onFaq={onFaq} />
    </div>
  );
}

// ── INSCRIÇÃO ─────────────────────────────────────────────────────────────────
const CELULAS = [
  "A Forja",
  "Atos 29",
  "Baluarte",
  "Barueri",
  "Beraká",
  "Betel",
  "Betesda",
  "Carta Viva",
  "Deus Forte",
  "Ebenézer",
  "Ekballo",
  "Ekklesia",
  "Emaús",
  "Essência",
  "Fire",
  "Gileade",
  "Identidade",
  "Jeova Rafah",
  "Kerygma",
  "Lavi",
  "Luz do mundo",
  "Nahal",
  "Pedra Angular",
  "Peniel - Santa Catarina",
  "Reobote",
  "Transbordo",
  "Yeshua",
  "Outra",
  "Não tenho célula",
];

function Inscricao({ onVoltar, onPago, onFaq }) {
  const [form, setForm] = useState({
    igreja: "",
    nome: "",
    cpf: "",
    nascimento: "",
    sexo: "",
    whatsapp: "",
    celula: "",
    camiseta: "",
    emergencia: "",
    medicamento: "",
    doenca: "",
    autorizaImagem: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [termoAssinado, setTermoAssinado] = useState(false);
  const [encId, setEncId] = useState(null);
  const [msgPagamento, setMsgPagamento] = useState("");
  const enviandoRef = useRef(false);

  // --- CPF já cadastrado: redireciona para a etapa em que a inscrição parou ---
  const [duplicado, setDuplicado] = useState(null); // { id, ...dados do encontrista já existente }
  const [contagem, setContagem] = useState(5);
  const [dupConfirmado, setDupConfirmado] = useState(false);
  const [dupTermoPendente, setDupTermoPendente] = useState(false);
  const [dupPagamento, setDupPagamento] = useState(false);

  useEffect(() => {
    if (!duplicado) return;
    if (contagem <= 0) {
      if (duplicado.pago) setDupConfirmado(true);
      else if (!duplicado.termoAssinado) setDupTermoPendente(true);
      else setDupPagamento(true);
      return;
    }
    const t = setTimeout(() => setContagem((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [duplicado, contagem]);

  const salvar = async () => {
    // Proteção síncrona contra clique duplo — saving (estado) é assíncrono e pode não bloquear a tempo
    if (enviandoRef.current) return;
    enviandoRef.current = true;

    // --- 1) CPF é validado PRIMEIRO: formato e depois duplicidade no banco ---
    if (!form.cpf.trim()) { alert("Informe seu CPF."); enviandoRef.current = false; return; }
    const cpfLimpo = form.cpf.replace(/[\.\-]/g, "").trim();
    if (cpfLimpo.length !== 11) { alert("CPF inválido. Deve ter 11 dígitos."); enviandoRef.current = false; return; }

    setSaving(true);
    let snap;
    try {
      snap = await getDocs(collection(db, "encontristas"));
    } catch (err) {
      console.error("Erro ao verificar CPF:", err);
      alert("Erro ao verificar CPF: " + err.message);
      setSaving(false);
      enviandoRef.current = false;
      return;
    }
    const cpfDoc = snap.docs.find((d) => d.data().cpf === cpfLimpo);
    if (cpfDoc) {
      setDuplicado({ id: cpfDoc.id, ...cpfDoc.data() });
      setContagem(5);
      setSaving(false);
      enviandoRef.current = false;
      return;
    }

    // --- 2) Demais campos obrigatórios ---
    if (!form.igreja) { alert("Selecione sua igreja."); setSaving(false); enviandoRef.current = false; return; }
    if (form.igreja === 'Outra' && !form.igrejaCustom?.trim()) { alert("Informe o nome da sua igreja."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.nome.trim()) { alert("Informe seu nome completo."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.nascimento || form.nascimento.includes('--') || form.nascimento.split('-').some(p => !p)) { alert("Informe sua data de nascimento."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.sexo) { alert("Selecione seu sexo."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.whatsapp.trim()) { alert("Informe seu WhatsApp."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.celula) { alert("Selecione sua célula."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.camiseta) { alert("Selecione o tamanho da camiseta."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.autorizaImagem) { alert("Responda sobre o uso de imagem."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.emergenciaNome?.trim()) { alert("Informe o nome do contato de emergência."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.emergenciaTel?.trim()) { alert("Informe o telefone do contato de emergência."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.temMedicamento) { alert("Responda sobre medicamentos."); setSaving(false); enviandoRef.current = false; return; }
    if (form.temMedicamento === 'Sim' && !form.medicamento?.trim()) { alert("Informe qual medicamento você toma."); setSaving(false); enviandoRef.current = false; return; }
    if (!form.temDoenca) { alert("Responda sobre doenças crônicas."); setSaving(false); enviandoRef.current = false; return; }
    if (form.temDoenca === 'Sim' && !form.doenca?.trim()) { alert("Informe qual doença crônica você tem."); setSaving(false); enviandoRef.current = false; return; }

    const nascimento = new Date(form.nascimento);
    const hoje = new Date();
    const idade = hoje.getFullYear() - nascimento.getFullYear() -
      (hoje < new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate()) ? 1 : 0);
    if (idade < 14) { alert("É necessário ter pelo menos 14 anos para se inscrever."); setSaving(false); enviandoRef.current = false; return; }

    try {
      const waLimpo = form.whatsapp.replace(/\D/g, "");
      const waExiste = snap.docs.some((d) => d.data().whatsapp?.replace(/\D/g, "") === waLimpo);
      if (waExiste) { alert("Este WhatsApp já está cadastrado!"); setSaving(false); enviandoRef.current = false; return; }

      const igrejaFinal = form.igreja === "Outra" ? form.igrejaCustom?.trim() || "Outra" : form.igreja;
      const docRef = await addDoc(collection(db, "encontristas"), {
        ...form,
        igreja: igrejaFinal,
        emergencia: `${form.emergenciaNome} — ${form.emergenciaTel}`,
        cpf: cpfLimpo,
        criadoEm: new Date().toLocaleString("pt-BR"),
      });

      if (form.temMedicamento === 'Sim' || form.temDoenca === 'Sim') {
        await addDoc(collection(db, 'saude'), {
          encontristaId: docRef.id,
          nome: form.nome,
          quarto: '',
          cond: [
            form.temMedicamento === 'Sim' ? `Medicamento: ${form.medicamento}` : null,
            form.temDoenca === 'Sim' ? `Doença: ${form.doenca}` : null,
          ].filter(Boolean).join(' | '),
          obs: '',
          criadoEm: new Date().toLocaleString('pt-BR'),
        });
      }

      try {
        await fetch('https://us-central1-servos-peniel.cloudfunctions.net/notificarNovaInscricao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: form.nome, encontristaId: docRef.id }),
        });
      } catch {}

      setEncId(docRef.id);
      setDone(true);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro: " + err.message);
    }
    setSaving(false);
    enviandoRef.current = false;
  };

  if (dupConfirmado && duplicado)
  return <ConfirmadoV encId={duplicado.id} onVoltar={onVoltar} />;

  if (dupTermoPendente && duplicado)
  return (
    <TermoInscricao
      encId={duplicado.id}
      form={{ nome: duplicado.nome, sexo: duplicado.sexo, igreja: duplicado.igreja, cpf: duplicado.cpf, autorizaImagem: duplicado.autorizaImagem }}
      onAssinado={() => { setDupTermoPendente(false); setDupPagamento(true); }}
      onVoltar={onVoltar}
    />
  );

  if (dupPagamento && duplicado)
  return (
    <PagamentoV
      encId={duplicado.id}
      nome={duplicado.nome}
      igreja={duplicado.igreja}
      onVoltar={onVoltar}
      onPago={() => setDupConfirmado(true)}
    />
  );

  if (done && !termoAssinado)
  return (
    <TermoInscricao
      encId={encId}
      form={form}
      onAssinado={() => setTermoAssinado(true)}
      onVoltar={onVoltar}
    />
  );

  if (done && termoAssinado)
  return (
    <PagamentoV
      encId={encId}
      nome={form.nome}
      igreja={form.igreja === 'Outra' ? form.igrejaCustom : form.igreja}
      onVoltar={onVoltar}
      // repassa para o onPago do App (que grava o encId e navega). Antes isto
      // chamava setScr direto, que não existe aqui — dava ReferenceError e o
      // encontrista travava na tela de pagamento depois de confirmar.
      onPago={() => onPago(encId)}
    />
  );

  const iI = { ...I, marginBottom: 0 };
  const SLi = ({ c }) => (
    <div
      style={{
        color: "rgba(255,255,255,.4)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 8,
        marginTop: 20,
      }}
    >
      {c}
    </div>
  );
  const Radio = ({ val, set, opts }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => set(o)}
          style={{
            ...BK({ padding: "8px 14px", borderRadius: 50, fontSize: 13 }),
            borderColor: val === o ? "rgba(0,200,81,.5)" : "#2a2a2a",
            color: val === o ? G.green : G.td,
            background: val === o ? "rgba(0,200,81,.08)" : "transparent",
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#000", paddingBottom: 40 }}>

      {duplicado && !dupConfirmado && !dupTermoPendente && !dupPagamento && (
        <div className="scrim" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 20, padding: "28px 24px", maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Este CPF já está cadastrado!</div>
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Vamos te redirecionar para a etapa em que sua inscrição parou{duplicado.pago ? " (QR Code)" : !duplicado.termoAssinado ? " (assinatura do termo)" : " (pagamento)"}.
            </div>
            <button
              onClick={() => setContagem(0)}
              style={BG({ width: "100%", padding: 13, borderRadius: 14, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 })}
            >
              Ir agora {contagem > 0 && `(${contagem})`}
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          background: "#000",
          borderBottom: "1px solid #1a1a1a",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <button
          onClick={onVoltar}
          style={BK({
            padding: "8px 13px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
          })}
        >
          ←
        </button>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, flex: 1 }}>
          Inscrição — Encontro com Deus
        </span>
      </div>
      <div style={{ padding: "20px 20px 0", maxWidth: 480, margin: "0 auto" }}>
        <div
          style={{
            background: "rgba(0,200,81,.08)",
            border: "1px solid rgba(0,200,81,.2)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 8,
            color: G.green,
            fontSize: 13,
            lineHeight: 1.6,
          }}
         > 
          <div>
            <strong style={{ color: G.green }}>Dias 20, 21 e 22 de Novembro</strong>
            <br />
            
          <span style={{ color: 'rgba(0,200,81,.7)', fontSize: 12 }}>Endereço: Estrada do Tronco 485, Itaquaquecetuba</span>
          <a
          href="https://cemine.wixsite.com/world"
            target="_blank"
            rel="noopener noreferrer"
            style={{
            background: "none",
            border: "none",
            color: G.tm,
            fontSize: 12,
            cursor: "pointer",
            textAlign: "left",
            textDecoration: "underline",
            display: "block",
            marginBottom: 8,
          }}
          >
            Conheça o sítio</a>
          </div>
      </div>

      {/* <button
        onClick={onFaq}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(255,159,10,.08)",
          border: "1px solid rgba(255,159,10,.2)",
          color: "#ff6b00",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 8,
          textAlign: "left",
        }}
      >
        ? Dúvidas Frequentes
      </button> */}

        <SLi c="Igreja *" />
        <Radio
          val={form.igreja}
          set={(v) => setForm({ ...form, igreja: v })}
          opts={["Fonte Cajamar", "Fonte Itajaí", "Fonte Barueri", "Outra"]}
        />
        {form.igreja === "Outra" && (
          <input
            placeholder="Nome da sua igreja... *"
            value={form.igrejaCustom || ""}
            onChange={(e) => setForm({ ...form, igrejaCustom: e.target.value })}
            style={{ 
              ...iI, 
              marginTop: 8,
              borderColor: !form.igrejaCustom?.trim() ? "rgba(255,59,48,.4)" : "#2a2a2a"
            }}
          />
        )}
        <SLi c="Nome completo *" />
        <input
          placeholder="Sem abreviações"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          style={iI}
        />

        <SLi c="CPF *" />
        <input
          placeholder="000.000.000-00"
          value={form.cpf}
          maxLength={14}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9xX]/g, "").slice(0, 11);
            const mask = v
              .replace(/(\w{3})(\w)/, "$1.$2")
              .replace(/(\w{3})(\w)/, "$1.$2")
              .replace(/(\w{3})(\w{1,2})$/, "$1-$2");
            setForm({ ...form, cpf: mask });
          }}
          style={iI}
        />

        <SLi c="Data de Nascimento *" />
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={form.nascimento?.split("-")[2] || ""}
            onChange={(e) =>
              setForm({
                ...form,
                nascimento: `${form.nascimento?.split("-")[0] || ""}-${form.nascimento?.split("-")[1] || ""}-${e.target.value}`,
              })
            }
            style={{ ...iI, flex: 1 }}
          >
            <option value="">Dia</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d).padStart(2, "0")}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={form.nascimento?.split("-")[1] || ""}
            onChange={(e) =>
              setForm({
                ...form,
                nascimento: `${form.nascimento?.split("-")[0] || ""}-${e.target.value}-${form.nascimento?.split("-")[2] || ""}`,
              })
            }
            style={{ ...iI, flex: 1 }}
          >
            <option value="">Mês</option>
            {[
              "Jan",
              "Fev",
              "Mar",
              "Abr",
              "Mai",
              "Jun",
              "Jul",
              "Ago",
              "Set",
              "Out",
              "Nov",
              "Dez",
            ].map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={form.nascimento?.split("-")[0] || ""}
            onChange={(e) =>
              setForm({
                ...form,
                nascimento: `${e.target.value}-${form.nascimento?.split("-")[1] || ""}-${form.nascimento?.split("-")[2] || ""}`,
              })
            }
            style={{ ...iI, flex: 1 }}
          >
            <option value="">Ano</option>
            {Array.from(
              { length: 80 },
              (_, i) => new Date().getFullYear() - 14 - i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <SLi c="Sexo *" />
        <Radio
          val={form.sexo}
          set={(v) => setForm({ ...form, sexo: v })}
          opts={["Feminino", "Masculino"]}
        />

        <SLi c="WhatsApp *" />
        <input
          placeholder="(11) 99999-9999"
          value={form.whatsapp}
          type="tel"
          maxLength={15}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 11);
            const mask = v
              .replace(/(\d{2})(\d)/, "($1) $2")
              .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
            setForm({ ...form, whatsapp: mask });
          }}
          style={iI}
        />

        <SLi c="Célula *" />
        <select
          value={form.celula}
          onChange={(e) => setForm({ ...form, celula: e.target.value })}
          style={iI}
        >
          <option value="">Selecione sua célula...</option>
          {CELULAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <SLi c="Tamanho da Camiseta *" />
        <Radio
          val={form.camiseta}
          set={(v) => setForm({ ...form, camiseta: v })}
          opts={["P", "M", "G", "GG", "EXG", "G1", "G2", "G3"]}
        />

      <SLi c="Autoriza uso de imagem? *" />
      <div style={{ background: 'rgba(0,200,81,.08)', border: '1px solid rgba(0,200,81,.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 10, color: 'rgba(255,255,255,.7)', fontSize: 13, lineHeight: 1.6 }}>
        Sua história pode transformar outras vidas!<br /> As imagens do evento serão usadas como testemunho do poder de Deus para alcançar pessoas que ainda precisam de um encontro com Ele.
      </div>
      <Radio val={form.autorizaImagem} set={v => setForm({ ...form, autorizaImagem: v })} opts={['Sim', 'Não']} />

       <SLi c="Contato de Emergência *" />
      <input 
        placeholder="Nome do contato" 
        value={form.emergenciaNome || ''}
        onChange={e => setForm({ ...form, emergenciaNome: e.target.value })} 
        style={{ ...iI, marginBottom: 8 }} 
      />
      
      <input 
        placeholder="Telefone do contato" 
        type="tel" 
        value={form.emergenciaTel || ''}
        maxLength={15}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 11);
          const mask = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
          setForm({ ...form, emergenciaTel: mask });
        }} 
        style={iI} 
      />

        <SLi c="Toma algum medicamento? *" />
        <Radio
          val={form.temMedicamento}
          set={(v) => setForm({ ...form, temMedicamento: v, medicamento: v === 'Não' ? 'Não' : form.medicamento })}
          opts={['Sim', 'Não']}
        />
        {form.temMedicamento === 'Sim' && (
          <input
            placeholder="Qual medicamento? *"
            value={form.medicamento}
            onChange={(e) => setForm({ ...form, medicamento: e.target.value })}
            style={{ 
              ...iI, 
              marginTop: 8,
              borderColor: !form.medicamento?.trim() ? "rgba(255,59,48,.4)" : "#2a2a2a"
            }}
          />
        )}

        <SLi c="Tem alguma doença crônica? *" />
        <Radio
          val={form.temDoenca}
          set={(v) => setForm({ ...form, temDoenca: v, doenca: v === 'Não' ? 'Não' : form.doenca })}
          opts={['Sim', 'Não']}
        />
        {form.temDoenca === 'Sim' && (
          <input
            placeholder="Qual doença? *"
            value={form.doenca}
            onChange={(e) => setForm({ ...form, doenca: e.target.value })}
            style={{ 
              ...iI, 
              marginTop: 8,
              borderColor: !form.doenca?.trim() ? "rgba(255,59,48,.4)" : "#2a2a2a"
            }}
          />
        )}

        <button
          onClick={salvar}
          disabled={saving}
          style={BG({
            width: "100%",
            padding: 16,
            borderRadius: 16,
            marginTop: 28,
            fontSize: 15,
            opacity: saving ? 0.7 : 1,
          })}
        >
          {saving ? "Enviando..." : "Enviar Inscrição"}
        </button>
      </div>
      <BotaoAjuda />
      <BotaoInsta />
      <BotaoFaq onFaq={onFaq} />
    </div>
  );
}

function TermoInscricao({ encId, form, onAssinado, onVoltar }) {
  const [cep, setCep] = useState("");
  const [num, setNum] = useState("");
  const [comp, setComp] = useState("");
  const [end, setEnd] = useState("");
  const [loadCep, setLoadCep] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [saving, setSaving] = useState(false);

  // Foto do documento: frente e opcionalmente verso
  const [fotoFrente, setFotoFrente] = useState(null);
  const [fotoVerso, setFotoVerso] = useState(null);
  const [previewFrente, setPreviewFrente] = useState(null);
  const [previewVerso, setPreviewVerso] = useState(null);
  const [perguntouVerso, setPerguntouVerso] = useState(false);
  const [precisaVerso, setPrecisaVerso] = useState(null); // true/false
  const [fotoRosto, setFotoRosto] = useState(null);
  const [previewRosto, setPreviewRosto] = useState(null);

  const comprimirImagem = (file) =>
    new Promise((resolve) => {
      if (!file.type.startsWith("image/") || file.size < 1.5 * 1024 * 1024) { resolve(file); return; }
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > height && width > MAX_DIM) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
        else if (height > MAX_DIM) { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file), "image/jpeg", 0.75);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });

  const uploadFoto = async (file, caminho) => {
    const arq = await comprimirImagem(file);
    const r = ref(storage, caminho);
    await uploadBytes(r, arq);
    return await getDownloadURL(r);
  };

  const buscarCep = async (valor) => {
    const limpo = valor.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setLoadCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) setEnd(`${data.logradouro}, ${data.bairro}, ${data.localidade}/${data.uf}`);
    } catch {}
    setLoadCep(false);
  };

  const [modalVerso, setModalVerso] = useState(false);

  const handleFotoFrente = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoFrente(file);
    setPreviewFrente(URL.createObjectURL(file));
    setModalVerso(true);
  };

  const handleFotoVerso = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFotoVerso(file);
    setPreviewVerso(URL.createObjectURL(file));
  };

  const assinar = async () => {
    if (!end.trim() || !num.trim()) {
      alert("Preencha o endereço completo (rua e número).");
      return;
    }
    if (!aceite) { alert("Você precisa aceitar os termos para assinar."); return; }
    if (!fotoFrente) { alert("Envie uma foto do documento (frente)."); return; }
    if (precisaVerso && !fotoVerso) { alert("Envie a foto do verso do documento."); return; }
    if (!fotoRosto) { alert("Tire uma selfie para validar."); return; }

    setSaving(true);
    const agora = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
    const endCompleto = `${end}, ${num}, ${comp}`;
    const termoTexto = `O(a) signatário(a) manifesta concordância com o registro, utilização e divulgação de sua imagem em mídias sociais da Igreja Apostólica Fonte (CNPJ 52.268.825/0001-95), localizada à Rua Catiguá nº 130, Ipês (Polvilho), Cajamar/SP, CEP 07750-000.\n\nA autorização é referente a imagens e vídeos do evento "Encontro com Deus", nos dias 20, 21 e 22 de novembro de 2026.\n\nTambém concorda com as regras do evento, destacando que não é permitido nenhum tipo de registro e/ou gravação pelos inscritos — apenas pela organização.\n\nPor fim, declara que toda participação foi voluntária, em conformidade com a legislação vigente, não infringindo o art. 208 do Código Penal.`;

    let urlDoc = null, urlVerso = null, urlRosto = null;
    try { urlDoc = await uploadFoto(fotoFrente, `termos/${encId}/documento_frente`); }
    catch (err) { setSaving(false); alert("Erro ao enviar foto do documento: " + err.message); return; }

    if (precisaVerso && fotoVerso) {
      try { urlVerso = await uploadFoto(fotoVerso, `termos/${encId}/documento_verso`); }
      catch (err) { setSaving(false); alert("Erro ao enviar verso do documento: " + err.message); return; }
    }

    try { urlRosto = await uploadFoto(fotoRosto, `termos/${encId}/selfie`); }
    catch (err) { setSaving(false); alert("Erro ao enviar selfie: " + err.message); return; }

    try {
      await setDoc(doc(db, "encontristas", encId), {
        endereco: endCompleto, termoAssinado: true, termoAssinadoEm: agora,
        fotoDocumento: urlDoc, fotoDocumentoVerso: urlVerso || null, fotoRosto: urlRosto,
      }, { merge: true });
    } catch (err) { setSaving(false); alert("Erro ao salvar seus dados: " + err.message); return; }

    try {
      const nomeCompleto = form.nome?.trim() || "";
      const igrejaFinal = form.igreja === "Outra" ? form.igrejaCustom?.trim() : form.igreja;
      await addDoc(collection(db, "termos"), {
        encontristaId: encId, nome: nomeCompleto, cpf: form.cpf?.replace(/[\.\-]/g, ""),
        endereco: endCompleto, sexo: form.sexo, igreja: igrejaFinal,
        autorizaImagem: form.autorizaImagem, assinadoEm: agora, termoTexto,
        fotoDocumento: urlDoc, fotoDocumentoVerso: urlVerso || null, fotoRosto: urlRosto,
      });
    } catch (err) { console.error("Erro ao salvar termo:", err); }

    setSaving(false);
    onAssinado();
  };

  const iI = { ...I, marginBottom: 0 };

  return (
    <div style={{ minHeight: "100vh", background: "#000", paddingBottom: 60 }}>

      {/* Modal: a foto já tem frente e verso? */}
      {modalVerso && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#1a1a1a", borderRadius: 18, padding: 24, maxWidth: 340, width: "100%", textAlign: "center" }}>
            <FileText size={32} color="#0a84ff" style={{ marginBottom: 12 }} />
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Sua foto já tem frente e verso?</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              Se o documento completo já aparece em uma só foto, toque em <strong style={{ color: "#fff" }}>OK</strong>.<br/>
              Se precisar enviar o verso separado, toque em <strong style={{ color: "#fff" }}>Enviar 2ª foto</strong>.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setPerguntouVerso(true); setPrecisaVerso(true); setModalVerso(false); }}
                style={{ ...BK({ flex: 1, padding: 13, borderRadius: 12, fontSize: 14 }), borderColor: "rgba(10,132,255,.4)", color: "#0a84ff" }}
              >
                Enviar 2ª foto
              </button>
              <button
                onClick={() => { setPerguntouVerso(true); setPrecisaVerso(false); setModalVerso(false); }}
                style={BG({ flex: 1, padding: 13, borderRadius: 12, fontSize: 14 })}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "#000", borderBottom: "1px solid #1a1a1a", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50 }}>
        <button
          onClick={onVoltar}
          style={BK({
            padding: "8px 13px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          })}
        >
          ←
        </button>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, textAlign: "center", flex: 1 }}>Termo de Concordância</div>
        <div style={{ width: 39, flexShrink: 0 }} aria-hidden="true" />
      </div>
      <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 4, textAlign: "center" }}>
          Termo de Concordância com as Ministrações e Autorização de Uso de Imagem
        </div>
        <div style={{ color: "rgba(255,255,255,.3)", fontSize: 11, textAlign: "center", marginBottom: 24 }}>
          Encontro com Deus — 20, 21 e 22 de novembro de 2026
        </div>

        {/* Dados do encontrista (pré-preenchidos) */}
        <div style={{ background: "#111", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Signatário</div>
          <div style={{ color: "#fff", fontWeight: 700 }}>{form.nome}</div>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12, marginTop: 4 }}>{form.sexo} · {form.igreja === "Outra" ? form.igrejaCustom : form.igreja}</div>
        </div>

        {/* Endereço */}
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, marginTop: 20 }}>Endereço *</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={cep} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); setCep(v); buscarCep(v); }} placeholder="CEP" style={{ ...iI, width: 120 }} />
          {loadCep && <span style={{ color: "rgba(255,255,255,.4)", fontSize: 12, alignSelf: "center" }}>Buscando...</span>}
        </div>
        <input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="Rua, bairro, cidade/UF" style={{ ...iI, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="Número" style={{ ...iI, width: 90 }} />
          <input value={comp} onChange={(e) => setComp(e.target.value)} placeholder="Complemento (opcional)" style={{ ...iI, flex: 1 }} />
        </div>

        {/* Texto do termo */}
        <div style={{ background: "#111", borderRadius: 14, padding: "14px 16px", marginBottom: 20, color: "rgba(255,255,255,.7)", fontSize: 13, lineHeight: 1.7 }}>
          <p>O(a) signatário(a) manifesta concordância com o registro, utilização e divulgação de sua imagem em mídias sociais da <strong style={{ color: "#fff" }}>Igreja Apostólica Fonte</strong> (CNPJ 52.268.825/0001-95), localizada à Rua Catiguá nº 130, Ipês (Polvilho), Cajamar/SP, CEP 07750-000.</p>
          <p>A autorização é referente a imagens e vídeos do evento <strong style={{ color: "#fff" }}>"Encontro com Deus"</strong>, nos dias 20, 21 e 22 de novembro de 2026.</p>
          <p>Também concorda com as regras do evento, destacando que não é permitido nenhum tipo de registro e/ou gravação pelos inscritos — apenas pela organização.</p>
          <p>Por fim, declara que toda participação foi voluntária, em conformidade com a legislação vigente, não infringindo o art. 208 do Código Penal.</p>
        </div>

        {/* Aceite */}
        <div onClick={() => setAceite(!aceite)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: aceite ? "rgba(0,200,81,.08)" : "#111", border: `1px solid ${aceite ? "rgba(0,200,81,.4)" : "#2a2a2a"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${aceite ? G.green : "#444"}`, background: aceite ? G.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {aceite && <span className="pop" style={{ color: "#000", fontSize: 12, fontWeight: 900, display: "inline-block" }}>✓</span>}
          </div>
          <span style={{ color: aceite ? "#fff" : "rgba(255,255,255,.6)", fontSize: 13 }}>Li e concordo com os termos acima</span>
        </div>

        {/* Foto do documento */}
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Documento (frente) *</div>
        <label style={{ display: "block", background: "#111", border: "1px dashed #333", borderRadius: 14, padding: 16, textAlign: "center", cursor: "pointer", marginBottom: 8 }}>
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={handleFotoFrente} />
          {previewFrente
            ? <img src={previewFrente} style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8 }} alt="frente" />
            : <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Camera size={18} /> Toque para tirar foto ou selecionar arquivo</div>
          }
        </label>

        {perguntouVerso && precisaVerso && (
          <>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, marginTop: 16 }}>Documento (verso) *</div>
            <label style={{ display: "block", background: "#111", border: "1px dashed #333", borderRadius: 14, padding: 16, textAlign: "center", cursor: "pointer", marginBottom: 8 }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={handleFotoVerso} />
              {previewVerso
                ? <img src={previewVerso} style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8 }} alt="verso" />
                : <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Camera size={18} /> Foto do verso</div>
              }
            </label>
          </>
        )}

        {/* Selfie */}
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, marginTop: 16 }}>Selfie de validação *</div>
        <label style={{ display: "block", background: "#111", border: "1px dashed #333", borderRadius: 14, padding: 16, textAlign: "center", cursor: "pointer", marginBottom: 24 }}>
          <input type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { setFotoRosto(f); setPreviewRosto(URL.createObjectURL(f)); } }} />
          {previewRosto
            ? <img src={previewRosto} style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8 }} alt="selfie" />
            : <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><UserSquare size={18} /> Tire uma selfie segurando seu documento</div>
          }
        </label>

        <button
          onClick={assinar}
          disabled={saving}
          style={{ ...BG({ width: "100%", padding: 16, borderRadius: 14, fontSize: 15 }), opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Enviando... aguarde" : "Assinar e ir para pagamento →"}
        </button>
      </div>
    </div>
  );
}

function Termo({ cpf, onVoltar }) {
  const [enc, setEnc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Timeout de segurança — se demorar mais de 8s em loading, mostrar erro
  useEffect(() => {
    let timer = setTimeout(() => {
      setLoadingTimeout(true);
      setLoading(false);
    }, 25000);

    // Se a aba ficar em background e voltar, reseta o timer — evita falso timeout
    // causado pelo browser pausando JS enquanto a aba estava oculta.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        timer = setTimeout(() => {
          setLoadingTimeout(true);
          setLoading(false);
        }, 25000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const [rg, setRg] = useState("");
  const [cep, setCep] = useState("");
  const [num, setNum] = useState("");
  const [comp, setComp] = useState("");
  const [end, setEnd] = useState("");
  const [loadCep, setLoadCep] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fotoDoc, setFotoDoc] = useState(null);
  const [fotoRosto, setFotoRosto] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewRosto, setPreviewRosto] = useState(null);

  const uploadFoto = async (file, caminho) => {
    const arquivo = await comprimirImagemSeNecessario(file);
    const storageRef = ref(storage, caminho);
    await uploadBytes(storageRef, arquivo);
    return await getDownloadURL(storageRef);
  };

  const comprimirImagemSeNecessario = (file) => {
    return new Promise((resolve) => {
      // PDFs e arquivos já pequenos (<1.5MB) não precisam de compressão
      if (!file.type.startsWith("image/") || file.size < 1.5 * 1024 * 1024) {
        resolve(file);
        return;
      }
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              resolve(file); // fallback se a compressão falhar
            }
          },
          "image/jpeg",
          0.75
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  };

  const buscarCep = async (valor) => {
    const limpo = valor.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setLoadCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEnd(
          `${data.logradouro}, ${data.bairro}, ${data.localidade}/${data.uf}`,
        );
      }
    } catch {}
    setLoadCep(false);
  };

  useEffect(() => {
    const buscar = async () => {
      const cpfLimpo = cpf.replace(/\D/g, "");
      try {
        // Query direta por cpf — muito mais rápida que baixar toda a coleção
        const q = query(collection(db, "encontristas"), where("cpf", "==", cpfLimpo), limit(1));
        const snap = await getDocs(q);
        let found = snap.docs[0];

        // Fallback: se não achou (ex: cpf salvo com formatação diferente), tenta busca completa
        if (!found) {
          const snapAll = await getDocs(collection(db, "encontristas"));
          found = snapAll.docs.find((d) => d.data().cpf === cpfLimpo);
        }

        if (found) {
          const data = found.data();
          setEnc({ id: found.id, ...data });
          if (data.termoAssinado) setAssinado(true);
          if (data.rg) setRg(data.rg);
          if (data.endereco) setEnd(data.endereco);
        }
      } catch (err) {
        console.error("Erro ao buscar:", err);
      } finally {
        setLoading(false);
        setLoadingTimeout(false); // garante que o sucesso sempre sobrescreve um timeout anterior
      }
    };
    buscar();
  }, [cpf]);

  const assinar = async () => {
    if (!rg.trim() || !end.trim() || !num.trim() || !comp.trim()) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!aceite) {
      alert("Você precisa aceitar os termos para assinar.");
      return;
    }
    if (!fotoDoc) { alert("Anexe uma foto do documento."); return; }
    if (!fotoRosto) { alert("Tire uma selfie para validar."); return; }
    setSaving(true);
    
    const agora = new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
    const endCompleto = `${end}, ${num}, ${comp}`;
    const termoTexto = `O(a) signatário(a) manifesta concordância com o registro, utilização e divulgação de sua imagem em mídias sociais da Igreja Apostólica Fonte (CNPJ 52.268.825/0001-95), localizada à Rua Catiguá nº 130, Ipês (Polvilho), Cajamar/SP, CEP 07750-000.

      A autorização é referente a imagens e vídeos do evento "Encontro com Deus", nos dias 20, 21 e 22 de novembro de 2026.

      Também concorda com as regras do evento, destacando que não é permitido nenhum tipo de registro e/ou gravação pelos inscritos — apenas pela organização.

      Por fim, declara que toda participação foi voluntária, em conformidade com a legislação vigente, não infringindo o art. 208 do Código Penal.`;

    let urlDoc = null;
    let urlRosto = null;

    try {
      urlDoc = await uploadFoto(fotoDoc, `termos/${enc.id}/documento`);
    } catch (err) {
      console.error("Erro ao enviar foto do documento:", err);
      setSaving(false);
      alert("Erro ao enviar a foto do documento: " + (err.message || "tente novamente.") + "\n\nVerifique sua conexão e tente outra vez.");
      return;
    }

    try {
      urlRosto = await uploadFoto(fotoRosto, `termos/${enc.id}/selfie`);
    } catch (err) {
      console.error("Erro ao enviar selfie:", err);
      setSaving(false);
      alert("Erro ao enviar a selfie: " + (err.message || "tente novamente.") + "\n\nVerifique sua conexão e tente outra vez.");
      return;
    }

    try {
      await setDoc(doc(db, "encontristas", enc.id), {
        rg, endereco: endCompleto, termoAssinado: true, termoAssinadoEm: agora,
        fotoDocumento: urlDoc, fotoRosto: urlRosto,
      }, { merge: true });
    } catch (err) {
      console.error("Erro ao salvar encontrista:", err);
      setSaving(false);
      alert("Erro ao salvar seus dados: " + (err.message || "tente novamente.") + "\n\nVerifique sua conexão e tente outra vez.");
      return;
    }

    try {
      await addDoc(collection(db, "termos"), {
        encontristaId: enc.id, nome: enc.nome, cpf: enc.cpf, rg,
        endereco: endCompleto, sexo: enc.sexo, igreja: enc.igreja,
        autorizaImagem: enc.autorizaImagem, assinadoEm: agora, termoTexto,
        fotoDocumento: urlDoc, fotoRosto: urlRosto,
      });
    } catch (err) {
      console.error("Erro ao salvar termo:", err);
      alert("Erro termo: " + err.message);
    }

    setAssinado(true);
    setSaving(false);
  };

  if (loadingTimeout && !enc)
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 32, textAlign: "center", fontFamily: "sans-serif" }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus" style={{ width: 160, mixBlendMode: "screen", opacity: 0.85 }} />
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginTop: 8 }}>Não foi possível carregar</div>
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 13, lineHeight: 1.6 }}>Para melhor experiência, abra o link no Safari ou Chrome.</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, background: "#30d158", color: "#000", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Tentar novamente</button>
      </div>
    );

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 14 }}>
          Carregando...
        </div>
      </div>
    );

  if (!enc)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            CPF não encontrado
          </div>
          <div
            style={{
              color: "rgba(255,255,255,.4)",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            Verifique o CPF informado ou fale com a organização.
          </div>
          <button
            onClick={onVoltar}
            style={BK({ padding: "12px 24px", borderRadius: 12 })}
          >
            Voltar
          </button>
        </div>
      </div>
    );

    if (assinado)
    return (
      <div className="scr" style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
          <img src="/IMG_2408.PNG" alt="Encontro com Deus" style={{ width: 140, mixBlendMode: "screen", display: "block", margin: "0 auto 20px" }} />
          <CheckCircle2 size={48} color={G.green} style={{ marginBottom: 12 }} />
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Termo assinado!</div>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
            Seu termo foi registrado com sucesso.
          </div>
          <button
            onClick={async () => {
              const snap = await getDocs(collection(db, "termos"));
              const termoDoc = snap.docs.find(d => d.data().encontristaId === enc.id);
              if (!termoDoc) { alert("Termo não encontrado."); return; }
              await exportarPDF({ id: termoDoc.id, ...termoDoc.data() });
            }}
            style={{ ...BG({ width: "100%", padding: 14, borderRadius: 14, marginBottom: 12 }), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Download size={18} />
            Baixar meu termo
          </button>
        </div>
      </div>
    );

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#000", paddingBottom: 60 }}>
      <div
        style={{
          background: "#000",
          borderBottom: "1px solid #1a1a1a",
          padding: "14px 16px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          Termo de Concordância
        </div>
      </div>
      <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
        <div
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            marginBottom: 4,
            textAlign: "center",
          }}
        >
          Termo de Concordância com as Ministrações e Autorização de Uso de
          Imagem
        </div>
        <div
          style={{
            color: "rgba(255,255,255,.3)",
            fontSize: 11,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Encontro com Deus — 20, 21 e 22 de novembro de 2026
        </div>

        <div
          style={{
            background: "#111",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 20,
            border: "1px solid #222",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,.4)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Dados do Signatário
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>
                Nome
              </div>
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>
                {enc.nome}
              </div>
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>
                CPF
              </div>
              <div style={{ color: "#fff", fontSize: 14 }}>{enc.cpf}</div>
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>
                Autorização de uso de imagem
              </div>
              <div style={{ color: "#fff", fontSize: 14 }}>
                {enc.autorizaImagem || "—"}
              </div>
            </div>
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,.4)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                RG *
              </div>
              <input
                placeholder="Digite seu RG"
                value={rg}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                  const mask = v
                    .replace(/(\d{2})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d)/, "$1.$2")
                    .replace(/(\d{3})(\d{1})$/, "$1-$2");
                  setRg(mask);
                }}
                style={I}
              />
            </div>
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,.4)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                CEP
              </div>
              <input
                placeholder="00000-000"
                value={cep}
                maxLength={9}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                  const mask = v.replace(/(\d{5})(\d)/, "$1-$2");
                  setCep(mask);
                  buscarCep(v);
                }}
                style={I}
              />
            </div>
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,.4)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                Número *
              </div>
              <input
                placeholder="Ex: 241"
                value={num}
                onChange={(e) => setNum(e.target.value)}
                style={I}
              />
            </div>
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,.4)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                Complemento *
              </div>
              <input
                placeholder="Ex: Apto 12, Casa 1"
                value={comp}
                onChange={(e) => setComp(e.target.value)}
                style={I}
              />
            </div>
            <div>
              <div
                style={{
                  color: "rgba(255,255,255,.4)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                Endereço *{" "}
                {loadCep && <span style={{ color: G.tm }}>buscando...</span>}
              </div>
              <input
                placeholder="Rua, número, bairro, cidade"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={I}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#0d0d0d",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 20,
            border: "1px solid #1a1a1a",
          }}
        >
          <div
            style={{
              color: "rgba(255,255,255,.7)",
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <p style={{ marginBottom: 12 }}>
              O(a) signatário(a) manifesta concordância com o registro,
              utilização e divulgação de sua imagem em mídias sociais da{" "}
              <strong style={{ color: "#fff" }}>Igreja Apostólica Fonte</strong>{" "}
              (CNPJ 52.268.825/0001-95), localizada à Rua Catiguá nº 130, Ipês
              (Polvilho), Cajamar/SP, CEP 07750-000.
            </p>
            <p style={{ marginBottom: 12 }}>
              A autorização é referente a imagens e vídeos do evento{" "}
              <strong style={{ color: "#fff" }}>"Encontro com Deus"</strong>,
              nos dias 20, 21 e 22 de novembro de 2026.
            </p>
            <p style={{ marginBottom: 12 }}>
              Também concorda com as regras do evento, destacando que{" "}
              <strong style={{ color: "#fff" }}>
                não é permitido nenhum tipo de registro e/ou gravação pelos
                inscritos
              </strong>{" "}
              — apenas pela organização.
            </p>
            <p style={{ marginBottom: 0 }}>
              Por fim, declara que toda participação foi voluntária, em
              conformidade com a legislação vigente, não infringindo o art. 208
              do Código Penal.
            </p>
          </div>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,.4)",
            fontSize: 12,
            lineHeight: 1.6,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Assinado em: Cajamar, {hoje}.<br />
          Igreja Apostólica Fonte (IF) — Av. Tenente Marques, 5014, Portais
          (Polvilho), Cajamar/SP, CEP 07790-845 | Tel: (11) 94718-7017
        </div>

        <div
          onClick={() => setAceite(!aceite)}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            background: "#111",
            borderRadius: 14,
            padding: "14px",
            marginBottom: 20,
            border: `1px solid ${aceite ? "rgba(0,200,81,.4)" : "#222"}`,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: `2px solid ${aceite ? G.green : "#444"}`,
              background: aceite ? "rgba(0,200,81,.15)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {aceite && (
              <span style={{ color: G.green, fontSize: 13, fontWeight: 800 }}>
                ✓
              </span>
            )}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,.7)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Li e concordo com todos os termos acima, incluindo as regras do
            evento e a autorização de uso de imagem.
          </div>
        </div>

        {/* FOTO DO DOCUMENTO */}
        <div style={{ background: "#111", borderRadius: 14, padding: 14, marginBottom: 12, border: `1px solid ${fotoDoc ? "rgba(0,200,81,.3)" : "#222"}` }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>📄 Foto do Documento *</div>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12, marginBottom: 10 }}>Tire foto ou anexe o RG, CNH ou documento digital (PDF).</div>
          {previewDoc && (
            <img src={previewDoc} style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 200, objectFit: "cover" }} />
          )}
          {fotoDoc && !previewDoc && (
            <div style={{ color: G.green, fontSize: 12, marginBottom: 10 }}>✓ {fotoDoc.name}</div>
          )}
          <label style={{ display: "block", background: "rgba(10,132,255,.1)", border: "1px solid rgba(10,132,255,.3)", borderRadius: 12, padding: "12px", textAlign: "center", color: "#64b5f6", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {fotoDoc ? "Trocar documento" : "📷 Tirar foto / Anexar"}
            <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                setFotoDoc(file);
                if (file.type.startsWith("image/")) setPreviewDoc(URL.createObjectURL(file));
                else setPreviewDoc(null);
              }}
            />
          </label>
        </div>

        {/* SELFIE */}
        <div style={{ background: "#111", borderRadius: 14, padding: 14, marginBottom: 20, border: `1px solid ${fotoRosto ? "rgba(0,200,81,.3)" : "#222"}` }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🤳 Selfie para validação *</div>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12, marginBottom: 10 }}>Tire uma foto do seu rosto para validar a assinatura.</div>
          {previewRosto && (
            <img src={previewRosto} style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 200, objectFit: "cover" }} />
          )}
          <label style={{ display: "block", background: "rgba(191,90,242,.1)", border: "1px solid rgba(191,90,242,.3)", borderRadius: 12, padding: "12px", textAlign: "center", color: "#bf5af2", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            {fotoRosto ? "Tirar outra selfie" : "🤳 Tirar selfie"}
            <input type="file" accept="image/*" capture="user" style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                setFotoRosto(file);
                setPreviewRosto(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>

        <button
          onClick={assinar}
          disabled={saving}
          style={BG({
            width: "100%",
            padding: 16,
            borderRadius: 14,
            fontSize: 15,
            opacity: saving ? 0.7 : 1,
          })}
        >
          {saving ? "Assinando..." : "Assinar Termo"}
        </button>
      </div>
    </div>
  );
}

const exportarPDF = async (termo) => {
    if (!termo) {
      alert("Dados do termo não encontrados.");
      return;
    }

    const jsPDF = await carregarJsPDF();
    const pdf = new jsPDF();
    const margin = 20;
    const pageW = 210;
    let y = 20;

    const line = (txt, size = 11, bold = false, align = "left") => {
      pdf.setFontSize(size);
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      const maxW = pageW - margin * 2;
      const lines = pdf.splitTextToSize(String(txt || ""), maxW);
      const x = align === "center" ? pageW / 2 : margin;
      pdf.text(lines, x, y, { align });
      y += lines.length * (size * 0.45) + 5;
    };

    const hr = () => {
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;
    };

    pdf.setFillColor(240, 240, 240);
    pdf.rect(0, 0, pageW, 30, "F");
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 30, 30);
    pdf.text("Igreja Apostólica Fonte", pageW / 2, 13, { align: "center" });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text("R. Catiguá, 130 - Ipês (Polvilho), Cajamar - SP, 07750-000 | Tel: (11) 94718-7017", pageW / 2, 21, { align: "center" });
    y = 40;

    pdf.setTextColor(30, 30, 30);
    line("Termo de Concordância com as Ministrações e Autorização de Uso de Imagem", 14, true, "center");
    y += 2;
    hr();

    line("DADOS DO SIGNATÁRIO", 10, true);
    y += 2;

    const campo = (label, valor) => {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(120, 120, 120);
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(String(valor || "—"), 170);
      y += 5;
      pdf.text(lines, margin, y);
      y += lines.length * 6 + 2;
    };

    campo("Nome", termo.nome);
    campo("CPF", termo.cpf);
    campo("RG", termo.rg);
    campo("Endereço", termo.endereco);
    campo("Autorização de uso de imagem", termo.autorizaImagem);
    campo("Sexo", termo.sexo);
    campo("Igreja", termo.igreja || "—");

    y += 2;
    hr();

    line("TERMO", 10, true);
    y += 2;
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 30, 30);
    const textoLimpo = (termo.termoTexto || "").replace(/\\n/g, "\n");
    const paragrafos = textoLimpo.split("\n").filter((p) => p.trim());
    paragrafos.forEach((p) => {
      const lines = pdf.splitTextToSize(p, 170);
      if (y + lines.length * 6 > 270) { pdf.addPage(); y = 20; }
      pdf.text(lines, margin, y);
      y += lines.length * 6 + 2;
    });

    y += 8;
    if (y + 40 > 285) { pdf.addPage(); y = 20; }
    hr();
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 30, 30);
    pdf.text(`Assinado digitalmente por: ${termo.nome}`, margin, y);
    y += 6;
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Assinado em: ${termo.assinadoEm || "—"} pelo app Encontro com Deus`, margin, y);

    const addImg = async (url, titulo, isPdf = false) => {
      if (isPdf) {
        pdf.addPage();
        let yF = 20;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text(titulo, margin, yF);
        yF += 10;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text("Documento anexado digitalmente.", margin, yF);
        yF += 6;
        pdf.setTextColor(10, 100, 200);
        pdf.textWithLink("Clique aqui para visualizar o documento", margin, yF, { url });
        return;
      }

      let dataUrl = null;
      try {
        dataUrl = await new Promise((resolve, reject) => {
          const img = document.createElement("img");
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
          };
          img.onerror = reject;
          img.src = url;
        });
      } catch (e) {
        console.error("Erro ao carregar imagem:", e);
        return; // ← não adiciona página se falhar
      }

      pdf.addPage();
      let yF = 20;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text(titulo, margin, yF);
      yF += 10;
      pdf.addImage(dataUrl, 'JPEG', margin, yF, 170, 130);
    };

    const ext = termo.fotoDocumento?.split('?')[0]?.split('%2F').pop()?.toLowerCase();
    const isDocPdf = ext === 'documento' || termo.fotoDocumento?.includes('application/pdf');
    if (termo.fotoDocumento) await addImg(termo.fotoDocumento, "DOCUMENTO DE IDENTIDADE", isDocPdf);
    if (termo.fotoRosto) await addImg(termo.fotoRosto, "SELFIE DE VALIDAÇÃO", false);


    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Igreja Apostólica Fonte — CNPJ 52.268.825/0001-95`, margin, 287);
      pdf.text(`Página ${i} de ${totalPages}`, pageW - margin, 287, { align: "right" });
    }

    pdf.save(`termo_${termo.nome.trim().replace(/ /g, "_")}.pdf`);
  };

function TermoAdminV({ encH, encM, t, buscaInicial }) {
  const [aba, setAba] = useState("aguardando");
  const [s, setS] = useState(buscaInicial || "");
  const [termos, setTermos] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "termos"), (snap) => {
      setTermos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Todos os encontristas inscritos (pagos, pagar depois ou pendentes com termo iniciado)
  const todos = [...encH, ...encM];

  const lista = useMemo(() => {
    const filtrado = todos.filter((e) =>
      e.nome.toLowerCase().includes(s.toLowerCase()),
    );
    if (aba === "aguardando")
      return filtrado.filter((e) => !e.termoAssinado);
    return filtrado.filter((e) => e.termoAssinado);
  }, [todos, aba, s]);

  const [exportandoTodos, setExportandoTodos] = useState(false);

  const exportarTodos = async () => {
    const assinados = todos.filter((e) => e.termoAssinado);
    if (assinados.length === 0) { t("Nenhum termo assinado ainda."); return; }
    setExportandoTodos(true);
    let ok = 0, erro = 0;
    for (const enc of assinados) {
      const termo = termos.find((tr) => tr.encontristaId === enc.id);
      if (!termo) { erro++; continue; }
      try {
        await exportarPDF(termo);
        ok++;
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        console.error("Erro ao exportar PDF de", enc.nome, e);
        erro++;
      }
    }
    setExportandoTodos(false);
    t(`${ok} PDFs baixados${erro > 0 ? ` | ${erro} com erro` : ""}!`);
  };

  const cntAguardando = todos.filter((e) => !e.termoAssinado).length;
  const cntAssinados = todos.filter((e) => e.termoAssinado).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          ["aguardando", `Aguardando (${cntAguardando})`, "#ff9f0a"],
          ["assinado", `Assinados (${cntAssinados})`, G.green],
        ].map(([key, label, cor]) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            style={{
              flex: 1,
              background: aba === key ? cor : "#111",
              color: aba === key ? "#000" : G.td,
              border: "none",
              borderRadius: 10,
              padding: "9px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        value={s}
        onChange={(e) => setS(e.target.value)}
        placeholder="Buscar por nome..."
        style={{ ...I, marginBottom: 10 }}
      />

      {aba === "assinado" && lista.length > 0 && (
        <button
          onClick={exportarTodos}
          disabled={exportandoTodos}
          style={{
            ...BK({ width: "100%", padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 12 }),
            borderColor: "rgba(0,200,81,.4)",
            color: exportandoTodos ? G.tm : G.green,
          }}
        >
          {exportandoTodos ? "Baixando... aguarde" : `⬇ Baixar todos (${lista.length} PDFs)`}
        </button>
      )}

      {lista.length === 0 && (
        <div className="empty" style={{ color: G.tm, textAlign: "center", padding: 28, fontSize: 13 }}>
          Nenhum encontrista aqui.
        </div>
      )}

      {lista.map((enc) => (
        <div
          key={enc.id}
          className="fu"
          style={{
            background: G.card,
            border: `1px solid ${G.cb}`,
            borderLeft: `3px solid ${aba === "assinado" ? G.green : "#ff9f0a"}`,
            borderRadius: 13,
            padding: "12px 14px",
            marginBottom: 7,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
              {enc.nome}
            </div>
            <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
              {enc.sexo} · {enc.igreja || "—"}
            </div>
            {aba === "assinado" && enc.termoAssinadoEm && (
              <div style={{ color: G.green, fontSize: 11, marginTop: 2 }}>
                ✓ Assinado em {enc.termoAssinadoEm}
              </div>
            )}
            {aba === "aguardando" && (
              <div style={{ color: "#ff9f0a", fontSize: 11, marginTop: 2 }}>
                {enc.pago ? "Pago · aguardando assinatura" : "Inscrito · aguardando assinatura"}
              </div>
            )}
          </div>
          {aba === "assinado" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={async () => {
                  const termo = termos.find((tr) => tr.encontristaId === enc.id);
                  if (!termo) { alert("Dados do termo não encontrados."); return; }
                  await exportarPDF(termo);
                }}
                style={BK({ padding: "8px 14px", borderRadius: 10, fontSize: 12, whiteSpace: "nowrap" })}
              >
                Exportar PDF
              </button>
              <div style={{ color: G.green, fontSize: 18 }}>✓</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

const normalizar = (str) =>
  (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function ServoRestV({ user, encH, encM, t }) {
  const celula = user.celula || "";
  const todos = [...encH, ...encM].filter(
    (e) => normalizar(e.celula) === normalizar(celula),
  );
  const [restricoes, setRestricoes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const buscar = async () => {
      const snap = await getDoc(doc(db, "users", user.id));
      if (snap.exists() && snap.data().restricoes) {
        setRestricoes(snap.data().restricoes);
      }
    };
    buscar();
  }, []);

  const salvar = async (novas) => {
    setRestricoes(novas);
    await setDoc(
      doc(db, "users", user.id),
      { restricoes: novas },
      { merge: true },
    );
    t("Salvo!");
  };

  const toggle = (nomeA, nomeB) => {
    const par = [nomeA, nomeB].sort().join("||");
    const jaExiste = restricoes.includes(par);
    const novas = jaExiste
      ? restricoes.filter((r) => r !== par)
      : [...restricoes, par];
    salvar(novas);
  };

  const temRestricao = (nomeA, nomeB) => {
    const par = [nomeA, nomeB].sort().join("||");
    return restricoes.includes(par);
  };

  if (!celula)
    return (
      <div
        style={{ color: G.tm, textAlign: "center", padding: 28, fontSize: 13 }}
      >
        Célula não definida. Fale com o admin.
      </div>
    );

  return (
    <div>
      <div
        style={{
          background: "rgba(255,59,48,.08)",
          border: "1px solid rgba(255,59,48,.2)",
          borderRadius: 14,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            color: "#ff6b6b",
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 4,
          }}
        >
          ⛔ Restrições — {celula}
        </div>
        <div style={{ color: G.tm, fontSize: 12 }}>
          Marque quem não pode ficar no mesmo quarto.
        </div>
      </div>

      {todos.length === 0 && (
        <div
          className="empty"
          style={{
            color: G.tm,
            textAlign: "center",
            padding: 28,
            fontSize: 13,
          }}
        >
          Nenhum encontrista da sua célula inscrito ainda.
        </div>
      )}

      {todos.map((enc, i) => (
        <div
          key={enc.id}
          className="fu"
          style={{
            background: G.card,
            border: `1px solid ${G.cb}`,
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              color: G.t,
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            {enc.nome}
          </div>
          <div
            style={{
              color: G.tm,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Não pode ficar com:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {todos
              .filter((e) => e.id !== enc.id)
              .map((outro, j) => {
                const restrito = temRestricao(enc.nome, outro.nome);
                return (
                  <button
                    key={j}
                    onClick={() => toggle(enc.nome, outro.nome)}
                    style={{
                      ...BK({
                        padding: "6px 12px",
                        borderRadius: 50,
                        fontSize: 12,
                      }),
                      borderColor: restrito ? "rgba(255,59,48,.5)" : "#2a2a2a",
                      color: restrito ? "#ff6b6b" : G.td,
                      background: restrito
                        ? "rgba(255,59,48,.08)"
                        : "transparent",
                    }}
                  >
                    {restrito ? "⛔ " : ""}
                    {outro.nome.split(" ")[0]}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
// ── TELAS ────────────────────────────────────────────────────────────────────
// Estes componentes ficavam declarados dentro de App(). Como eram recriados a
// cada render, o React via um `type` novo e desmontava/remontava a subárvore
// inteira a cada toast ou snapshot do Firestore — perdendo estado interno
// (busca, filtros, acordeão aberto) e impedindo animações de entrada.

  // shared top bar
  const TB = ({ pg, user, nav, showT, setMenu, notif, setNotif }) => (
    <div style={{
        background: "#000",
        borderBottom: "1px solid #1a1a1a",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
      {/* Esquerda */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
        {pg === "home" ? (
          <button onClick={() => setMenu(true)} style={BK({ padding: "8px 12px", borderRadius: 10, fontSize: 16 })}>☰</button>
        ) : (
          <button onClick={() => nav("home")} style={BK({ padding: "8px 13px", borderRadius: 10, fontSize: 13, fontWeight: 700 })}>←</button>
        )}
      </div>
      {/* Centro */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        {pg === "home" ? (
          <img src="/IMG_2409.PNG" alt="Fonte" style={{ height: 44, opacity: 0.85 }} />
        ) : (
          <span key={pg} className="tt" style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>{LABELS[pg]}</span>
        )}
      </div>
      {/* Direita */}
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
        {pg === "home" && user.pago && <Pill c="Pago ✓" bg="rgba(0,200,81,.15)" tc={G.green} />}
        {pg === "home" && <Pill c={PERFIS[user.perfil]?.l || user.perfil} bg={`${PERFIS[user.perfil]?.c || G.green}18`} tc={PERFIS[user.perfil]?.c || G.green} />}
        <button
          onClick={async () => {
            const token = await iniciarNotificacoes(user?.id);
            if (token) { setNotif(true); showT("Notificações ativas!", "n"); }
            else showT("Permissão negada", "w");
          }}
          style={{ ...BK({ padding: "8px 11px", borderRadius: 10, fontSize: 13, borderColor: notif ? "rgba(0,200,81,.4)" : "#2a2a2a", color: notif ? G.green : G.td }), display: "flex", alignItems: "center" }}
        >
          <Bell size={16} />
        </button>
      </div>
    </div>
  );
  // ── SERVO SHELL ──
    const TelaRestrita = () => (
      <div style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <div style={{ color: G.t, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Acesso restrito</div>
        <div style={{ color: G.tm, fontSize: 13 }}>Você não tem permissão para acessar esta tela.</div>
      </div>
    );
    function FAQ({ onVoltar }) {
      const [aberto, setAberto] = useState(null);
      const perguntas = [
        {
          p: "O que é o Encontro com Deus?",
          r: "O Encontro com Deus é um retiro espiritual preparado para proporcionar momentos de conexão com Deus, renovação da fé e transformação de vida."
        },
        {
          p: "Quanto custa e como pagar?",
          r: "O valor do encontro é de R$ 360,00 no PIX ou boleto, e R$ 384,00 no cartão de crédito, o pagamento via cartão de crédito aceita parcelamento em até 12x com acréscimo de 5% (R$ 384,00). O pagamento deve ser realizado pela plataforma Mercado Pago."
        },
        {
          p: "O que devo levar para o evento?",
          r: "Leve roupas confortáveis, itens de higiene pessoal, Bíblia, travesseiro, roupas de cama de solteiro e objetos de uso pessoal necessários para os dias do encontro."
        },
        {
          p: "Como funciona o transporte?",
          r: "O transporte será realizado em ônibus com saída da sede da Igreja Fonte, localizada na Rua Catiguá, 130 - Cajamar."
        },
        {
          p: "Como confirmo meu pagamento e obtenho o QR Code?",
          r: "Após realizar o pagamento, acesse novamente o app, vá em Já se inscreveu?, informe seu CPF ou WhatsApp e seu QR Code será exibido automaticamente."
        },
        {
          p: "Me inscrevi mas ainda não paguei, o que fazer?",
          r: "Sua inscrição está salva! Para confirmar sua vaga, acesse 'Já se inscreveu?' na tela inicial, informe seu CPF ou WhatsApp e siga as instruções para realizar o pagamento via PIX, boleto ou cartão de crédito. Sua vaga só é garantida após a confirmação do pagamento."
        },
        
      ];

      return (
        <div style={{ minHeight: "100vh", background: "#000", paddingBottom: 40 }}>
          <div style={{
            background: "#000",
            borderBottom: "1px solid #1a1a1a",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}>
            <button onClick={onVoltar} style={BK({ padding: "8px 13px", borderRadius: 10, fontSize: 13, fontWeight: 700 })}>←</button>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Dúvidas Frequentes</span>
          </div>
          <div style={{ padding: "20px 20px 0", maxWidth: 480, margin: "0 auto" }}>
            {perguntas.map((item, i) => (
              <div
                key={i}
                style={{
                  background: "#111",
                  border: `1px solid ${aberto === i ? "rgba(0,200,81,.3)" : "#1e1e1e"}`,
                  borderLeft: `3px solid ${aberto === i ? G.green : "#1e1e1e"}`,
                  borderRadius: 14,
                  marginBottom: 8,
                  overflow: "hidden",
                  transition: "border-color var(--d-fast) var(--e-out)",
                }}
              >
                <div
                  onClick={() => setAberto(aberto === i ? null : i)}
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, flex: 1 }}>
                    {item.p}
                  </span>
                  <span style={{
                    color: G.green,
                    fontSize: 18,
                    transition: "transform var(--d-fast) var(--e-out)",
                    display: "inline-block",
                    transform: aberto === i ? "rotate(45deg)" : "none",
                    marginLeft: 10,
                    fontWeight: 300,
                  }}>
                    +
                  </span>
                </div>
                {aberto === i && (
                  <div style={{
                    borderTop: "1px solid #1e1e1e",
                    padding: "12px 16px",
                    color: "rgba(255,255,255,.6)",
                    fontSize: 13,
                    lineHeight: 1.7,
                  }}>
                    {item.r}
                  </div>
                )}
              </div>
            ))}
              <a
              href="https://wa.me/5511982222149?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20o%20Encontro%20com%20Deus."
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "rgba(37,211,102,.1)",
                border: "1px solid rgba(37,211,102,.3)",
                color: "#25d366",
                borderRadius: 14,
                padding: "14px",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                marginTop: 16,
              }}
            >
              Ainda tem dúvidas? Fale conosco
            </a>
          </div>
        </div>
      );
    }
  function CozinhaServoV({ nome }) {
    const [tarefas, setTarefas] = useState([]);

    useEffect(() => {
      const unsub = onSnapshot(collection(db, 'cozinha'), (snap) => {
        const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTarefas(todas.filter(t => (t.s || []).includes(nome)));
      });
      return () => unsub();
    }, [nome]);

    if (tarefas.length === 0) return null;

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
          Cozinha
        </div>
        {tarefas.map(t => (
          <div
            key={t.id}
            className="fu"
            style={{
              background: G.card,
              border: `1px solid ${G.cb}`,
              borderLeft: `3px solid #ff9f0a`,
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 16 }}>🍽️</span>
              <span style={{ color: G.t, fontWeight: 700, fontSize: 14 }}>{t.r}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  function MinCard({ m }) {
    const [aberto, setAberto] = useState(false);
    return (
      <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, overflow: "hidden" }}>
        <div onClick={() => setAberto(!aberto)} style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
          <div>
            <div style={{ color: G.t, fontWeight: 700, fontSize: 13 }}>{m.titulo}</div>
            <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>{m.dia}</div>
          </div>
          <span style={{ color: G.tm, fontSize: 12, display: "inline-block", transform: aberto ? "rotate(180deg)" : "none", transition: "transform var(--d-fast) var(--e-out)" }}>▾</span>
        </div>
        {aberto && (
          <div style={{ borderTop: `1px solid ${G.cb}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ color: G.green, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Resumo</div>
              <div style={{ color: G.td, fontSize: 13, lineHeight: 1.6 }}>{m.resumo}</div>
            </div>
            {m.ato && (
              <div>
                <div style={{ color: "#ff9f0a", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Ato</div>
                <div style={{ color: G.td, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}>{m.ato}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  // ── SERVO HOME ───────────────────────────────────────────────────────────────
  function ServoHomeV({ user, mins, avs, ocorr, setPg, pago, role, uni, dataLimiteUni, dataLimitePagamento, esc, users, qh, qm, on, liderMapOverrides }) {
    const [cartasGlobais, setCartasGlobais] = useState([]);
    useEffect(() => {
      const unsub = onSnapshot(collection(db, "cartas"), (snap) => {
        setCartasGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }, []);

    const [respCartas, setRespCartas] = useState("");
    useEffect(() => {
      const unsub = onSnapshot(doc(db, "config", "cartas"), (snap) => {
        if (snap.exists()) setRespCartas(snap.data().responsavel || "");
      });
      return () => unsub();
    }, []);

    const minhasCartasTotal = cartasGlobais
      .filter(c => c.servoId === user.id && !c.retirada)
      .reduce((acc, c) => acc + (c.qtd || 1), 0);

    const [tab, setTab] = useState("mins");
    const [slide, setSlide] = useState(0);
    const [diasAbertos, setDiasAbertos] = useState({});
    const touchStartX = useRef(0);
    const [avsVistos, setAvsVistos] = useState(() => {
      try { return JSON.parse(localStorage.getItem(`avs_vistos_${user.id}`) || "[]"); } catch { return []; }
    });

    const avsNaoVistos = avs.filter(a => !avsVistos.includes(a.id)).length;

    const dC = { Quinta: "#ff6b35", Sexta: "#bf5af2", Sábado: G.green, Domingo: "#ff9f0a" };
    const DIAS = ["Quinta", "Sexta", "Sábado", "Domingo"];

    const prox = mins.find((m) => !m.sent);
    const meuPedido = uni.find((u) => u.userId === user.id);
    const escala = user.escala || {};

    const toggleDia = (dia) => setDiasAbertos(prev => ({ ...prev, [dia]: !prev[dia] }));

    const meuUniPagoSinal = meuPedido?.pagoSinal === true;
    const meuUniPagoIntegral = meuPedido?.pagoIntegral === true;

    const hoje2 = new Date();
    const dataEvento = new Date("2026-11-20");
    const dataInicioJejum = new Date("2026-11-20");
    dataInicioJejum.setDate(dataInicioJejum.getDate() - 40);

    const slides = [];
    const prazoUniOk = dataLimiteUni && new Date() <= new Date(dataLimiteUni + "T23:59:59");
    if (prox) slides.push({ tipo: "min", data: prox });
    if (!pago && dataLimitePagamento && role !== "pastor_auxiliar") slides.push({ tipo: "pagamento" });
    if (meuPedido?.status === "aberto" && prazoUniOk) slides.push({ tipo: "uniforme" });
    if (!meuPedido && prazoUniOk) slides.push({ tipo: "uniforme_sem_pedido" });
    if (meuPedido && !meuPedido.naoQuerUniforme && !meuUniPagoSinal && !meuUniPagoIntegral && prazoUniOk) slides.push({ tipo: "uniforme_pagamento" });
    if (meuPedido && !meuPedido.naoQuerUniforme && meuUniPagoSinal && !meuUniPagoIntegral && dataLimiteUni) slides.push({ tipo: "uniforme_sinal_pago" });
    if (hoje2 >= dataInicioJejum && hoje2 <= dataEvento) slides.push({ tipo: "jejum" });
    if (minhasCartasTotal > 0) slides.push({ tipo: "cartas" });

    useEffect(() => {
      if (slides.length <= 1) return;
      const interval = setInterval(() => setSlide((s) => (s + 1) % slides.length), 10000);
      return () => clearInterval(interval);
    }, [slides.length]);

    const slideAtual = slides[slide];

    // Busca colegas que têm a mesma função no mesmo dia
    const getColegasDia = (dia, fn) => {
      return (users || []).filter(u =>
        u.id !== user.id &&
        u.ativo !== false &&
        (u.escala?.[dia] || []).includes(fn)
      );
    };

    const temEscala = DIAS.some(d => (escala[d] || []).length > 0);

    return (
      <div>
        <div style={{ padding: "16px 16px 0", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: G.t }}>
              Shalom, {user.nome.split(" ")[0]}<span style={{ color: G.green }}>.</span>
            </div>
          </div>

          {/* quick cards */}
          {(() => {
            const temQuartos = (user?.telasExtra || []).includes("quartos") || role === "lider_quartos";
            const temOnibus = (user?.telasExtra || []).includes("onibus");
            // Com dados reais para quartos e onibus
            const quartosTot = (qh?.length || 0) + (qm?.length || 0);
            const onibusTot = on?.reduce((a, o) => a + (o.poltronas || 40), 0) || 0;
            const CARD_ICONS = { savs: Megaphone, scartas: FileText, sinfo: AlertTriangle, squartos: BedDouble, sonibus: Bus };
            const cardsComValor = [
              [avsNaoVistos > 0 ? avsNaoVistos : null, "Avisos", "savs"],
              [minhasCartasTotal > 0 ? minhasCartasTotal : null, "Cartas", "scartas"],
              [(ocorr || []).filter(o => !o.res).length, "Ocorrências", "sinfo"],
              ...(temQuartos ? [[quartosTot, "Quartos", "squartos"]] : []),
              ...(temOnibus ? [[onibusTot, "Ônibus", "sonibus"]] : []),
            ];
            const SEM_BADGE = ["squartos"];
            const cols = cardsComValor.length > 3 ? "1fr 1fr" : "1fr 1fr 1fr";
            return (
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginBottom: 16 }}>
                {cardsComValor.map(([n, l, p]) => {
                  const Icon = CARD_ICONS[p];
                  return (
                    <div key={p} onClick={() => {
                      setPg(p);
                      if (p === "savs") {
                        const todos = avs.map(a => a.id);
                        setAvsVistos(todos);
                        localStorage.setItem(`avs_vistos_${user.id}`, JSON.stringify(todos));
                      }
                    }} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 14, padding: "16px 14px", cursor: "pointer", position: "relative" }}>
                      {n !== null && n > 0 && !SEM_BADGE.includes(p) && (
                        <div style={{ position: "absolute", top: 8, right: 8, background: "#ff3b30", borderRadius: 50, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", padding: "0 4px" }}>{n}</div>
                      )}
                      <Icon size={22} color={G.tm} style={{ marginBottom: 8 }} />
                      <div style={{ color: G.t, fontWeight: 800, fontSize: n !== null ? 22 : 13, letterSpacing: n !== null ? -0.5 : 0 }}>{n !== null ? n : ""}</div>
                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: n !== null ? 2 : 0 }}>{l}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <Seg opts={[["mins", "Agenda"], ["atr", "Escalas"], ["minfo", "Ministrações"]]} val={tab} set={setTab} />

          <div style={{ marginTop: 12 }}>
            {tab === "mins" && (
              <div>
                {slides.length > 0 && (
                    <div
                      style={{ marginBottom: 14 }}
                      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                      onTouchEnd={e => {
                        const dx = e.changedTouches[0].clientX - touchStartX.current;
                        if (Math.abs(dx) > 50) {
                          if (dx < 0) setSlide(s => (s + 1) % slides.length);
                          else setSlide(s => (s - 1 + slides.length) % slides.length);
                        }
                      }}
                    >
                    {slides.length > 1 && (
                      <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 8 }}>
                        {slides.map((_, i) => (
                          <div key={i} onClick={() => setSlide(i)} style={{ width: i === slide ? 16 : 6, height: 6, borderRadius: 3, background: i === slide ? G.green : "#333", transition: "transform var(--d-base) var(--e-out), width var(--d-base) var(--e-out), background var(--d-base) var(--e-out)", cursor: "pointer" }} />
                        ))}
                      </div>
                    )}
                    {slideAtual?.tipo === "min" && (
                      <div style={{ background: "rgba(10,132,255,.1)", border: "1px solid rgba(10,132,255,.2)", borderRadius: 14, padding: "13px 14px" }}>
                        <div style={{ color: "#64b5f6", fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Próxima</div>
                        <div style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>{prox.nome}</div>
                        <div style={{ color: G.tm, fontSize: 12, marginTop: 2 }}>{prox.dia} · {prox.hora}</div>
                      </div>
                    )}
                    {slideAtual?.tipo === "pagamento" && (() => {
                    const depois = new Date() > new Date("2026-06-01T03:00:00");
                    const pixValor    = role === "cozinha" ? (depois ? 100  : 80)  : (depois ? 220  : 200);
                    const creditoValor = role === "cozinha" ? (depois ? 105  : 84)  : (depois ? 231  : 210);
                    const pixLabel    = `R$ ${pixValor.toFixed(2).replace(".", ",")}`;
                    const creditoLabel = `R$ ${creditoValor.toFixed(2).replace(".", ",")}`;

                    return (
                      <div style={{ background: "rgba(255,59,48,.08)", border: "1px solid rgba(255,59,48,.25)", borderRadius: 14, padding: "13px 14px" }}>
                        <div style={{ color: "#ff6b6b", fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>⚠️ Pagamento Pendente</div>
                        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, lineHeight: 1.5 }}>Valor: <strong style={{ color: "#fff" }}>{pixLabel}</strong></div>
                        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 4, lineHeight: 1.5, marginBottom: 10 }}>Prazo: <strong style={{ color: "#ff6b6b" }}>{new Date(dataLimitePagamento + "T12:00:00").toLocaleDateString("pt-BR")}</strong></div>
                        <button onClick={async () => {
                          vibrar(50);
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'servo_pix', valor: pixValor })
                            });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 8 }), background: "#009ee3" }}>
                          PIX ou Boleto — {pixLabel}
                        </button>
                        <button onClick={async () => {
                          vibrar(50);
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'servo_credito', valor: creditoValor })
                            });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 13 }), background: "#009ee3" }}>
                          Cartão de Crédito — {creditoLabel}
                        </button>
                      </div>
                    );
                  })()}
                    {slideAtual?.tipo === "uniforme_pagamento" && (
                      <div
                        onClick={() => setPg("suni")}
                        className="press-sc"
                        style={{
                          background: "rgba(255,59,48,.08)",
                          border: "1px solid rgba(255,59,48,.25)",
                          borderRadius: 14,
                          padding: "13px 14px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ color: "#ff6b6b", fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                          👕 Pagamento de Uniforme
                        </div>
                        <div style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>
                          Você ainda não pagou seu uniforme
                        </div>
                        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                          Prazo: <strong style={{ color: "#ff6b6b" }}>
                            {new Date(dataLimiteUni + "T12:00:00").toLocaleDateString("pt-BR")}
                          </strong> · Toque para pagar
                        </div>
                      </div>
                    )}
                    {slideAtual?.tipo === "uniforme_sem_pedido" && (
                      <div onClick={() => setPg("suni")} className="press-sc" style={{ background: "rgba(255,159,10,.08)", border: "1px solid rgba(255,159,10,.25)", borderRadius: 14, padding: "13px 14px", cursor: "pointer" }}>
                        <div style={{ color: "#ff9f0a", fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>👕 Pedido de Uniforme</div>
                        <div style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>Você ainda não fez seu pedido de uniforme</div>
                        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                          Prazo: <strong style={{ color: "#ff9f0a" }}>{new Date(dataLimiteUni + "T12:00:00").toLocaleDateString("pt-BR")}</strong> · Toque para pedir
                        </div>
                      </div>
                    )}
                    {slideAtual?.tipo === "uniforme_sinal_pago" && (
                      <div
                        onClick={() => setPg("suni")}
                        className="press-sc"
                        style={{
                          background: "rgba(255,159,10,.08)",
                          border: "1px solid rgba(255,159,10,.25)",
                          borderRadius: 14,
                          padding: "13px 14px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ color: "#ff9f0a", fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                          👕 Uniforme — Sinal Pago ✓
                        </div>
                        <div style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>
                          Falta pagar o restante (50%)
                        </div>
                        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                          Sinal confirmado · Toque para pagar o restante
                        </div>
                      </div>
                    )}
                    {slideAtual?.tipo === "jejum" && (
                      <div style={{
                        background: "rgba(0,200,81,.08)",
                        border: "1px solid rgba(0,200,81,.25)",
                        borderRadius: 14,
                        padding: "13px 14px",
                      }}>
                        <div style={{ color: G.green, fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                          🙏 Jejum
                        </div>
                        <div style={{ color: G.t, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                          Lembre-se do seu jejum!
                        </div>
                        <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12, lineHeight: 1.6 }}>
                          • Retire ao menos <strong style={{ color: "#fff" }}>1 refeição</strong> por dia<br/>
                          • Mínimo de <strong style={{ color: "#fff" }}>6h de jejum</strong>
                        </div>
                      </div>
                    )}
                    {slideAtual?.tipo === "cartas" && (
                      <div
                        onClick={() => setPg("scartas")}
                        style={{
                          background: "rgba(0,200,81,.08)",
                          border: "1px solid rgba(0,200,81,.25)",
                          borderRadius: 14,
                          padding: "13px 14px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ color: G.green, fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                          ✉️ Cartas
                        </div>
                        <div style={{ color: G.t, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                          {minhasCartasTotal === 1 ? "Você tem 1 carta para retirar" : `Você tem ${minhasCartasTotal} cartas para retirar`}
                        </div>
                        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, lineHeight: 1.5 }}>
                          {respCartas.trim() ? `Procure ${respCartas} para retirar.` : "Procure o líder de Cartas para retirar."} · Toque para ver
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {mins.map((m) => (
                  <div key={m.id} className="fu" style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${dC[m.dia]}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>{m.nome}</div>
                    <div style={{ color: G.tm, fontSize: 12, marginTop: 3 }}>{m.dia} · {m.hora}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === "atr" && (
              <div>
                {!temEscala ? (
                  <div style={{ color: G.tm, textAlign: "center", padding: 28, fontSize: 13 }}>
                    Sem atribuições. Aguarde.
                  </div>
                ) : (
                  DIAS.map(dia => {
                    const fns = escala[dia] || [];
                    if (fns.length === 0) return null;
                    const aberto = diasAbertos[dia] !== false;

                    return (
                      <div key={dia} style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${dC[dia]}`, borderRadius: 14, marginBottom: 8 }}>
                        <div
                          onClick={() => toggleDia(dia)}
                          style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: dC[dia] }} />
                            <span style={{ color: G.td, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{dia}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Pill c={`${fns.length} funç${fns.length > 1 ? 'ões' : 'ão'}`} bg={`${dC[dia]}18`} tc={dC[dia]} />
                            <span style={{ color: G.tm, fontSize: 12, transition: "transform var(--d-fast) var(--e-out)", display: "inline-block", transform: aberto ? "rotate(180deg)" : "none" }}>▾</span>
                          </div>
                        </div>

                        {aberto && (
                          <div style={{ borderTop: "1px solid #1e1e1e", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {fns.map((fn, i) => {
                              const fnBase = fn.replace(/ - (Almoço|Jantar)$/, "");
                              const perfisLider = user.perfil === "lider_staff"
                                ? ["lider_staff"]
                                : (liderMapOverrides[fnBase] || LIDER_MAP_DEFAULT[fnBase] || ["lider_staff"]);

                              const lideres = (users || []).filter(u => perfisLider.includes(u.perfil));

                              const colegas = (users || []).filter(u =>
                                u.ativo !== false &&
                                (u.escala?.[dia] || []).includes(fn) &&
                                (fnBase !== "Servo de Quarto" || u.sexo === user.sexo)
                              );

                              const meuQuarto = fnBase === "Servo de Quarto"
                                ? [...(qh || []), ...(qm || [])].find((q) => (q.servos || []).includes(user.nome))
                                : null;

                              return (
                                <div key={i} style={{ background: "#111", borderRadius: 12, padding: "10px 12px" }}>
                                  <div style={{ color: G.t, fontWeight: 700, fontSize: 14, marginBottom: lideres.length > 0 || colegas.length > 0 ? 8 : 0 }}>
                                    {fn}
                                    {meuQuarto && (
                                      <span style={{ color: dC[dia] }}> (Quarto {meuQuarto.num})</span>
                                    )}
                                  </div>

                                  {lideres.length > 0 && (
                                    <>
                                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Líder</div>
                                      {lideres.map((l, j) => (
                                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: j === lideres.length - 1 && colegas.length > 0 ? 8 : 3 }}>
                                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: G.td }} />
                                          <span style={{ color: G.td, fontSize: 13, fontWeight: l.id === user.id ? 700 : 400 }}>
                                            {l.nome}{l.id === user.id ? " (você)" : ""}
                                          </span>
                                        </div>
                                      ))}
                                    </>
                                  )}

                                  {colegas.length > 0 && (
                                    <>
                                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Equipe</div>
                                      {colegas.map((c, j) => (
                                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: G.td }} />
                                          <span style={{ color: G.td, fontSize: 13, fontWeight: c.id === user.id ? 700 : 400 }}>
                                            {c.nome}{c.id === user.id ? " (você)" : ""}
                                          </span>
                                        </div>
                                      ))}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <CozinhaServoV userId={user.id} nome={user.nome} />
              </div>
            )}
            {tab === "minfo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {[
                  {
                    titulo: "Pré-Encontro", dia: "Quinta · 20:00",
                    resumo: "Momento de organização dos itens que vão para o sítio do encontro. Algumas escalas serão definidas pelo líder geral.",
                    ato: null,
                  },
                  {
                    titulo: "Envio", dia: "Quinta · 23:30",
                    resumo: "Oração com todos os servos antes da partida. É muito importante que nenhum servo falte",
                    ato: null,
                  },
                  {
                    titulo: "Encontro com o Mundo, Encontro com Deus", dia: "Sexta · 23:00",
                    resumo: "Em breve...",
                    ato: "Apelo para que os encontristas aceitem a Jesus. Os servos fazem a oração de confissão junto aos encontristas: \"Senhor Jesus, eu reconheço que sou um pecador e preciso do Teu perdão. Eu creio que Tu morreste na cruz por mim e ressuscitaste para me dar a vida eterna. Hoje, eu Te aceito como meu único e suficiente Senhor e Salvador da minha vida. Entra no meu coração, guia os meus passos e transforma-me na pessoa que desejas que eu seja. Entrego a minha vida a Ti. Em nome de Jesus. Amém.\"",
                  },
                  {
                    titulo: "Ministração Peniel", dia: "Sábado · 08:30",
                    resumo: "Em breve...",
                    ato: "Os encontristas vão ao microfone e dizem o nome do pecado que rotulava a sua identidade quando chegaram. Os servos, ao abraçar e orar, anulam esses rótulos do pecado e declaram um novo nome: Israel, príncipe ou princesa de Deus. Quando eles saírem para fora, para receber a lembrancinha, os servos formam um corredor para comemorar o retorno deles ao templo com a identidade nova após o ato, celebrando a mudança deles.",
                  },
                  {
                    titulo: "Ministração Cura", dia: "Sábado · 10:30",
                    resumo: "Em breve...",
                    ato: "Semelhante ao ato da Ministração Peniel. O encontrista vai ao microfone para liberar perdão por algo que fez e pedir perdão também. Ao finalizar, os servos abraçam e oram declarando que as correntes que o aprisionavam nessa mágoa foram quebradas e que ele está livre.",
                  },
                  {
                    titulo: "Ministração Escamas", dia: "Sábado · 15:30",
                    resumo: "Em breve...",
                    ato: "Uma venda é colocada nos olhos dos encontristas simbolizando escamas que deixam a pessoa cega no mundo espiritual. Após o pastor iniciar a ministração, os servos retiram as vendas e oram pelos encontristas como ato profético de que as escamas foram retiradas e que agora eles enxergam com os olhos espirituais.",
                  },
                  {
                    titulo: "Ministração Libertação", dia: "Sábado · 17:00",
                    resumo: "Em breve...",
                    ato: "⚠️ Pontos de atenção:\n1. Servos oram pelos encontristas e staffs dão apoio atrás para evitar quedas.\n2. Oração de libertação é feita com a mão na cabeça do encontrista.\n3. Demônios são expulsos em nome de Jesus — se manifestar, dê uma ordem a todas as entidades e expulse em nome de Jesus.\n4. Não pergunte o nome frequentemente — só após a oração para confirmar que não há mais entidades.\n5. Não abrace o encontrista nesse momento — pode ser perigoso.\n6. Não é permitido ir ao banheiro — se necessário, procure os pastores.\n\nApós todas as renúncias, nos revestimos de toda armadura do Céu e celebramos juntos a libertação.",
                  },
                  {
                    titulo: "Ministração Amor de Deus", dia: "Sábado · 21:30",
                    resumo: "Em breve...",
                    ato: "1. Ao finalizar a ministração, todos os servos oram por todos os encontristas declarando o amor de Deus sobre suas vidas.\n2. Todos vão para a fogueira para ver os pecados serem queimados na cruz.",
                  },
                  {
                    titulo: "Ministração Sonhos", dia: "Domingo · 08:30",
                    resumo: "Em breve...",
                    ato: "Todos fazem uma caixa imaginária do tamanho dos seus sonhos. De forma profética os sonhos são colocados dentro dessa caixa e enviados ao céu lançando a caixa para cima. Em seguida é distribuída uma uva para cada pessoa — colocamos profeticamente os sonhos de Deus dentro da uva e a ingerimos para que os sonhos de Deus sejam gerados em nós.",
                  },
                  {
                    titulo: "Unção de Multiplicação", dia: "Domingo · 09:30",
                    resumo: "Em breve...",
                    ato: "É feita uma oração sobre todos os encontristas declarando unção de multiplicação sobre eles, para que possam multiplicar em todas as áreas da vida.",
                  },
                  {
                    titulo: "Batismo com Espírito Santo", dia: "Domingo · 10:30",
                    resumo: "Em breve...",
                    ato: "Oram com imposição de mãos, declarando o batismo com o Espírito Santo, batismo com fogo e ativação de dons. Se a pessoa aparentemente demonstrar não estar recebendo o batismo, conduzir ela a fazer uma oração de confissão, semelhante a: \"Espírito Santo, eu o reconheço como pessoa e confesso precisar de ti, te convido a habitar em mim e ativar todos os dons necessários para que eu cumpra o propósito de Deus na minha história\".",
                  },
                  {
                    titulo: "Oração Estilo de Vida", dia: "Domingo · 15:00",
                    resumo: "Em breve...",
                    ato: "São entregues os presentes e cartas enviadas pela família do encontrista. Um dos atos mais importantes do encontro — muita atenção ao colocar a sacola à frente do encontrista.",
                  },
                ].map((m, i) => <MinCard key={i} m={m} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  // ── HOME ─────────────────────────────────────────────────────────────────────
function HomeV({ role, user, ck, mins, ocorr, avs, qh, qm, on, nav, edit, encH, encM, addAv, delAv, users, canAvisos, enviandoAviso }) {
  const [tab, setTab] = useState("dash");
  const [av, setAv] = useState("");
  const [publicoAviso, setPublicoAviso] = useState("todos");
  const [filtroDias, setFiltroDias] = useState(7);

  const ch = ck.filter((c) => c.ok).length, tot = ck.length;
  const oc = ocorr.filter((o) => !o.res).length;
  const tEnc = [...qh, ...qm].length;
  const tPass = on.reduce((a, o) => {
    const passCheckin = [...(encH || []), ...(encM || [])].filter(e => e.onibus === String(o.num) || e.onibus === o.num).length;
    return a + passCheckin + (o.passManual?.length || 0) + (o.servos?.length || 0);
  }, 0);

  const META_ENC = 140;
  const todosEnc = [...encH, ...encM];
  const VALOR_ENC = 360;
  const VALOR_ENC_ITAJAI = 200;
  const getValorEnc = (e) => {
    if (e.acordo && e.valorAcordado != null && !isNaN(e.valorAcordado)) return Number(e.valorAcordado);
    return (e.igreja === 'Fonte Itajaí' || e.celula === 'Peniel - Santa Catarina') ? VALOR_ENC_ITAJAI : VALOR_ENC;
  };
  const encPagosLista = todosEnc.filter(e => e.pago);
  const encPendentesLista = todosEnc.filter(e => !e.pago && !e.desistiu);
  const encPagarDepoisLista = todosEnc.filter(e => !e.pago && !e.desistiu && e.pagarDepois);
  const encDesistenciaLista = todosEnc.filter(e => !e.pago && e.desistiu);
  const encPagos = encPagosLista.length;
  const encPagarDepois = encPagarDepoisLista.length;
  const encDesistencia = encDesistenciaLista.length;
  const encPendentes = encPendentesLista.length - encPagarDepois;
  const pctEncPagos = todosEnc.length ? Math.round((encPagos / META_ENC) * 100) : 0;
  const encArrecadado = encPagosLista.reduce((acc, e) => acc + getValorEnc(e), 0);
  const encAReceber = encPendentesLista.reduce((acc, e) => acc + getValorEnc(e), 0);

  // Inscritos por célula  ← depois usa todosEnc
  const celulasPorQtd = {};
  todosEnc.forEach(e => {
    let celula = e.celula || "Sem célula";
    if (celula === "Não faço parte de célula" || celula === "Não tenho célula") {
      celula = "Sem célula";
    }
   celulasPorQtd[celula] = (celulasPorQtd[celula] || 0) + 1;
  });
  const celulasOrdenadas = Object.entries(celulasPorQtd).sort((a, b) => b[1] - a[1]);
  const maxCelula = Math.max(...celulasOrdenadas.map(([, v]) => v), 1);

  const PERFIS_ABONADOS_DASH = ['pastor', 'pastor_auxiliar', 'lider_geral'];
  const isAbonadoPorPerfilDash = (u) => PERFIS_ABONADOS_DASH.includes(u.perfil);
  const servos = (users || []).filter(u =>
    u.nome &&
    u.ativo !== false &&
    u.perfil !== 'admin'
  );

  // Data de corte para valor do servo (meia-noite Brasília = 03:00 UTC)
  const depoisCorte = new Date() > new Date("2026-06-01T03:00:00");
  const valorServoPix      = depoisCorte ? 220 : 200;
  const valorServoCreditoM = depoisCorte ? 231 : 210; // médio: média pix+credito p/ projeção
  const valorCozinhaPix    = depoisCorte ? 100 : 80;

  const CORTE = new Date("2026-06-01T03:00:00");
  const getValorServo = (u) => {
    // Usa pagoEm se disponível, senão assume que pagou depois do corte
    const pagoEm = u.pagoEm ? new Date(u.pagoEm) : null;
    const antesDoCorte = pagoEm ? pagoEm < CORTE : false;
    if (u.perfil === 'cozinha') return antesDoCorte ? 80 : 100;
    // servo, staff, líderes (exceto geral/pastor) → mesmo valor
    return antesDoCorte ? 200 : 220;
  };

  const servosPagos     = servos.filter(u => !isAbonadoPorPerfilDash(u) && u.pago === true);
  const servosAbonados  = servos.filter(u => isAbonadoPorPerfilDash(u) || u.pago === 'abonado');
  const servosPagarDepois = servos.filter(u => !isAbonadoPorPerfilDash(u) && u.pago === 'pagar_depois');
  const servosPendentes = servos.filter(u => !isAbonadoPorPerfilDash(u) && !u.pago && u.pago !== 'pagar_depois');

  const totalArrecadado = servosPagos.reduce((acc, u) => acc + getValorServo(u), 0);
  const totalAReceber   = servosPendentes.reduce((acc, u) => acc + getValorServo(u), 0);

  const pctServos = servos.length ? Math.round((servosPagos.length / servos.length) * 100) : 0;

  // Cadastros por dia
  const hoje = new Date();
  const diasAtras = new Date(hoje);
  diasAtras.setDate(hoje.getDate() - filtroDias);

  const cadastrosPorDia = {};
  todosEnc.forEach(e => {
    if (!e.criadoEm) return;
    try {
      const [d, t] = e.criadoEm.split(', ');
      const [dia, mes, ano] = d.split('/');
      const data = new Date(`${ano}-${mes}-${dia}`);
      if (data >= diasAtras) {
        const key = `${dia}/${mes}`;
        cadastrosPorDia[key] = (cadastrosPorDia[key] || 0) + 1;
      }
    } catch {}
  });

  const diasOrdenados = Object.entries(cadastrosPorDia).sort((a, b) => {
    const [dA, mA] = a[0].split('/');
    const [dB, mB] = b[0].split('/');
    return new Date(`2026-${mA}-${dA}`) - new Date(`2026-${mB}-${dB}`);
  });

  const maxCad = Math.max(...diasOrdenados.map(([, v]) => v), 1);

  const dC = { Quinta: "#ff6b35", Sexta: "#bf5af2", Sábado: G.green, Domingo: "#ff9f0a" };

  const BarPct = ({ val, max, color }) => (
    <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6, flex: 1 }}>
      <div style={{ background: color, borderRadius: 4, height: 6, width: `${Math.min(100, (val / max) * 100)}%`, transition: 'width var(--d-slow) var(--e-out)' }} />
    </div>
  );

  return (
    <div>
      {/* Saudação */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: G.t }}>
          Shalom, {user.nome.split(" ")[0]}<span style={{ color: G.green }}>.</span>
        </div>
      </div>
      {/* Cards operacionais */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          [`${ch}/${tot}`, "Check-in", "checkin"],
          [`${tPass}/${on.reduce((a, o) => a + (o.poltronas || 40), 0)}`, "Ônibus", "onibus"],
          [tEnc, "Quartos", "quartos"],
          [oc, "Ocorrências", "info"],
        ].map(([n, l, p]) => (
          <div key={l} onClick={() => nav(p)} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 14, padding: "20px 16px", cursor: "pointer" }}>
            <div style={{ color: G.t, fontWeight: 800, fontSize: String(n).length > 5 ? 18 : 28, letterSpacing: -1 }}>{n}</div>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      <Seg opts={[["dash", "Dashboard"], ["mins", "Agenda"], ["avs", "Avisos"]]} val={tab} set={setTab} />

      <div style={{ marginTop: 12 }}>
        {tab === "dash" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Encontristas */}
            <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 16 }}>Encontristas</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: G.tm, fontSize: 11 }}>{todosEnc.length}/{META_ENC}</span>
                  <Pill c={`${pctEncPagos}%`} bg="rgba(0,200,81,.12)" tc={G.green} />
                </div>
              </div>

              {/* Barra meta */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: G.tm, fontSize: 11 }}>Meta: {META_ENC}</span>
                  <span style={{ color: G.tm, fontSize: 11 }}>{Math.round((todosEnc.length / META_ENC) * 100)}% preenchido</span>
                </div>
                <div style={{ background: '#1a1a1a', borderRadius: 6, height: 8 }}>
                  <div style={{ background: '#0a84ff', borderRadius: 6, height: 8, width: `${Math.min(100, (todosEnc.length / META_ENC) * 100)}%`, transition: 'width var(--d-slow) var(--e-out)' }} />
                </div>
              </div>

              {/* Pagos vs Pendentes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: G.green, fontSize: 12, fontWeight: 700, minWidth: 60 }}>Pago</span>
                  <BarPct val={encPagos} max={META_ENC} color={G.green} />
                  <span key={String(encPagos)} className="tick" style={{ color: G.t, fontWeight: 800, fontSize: 16, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{encPagos}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#ff3b30', fontSize: 12, fontWeight: 700, minWidth: 60 }}>Pend.</span>
                  <BarPct val={encPendentes} max={META_ENC} color="#ff3b30" />
                  <span key={String(encPendentes)} className="tick" style={{ color: G.t, fontWeight: 800, fontSize: 16, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{encPendentes}</span>
                </div>
                {encPagarDepois > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#ff9f0a', fontSize: 12, fontWeight: 700, minWidth: 60 }}>Pagar dep.</span>
                    <BarPct val={encPagarDepois} max={META_ENC} color="#ff9f0a" />
                    <span key={String(encPagarDepois)} className="tick" style={{ color: G.t, fontWeight: 800, fontSize: 16, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{encPagarDepois}</span>
                  </div>
                )}
                {encDesistencia > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#636366', fontSize: 12, fontWeight: 700, minWidth: 60 }}>Desistência</span>
                    <BarPct val={encDesistencia} max={META_ENC} color="#636366" />
                    <span key={String(encDesistencia)} className="tick" style={{ color: G.t, fontWeight: 800, fontSize: 16, minWidth: 28, textAlign: 'right', display: 'inline-block' }}>{encDesistencia}</span>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div style={{ height: 1, background: G.cb, marginBottom: 14 }} />

              {/* Projeção financeira encontristas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Financeiro</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: G.green }} />
                    <span style={{ color: G.tm, fontSize: 13 }}>Arrecadado</span>
                  </div>
                  <span style={{ color: G.green, fontWeight: 800, fontSize: 15 }}>
                    R$ {encArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9f0a' }} />
                    <span style={{ color: G.tm, fontSize: 13 }}>A receber</span>
                  </div>
                  <span style={{ color: '#ff9f0a', fontWeight: 800, fontSize: 15 }}>
                    R$ {encAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ height: 1, background: G.cb, margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: G.tm, fontSize: 13, fontWeight: 700 }}>Projeção de hoje</span>
                  <span style={{ color: G.t, fontWeight: 800, fontSize: 16 }}>
                    R$ {(encArrecadado + encAReceber).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ color: G.tm, fontSize: 10, marginTop: -2 }}>* {todosEnc.length} cadastrados (arrecadado + a receber)</div>
                {(() => {
                  const qtdItajai = todosEnc.filter(e => e.igreja === 'Fonte Itajaí' || e.celula === 'Peniel - Santa Catarina').length;
                  const qtdPadrao = Math.max(META_ENC - qtdItajai, 0);
                  const previsaoTotal = qtdPadrao * VALOR_ENC + qtdItajai * VALOR_ENC_ITAJAI;
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ color: G.tm, fontSize: 13, fontWeight: 700 }}>Previsão total (meta)</span>
                        <span style={{ color: '#0a84ff', fontWeight: 800, fontSize: 16 }}>
                          R$ {previsaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div style={{ color: G.tm, fontSize: 10, marginTop: 2 }}>
                        * {qtdPadrao} × R$ {VALOR_ENC} + {qtdItajai} (Itajaí) × R$ {VALOR_ENC_ITAJAI}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Servos */}
            {(role === 'admin' || role === 'pastor' || role === 'pastor_auxiliar' || role === 'lider_geral') && (
            <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 16 }}>Servos</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: G.tm, fontSize: 11 }}>{servos.length} total</span>
                  <Pill c={`${pctServos}%`} bg="rgba(10,132,255,.12)" tc="#0a84ff" />
                </div>
              </div>

              {/* Barras pagos/pendentes/abonados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: G.green, fontSize: 12, fontWeight: 700, minWidth: 64 }}>Pagos</span>
                  <BarPct val={servosPagos.length} max={servos.length || 1} color={G.green} />
                  <span style={{ color: G.t, fontWeight: 800, fontSize: 14, minWidth: 28, textAlign: 'right' }}>{servosPagos.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#ff3b30', fontSize: 12, fontWeight: 700, minWidth: 64 }}>Pend.</span>
                  <BarPct val={servosPendentes.length} max={servos.length || 1} color="#ff3b30" />
                  <span style={{ color: G.t, fontWeight: 800, fontSize: 14, minWidth: 28, textAlign: 'right' }}>{servosPendentes.length}</span>
                </div>
                {servosAbonados.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#636366', fontSize: 12, fontWeight: 700, minWidth: 64 }}>Abonado</span>
                    <BarPct val={servosAbonados.length} max={servos.length || 1} color="#636366" />
                    <span style={{ color: G.t, fontWeight: 800, fontSize: 14, minWidth: 28, textAlign: 'right' }}>{servosAbonados.length}</span>
                  </div>
                )}
                {servosPagarDepois.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#0a84ff', fontSize: 12, fontWeight: 700, minWidth: 64 }}>Pagar dep.</span>
                    <BarPct val={servosPagarDepois.length} max={servos.length || 1} color="#0a84ff" />
                    <span style={{ color: G.t, fontWeight: 800, fontSize: 14, minWidth: 28, textAlign: 'right' }}>{servosPagarDepois.length}</span>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div style={{ height: 1, background: G.cb, marginBottom: 14 }} />

              {/* Projeção financeira */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Financeiro</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: G.green }} />
                    <span style={{ color: G.tm, fontSize: 13 }}>Arrecadado</span>
                  </div>
                  <span style={{ color: G.green, fontWeight: 800, fontSize: 15 }}>
                    R$ {totalArrecadado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9f0a' }} />
                    <span style={{ color: G.tm, fontSize: 13 }}>A receber</span>
                  </div>
                  <span style={{ color: '#ff9f0a', fontWeight: 800, fontSize: 15 }}>
                    R$ {totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ height: 1, background: G.cb, margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: G.tm, fontSize: 13, fontWeight: 700 }}>Projeção total</span>
                  <span style={{ color: G.t, fontWeight: 800, fontSize: 16 }}>
                    R$ {(totalArrecadado + totalAReceber).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {servosPagarDepois.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0a84ff' }} />
                      <span style={{ color: G.tm, fontSize: 13 }}>Pagar depois ({servosPagarDepois.length})</span>
                    </div>
                    <span style={{ color: '#0a84ff', fontWeight: 800, fontSize: 15 }}>
                      R$ {servosPagarDepois.reduce((acc, u) => acc + getValorServo(u), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div style={{ color: G.tm, fontSize: 10, marginTop: 2 }}>
                  * R${valorServoPix}/servo·staff·líder e R${valorCozinhaPix}/cozinha (PIX). Abonados não contabilizados.
                </div>
              </div>
            </div>
            )}

            {/* Cadastros por dia */}
            <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 16 }}>Cadastros por dia</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[7, 14, 30].map(d => (
                    <button key={d} onClick={() => setFiltroDias(d)} style={{ background: filtroDias === d ? G.green : '#1a1a1a', color: filtroDias === d ? '#000' : G.tm, border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {diasOrdenados.length === 0 ? (
                <div className="empty" style={{ color: G.tm, fontSize: 13, textAlign: 'center', padding: 16 }}>Nenhum cadastro nesse período.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {diasOrdenados.map(([dia, qtd]) => (
                    <div key={dia} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: G.tm, fontSize: 12, minWidth: 36 }}>{dia}</span>
                      <BarPct val={qtd} max={maxCad} color="#0a84ff" />
                      <span style={{ color: G.t, fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'right' }}>{qtd}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Inscritos por Célula */}
            <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 16 }}>Por Célula</div>
              </div>
              {celulasOrdenadas.length === 0 ? (
                <div className="empty" style={{ color: G.tm, fontSize: 13, textAlign: 'center', padding: 16 }}>Nenhum inscrito ainda.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {celulasOrdenadas.map(([celula, qtd]) => (
                    <div key={celula} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: G.td, fontSize: 12, minWidth: 120 }}>{celula}</span>
                      <BarPct val={qtd} max={maxCelula} color="#bf5af2" />
                      <span style={{ color: G.t, fontWeight: 700, fontSize: 14, minWidth: 20, textAlign: 'right' }}>{qtd}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "mins" && mins.map((m) => (
          <div key={m.id} className="fu" style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${m.sent ? G.green : dC[m.dia]}`, borderRadius: 13, padding: "12px 14px", marginBottom: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: G.t, fontWeight: 600, fontSize: 13 }}>{m.nome}</div>
              <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>{m.dia} · {m.hora}</div>
            </div>
            {m.sent && <Pill c="✓ Enviado" bg="rgba(0,200,81,.1)" tc={G.green} />}
          </div>
        ))}

        {tab === "avs" && (
          <>
            {canAvisos && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                <select onChange={(e) => { if (e.target.value) setAv(e.target.value); }} style={{ ...I, fontSize: 12 }} defaultValue="">
                  <option value="">Usar template de aviso...</option>
                  {AVISOS_TEMPLATES.map((a, i) => (
                    <option key={i} value={a.txt}>{a.txt.substring(0, 50)}...</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["todos", "Todos"], ["homens", "Homens"], ["mulheres", "Mulheres"]].map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setPublicoAviso(k)}
                      style={{
                        flex: 1,
                        padding: "8px 6px",
                        borderRadius: 9,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: `1px solid ${publicoAviso === k ? "#0a84ff" : "#2a2a2a"}`,
                        background: publicoAviso === k ? "rgba(10,132,255,.12)" : "#1a1a1a",
                        color: publicoAviso === k ? "#0a84ff" : G.td,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={av} onChange={(e) => setAv(e.target.value)} placeholder="Escrever aviso..." style={{ ...I, flex: 1 }} />
                  <button
                    onClick={() => {
                      if (enviandoAviso.current) return;
                      if (!av.trim()) return;
                      enviandoAviso.current = true;
                      vibrar(100);
                      const txt = av.trim();
                      setAv("");
                      addAv(txt, publicoAviso);
                      setTimeout(() => { enviandoAviso.current = false; }, 1500);
                    }}
                    style={BG({ padding: "13px 15px", borderRadius: 12 })}
                  >+</button>
                </div>
              </div>
            )}
            {avs.map((a) => (
              <div key={a.id} className="fu" style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${G.green}`, borderRadius: 13, padding: "12px 14px", marginBottom: 7, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: G.t, fontSize: 13, lineHeight: 1.6 }}>{a.txt}</div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    {a.autor}{a.autorPerfil && PERFIS[a.autorPerfil] ? ` · ${PERFIS[a.autorPerfil].l}` : ""} · {a.hr}
                    {a.publico === "homens" && <Pill c="Homens" bg="rgba(10,132,255,.12)" tc="#0a84ff" />}
                    {a.publico === "mulheres" && <Pill c="Mulheres" bg="rgba(255,45,146,.12)" tc="#ff2d92" />}
                  </div>
                </div>
                {canAvisos && <span onClick={() => delAv(a.id)} style={{ color: "rgba(255,59,48,.5)", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</span>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
  // ── CHECK-IN ─────────────────────────────────────────────────────────────────
  function CkV({ ck, setCk, on, edit, t, sub, setSub, gen, setGen, setPg, setTermoBusca, telaTermo }) {
    const [s, setS] = useState("");
    const [sh, setSh] = useState(false);
    const [shQr, setShQr] = useState(false);
    const [scanMsg, setScanMsg] = useState("");
    const [f, setF] = useState({ nome: "", sob: "", gen: "M" });
    const scannerRef = useRef(null);
    const [highlightId, setHighlightId] = useState(null);
    const highlightRef = useRef(null);
    const onibusSelectRef = useRef(null);

    useEffect(() => {
      if (!shQr) {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(() => {});
          scannerRef.current = null;
        }
        return;
      }
      setScanMsg("");
      setTimeout(async () => {
        try {
          const Html5Qrcode = await carregarHtml5Qrcode();
          const scanner = new Html5Qrcode("qr-reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 220 },
            async (decodedText) => {
              await scanner.stop();
              scannerRef.current = null;
              setShQr(false);
              const enc = ck.find((c) => c.id === decodedText);
              if (!enc) {
                t("QR Code não reconhecido");
                return;
              }
              if (enc.ok) {
                t(`${enc.nome} já fez check-in ✓`);
                return;
              }
              await setDoc(
                doc(db, "encontristas", enc.id),
                { chegou: true },
                { merge: true },
              );
              vibrar(60);
              t(`✅ Check-in: ${enc.nome}`);
              const encGen = enc.gen === "M" ? "M" : "H";
              setGen(encGen);
              setSub("conf");
              setHighlightId(enc.id);
              setTimeout(
                () =>
                  highlightRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  }),
                300,
              );
              // Mensagem de confirmação por WhatsApp (sem link de termo)
              if (enc.whatsapp) {
                const tel = enc.whatsapp.replace(/\D/g, "");
                const msg = encodeURIComponent(
                  `Olá ${enc.nome.split(" ")[0]}! Seu check-in foi confirmado 🎉 Bem-vindo(a) ao Encontro com Deus!`,
                );
                const a = document.createElement("a");
                a.href = `https://wa.me/55${tel}?text=${msg}`;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            },
            () => {},
          );
        } catch (err) {
          console.error("Erro ao iniciar câmera:", err);
          t("Erro ao acessar câmera. Verifique as permissões.", "w");
          setShQr(false);
        }
      }, 300);
      return () => {
        if (scannerRef.current) {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current = null;
        }
      };
    }, [shQr]);

    const lista = useMemo(
      () =>
        ck.filter(
          (c) =>
            c.gen === gen &&
            (sub === "pend" ? !c.ok : c.ok) &&
            c.nome.toLowerCase().includes(s.toLowerCase()),
        ).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")),
      [ck, gen, sub, s],
    );
    const cnt = (g, ok) =>
      ck.filter((c) => c.gen === g && (ok ? c.ok : !c.ok)).length;
    const ns = (n) => {
      const s = String(n);
      return {
        color: G.t,
        fontWeight: 800,
        fontSize: s.length > 5 ? 16 : s.length > 3 ? 20 : 24,
      };
    };
    const add = async () => {
      if (!f.nome.trim()) return;
      const novoEnc = {
        nome: `${f.nome.trim()} ${f.sob.trim()}`.trim(),
        sexo: f.gen === "M" ? "Feminino" : "Masculino",
        chegou: false,
        onibus: null,
        criadoEm: new Date().toLocaleString("pt-BR"),
      };
      await addDoc(collection(db, "encontristas"), novoEnc);
      setF({ nome: "", sob: "", gen: "M" });
      setSh(false);
      t("Encontrista adicionado!");
    };

    return (
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {[
            [ck.length, "Total", "#636366"],
            [ck.filter((c) => c.ok).length, "Chegaram", G.green],
            [ck.filter((c) => !c.ok).length, "Pendentes", "#ff9f0a"],
          ].map(([n, l, c]) => (
            <div
              key={l}
              style={{
                background: "#111",
                borderRadius: 14,
                padding: "12px 8px",
                textAlign: "center",
                borderTop: `2px solid ${c}`,
              }}
            >
              <div style={ns(n)}>{n}</div>
              <div
                style={{
                  color: G.tm,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginTop: 3,
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>

        {/* Botão scanner */}
        <button
          onClick={() => setShQr(true)}
          style={BG({
            width: "100%",
            padding: 14,
            marginBottom: 10,
            borderRadius: 14,
            fontSize: 15,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          })}
        >
          Escanear QR Code
        </button>

        {/* Botão exportar - somente confirmados (chegaram), todos os gêneros */}
        <button
          onClick={async () => {
            const confirmados = ck.filter((c) => c.ok);
            if (!confirmados.length) {
              t("Nenhum check-in confirmado ainda.", "w");
              return;
            }
            const ExcelJS = await carregarExcelJS();
              const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet("Check-in");
            ws.columns = [
              { header: "Nome", key: "nome", width: 35 },
              { header: "Sexo", key: "sexo", width: 12 },
              { header: "CPF", key: "cpf", width: 18 },
              { header: "WhatsApp", key: "whatsapp", width: 18 },
              { header: "Ônibus", key: "onibus", width: 10 },
            ];
            ws.getRow(1).font = { bold: true, color: { argb: "FF000000" } };
            ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD0D0D0" } };
            confirmados
              .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
              .forEach((c) => {
                ws.addRow({
                  nome: c.nome || "",
                  sexo: c.gen === "M" ? "Feminino" : "Masculino",
                  cpf: c.cpf || "",
                  whatsapp: c.whatsapp || "",
                  onibus: c.on || "",
                });
              });
            const buf = await wb.xlsx.writeBuffer();
            const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "checkin_confirmados.xlsx"; a.click();
            URL.revokeObjectURL(url);
          }}
          style={BK({
            width: "100%",
            padding: 13,
            marginBottom: 10,
            borderRadius: 14,
            fontSize: 14,
          })}
        >
          Exportar Excel (confirmados)
        </button>

        <Seg
          opts={[
            ["M", "Mulheres"],
            ["H", "Homens"],
          ]}
          val={gen}
          set={setGen}
        />
        <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
          <button
            onClick={() => setSub("pend")}
            style={{
              flex: 1,
              background: sub === "pend" ? "#ff9f0a" : "#111",
              color: sub === "pend" ? "#000" : G.td,
              border: "none",
              borderRadius: 10,
              padding: "9px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Pendentes ({cnt(gen, false)})
          </button>
          <button
            onClick={() => setSub("conf")}
            style={{
              flex: 1,
              background: sub === "conf" ? G.green : "#111",
              color: sub === "conf" ? "#000" : G.td,
              border: "none",
              borderRadius: 10,
              padding: "9px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Confirmados ({cnt(gen, true)})
          </button>
        </div>
        <input
          value={s}
          onChange={(e) => setS(e.target.value)}
          placeholder="🔍 Buscar..."
          style={{ ...I, marginBottom: 10 }}
        />
        {lista.length === 0 && (
          <div
            className="empty"
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhum encontrista aqui.
          </div>
        )}
        {lista.map((c) => (
          <div
            key={c.id}
            className="fu"
            ref={c.id === highlightId ? highlightRef : null}
            style={{
              background: G.card,
              border: `1px solid ${c.id === highlightId ? "#fb923c" : c.ok ? "rgba(0,200,81,.3)" : G.cb}`,
              borderLeft: `3px solid ${c.id === highlightId ? "#fb923c" : c.ok ? G.green : "#2a2a2a"}`,
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 7,
              transition: "border-color var(--d-base) var(--e-out)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <button
                onClick={() => {
                  vibrar(30);
                  const novoOk = !c.ok;
                  setCk(prev => prev.map(x => x.id === c.id ? { ...x, ok: novoOk } : x));
                  setDoc(
                    doc(db, "encontristas", c.id),
                    { chegou: novoOk },
                    { merge: true },
                  );
                  setHighlightId(novoOk ? c.id : null);
                  setSub(novoOk ? "conf" : "pend");
                  if (novoOk) {
                    const tentarAbrir = (tentativas) => {
                      if (tentativas <= 0) return;
                      if (onibusSelectRef.current) {
                        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        onibusSelectRef.current.focus();
                        if (onibusSelectRef.current.showPicker) {
                          try { onibusSelectRef.current.showPicker(); } catch {}
                        }
                      } else {
                        setTimeout(() => tentarAbrir(tentativas - 1), 150);
                      }
                    };
                    setTimeout(() => tentarAbrir(8), 150);
                  }
                }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: `2px solid ${c.ok ? G.green : "#333"}`,
                  background: c.ok ? "rgba(0,200,81,.15)" : "transparent",
                  color: G.green,
                  fontSize: 16,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "border-color var(--d-fast) var(--e-out), background var(--d-fast) var(--e-out)",
                }}
              >
                {/* o ✓ nasce com escala: no dia do encontro esta é a ação mais
                    repetida, e sem isso não há confirmação de que o toque pegou */}
                {c.ok ? <span className="pop" style={{ display: "block", lineHeight: 1 }}>✓</span> : ""}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
                  {c.nome}
                </div>
                {c.on && (
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                    Ônibus {c.on}
                  </div>
                )}
              </div>
              {c.ok && (
                <select
                  ref={c.id === highlightId ? onibusSelectRef : null}
                  value={c.on || ""}
                  onChange={async (e) => {
                    const valor = e.target.value;
                    await setDoc(
                      doc(db, "encontristas", c.id),
                      { onibus: valor || null },
                      { merge: true },
                    );
                    if (valor && setPg && setTermoBusca) {
                      setTermoBusca(c.nome);
                      setPg(telaTermo || "stermo");
                    }
                  }}
                  style={{
                    ...I,
                    width: "auto",
                    padding: "6px 10px",
                    fontSize: 11,
                    borderRadius: 9,
                  }}
                >
                  <option value="">Ônibus?</option>
                  {on
                    .filter((o) => o.tipo !== "Servos" && o.tipo === (c.gen === "M" ? "Feminino" : "Masculino"))
                    .filter((o) => {
                      // Conta quantos já estão nesse ônibus (via check-in confirmado)
                      const ocupados = ck.filter((x) => x.ok && (x.on === String(o.num) || x.on === o.num)).length;
                      const poltronas = o.poltronas;
                      // Sempre mostra o ônibus já selecionado para esse encontrista, mesmo se lotado
                      return ocupados < poltronas || c.on === String(o.num) || c.on === o.num;
                    })
                    .map((o) => (
                      <option key={o.num} value={o.num}>
                        Ônibus {o.num} — {o.tipo}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>
        ))}

        {/* Sheet do scanner */}
        <Sheet
          open={shQr}
          onClose={() => setShQr(false)}
          title="Escanear QR Code"
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: G.tm, fontSize: 13, marginBottom: 16 }}>
              Aponte a câmera para o QR Code do encontrista
            </div>
            <div id="qr-reader" style={{ width: "100%" }} />
            {scanMsg && (
              <div style={{ marginTop: 12, color: G.tm, fontSize: 13 }}>
                {scanMsg}
              </div>
            )}
            <button
              onClick={() => setShQr(false)}
              style={{
                marginTop: 20,
                color: G.tm,
                background: "none",
                border: "none",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Fazer manualmente
            </button>
          </div>
        </Sheet>

        {/* Sheet adicionar encontrista */}
        <Sheet
          open={sh}
          onClose={() => setSh(false)}
          title="Adicionar Encontrista"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              placeholder="Nome *"
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
              style={I}
            />
            <input
              placeholder="Sobrenome"
              value={f.sob}
              onChange={(e) => setF({ ...f, sob: e.target.value })}
              style={I}
            />
            <Seg
              opts={[
                ["M", "♀ Feminino"],
                ["H", "♂ Masculino"],
              ]}
              val={f.gen}
              set={(v) => setF({ ...f, gen: v })}
            />
            <button
              onClick={add}
              style={BG({
                width: "100%",
                padding: 14,
                borderRadius: 14,
                marginTop: 4,
              })}
            >
              Confirmar
            </button>
          </div>
        </Sheet>
      </div>
    );
  }
  // ── MINISTRAÇÕES ─────────────────────────────────────────────────────────────
  function MinsV({ mins, setMins, edit, role, t, sN }) {
    const [sh, setSh] = useState(false);
    const [f, setF] = useState({ dia: "Sexta", nome: "", hora: "" });
    const [highlightId, setHighlightId] = useState(null);
    const highlightRef = useRef(null);

    const dC = {
      Quinta: "#ff6b35",
      Sexta: "#bf5af2",
      Sábado: G.green,
      Domingo: "#ff9f0a",
    };
    return (
      <div>
        {edit && (
          <>
            <button
              onClick={() => setSh(!sh)}
              style={
                sh
                  ? {
                      ...BK({
                        width: "100%",
                        padding: 12,
                        marginBottom: 14,
                        borderRadius: 14,
                      }),
                    }
                  : {
                      ...BG({
                        width: "100%",
                        padding: 12,
                        marginBottom: 14,
                        borderRadius: 14,
                      }),
                    }
              }
            >
              {sh ? "Cancelar" : "+ Nova Ministração / Ato"}
            </button>
            {sh && (
              <div
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <select
                  style={I}
                  value={f.dia}
                  onChange={(e) => setF({ ...f, dia: e.target.value })}
                >
                  {["Quinta", "Sexta", "Sábado", "Domingo"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <input
                  style={I}
                  placeholder="Nome (ex: 2ª Ministração ou Ato — 2ª Min.) *"
                  value={f.nome}
                  onChange={(e) => setF({ ...f, nome: e.target.value })}
                />
                <div>
                  <div
                    style={{
                      color: G.tm,
                      fontSize: 11,
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    Horário
                  </div>
                  <input
                    style={I}
                    type="time"
                    value={f.hora}
                    onChange={(e) => setF({ ...f, hora: e.target.value })}
                  />
                </div>
                <button
                  onClick={() => {
                    if (!f.nome || !f.hora) return;
                    const id = Math.max(...mins.map((m) => m.id), 0) + 1;
                    setMins([...mins, { id, ...f, sent: false }]);
                    setF({ dia: "Sexta", nome: "", hora: "" });
                    setSh(false);
                    t("Adicionado!");
                  }}
                  style={BG({ padding: 12, borderRadius: 12 })}
                >
                  Adicionar
                </button>
              </div>
            )}
          </>
        )}
        {["Quinta", "Sexta", "Sábado", "Domingo"].map((dia) => {
          const list = mins.filter((m) => m.dia === dia);
          if (!list.length) return null;
          return (
            <div key={dia} style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dC[dia],
                  }}
                />
                <span
                  style={{
                    color: G.td,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                  }}
                >
                  {dia}
                </span>
              </div>
              {list.map((m) => (
                <div
                  key={m.id}
                  className="fu"
                  style={{
                    background: G.card,
                    border: `1px solid ${G.cb}`,
                    borderLeft: `3px solid ${m.sent ? G.green : dC[dia]}`,
                    borderRadius: 13,
                    padding: "12px 14px",
                    marginBottom: 7,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{ color: G.t, fontWeight: 600, fontSize: 13 }}
                      >
                        {m.nome}
                      </div>
                      <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                        {m.hora}
                        {m.sent ? " · ✓" : ""}
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      {canN(role) &&
                        (!m.sent ? (
                          <button
                            onClick={async () => {
                              vibrar(50);
                              setMins(
                                mins.map((x) =>
                                  x.id === m.id ? { ...x, sent: true } : x,
                                ),
                              );
                              try {
                                await fetch(
                                  "https://us-central1-servos-peniel.cloudfunctions.net/notificarMinisterio",
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      titulo: `🙏 ${m.nome}`,
                                      horario: m.hora,
                                    }),
                                  },
                                );
                                t("Notificação enviada! 🔔");
                              } catch (err) {
                                console.error("Erro notificarMinisterio:", err);
                                t("Erro ao notificar: " + err.message, "w");
                                sN(m.nome, m.hora);
                              }
                            }}
                            style={{
                              background: "rgba(10,132,255,.15)",
                              border: "1px solid rgba(10,132,255,.3)",
                              color: "#64b5f6",
                              borderRadius: 9,
                              padding: "6px 11px",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <Bell size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setMins(
                                mins.map((x) =>
                                  x.id === m.id ? { ...x, sent: false } : x,
                                ),
                              )
                            }
                            style={BK({
                              padding: "6px 10px",
                              borderRadius: 9,
                              fontSize: 11,
                            })}
                          >
                            <RotateCcw size={14} />
                          </button>
                        ))}
                      {edit && (
                        <span
                          onClick={() =>
                            setMins(mins.filter((x) => x.id !== m.id))
                          }
                          style={{
                            color: "rgba(255,59,48,.4)",
                            cursor: "pointer",
                            fontSize: 13,
                          }}
                        >
                          <Trash2 size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }
  // ── ENCONTRISTAS ─────────────────────────────────────────────────────────────
  function EncV({
    encH,
    setEncH,
    encM,
    setEncM,
    qh,
    qm,
    setQh,
    setQm,
    edit,
    t,
    inscricoesBloqueadas,
    salvarInscricoesBloqueadas,
  }) {
    const [g, setG] = useState("T");
    // status: múltipla seleção — nenhum marcado = todos
    const [filtroStatus, setFiltroStatus] = useState([]);
    const [filtroCelula, setFiltroCelula] = useState("todas");
    // um card aberto por vez
    const [expandido, setExpandido] = useState(null);
    const [busca, setBusca] = useState("");

    const todos = [...encM, ...encH];
    const celulasUnicas = [
      "todas",
      ...Array.from(new Set(todos.map((e) => e.celula).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    ];

    // stats sobre TODOS (não filtrado)
    const stats = { total: todos.length, pago: 0, pendente: 0, pagar_depois: 0, desistiu: 0 };
    todos.forEach((e) => { stats[encStatus(e)] += 1; });

    // Cada contagem ignora o SEU PRÓPRIO filtro: o número mostrado numa opção
    // diz quantas linhas ela traz se for marcada — e não quantas sobram depois.
    const q = busca.trim().toLowerCase();
    const porCelula = (e) => filtroCelula === "todas" || e.celula === filtroCelula;
    const porBusca = (e) => !q || (e.nome || "").toLowerCase().includes(q);
    const casaStatus = (e) => filtroStatus.length === 0 || filtroStatus.includes(encStatus(e));
    const casaSexo = (e) => g === "T" || e.sexo === (g === "M" ? "Feminino" : "Masculino");
    const baseSexo = todos.filter((e) => porCelula(e) && porBusca(e) && casaStatus(e));
    const baseStatus = todos.filter((e) => porCelula(e) && porBusca(e) && casaSexo(e));
    const porSexo = {
      T: baseSexo.length,
      M: baseSexo.filter((e) => e.sexo === "Feminino").length,
      H: baseSexo.filter((e) => e.sexo === "Masculino").length,
    };
    const porStatus = Object.fromEntries(
      Object.keys(ENC_STATUS).map((st) => [st, baseStatus.filter((e) => encStatus(e) === st).length]),
    );
    const lista = baseSexo.filter(casaSexo).sort((a, b) => {
      if (!a.criadoEm && !b.criadoEm) return 0;
      if (!a.criadoEm) return 1;
      if (!b.criadoEm) return -1;
      const toDate = (s) => {
        const [d, hora] = s.split(", ");
        const [dia, mes, ano] = d.split("/");
        return new Date(`${ano}-${mes}-${dia}T${hora}`);
      };
      return toDate(b.criadoEm) - toDate(a.criadoEm);
    });
    const temFiltro = g !== "T" || filtroCelula !== "todas" || filtroStatus.length > 0 || q !== "";
    const alternarStatus = (st) =>
      setFiltroStatus((prev) => (prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st]));

    const dist = () => {
      if (!lista.length) {
        t("Nenhum encontrista", "w");
        return;
      }
      const qs = (g === "H" ? qh : qm).filter((q) => !q.maes);
      const sh = [...lista].sort(() => Math.random() - 0.5);
      const cp = qs.map((q) => ({ ...q, enc: [...q.enc] }));
      sh.forEach((p, i) => {
        const d = cp.filter((q) => q.enc.length + q.servos.length < q.lim);
        if (d.length > 0) d[i % d.length].enc.push(p.nome);
      });
      if (g === "H") setQh(qh.map((q) => cp.find((c) => c.num === q.num) || q));
      else setQm(qm.map((q) => cp.find((c) => c.num === q.num) || q));
      t(`${lista.length} distribuídos!`);
    };

    // rascunhos por card (acordo / pagar depois)
    const [acordoTemp, setAcordoTemp] = useState({});
    const [editandoAcordo, setEditandoAcordo] = useState({});
    const [mostrarAcordo, setMostrarAcordo] = useState({});
    const [pdDataTemp, setPdDataTemp] = useState({});
    const [pdObsTemp, setPdObsTemp] = useState({});
    const [editandoPd, setEditandoPd] = useState({});

    // persiste no Firestore e aplica otimista nas duas listas (o snapshot confirma depois)
    const salvar = async (enc, upd, msg) => {
      try {
        await setDoc(doc(db, "encontristas", enc.id), upd, { merge: true });
        const apply = (arr) => arr.map((x) => (x.id === enc.id ? { ...x, ...upd } : x));
        setEncH((prev) => apply(prev));
        setEncM((prev) => apply(prev));
        if (msg) t(msg);
        return true;
      } catch (err) {
        console.error("Erro ao salvar encontrista:", err);
        t("Erro ao salvar.", "w");
        return false;
      }
    };

    // descarta os rascunhos de "pagar depois" quando a data deixa de existir no banco,
    // senão a caixa reabre com a data antiga travada em modo leitura
    const limparDraftPd = (id) => {
      const drop = (prev) => { const { [id]: _, ...resto } = prev; return resto; };
      setPdDataTemp(drop);
      setPdObsTemp(drop);
      setEditandoPd(drop);
    };

    // status manual — exclusivo entre si; "pago" só via Mercado Pago ou admin
    const mudarStatus = (enc, st) => {
      if (st === encStatus(enc)) return;
      if (st === "pendente") {
        limparDraftPd(enc.id);
        return salvar(enc, { desistiu: false, pagarDepois: false, pagarDepoisData: null, pagarDepoisObs: null }, "Status atualizado.");
      }
      if (st === "pagar_depois") return salvar(enc, { pagarDepois: true, desistiu: false }, "Pagar depois salvo!");
      if (st === "desistiu") {
        // limpa pagarDepois junto: o check-in monta a lista pelos flags
        // (pago || pagarDepois), então um desistente com a flag antiga continuaria lá
        limparDraftPd(enc.id);
        return salvar(enc, { desistiu: true, pagarDepois: false, pagarDepoisData: null, pagarDepoisObs: null }, "Marcado como desistência.");
      }
    };

    const salvarPagarDepois = async (enc, data, obs) => {
      const ok = await salvar(
        enc,
        { pagarDepois: true, desistiu: false, pagarDepoisData: data || null, pagarDepoisObs: obs || null },
        "Pagar depois salvo!",
      );
      if (ok) setEditandoPd((prev) => ({ ...prev, [enc.id]: false }));
    };

    // valor vazio → remove o acordo (volta ao valor padrão)
    const salvarAcordo = async (enc, valor) => {
      const raw = String(valor ?? "").trim().replace(",", ".");
      if (raw === "") {
        const ok = await salvar(enc, { acordo: false, valorAcordado: null }, "Acordo removido.");
        if (ok) setEditandoAcordo((prev) => ({ ...prev, [enc.id]: true }));
        return;
      }
      const v = parseFloat(raw);
      if (isNaN(v) || v < 0) {
        t("Informe um valor válido.", "w");
        return;
      }
      const ok = await salvar(enc, { acordo: true, valorAcordado: v }, "Acordo salvo!");
      if (ok) setEditandoAcordo((prev) => ({ ...prev, [enc.id]: false }));
    };

    // só admin/edição. Confirma antes: mexe no valor arrecadado do painel.
    const marcarPago = (enc) => {
      if (!window.confirm(`Marcar ${enc.nome} como PAGO (fora do app)?`)) return;
      salvar(enc, { pago: true }, "Marcado como pago.");
    };
    const reverterPago = (enc) => {
      if (!window.confirm("Reverter este pagamento para PENDENTE?")) return;
      // volta mesmo para pendente: quem era "pagar depois"/"desistiu" antes de pagar
      // manteria esses flags e reapareceria com o status antigo
      limparDraftPd(enc.id);
      salvar(
        enc,
        { pago: false, pagarDepois: false, desistiu: false, pagarDepoisData: null, pagarDepoisObs: null },
        "Pagamento revertido.",
      );
    };

    const msgPendente = (nome) =>
      `Olá, ${nome.split(" ")[0]}! 🙏\n\nVi que você se inscreveu no *Encontro com Deus* mas ainda não confirmou sua vaga.\n\nEsse fim de semana pode mudar sua vida de uma forma que você nunca imaginou. Um encontro real com Deus transforma, liberta e renova — e você merece viver isso! 💫\n\nPodemos te ajudar? Ficou com alguma dúvida sobre o pagamento ou sobre o evento? É só falar, estamos aqui! ❤️`;
    // lembrete do combinado, citando a data quando houver
    const msgPagarDepois = (nome, data) =>
      `Olá, ${nome.split(" ")[0]}! 🙏\n\nPassando para lembrar do nosso combinado sobre a sua inscrição no *Encontro com Deus*: ficou de acertar o pagamento ${data ? `até *${fmtISO(data)}*` : "nos próximos dias"}.\n\nA sua vaga está reservada até lá — assim que o pagamento entrar, ela fica confirmada de vez. 💚\n\nSe alguma coisa mudou e você não puder ir, é só responder esta mensagem que a gente ajusta o seu cadastro.`;

    const exportarPlanilha = async () => {
      const ExcelJS = await carregarExcelJS();
              const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Encontristas");
      ws.columns = [
        { header: "Nome", key: "nome", width: 40 },
        { header: "Sexo", key: "sexo", width: 12 },
        { header: "CPF", key: "cpf", width: 18 },
        { header: "Nascimento", key: "nascimento", width: 14 },
        { header: "Igreja", key: "igreja", width: 25 },
        { header: "Célula", key: "celula", width: 25 },
        { header: "Camiseta", key: "camiseta", width: 14 },
        { header: "Status", key: "status", width: 14 },
        { header: "Check-in", key: "checkin", width: 10 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: "FF000000" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD0D0D0" } };
      // exporta o que está filtrado na tela (sem filtro = todos)
      [...lista].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).forEach((e) => {
        ws.addRow({
          nome: e.nome || "",
          sexo: e.sexo || "",
          cpf: e.cpf || "",
          nascimento: e.nascimento ? fmtISO(e.nascimento) : "",
          igreja: e.igreja === "Outra" ? (e.igrejaCustom || "Outra") : (e.igreja || ""),
          celula: e.celula || "",
          camiseta: e.camiseta || "",
          status: ENC_STATUS[encStatus(e)].l,
          checkin: e.chegou ? "Sim" : "Não",
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "encontristas.xlsx"; a.click();
      URL.revokeObjectURL(url);
    };

    const lbl = { color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" };
    const segLabel = (txt, n) => (
      <>
        {txt} <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 800 }}>{n}</span>
      </>
    );
    // botão de status: ativo = preenchido com a cor, inativo = contorno
    const btnStatus = (ativo, cor) => ({
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      background: ativo ? cor : "transparent",
      border: `1px solid ${ativo ? cor : G.cb}`,
      color: ativo ? (cor === G.green ? "#000" : "#fff") : G.td,
    });
    const caixa = (cor) => ({
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      border: `1px solid ${cor}66`,
      background: `${cor}14`,
    });
    const AC = "#0a84ff"; // cor do Acordo (não é status)

    return (
      <div>
        {/* total geral */}
        <div
          style={{
            background: "#111",
            border: `1px solid ${G.cb}`,
            borderRadius: 12,
            padding: "14px 8px",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          <div style={{ color: G.t, fontSize: 30, fontWeight: 800 }}>{stats.total}</div>
          <div style={{ ...lbl, marginTop: 3 }}>Total Geral</div>
        </div>
        {/* 4 cards por status (sobre todos, não filtrado) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            ["pago", "Pagos"],
            ["pendente", "Pendentes"],
            ["pagar_depois", "Pagar dep."],
            ["desistiu", "Desistência"],
          ].map(([st, l]) => (
            <div
              key={st}
              style={{
                background: "#111",
                border: `1px solid ${G.cb}`,
                borderLeft: `3px solid ${ENC_STATUS[st].c}`,
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div style={{ color: G.t, fontSize: 20, fontWeight: 800 }}>{stats[st]}</div>
              <div style={{ ...lbl, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* abas de sexo (com contagem) */}
        <Seg
          opts={[
            ["T", segLabel("Todos", porSexo.T)],
            ["M", segLabel("Mulheres", porSexo.M)],
            ["H", segLabel("Homens", porSexo.H)],
          ]}
          val={g}
          set={setG}
        />

        {/* filtro de célula */}
        <select
          value={filtroCelula}
          onChange={(e) => setFiltroCelula(e.target.value)}
          style={{ ...I, marginTop: 10, marginBottom: 0, fontSize: 13 }}
        >
          {celulasUnicas.map((c) => (
            <option key={c} value={c}>{c === "todas" ? "Todas as células" : c}</option>
          ))}
        </select>

        {/* status: múltipla seleção (nenhum marcado = todos) */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={lbl}>
              Status <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>— marque quantos quiser</span>
            </span>
            {filtroStatus.length > 0 && (
              <span
                onClick={() => setFiltroStatus([])}
                style={{ color: AC, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
              >
                Limpar
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.keys(ENC_STATUS).map((st) => {
              const ativo = filtroStatus.includes(st);
              const c = ENC_STATUS[st].c;
              return (
                <button
                  key={st}
                  onClick={() => alternarStatus(st)}
                  aria-pressed={ativo}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 50,
                    padding: "7px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${ativo ? c : G.cb}`,
                    background: ativo ? `${c}1a` : "transparent",
                    color: ativo ? c : G.td,
                  }}
                >
                  {ENC_STATUS[st].l}
                  <span style={{ opacity: 0.65, fontSize: 11 }}>{porStatus[st]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={exportarPlanilha}
          style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 13, marginTop: 12, marginBottom: 0 }) }}
        >
          Exportar Excel
        </button>
        {edit && (
          <div
            onClick={() => salvarInscricoesBloqueadas(!inscricoesBloqueadas)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              cursor: "pointer",
              padding: "12px 14px",
              borderRadius: 12,
              marginTop: 10,
              background: inscricoesBloqueadas ? "rgba(255,59,48,.08)" : "#111",
              border: `1px solid ${inscricoesBloqueadas ? "rgba(255,59,48,.3)" : "#1e1e1e"}`,
            }}
          >
            <div>
              <div style={{ color: G.t, fontSize: 13, fontWeight: 700 }}>
                {inscricoesBloqueadas ? "Inscrições encerradas" : "Inscrições abertas"}
              </div>
              <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                {inscricoesBloqueadas ? "Ninguém consegue se inscrever agora" : "Toque para encerrar novas inscrições"}
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 26,
                borderRadius: 14,
                background: inscricoesBloqueadas ? "#ff3b30" : "#333",
                position: "relative",
                flexShrink: 0,
                transition: "background var(--d-fast) var(--e-out)",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: 3,
                  left: 3,
                  transform: inscricoesBloqueadas ? "translateX(18px)" : "none",
                  transition: "transform var(--d-fast) var(--e-sheet)",
                }}
              />
            </div>
          </div>
        )}

        {/* busca */}
        <div style={{ position: "relative", marginTop: 10 }}>
          <Search size={15} color={G.tm} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setExpandido(null); }}
            placeholder="Buscar por nome..."
            style={{ ...I, marginTop: 0, marginBottom: 0, paddingLeft: 34 }}
          />
        </div>

        {/* quantos o filtro atual traz */}
        <div style={{ color: G.tm, fontSize: 12, marginTop: 10 }}>
          <span style={{ color: G.t, fontWeight: 800, fontSize: 15 }}>{lista.length}</span>{" "}
          {lista.length === 1 ? "encontrista" : "encontristas"}
          {temFiltro && ` de ${todos.length}`}
        </div>

        {/* lista */}
        <div style={{ marginTop: 8 }}>
          {lista.length === 0 && (
            <div className="empty" style={{ color: G.tm, textAlign: "center", padding: 28, fontSize: 13 }}>
              Nenhum encontrista encontrado.
            </div>
          )}
          {lista.map((e) => {
            const st = encStatus(e);
            const cor = ENC_STATUS[st].c;
            const aberto = expandido === e.id;
            const wa = waLink(e.whatsapp);
            // pago fora do app (sem pagamentoId) ainda pode ter acordo — afeta o arrecadado no painel
            const podeAcordo = !e.pago || !e.pagamentoId;
            const mostrarAcordoAtivo = mostrarAcordo[e.id] ?? !!e.acordo;
            const emEdicaoAcordo = editandoAcordo[e.id] ?? !e.acordo;
            const acordoVal = acordoTemp[e.id] ?? (e.valorAcordado != null ? String(e.valorAcordado) : "");
            const emEdicaoPd = editandoPd[e.id] ?? !e.pagarDepoisData;
            const pdData = pdDataTemp[e.id] ?? (e.pagarDepoisData || "");
            const pdObs = pdObsTemp[e.id] ?? (e.pagarDepoisObs || "");
            return (
              <div
                key={e.id}
                className="fu"
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderLeft: `3px solid ${cor}`,
                  borderRadius: 13,
                  marginBottom: 7,
                  overflow: "hidden",
                }}
              >
                {/* cabeçalho do card (clicável) */}
                <div
                  onClick={() => setExpandido(aberto ? null : e.id)}
                  className="press"
                  style={{
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: G.t, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.nome}
                    </div>
                    <div style={{ color: G.tm, fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.igreja || "—"} · {e.celula || "Não tenho célula"}
                      {e.criadoEm ? ` · ${e.criadoEm.split(", ")[0]}` : ""}
                      {st === "pagar_depois" && e.pagarDepoisData ? ` · pagar até ${fmtISO(e.pagarDepoisData)}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {e.pago && e.pagamentoId && (
                      <img src="/mp-logo.png" alt="Mercado Pago" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />
                    )}
                    <Pill c={e.pago && !e.pagamentoId ? "Pago fora do app" : ENC_STATUS[st].l} bg={`${cor}1a`} tc={cor} />
                  </div>
                </div>

                {/* detalhes expandidos */}
                {aberto && (
                  <div style={{ borderTop: "1px solid #1e1e1e", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <CampoInfo label="CPF" valor={fmtCPF(e.cpf)} />
                      <CampoInfo label="Nascimento" valor={fmtISO(e.nascimento)} />
                      <CampoInfo label="Camiseta" valor={e.camiseta || "—"} />
                      <CampoInfo label="Emergência" valor={e.emergencia || "—"} />
                      <CampoInfo label="Medicamento" valor={e.medicamento || "Não"} />
                      <CampoInfo label="Doença crônica" valor={e.doenca || "Não"} />
                    </div>

                    {/* status (some quando pago) + acordo */}
                    {podeAcordo && (
                      <div>
                        <div style={{ ...lbl, marginBottom: 8 }}>{e.pago ? "Acordo" : "Status"}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                          {/* Marcar como pago — só admin. Fica em destaque no topo. */}
                          {!e.pago && edit && (
                            <button onClick={() => marcarPago(e)} style={btnStatus(true, ENC_STATUS.pago.c)}>
                              Marcar como pago
                            </button>
                          )}
                          {!e.pago &&
                            ENC_STATUS_MANUAL.map((s) => (
                              <button key={s} onClick={() => mudarStatus(e, s)} style={btnStatus(st === s, ENC_STATUS[s].c)}>
                                {ENC_STATUS[s].l}
                              </button>
                            ))}
                          {/* Acordo: não é status — abre o campo de valor combinado */}
                          <button
                            onClick={() => setMostrarAcordo((prev) => ({ ...prev, [e.id]: !mostrarAcordoAtivo }))}
                            style={{
                              ...btnStatus(mostrarAcordoAtivo, AC),
                              border: `1px solid ${mostrarAcordoAtivo ? AC : `${AC}80`}`,
                              color: mostrarAcordoAtivo ? "#fff" : AC,
                            }}
                          >
                            Acordo{e.acordo && e.valorAcordado != null ? ` · R$ ${e.valorAcordado}` : ""}
                          </button>
                        </div>

                        {/* campo de acordo — só quando o botão Acordo está ativo */}
                        {mostrarAcordoAtivo && (
                          <div style={caixa(AC)} onClick={(ev) => ev.stopPropagation()}>
                            <div style={{ ...lbl, color: AC, marginBottom: 8 }}>Acordo — valor combinado</div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ position: "relative", flex: 1 }}>
                                <span
                                  style={{
                                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                                    color: G.tm, fontSize: 14, fontWeight: 600, pointerEvents: "none",
                                  }}
                                >
                                  R$
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  placeholder="0,00"
                                  value={acordoVal}
                                  readOnly={!emEdicaoAcordo}
                                  onChange={(ev) => setAcordoTemp((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                                  style={{ ...I, marginBottom: 0, paddingLeft: 36, fontSize: 14, opacity: emEdicaoAcordo ? 1 : 0.7 }}
                                />
                              </div>
                              {emEdicaoAcordo ? (
                                <button
                                  onClick={() => salvarAcordo(e, acordoVal)}
                                  style={BG({ padding: "10px 16px", borderRadius: 10, fontSize: 13, background: AC, color: "#fff" })}
                                >
                                  Salvar
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEditandoAcordo((prev) => ({ ...prev, [e.id]: true }))}
                                  style={BK({ padding: "10px 16px", borderRadius: 10, fontSize: 13, borderColor: AC, color: AC })}
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                            {e.acordo && (
                              <div style={{ color: G.tm, fontSize: 11, marginTop: 8 }}>
                                Para remover o acordo, apague o valor e toque em Salvar.
                              </div>
                            )}
                          </div>
                        )}

                        {/* data combinada — só quando "Pagar depois" está ativo */}
                        {!e.pago && st === "pagar_depois" && (
                          <div style={caixa(ENC_STATUS.pagar_depois.c)} onClick={(ev) => ev.stopPropagation()}>
                            <div style={{ ...lbl, color: ENC_STATUS.pagar_depois.c, marginBottom: 8 }}>
                              Data combinada para pagamento
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                type="date"
                                value={pdData}
                                readOnly={!emEdicaoPd}
                                onChange={(ev) => setPdDataTemp((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                                style={{ ...I, flex: 1, marginBottom: 0, fontSize: 13, colorScheme: "dark", opacity: emEdicaoPd ? 1 : 0.7 }}
                              />
                              {emEdicaoPd ? (
                                <button
                                  onClick={() => salvarPagarDepois(e, pdData, pdObs)}
                                  disabled={!pdData}
                                  style={BG({
                                    padding: "10px 16px", borderRadius: 10, fontSize: 13,
                                    background: ENC_STATUS.pagar_depois.c, color: "#fff",
                                    opacity: pdData ? 1 : 0.5,
                                  })}
                                >
                                  Salvar
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEditandoPd((prev) => ({ ...prev, [e.id]: true }))}
                                  style={BK({ padding: "10px 16px", borderRadius: 10, fontSize: 13, borderColor: ENC_STATUS.pagar_depois.c, color: ENC_STATUS.pagar_depois.c })}
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={pdObs}
                              readOnly={!emEdicaoPd}
                              onChange={(ev) => setPdObsTemp((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                              placeholder="Observações (ex: vai pagar na sexta...)"
                              style={{ ...I, marginTop: 8, marginBottom: 0, fontSize: 13, opacity: emEdicaoPd ? 1 : 0.7 }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* reverter pagamento — só admin, e só quando já está pago */}
                    {e.pago && edit && (
                      <button
                        onClick={() => reverterPago(e)}
                        style={BK({ width: "100%", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, borderColor: "rgba(255,59,48,.5)", color: "#ff3b30" })}
                      >
                        Reverter para pendente
                      </button>
                    )}

                    {(e.pago || st === "pagar_depois") && wa && (
                      <a
                        href={`${wa}?text=${encodeURIComponent(`Olá ${e.nome.split(" ")[0]}! Segue o link para acessar seu QR Code do Encontro com Deus: https://servos-peniel.vercel.app?qr=true&id=${e.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          background: "rgba(10,132,255,.1)", border: "1px solid rgba(10,132,255,.3)", color: "#64b5f6",
                          borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, textDecoration: "none",
                        }}
                      >
                        Reenviar QR Code
                      </a>
                    )}

                    {/* entrar em contato (WhatsApp) — mensagem conforme o status:
                        pendente gera link de pagamento do Mercado Pago, pagar depois
                        lembra do prazo combinado, pago/desistiu abre a conversa limpa */}
                    {wa && (
                      <button
                        onClick={async () => {
                          if (st === "pendente") {
                            try {
                              const res = await fetch(
                                "https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento",
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ encontristaId: e.id, nome: e.nome, email: "" }),
                                },
                              );
                              const data = await res.json();
                              if (data.init_point) {
                                const msg = `${msgPendente(e.nome)}\n\npara confirmar a sua vaga, clique aqui para pagar: ${data.init_point}`;
                                window.location.href = `${wa}?text=${encodeURIComponent(msg)}`;
                              } else {
                                t("Erro ao gerar link de pagamento", "w");
                              }
                            } catch {
                              t("Erro ao gerar link de pagamento", "w");
                            }
                          } else if (st === "pagar_depois") {
                            window.location.href = `${wa}?text=${encodeURIComponent(msgPagarDepois(e.nome, e.pagarDepoisData))}`;
                          } else {
                            window.location.href = wa;
                          }
                        }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          background: "rgba(37,211,102,.1)", border: "1px solid rgba(37,211,102,.3)", color: "#25d366",
                          borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
                        }}
                      >
                        Entrar em contato — {e.whatsapp}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  function EditOnibus({ o, onSave }) {
    const [aberto, setAberto] = useState(false);
    const [f, setF] = useState({
      tipo: o.tipo,
      poltronas: o.poltronas || 40,
      limResp: o.limResp ?? 2,
      limTemplo: o.limTemplo ?? 2,
    });

    if (!aberto)
      return (
        <button
          onClick={() => setAberto(true)}
          style={{
            ...BK({
              width: "100%",
              padding: 8,
              borderRadius: 10,
              fontSize: 12,
              marginBottom: 8,
            }),
            borderColor: "rgba(255,159,10,.3)",
            color: "#ff9f0a",
          }}
        >
          ✏️ Editar informações
        </button>
      );

    return (
      <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
          Editar Ônibus {o.num}
        </div>

        {/* NÚMERO */}
        <div>
          <div style={{ color: G.tm, fontSize: 11, marginBottom: 6 }}>Número</div>
          <input
            type="number"
            value={f.num ?? o.num}
            onChange={e => setF({ ...f, num: parseInt(e.target.value) || o.num })}
            style={{ ...I, marginBottom: 0 }}
          />
        </div>

        {/* TIPO */}
        <div>
          <div style={{ color: G.tm, fontSize: 11, marginBottom: 6 }}>Tipo</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["Feminino", "Masculino", "Servos"].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setF({ ...f, tipo })}
                style={{
                  ...BK({ padding: "6px 12px", borderRadius: 50, fontSize: 12 }),
                  borderColor: f.tipo === tipo ? "rgba(0,200,81,.5)" : "#2a2a2a",
                  color: f.tipo === tipo ? G.green : G.td,
                  background: f.tipo === tipo ? "rgba(0,200,81,.08)" : "transparent",
                }}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>

        {/* POLTRONAS */}
        <div>
          <div style={{ color: G.tm, fontSize: 11, marginBottom: 6 }}>Poltronas</div>
          <input
            type="number"
            value={f.poltronas}
            onChange={e => setF({ ...f, poltronas: parseInt(e.target.value) || 40 })}
            style={{ ...I, marginBottom: 0 }}
          />
        </div>

        {f.tipo !== "Servos" && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: G.tm, fontSize: 11, marginBottom: 6 }}>Limite de responsáveis</div>
              <input
                type="number"
                min="0"
                max="10"
                value={f.limResp}
                onChange={e => setF({ ...f, limResp: parseInt(e.target.value) ?? 2 })}
                style={{ ...I, marginBottom: 0 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: G.tm, fontSize: 11, marginBottom: 6 }}>Limite de servos do templo</div>
              <input
                type="number"
                min="0"
                max="10"
                value={f.limTemplo}
                onChange={e => setF({ ...f, limTemplo: parseInt(e.target.value) ?? 2 })}
                style={{ ...I, marginBottom: 0 }}
              />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              await onSave({
                ...o,
                num: f.num ?? o.num,
                tipo: f.tipo,
                poltronas: f.poltronas,
                limResp: f.limResp ?? 2,
                limTemplo: f.limTemplo ?? 2,
              });
              setAberto(false);
            }}
            style={BG({ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 })}
          >
            Salvar
          </button>
          <button onClick={() => setAberto(false)} style={BK({ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 })}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }
  // ── ÔNIBUS ───────────────────────────────────────────────────────────────────
  function OnV({
    on,
    uOn,
    setOn,
    encH,
    encM,
    edit,
    t,
    salvarOnibus,
    deletarOnibus,
    users,
  }) {
    const [confirmDel, setConfirmDel] = useState(null);
    const [shN, setShN] = useState(false);
    const [f, setF] = useState({ num: "", tipo: "Feminino", poltronas: 40 });

    const passageirosPorOnibus = (num, tipo) => {
      const lista =
        tipo === "Feminino" ? encM : tipo === "Masculino" ? encH : [];
      return lista.filter((e) => e.onibus === String(num) || e.onibus === num);
    };

    const AddServoBusca = ({ ph, atual, lim, onPick }) => {
      const [busca, setBusca] = useState("");
      const [aberto, setAberto] = useState(false);
      if (!edit) return null;
      if (lim != null && atual.length >= lim) {
        return (
          <div style={{ color: G.tm, fontSize: 11, marginTop: 6, fontStyle: "italic" }}>
            Limite de {lim} atingido.
          </div>
        );
      }
      const filtrados = busca.trim()
        ? (users || []).filter(
            (u) =>
              u.ativo !== false &&
              u.nome &&
              u.nome.toLowerCase().includes(busca.toLowerCase()) &&
              !(atual || []).includes(u.nome),
          ).slice(0, 8)
        : [];
      return (
        <div style={{ position: "relative", marginTop: 8 }}>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            placeholder={ph}
            style={{ ...I, fontSize: 12, padding: "9px 12px", marginBottom: 0 }}
          />
          {aberto && busca.length > 0 && filtrados.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 999,
                background: "#1e1e1e",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                marginTop: 4,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {filtrados.map((u) => (
                <div
                  key={u.id}
                  onMouseDown={() => {
                    onPick(u.nome);
                    setBusca("");
                    setAberto(false);
                  }}
                  style={{
                    padding: "10px 14px",
                    color: G.td,
                    fontSize: 13,
                    cursor: "pointer",
                    borderBottom: "1px solid #2a2a2a",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {u.nome}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    const criarOnibus = async () => {
      if (!f.num) {
        t("Informe o número", "w");
        return;
      }
      const existe = on.find((o) => o.num === parseInt(f.num));
      if (existe) {
        t("Ônibus já existe", "w");
        return;
      }
      const novo = {
        num: parseInt(f.num),
        tipo: f.tipo,
        poltronas: parseInt(f.poltronas) || 40,
        resp: [],
        templo: [],
        servos: [],
        passManual: [],
        malaTipo: "",
      };
      await salvarOnibus(novo);
      setOn([...on, novo].sort((a, b) => a.num - b.num));
      setF({ num: "", tipo: "Feminino", poltronas: 40 });
      setShN(false);
      t("Ônibus criado!");
    };

    const delOnibus = async (num) => {
      setConfirmDel(num);
    };

    const upd = async (num, fn) => {
      const onibus = on.find((o) => o.num === num);
      if (!onibus) return;
      const atualizado = fn(onibus);
      uOn(num, () => atualizado);
      await salvarOnibus(atualizado);
    };

    const tipoColor = {
      Feminino: "#bf5af2",
      Masculino: "#0a84ff",
      Servos: G.green,
    };

    // Componente de mala com dropdown
    return (
      <div>
        {/* MODAL CONFIRMAR DELETE */}
        {confirmDel !== null && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 24,
            }}
          >
            <div
              style={{
                background: "#1c1c1e",
                borderRadius: 18,
                padding: 24,
                maxWidth: 320,
                width: "100%",
                textAlign: "center",
              }}
            >
              <Trash2 size={32} color="#ff3b30" style={{ marginBottom: 12 }} />
              <div
                style={{
                  color: G.t,
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 8,
                }}
              >
                Deletar Ônibus {confirmDel}?
              </div>
              <div style={{ color: G.tm, fontSize: 13, marginBottom: 20 }}>
                Esta ação não pode ser desfeita.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setConfirmDel(null)}
                  style={BK({
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    fontSize: 16,
                  })}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    // Sem o try/catch, uma rejeicao do Firestore (regra de
                    // seguranca, rede) deixava o modal aberto e nao dizia nada:
                    // o clique parecia simplesmente nao funcionar.
                    try {
                      await deletarOnibus(confirmDel);
                      setOn(on.filter((o) => o.num !== confirmDel));
                      setConfirmDel(null);
                      t("Ônibus excluído.");
                    } catch (err) {
                      console.error("Erro ao deletar ônibus:", err);
                      t(
                        err?.code === "permission-denied"
                          ? "Sem permissão para excluir ônibus."
                          : `Erro ao excluir: ${err?.code || err?.message || "desconhecido"}`,
                        "w",
                      );
                    }
                  }}
                  style={{
                    ...BK({
                      flex: 1,
                      padding: 12,
                      borderRadius: 12,
                      fontSize: 16,
                    }),
                    borderColor: "rgba(255,59,48,.4)",
                    color: "#ff6b6b",
                  }}
                >
                  Deletar
                </button>
              </div>
            </div>
          </div>
        )}

        {edit && (
          <>
            <button
              onClick={() => setShN(!shN)}
              style={
                shN
                  ? BK({
                      width: "100%",
                      padding: 12,
                      marginBottom: 10,
                      borderRadius: 13,
                    })
                  : BG({
                      width: "100%",
                      padding: 12,
                      marginBottom: 10,
                      borderRadius: 13,
                    })
              }
            >
              {shN ? "✕ Cancelar" : "＋ Novo Ônibus"}
            </button>
            {shN && (
              <div
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: G.tm,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Número *
                    </div>
                    <input
                      style={I}
                      placeholder="Ex: 1"
                      type="number"
                      value={f.num}
                      onChange={(e) => setF({ ...f, num: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: G.tm,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Poltronas
                    </div>
                    <input
                      style={I}
                      placeholder="Ex: 40"
                      type="number"
                      value={f.poltronas}
                      onChange={(e) =>
                        setF({ ...f, poltronas: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      color: G.tm,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Tipo
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["Feminino", "Masculino", "Servos"].map((tipo) => (
                      <button
                        key={tipo}
                        onClick={() => setF({ ...f, tipo })}
                        style={{
                          ...BK({
                            padding: "8px 14px",
                            borderRadius: 50,
                            fontSize: 12,
                            fontWeight: 700,
                          }),
                          borderColor:
                            f.tipo === tipo
                              ? `${tipoColor[tipo]}80`
                              : "#2a2a2a",
                          color: f.tipo === tipo ? tipoColor[tipo] : G.td,
                          background:
                            f.tipo === tipo
                              ? `${tipoColor[tipo]}12`
                              : "transparent",
                        }}
                      >
                        {tipo === "Feminino"
                          ? "♀"
                          : tipo === "Masculino"
                            ? "♂"
                            : "👤"}{" "}
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={criarOnibus}
                  style={BG({ padding: 12, borderRadius: 12 })}
                >
                  Criar Ônibus
                </button>
              </div>
            )}
          </>
        )}

        {on.length === 0 && (
          <div
            className="empty"
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 32,
              fontSize: 13,
            }}
          >
            Nenhum ônibus cadastrado.
          </div>
        )}

        {on.map((o) => {
          const pass = passageirosPorOnibus(o.num, o.tipo);
          const tc = tipoColor[o.tipo] || G.green;
          const passManual = o.passManual || [];
          const servos = o.servos || [];
          const malas = Array.isArray(o.malas) ? o.malas : [];
          const ocupados =
            o.tipo === "Servos"
              ? servos.length
              : (o.resp?.length || 0) +
                (o.templo?.length || 0) +
                pass.length +
                passManual.length;
          const poltronas = o.poltronas || 40;
          const pct = Math.min(100, Math.round((ocupados / poltronas) * 100));
          const bc = pct >= 100 ? "#ff3b30" : pct >= 80 ? "#ff9f0a" : G.green;

          return (
            <Acc
              key={o.num}
              title={`Ônibus ${o.num}`}
              ax={tc}
              right={
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Pill c={o.tipo} bg={`${tc}18`} tc={tc} />
                  <Pill c={`${ocupados}/${poltronas}`} bg={`${bc}18`} tc={bc} />
                </div>
              }
              onDel={edit ? () => delOnibus(o.num) : undefined}
            >
              <div
                style={{
                  background: "#1e1e1e",
                  borderRadius: 5,
                  height: 5,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    background: bc,
                    borderRadius: 5,
                    height: 5,
                    width: `${pct}%`,
                    transition: "width var(--d-slow) var(--e-out)",
                  }}
                />
              </div>
              <div style={{ color: G.tm, fontSize: 11, marginBottom: 10 }}>
                {poltronas - ocupados >= 0
                  ? `${poltronas - ocupados} vagas`
                  : "Lotado"}
              </div>

              {edit && <EditOnibus o={o} onSave={salvarOnibus} />}

              {o.tipo === "Servos" ? (
                <>
                  <SL c={`Servos (${servos.length})`} mt={0} />
                  <Tags
                    items={servos}
                    ax={G.green}
                    onX={
                      edit
                        ? (i) =>
                            upd(o.num, (x) => ({
                              ...x,
                              servos: x.servos.filter((_, j) => j !== i),
                            }))
                        : undefined
                    }
                  />
                  {edit && (
                    <AddIn
                      ph="Adicionar servo..."
                      onAdd={(n) =>
                        upd(o.num, (x) => ({
                          ...x,
                          servos: [...(x.servos || []), n],
                        }))
                      }
                      mt={8}
                    />
                  )}
                </>
              ) : (
                <>
                  <SL c={`Responsáveis (${(o.resp || []).length}/${o.limResp ?? 2})`} mt={0} />
                  <Tags
                    items={o.resp || []}
                    ax={G.green}
                    onX={
                      edit
                        ? (i) =>
                            upd(o.num, (x) => ({
                              ...x,
                              resp: x.resp.filter((_, j) => j !== i),
                            }))
                        : undefined
                    }
                  />
                  <AddServoBusca
                    ph="Adicionar responsável..."
                    atual={o.resp || []}
                    lim={o.limResp ?? 2}
                    onPick={(n) =>
                      upd(o.num, (x) => ({
                        ...x,
                        resp: [...(x.resp || []), n],
                      }))
                    }
                  />
                  <SL c={`Servos do Templo (${(o.templo || []).length}/${o.limTemplo ?? 2})`} />
                  <Tags
                    items={o.templo || []}
                    ax="#0a84ff"
                    onX={
                      edit
                        ? (i) =>
                            upd(o.num, (x) => ({
                              ...x,
                              templo: x.templo.filter((_, j) => j !== i),
                            }))
                        : undefined
                    }
                  />
                  <AddServoBusca
                    ph="Servo do templo..."
                    atual={o.templo || []}
                    lim={o.limTemplo ?? 2}
                    onPick={(n) =>
                      upd(o.num, (x) => ({
                        ...x,
                        templo: [...(x.templo || []), n],
                      }))
                    }
                  />
                  <SL c={`Passageiros via Check-in (${pass.length})`} />
                  {pass.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                      {pass.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #1e1e1e' }}>
                          <span style={{ color: G.tm, fontSize: 11, minWidth: 18 }}>{i + 1}.</span>
                          <span style={{ color: G.t, fontSize: 13, fontWeight: 600 }}>{p.nome}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: G.tm, fontSize: 12, fontStyle: "italic", margin: "4px 0 8px" }}>
                      Nenhum ainda — atribua pelo Check-in
                    </div>
                  )}
                </>
              )}

              <SL c="Malas" />
              <select
                value={o.malaTipo || ""}
                disabled={!edit}
                onChange={(e) => upd(o.num, (x) => ({ ...x, malaTipo: e.target.value, malas: undefined }))}
                style={{
                  ...I,
                  fontSize: 13,
                  padding: "10px 12px",
                  marginBottom: 8,
                  opacity: edit ? 1 : 0.6,
                }}
              >
                <option value="">Selecione o tipo de mala...</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
                <option value="Servos">Servos</option>
              </select>
            </Acc>
          );
        })}
      </div>
    );
  }
  // ── RESTRIÇÕES ───────────────────────────────────────────────────────────────
function RestV({ users, encH, encM, qm, setQm, role, t }) {
  const can = ['admin', 'lider_geral', 'pastor', 'lider_quartos'].includes(role);

  // Busca líderes de célula com suas restrições
  const lideres = (users || []).filter(u => u.perfil === "lider_celula" || u.liderCelula === true);

  // Monta lista de restrições por célula
  const grupos = lideres.map(l => {
    const restricoes = (l.restricoes || []).map(par => par.split('||'));
    return { celula: l.celula, restricoes };
  }).filter(g => g.restricoes.length > 0);

  return (
    <div>
      <div style={{ background: 'rgba(255,59,48,.08)', border: '1px solid rgba(255,59,48,.2)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 13 }}>⛔ Restrições por Célula</div>
        <div style={{ color: 'rgba(255,107,107,.6)', fontSize: 12, marginTop: 2 }}>Encontristas que não podem ficar no mesmo quarto.</div>
      </div>

      {grupos.length === 0 && (
        <div className="empty" style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>
          Nenhuma restrição cadastrada ainda.
        </div>
      )}

      {grupos.map((g, i) => (
        <Acc key={i} title={g.celula} ax="rgba(255,59,48,.5)"
          right={<Pill c={`${g.restricoes.length} pares`} bg="rgba(255,59,48,.1)" tc="#ff6b6b" />}>
          {g.restricoes.map((par, j) => (
            <div key={j} style={{ background: '#1a1a1a', borderRadius: 10, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ff6b6b', fontSize: 12 }}>⛔</span>
              <span style={{ color: G.td, fontSize: 13 }}>{par[0]}</span>
              <span style={{ color: G.tm, fontSize: 11 }}>e</span>
              <span style={{ color: G.td, fontSize: 13 }}>{par[1]}</span>
            </div>
          ))}
        </Acc>
      ))}
    </div>
  );
}
  function ImgV({ encH, encM }) {
    const todos = [...encH, ...encM].filter((e) => e.autorizaImagem === "Não");
    return (
      <div>
        <div
          style={{
            background: "rgba(255,214,10,.08)",
            border: "1px solid rgba(255,214,10,.2)",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 12,
            color: "#ffd60a",
            fontSize: 12,
          }}
        >
          📷 Encontristas que NÃO autorizaram uso de imagem
        </div>
        {todos.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Todos autorizaram! ✓
          </div>
        )}
        {todos.map((e, i) => (
          <div
            key={e.id}
            className="fu"
            style={{
              background: G.card,
              border: "1px solid rgba(255,214,10,.2)",
              borderLeft: "3px solid #ffd60a",
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 7,
            }}
          >
            <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
              {e.nome}
            </div>
            <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
              {e.sexo} · {e.celula || "Sem célula"}
            </div>
          </div>
        ))}
      </div>
    );
  }
  // ── LIST (imagem / crachás) ───────────────────────────────────────────────────
  function ListV({ icon, color, items, setItems, edit, t, ph }) {
    return (
      <div>
        {edit && (
          <AddIn
            ph={ph || "Nome..."}
            onAdd={(n) => {
              setItems([...items, { id: Date.now(), nome: n }]);
              t("✓");
            }}
            mt={0}
          />
        )}
        <div style={{ height: 8 }} />
        {items.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhum registro.
          </div>
        )}
        {items.map((p, i) => (
          <div
            key={p.id}
            className="fu"
            style={{
              background: G.card,
              border: `1px solid ${color}22`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 13,
              padding: "12px 14px",
              marginBottom: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
              {icon} {p.nome}
            </span>
            {edit && (
              <span
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                style={{
                  color: "rgba(255,59,48,.5)",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  // ── INFO (ocorrências) ────────────────────────────────────────────────────────
  function InfoV({ ocorr, setOcorr, t, notifyAll, user }) {
    const [sh, setSh] = useState(false);
    const [f, setF] = useState({ tipo: "", local: "", desc: "" });
    const registrar = async () => {
      if (!f.tipo) return;
      const nova = { id: Date.now(), ...f, res: false, hr: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
      await setDoc(doc(db, "ocorrencias", String(nova.id)), nova);
      notifyAll(`⚠️ Ocorrência: ${f.tipo}${f.local ? " — " + f.local : ""}`);
      setF({ tipo: "", local: "", desc: "" });
      setSh(false);
      t("Registrado!");
    };
    return (
      <div>
        <button
          onClick={() => setSh(!sh)}
          style={
            sh
              ? BK({
                  width: "100%",
                  padding: 12,
                  marginBottom: 14,
                  borderRadius: 13,
                })
              : {
                  ...BG({
                    width: "100%",
                    padding: 12,
                    marginBottom: 14,
                    borderRadius: 13,
                  }),
                  background: "linear-gradient(135deg,#ff9f0a,#ff6b00)",
                }
          }
        >
          {sh ? "✕ Cancelar" : "＋ Registrar Ocorrência"}
        </button>

        {ocorr.length > 0 && (
          <div style={{ color: G.tm, fontSize: 12, marginBottom: 12 }}>
            <strong style={{ color: G.t }}>{ocorr.filter(o => !o.res).length}</strong> não resolvida{ocorr.filter(o => !o.res).length === 1 ? "" : "s"} de <strong style={{ color: G.t }}>{ocorr.length}</strong> no total
          </div>
        )}
        {sh && (
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.cb}`,
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <select
              style={I}
              value={f.tipo}
              onChange={(e) => setF({ ...f, tipo: e.target.value })}
            >
              <option value="">Tipo *</option>
              {[
                "🚽 Banheiro entupido",
                "🚿 Chuveiro quebrado",
                "🛏️ Cama quebrada",
                "💡 Elétrico",
                "🚪 Porta",
                "⚠️ Outro",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              style={I}
              placeholder="Local (ex: Quarto 8)"
              value={f.local}
              onChange={(e) => setF({ ...f, local: e.target.value })}
            />
            <textarea
              style={{ ...I, minHeight: 60, resize: "vertical" }}
              placeholder="Descrição..."
              value={f.desc}
              onChange={(e) => setF({ ...f, desc: e.target.value })}
            />
            <button
              onClick={() => {
                vibrar(80);
                registrar();
              }}
              style={BG({ padding: 12, borderRadius: 12 })}
            >
              Registrar
            </button>
          </div>
        )}
        {ocorr.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhuma ocorrência. Tudo certo! ✓
          </div>
        )}
        {ocorr.map((o) => (
          <div
            key={o.id}
            className="fu"
            style={{
              background: G.card,
              border: `1px solid ${
                o.res ? "rgba(0,200,81,.25)" : "rgba(255,159,10,.2)"
              }`,
              borderLeft: `3px solid ${o.res ? G.green : "#ff9f0a"}`,
              borderRadius: 13,
              padding: "13px 14px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 13 }}>
                  {o.tipo}
                </div>
                {o.local && (
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                    📍 {o.local}
                  </div>
                )}
                {o.desc && (
                  <div
                    style={{
                      color: G.td,
                      fontSize: 12,
                      marginTop: 3,
                      lineHeight: 1.5,
                    }}
                  >
                    {o.desc}
                  </div>
                )}
                <div style={{ color: G.tm, fontSize: 11, marginTop: 4 }}>
                  🕐 {o.hr}
                  {o.res && o.resolvido_por && (
                    <div style={{ color: G.green, fontSize: 11, marginTop: 2 }}>
                      ✓ Resolvido por {o.resolvido_por} às {o.resolvido_hr}
                    </div>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginLeft: 10,
                  flexDirection: "column",
                  alignItems: "flex-end",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 10 }}>
                <button
                  onClick={async () => {
                    try {
                      await setDoc(doc(db, "ocorrencias", String(o.id)), {
                        res: !o.res,
                        resolvido_por: !o.res ? user.nome : null,
                        resolvido_hr: !o.res ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null,
                      }, { merge: true });
                      t(!o.res ? "Marcado como resolvido!" : "Reaberto.");
                    } catch (err) {
                      console.error("Erro ao resolver ocorrência:", err);
                      t("Erro ao salvar: " + err.message, "w");
                    }
                  }}
                  style={{
                    background: o.res ? "rgba(0,200,81,.1)" : "rgba(255,159,10,.1)",
                    border: `1px solid ${o.res ? "rgba(0,200,81,.3)" : "rgba(255,159,10,.3)"}`,
                    color: o.res ? G.green : "#ff9f0a",
                    borderRadius: 9,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {o.res ? "✓ OK" : "Resolver"}
                </button>
              </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  // ── ACHADOS ──────────────────────────────────────────────────────────────────
  function CartasV({ users, user, role, t }) {
    const [cartas, setCartas] = useState([]);
    const [busca, setBusca] = useState("");
    const [aberto, setAberto] = useState(false);
    const [servoSel, setServoSel] = useState(null);
    const [qtd, setQtd] = useState(1);
    const inputRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const [responsavel, setResponsavel] = useState("");
    const [editandoResp, setEditandoResp] = useState(false);
    const [respTemp, setRespTemp] = useState("");
    const [respAberto, setRespAberto] = useState(false);
    const respInputRef = useRef(null);

    useEffect(() => {
      const unsub = onSnapshot(collection(db, "cartas"), (snap) => {
        setCartas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }, []);

    useEffect(() => {
      const unsub = onSnapshot(doc(db, "config", "cartas"), (snap) => {
        if (snap.exists()) setResponsavel(snap.data().responsavel || "");
      });
      return () => unsub();
    }, []);

    const salvarResponsavel = async () => {
      await setDoc(doc(db, "config", "cartas"), { responsavel: respTemp.trim() }, { merge: true });
      setEditandoResp(false);
      t("Responsável atualizado!");
    };

    const isLiderCartas = role === "lider_cartas" || role === "admin" || role === "lider_geral";

    // ---- Visão do servo: ver minhas cartas ----
    if (!isLiderCartas) {
      const minhasCartas = cartas.filter(c => c.servoId === user.id && !c.retirada);
      const totalCartas = minhasCartas.reduce((acc, c) => acc + (c.qtd || 1), 0);
      const mensagemBusca = responsavel.trim()
        ? `Procure ${responsavel} para retirar.`
        : "Procure o líder de Cartas para retirar.";

      const marcarRetirada = async () => {
        try {
          await Promise.all(
            minhasCartas.map((c) =>
              setDoc(doc(db, "cartas", c.id), { retirada: true, retiradaEm: Date.now() }, { merge: true }),
            ),
          );
          t("Carta(s) marcada(s) como retirada(s)!");
        } catch (err) {
          console.error("Erro ao marcar retirada:", err);
          t("Erro ao salvar.", "w");
        }
      };

      if (totalCartas === 0) {
        return (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <FileText size={40} color={G.tm} style={{ marginBottom: 12 }} />
            <div style={{ color: G.t, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Sem cartas</div>
            <div style={{ color: G.tm, fontSize: 13 }}>Você não tem nenhuma carta para retirar.</div>
          </div>
        );
      }

      return (
        <div>
          <div style={{ background: "rgba(0,200,81,.08)", border: "1px solid rgba(0,200,81,.25)", borderRadius: 14, padding: 16, marginBottom: 14, textAlign: "center" }}>
            <FileText size={28} color={G.green} style={{ marginBottom: 8 }} />
            <div style={{ color: G.green, fontWeight: 800, fontSize: 22 }}>{totalCartas}</div>
            <div style={{ color: G.t, fontSize: 13, fontWeight: 600 }}>
              {totalCartas === 1 ? "carta para retirar" : "cartas para retirar"}
            </div>
            <div style={{ color: G.tm, fontSize: 12, marginTop: 6 }}>{mensagemBusca}</div>
          </div>
          <button
            onClick={marcarRetirada}
            style={BG({ width: "100%", padding: 14, borderRadius: 14, fontSize: 14 })}
          >
            ✓ Já retirei
          </button>
        </div>
      );
    }

    // ---- Visão do líder de Cartas: registrar/gerenciar ----
    const servosFiltrados = busca.trim()
      ? (users || []).filter(u => u.ativo !== false && u.nome && u.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 8)
      : [];

    const respServosFiltrados = respTemp.trim()
      ? (users || []).filter(u => u.ativo !== false && u.nome && u.nome.toLowerCase().includes(respTemp.toLowerCase())).slice(0, 8)
      : [];

    const abrirDropdown = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
      }
      setAberto(true);
    };

    const registrar = async () => {
      if (!servoSel || !qtd || qtd < 1) return;
      await addDoc(collection(db, "cartas"), {
        servoId: servoSel.id,
        servoNome: servoSel.nome,
        qtd: parseInt(qtd),
        criadoEm: Date.now(),
      });
      t("Carta registrada!");
      setServoSel(null);
      setBusca("");
      setQtd(1);
    };

    const [filtroCartas, setFiltroCartas] = useState("pendentes");

    const removerRegistro = async (id) => {
      await deleteDoc(doc(db, "cartas", id));
      t("Removido.");
    };

    const marcarRetiradaServo = async (registros, ativo) => {
      try {
        await Promise.all(
          registros.map((reg) =>
            setDoc(doc(db, "cartas", reg.id), { retirada: ativo, retiradaEm: ativo ? Date.now() : null }, { merge: true }),
          ),
        );
        t(ativo ? "Marcado como retirado!" : "Reaberto como pendente.");
      } catch (err) {
        console.error("Erro ao atualizar retirada:", err);
        t("Erro ao salvar.", "w");
      }
    };

    // Agrupa cartas por servo para exibição (filtrado por status)
    const cartasFiltradas = cartas.filter(c => filtroCartas === "pendentes" ? !c.retirada : !!c.retirada);
    const porServo = {};
    cartasFiltradas.forEach(c => {
      if (!porServo[c.servoId]) porServo[c.servoId] = { nome: c.servoNome, total: 0, registros: [] };
      porServo[c.servoId].total += c.qtd || 1;
      porServo[c.servoId].registros.push(c);
    });
    const listaServos = Object.entries(porServo).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
    const totalPendentes = cartas.filter(c => !c.retirada).length;
    const totalRetiradas = cartas.filter(c => !!c.retirada).length;

    return (
      <div>
        <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Quem o servo deve procurar
          </div>
          {!editandoResp ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: G.t, fontSize: 14 }}>
                {responsavel.trim() || <span style={{ color: G.tm, fontStyle: "italic" }}>Não definido (padrão: "líder de Cartas")</span>}
              </span>
              <button
                onClick={() => { setRespTemp(responsavel); setEditandoResp(true); }}
                style={BK({ padding: "6px 12px", borderRadius: 8, fontSize: 12 })}
              >
                Editar
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  ref={respInputRef}
                  autoFocus
                  value={respTemp}
                  onChange={(e) => { setRespTemp(e.target.value); setRespAberto(true); }}
                  onFocus={() => setRespAberto(true)}
                  onBlur={() => setTimeout(() => setRespAberto(false), 150)}
                  onKeyDown={(e) => e.key === "Enter" && salvarResponsavel()}
                  placeholder="Ex: Jessiany na recepção"
                  style={{ ...I, marginBottom: 0 }}
                />
                {respAberto && respServosFiltrados.length > 0 && (
                  <div
                    style={{
                      position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                      background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 10, maxHeight: 200, overflowY: "auto",
                    }}
                  >
                    {respServosFiltrados.map((s) => (
                      <div
                        key={s.id}
                        onMouseDown={() => { setRespTemp(s.nome); setRespAberto(false); }}
                        style={{ padding: "10px 12px", color: G.td, fontSize: 13, cursor: "pointer", borderBottom: "1px solid #2a2a2a" }}
                      >
                        {s.nome}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={salvarResponsavel} style={BG({ padding: "10px 16px", borderRadius: 10, fontSize: 13 })}>Salvar</button>
              <button onClick={() => setEditandoResp(false)} style={BK({ padding: "10px 16px", borderRadius: 10, fontSize: 13 })}>✕</button>
            </div>
          )}
        </div>

        <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            Registrar carta recebida
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input
              ref={inputRef}
              value={servoSel ? servoSel.nome : busca}
              onChange={(e) => {
                setServoSel(null);
                setBusca(e.target.value);
                abrirDropdown();
              }}
              onFocus={abrirDropdown}
              onBlur={() => setTimeout(() => setAberto(false), 150)}
              placeholder="Buscar servo..."
              style={{ ...I, marginBottom: 0 }}
            />
            {aberto && servosFiltrados.length > 0 && !servoSel && (
              <div
                style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                  background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 10, maxHeight: 200, overflowY: "auto",
                }}
              >
                {servosFiltrados.map((s) => (
                  <div
                    key={s.id}
                    onMouseDown={() => { setServoSel(s); setBusca(""); setAberto(false); }}
                    style={{ padding: "10px 12px", color: G.td, fontSize: 13, cursor: "pointer", borderBottom: "1px solid #2a2a2a" }}
                  >
                    {s.nome}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min="1"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              placeholder="Qtd"
              style={{ ...I, marginBottom: 0, flex: 1 }}
            />
            <button
              onClick={registrar}
              disabled={!servoSel}
              style={{ ...BG({ padding: "10px 20px", borderRadius: 10, fontSize: 13 }), opacity: servoSel ? 1 : 0.5 }}
            >
              Registrar
            </button>
          </div>
        </div>

        <Seg
          opts={[["pendentes", `Pendentes (${totalPendentes})`], ["retiradas", `Retiradas (${totalRetiradas})`]]}
          val={filtroCartas}
          set={setFiltroCartas}
        />
        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", margin: "12px 0 8px" }}>
          {filtroCartas === "pendentes" ? "Cartas pendentes" : "Cartas retiradas"} ({listaServos.length})
        </div>
        {listaServos.length === 0 && (
          <div style={{ color: G.tm, textAlign: "center", padding: 28, fontSize: 13 }}>
            {filtroCartas === "pendentes" ? "Nenhuma carta pendente." : "Nenhuma carta retirada ainda."}
          </div>
        )}
        {listaServos.map(([servoId, info]) => (
          <Acc
            key={servoId}
            title={info.nome}
            right={<Pill c={`${info.total} ${info.total === 1 ? "carta" : "cartas"}`} bg={filtroCartas === "pendentes" ? "rgba(0,200,81,.12)" : "rgba(99,99,102,.15)"} tc={filtroCartas === "pendentes" ? G.green : "#888"} />}
          >
            {info.registros.map((reg) => (
              <div key={reg.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
                <span style={{ color: G.td, fontSize: 13 }}>
                  {reg.qtd} {reg.qtd === 1 ? "carta" : "cartas"} — {new Date(reg.criadoEm).toLocaleDateString("pt-BR")}
                </span>
                <span onClick={() => removerRegistro(reg.id)} style={{ color: "rgba(255,60,60,.7)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <Trash2 size={14} />
                </span>
              </div>
            ))}
            <button
              onClick={() => marcarRetiradaServo(info.registros, filtroCartas === "pendentes")}
              style={BK({ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 12, marginTop: 10 })}
            >
              {filtroCartas === "pendentes" ? "Marcar como retirada" : "Reabrir como pendente"}
            </button>
          </Acc>
        ))}
      </div>
    );
  }
  function AchV({ ach, setAch, t }) {
    const [sh, setSh] = useState(false);
    const [f, setF] = useState({ item: "", local: "", dono: "" });
    return (
      <div>
        <button
          onClick={() => setSh(!sh)}
          style={
            sh
              ? BK({
                  width: "100%",
                  padding: 12,
                  marginBottom: 14,
                  borderRadius: 13,
                })
              : BG({
                  width: "100%",
                  padding: 12,
                  marginBottom: 14,
                  borderRadius: 13,
                })
          }
        >
          {sh ? "✕ Cancelar" : "＋ Registrar Item Encontrado"}
        </button>
        {sh && (
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.cb}`,
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <input
              style={I}
              placeholder="Item *"
              value={f.item}
              onChange={(e) => setF({ ...f, item: e.target.value })}
            />
            <input
              style={I}
              placeholder="Onde foi encontrado"
              value={f.local}
              onChange={(e) => setF({ ...f, local: e.target.value })}
            />
            <input
              style={I}
              placeholder="Dono (se souber)"
              value={f.dono}
              onChange={(e) => setF({ ...f, dono: e.target.value })}
            />
            <button
              onClick={() => {
                if (!f.item) return;
                setAch([
                  {
                    id: Date.now(),
                    ...f,
                    ent: false,
                    hr: new Date().toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  },
                  ...ach,
                ]);
                setF({ item: "", local: "", dono: "" });
                setSh(false);
                t("Registrado!");
              }}
              style={BG({ padding: 12, borderRadius: 12 })}
            >
              Registrar
            </button>
          </div>
        )}
        {ach.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhum item.
          </div>
        )}
        {ach.map((a) => (
          <div
            key={a.id}
            className="fu"
            style={{
              background: G.card,
              border: `1px solid ${
                a.ent ? "rgba(0,200,81,.25)" : "rgba(191,90,242,.2)"
              }`,
              borderLeft: `3px solid ${a.ent ? G.green : "#bf5af2"}`,
              borderRadius: 13,
              padding: "13px 14px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 13 }}>
                  🔎 {a.item}
                </div>
                {a.local && (
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                    📍 {a.local}
                  </div>
                )}
                {a.dono && (
                  <div style={{ color: G.td, fontSize: 12, marginTop: 2 }}>
                    👤 {a.dono}
                  </div>
                )}
                <div style={{ color: G.tm, fontSize: 11, marginTop: 4 }}>
                  🕐 {a.hr}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginLeft: 10,
                  flexDirection: "column",
                  alignItems: "flex-end",
                }}
              >
                <button
                  onClick={() =>
                    setAch(
                      ach.map((x) =>
                        x.id === a.id ? { ...x, ent: !x.ent } : x,
                      ),
                    )
                  }
                  style={{
                    background: a.ent
                      ? "rgba(0,200,81,.1)"
                      : "rgba(191,90,242,.1)",
                    border: `1px solid ${
                      a.ent ? "rgba(0,200,81,.3)" : "rgba(191,90,242,.3)"
                    }`,
                    color: a.ent ? G.green : "#bf5af2",
                    borderRadius: 9,
                    padding: "5px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {a.ent ? "✓ Entregue" : "Entregar"}
                </button>
                <span
                  onClick={() => setAch(ach.filter((x) => x.id !== a.id))}
                  style={{
                    color: "rgba(255,59,48,.35)",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                >
                  Remover
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  // ── SAÚDE ────────────────────────────────────────────────────────────────────
  function SauV({ sau, setSau, edit, t }) {
    const [sh, setSh] = useState(false);
    const [f, setF] = useState({ nome: "", quarto: "", cond: "", obs: "" });
    return (
      <div>
        <div
          style={{
            background: "rgba(255,59,48,.07)",
            border: "1px solid rgba(255,59,48,.15)",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 12,
            display: "flex",
            gap: 10,
          }}
        >
          <PillIcon size={16} color="#ff6b6b" style={{ flexShrink: 0 }} />
          <div style={{ color: G.td, fontSize: 12, lineHeight: 1.6 }}>
            Condições de saúde e necessidades especiais. Visível para servos
            responsáveis.
          </div>
        </div>
        {edit && (
          <button
            onClick={() => setSh(!sh)}
            style={
              sh
                ? BK({
                    width: "100%",
                    padding: 12,
                    marginBottom: 14,
                    borderRadius: 13,
                  })
                : BG({
                    width: "100%",
                    padding: 12,
                    marginBottom: 14,
                    borderRadius: 13,
                  })
            }
          >
            {sh ? "Cancelar" : "+ Adicionar Registro"}
          </button>
        )}
        {sh && (
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.cb}`,
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <input
              style={I}
              placeholder="Nome *"
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
            />
            <input
              style={I}
              placeholder="Quarto"
              value={f.quarto}
              onChange={(e) => setF({ ...f, quarto: e.target.value })}
            />
            <input
              style={I}
              placeholder="Condição (ex: diabética)"
              value={f.cond}
              onChange={(e) => setF({ ...f, cond: e.target.value })}
            />
            <textarea
              style={{ ...I, minHeight: 55, resize: "vertical" }}
              placeholder="Obs..."
              value={f.obs}
              onChange={(e) => setF({ ...f, obs: e.target.value })}
            />
            <button
              onClick={() => {
                if (!f.nome || !f.cond) return;
                setSau([...sau, { id: Date.now(), ...f }]);
                setF({ nome: "", quarto: "", cond: "", obs: "" });
                setSh(false);
                t("Registrado!");
              }}
              style={BG({ padding: 12, borderRadius: 12 })}
            >
              Salvar
            </button>
          </div>
        )}
        {sau.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhum registro.
          </div>
        )}
        {sau.map((s) => (
          <div
            key={s.id}
            className="fu"
            style={{
              background: G.card,
              border: "1px solid rgba(255,59,48,.2)",
              borderLeft: "3px solid #ff3b30",
              borderRadius: 13,
              padding: "13px 14px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <PillIcon size={14} color={G.t} style={{ flexShrink: 0 }} />
                  {s.nome}
                </div>
                {s.quarto && (
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    <BedDouble size={12} color={G.tm} style={{ flexShrink: 0 }} />
                    Quarto {s.quarto}
                  </div>
                )}
                <div
                  style={{
                    color: "#ff6b6b",
                    fontSize: 12,
                    marginTop: 3,
                    fontWeight: 600,
                  }}
                >
                  {s.cond}
                </div>
                {s.obs && (
                  <div
                    style={{
                      color: G.td,
                      fontSize: 12,
                      marginTop: 3,
                      lineHeight: 1.5,
                    }}
                  >
                    {s.obs}
                  </div>
                )}
              </div>
              {/* {edit && (
                <span
                  onClick={() => setSau(sau.filter((x) => x.id !== s.id))}
                  style={{
                    color: "rgba(255,59,48,.4)",
                    cursor: "pointer",
                    fontSize: 16,
                    marginLeft: 10,
                  }}
                >
                  ×
                </span>
              )} */}
            </div>
          </div>
        ))}
      </div>
    );
  }
  function AddServoCozinha({ tarefaId, servosJa, users, onAdd }) {
    const [busca, setBusca] = useState('');
    const [aberto, setAberto] = useState(false);
    const skipBlur = useRef(false);

    const filtrados = (users || []).filter(u =>
      u.ativo !== false &&
      u.nome &&
      u.nome.toLowerCase().includes(busca.toLowerCase()) &&
      busca.length > 0 &&
      !servosJa.includes(u.nome)
    );

    const confirmar = (nome) => {
      onAdd(tarefaId, nome);
      setBusca('');
      setAberto(false);
    };

    return (
      <div style={{ position: 'relative', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setAberto(true); }}
            onFocus={() => setAberto(true)}
            onBlur={() => { if (!skipBlur.current) setAberto(false); skipBlur.current = false; }}
            onKeyDown={e => e.key === 'Enter' && busca.trim() && confirmar(busca.trim())}
            placeholder="Adicionar servo..."
            style={{ ...I, flex: 1, fontSize: 12, padding: '9px 12px' }}
          />
          <button
            onMouseDown={() => busca.trim() && confirmar(busca.trim())}
            style={BG({ padding: '9px 14px', borderRadius: 10, fontSize: 13 })}
          >+</button>
        </div>
        {aberto && filtrados.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 10, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
            {filtrados.map((u, i) => (
              <div
                key={i}
                onMouseDown={() => { skipBlur.current = true; confirmar(u.nome); }}
                style={{ padding: '10px 14px', color: G.td, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ color: G.t, fontWeight: 600 }}>{u.nome}</div>
                <div style={{ color: G.tm, fontSize: 11 }}>{u.perfil}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
}
  // ── LOUÇA ────────────────────────────────────────────────────────────────────
function CardapioTextarea({ valorInicial, cor, edit, onSalvar }) {
  const [texto, setTexto] = useState(valorInicial);
  const [salvando, setSalvando] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => { setTexto(valorInicial); }, [valorInicial]);

  const onChange = (e) => {
    const val = e.target.value;
    setTexto(val);
    setSalvando(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      await onSalvar(val);
      setSalvando(false);
    }, 600);
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={texto}
        onChange={onChange}
        disabled={!edit}
        placeholder="O que será servido neste período..."
        rows={2}
        style={{
          ...I,
          marginBottom: 0,
          fontSize: 13,
          resize: 'vertical',
          minHeight: 50,
          borderColor: `${cor}44`,
          opacity: edit ? 1 : 0.7,
        }}
      />
      {salvando && (
        <span style={{ position: 'absolute', top: 6, right: 8, color: G.tm, fontSize: 10 }}>salvando...</span>
      )}
    </div>
  );
}
function CozinhaV({ edit, t, users }) {
  const [tab, setTab] = useState('estoque'); // 'estoque' | 'cardapio'
  const [tarefas, setTarefas] = useState([]);
  const [itens, setItens] = useState([]);
  const [sh, setSh] = useState(null); // categoria/subcategoria aberta para criar tarefa
  const [f, setF] = useState({ r: '' });
  const [novoItem, setNovoItem] = useState({}); // { [categoria]: { nome, qtd } }
  const [cardapioTexto, setCardapioTexto] = useState({}); // { "Sexta|Café": "texto" }

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cozinha_cardapio'), (snap) => {
      const mapa = {};
      snap.docs.forEach(d => { mapa[d.id] = d.data().texto || ''; });
      setCardapioTexto(mapa);
    });
    return () => unsub();
  }, []);

  const salvarCardapioTexto = async (dia, periodo, texto) => {
    const chave = `${dia}|${periodo}`;
    await setDoc(doc(db, 'cozinha_cardapio', chave), { texto, dia, periodo }, { merge: true });
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cozinha'), (snap) => {
      setTarefas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.criadoEm - b.criadoEm));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cozinha_estoque'), (snap) => {
      setItens(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.criadoEm - b.criadoEm));
    });
    return () => unsub();
  }, []);

  const ESTOQUE_CATS = ['Geral', 'Açougue', 'Frutas e Verduras'];
  const CARDAPIO_DIAS = ['Sexta', 'Sábado', 'Domingo'];
  const CARDAPIO_PERIODOS = ['Café', 'Almoço', 'Jantar'];
  const dC = { Sexta: '#bf5af2', Sábado: G.green, Domingo: '#ff9f0a' };

  const adicionarItem = async (categoria) => {
    const dados = novoItem[categoria] || {};
    if (!dados.nome?.trim()) return;
    await addDoc(collection(db, 'cozinha_estoque'), {
      nome: dados.nome.trim(),
      qtd: dados.qtd?.trim() || '',
      unidade: dados.unidade || 'unid',
      categoria,
      comprado: false,
      criadoEm: Date.now(),
    });
    setNovoItem(prev => ({ ...prev, [categoria]: { nome: '', qtd: '', unidade: 'unid' } }));
    t('Item adicionado!');
  };

  const toggleComprado = async (id, atual) => {
    await updateDoc(doc(db, 'cozinha_estoque', id), { comprado: !atual });
  };

  const removerItem = async (id) => {
    await deleteDoc(doc(db, 'cozinha_estoque', id));
    t('Removido.');
  };

  const criarTarefa = async (categoria, subcategoria) => {
    if (!f.r.trim()) return;
    await addDoc(collection(db, 'cozinha'), {
      r: f.r.trim(),
      s: [],
      tipo: tab,
      categoria,
      subcategoria: subcategoria || null,
      criadoEm: Date.now(),
    });
    setF({ r: '' });
    setSh(null);
    t('Tarefa criada!');
  };

  const addServо = async (id, nome) => {
    const ref = doc(db, 'cozinha', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, { s: [...(snap.data().s || []), nome] });
    t('✓');
  };

  const removeServo = async (id, i) => {
    const ref = doc(db, 'cozinha', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const novaLista = (snap.data().s || []).filter((_, j) => j !== i);
    await updateDoc(ref, { s: novaLista });
  };

  const deletarTarefa = async (id) => {
    await deleteDoc(doc(db, 'cozinha', id));
    t('Removido.');
  };

  const TarefaItem = ({ l }) => (
    <Acc
      key={l.id}
      title={l.r}
      right={<Pill c={l.s?.length || 0} bg="#1e1e1e" tc={G.td} />}
      onDel={edit ? () => deletarTarefa(l.id) : undefined}
    >
      <Tags
        items={l.s || []}
        onX={edit ? (i) => removeServo(l.id, i) : undefined}
      />
      {edit && (
        <AddServoCozinha tarefaId={l.id} servosJa={l.s || []} users={users} onAdd={addServо} />
      )}
    </Acc>
  );

  const NovaTarefaForm = ({ categoria, subcategoria, cor }) => {
    const chave = `${categoria}|${subcategoria || ''}`;
    const aberto = sh === chave;
    return (
      <div style={{ marginBottom: 10 }}>
        {!aberto ? (
          <button
            onClick={() => { setSh(chave); setF({ r: '' }); }}
            style={{ ...BK({ width: '100%', padding: 10, borderRadius: 10, fontSize: 12 }), borderColor: `${cor}44`, color: cor }}
          >
            + Nova Tarefa
          </button>
        ) : (
          <div style={{ background: '#111', border: `1px solid ${cor}44`, borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              autoFocus
              style={{ ...I, marginBottom: 0, fontSize: 13 }}
              placeholder="Nome da tarefa..."
              value={f.r}
              onChange={e => setF({ r: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && criarTarefa(categoria, subcategoria)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => criarTarefa(categoria, subcategoria)} style={{ ...BG({ flex: 1, padding: 9, borderRadius: 9, fontSize: 12 }), background: cor }}>Criar</button>
              <button onClick={() => setSh(null)} style={BK({ padding: '9px 14px', borderRadius: 9, fontSize: 12 })}>✕</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Seg opts={[['estoque', 'Estoque'], ['cardapio', 'Cardápio']]} val={tab} set={setTab} />

      <div style={{ marginTop: 14 }}>
        {tab === 'estoque' && ESTOQUE_CATS.map(cat => {
          const itensCat = itens.filter(item => item.categoria === cat);
          const comprados = itensCat.filter(item => item.comprado).length;
          return (
            <Acc
              key={cat}
              title={cat}
              right={<Pill c={`${comprados}/${itensCat.length}`} bg="rgba(10,132,255,.12)" tc="#0a84ff" />}
            >
              {itensCat.length === 0 && (
                <div style={{ color: G.tm, fontSize: 12, fontStyle: 'italic', margin: '4px 0 8px' }}>
                  Nenhum item cadastrado.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {itensCat.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: '#111', borderRadius: 10, padding: '10px 12px',
                    }}
                  >
                    <div
                      onClick={() => edit && toggleComprado(item.id, item.comprado)}
                      style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${item.comprado ? G.green : '#444'}`,
                        background: item.comprado ? 'rgba(0,200,81,.15)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: edit ? 'pointer' : 'default',
                      }}
                    >
                      {item.comprado && <span style={{ color: G.green, fontSize: 12, fontWeight: 800 }}>✓</span>}
                    </div>
                    <span style={{
                      flex: 1, fontSize: 14,
                      color: item.comprado ? G.tm : G.t,
                      textDecoration: item.comprado ? 'line-through' : 'none',
                    }}>
                      {item.nome}{item.qtd ? ` — ${item.qtd} ${item.unidade || 'unid'}` : ''}
                    </span>
                    {edit && (
                      <button
                        onClick={() => removerItem(item.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ff3b30', fontSize: 16, cursor: 'pointer', padding: 4 }}
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
              {edit && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="Item..."
                    value={novoItem[cat]?.nome || ''}
                    onChange={e => setNovoItem(prev => ({ ...prev, [cat]: { ...prev[cat], nome: e.target.value } }))}
                    onKeyDown={e => e.key === 'Enter' && adicionarItem(cat)}
                    style={{ ...I, flex: 2, marginBottom: 0, fontSize: 13 }}
                  />
                  <input
                    placeholder="Qtd"
                    value={novoItem[cat]?.qtd || ''}
                    onChange={e => setNovoItem(prev => ({ ...prev, [cat]: { ...prev[cat], qtd: e.target.value } }))}
                    onKeyDown={e => e.key === 'Enter' && adicionarItem(cat)}
                    style={{ ...I, flex: 1, marginBottom: 0, fontSize: 13 }}
                  />
                  <select
                    value={novoItem[cat]?.unidade || 'unid'}
                    onChange={e => setNovoItem(prev => ({ ...prev, [cat]: { ...prev[cat], unidade: e.target.value } }))}
                    style={{ ...I, flex: 1, marginBottom: 0, fontSize: 13, padding: '10px 8px' }}
                  >
                    <option value="unid">unid</option>
                    <option value="kg">kg</option>
                    <option value="L">litros</option>
                  </select>
                  <button onClick={() => adicionarItem(cat)} style={BG({ padding: '10px 16px', borderRadius: 10, fontSize: 13 })}>+</button>
                </div>
              )}
            </Acc>
          );
        })}

        {tab === 'cardapio' && CARDAPIO_DIAS.map(dia => {
          const itensDia = tarefas.filter(tarefa => tarefa.tipo === 'cardapio' && tarefa.categoria === dia);
          return (
            <Acc
              key={dia}
              title={dia}
              right={<Pill c={`${itensDia.length} ${itensDia.length === 1 ? 'item' : 'itens'}`} bg={`${dC[dia]}18`} tc={dC[dia]} />}
            >
              {CARDAPIO_PERIODOS.map(periodo => {
                const itens = itensDia.filter(tarefa => tarefa.subcategoria === periodo);
                const chave = `${dia}|${periodo}`;
                return (
                  <div key={periodo} style={{ marginBottom: 14 }}>
                    <div style={{ color: dC[dia], fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                      {periodo}
                    </div>
                    <CardapioTextarea
                      valorInicial={cardapioTexto[chave] || ''}
                      cor={dC[dia]}
                      edit={edit}
                      onSalvar={(texto) => salvarCardapioTexto(dia, periodo, texto)}
                    />
                    <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: '10px 0 6px' }}>
                      Tarefas
                    </div>
                    {itens.length === 0 && (
                      <div style={{ color: G.tm, fontSize: 12, fontStyle: 'italic', margin: '4px 0 8px' }}>
                        Nenhuma tarefa cadastrada.
                      </div>
                    )}
                    {itens.map(l => <TarefaItem key={l.id} l={l} />)}
                    {edit && <NovaTarefaForm categoria={dia} subcategoria={periodo} cor={dC[dia]} />}
                  </div>
                );
              })}
            </Acc>
          );
        })}
      </div>
    </div>
  );
}
  // ── EQUIPES ──────────────────────────────────────────────────────────────────
  function EqV({ esc, setEsc, uEs, edit, t }) {
    const [sh, setSh] = useState(false);
    const [f, setF] = useState({ equipe: "", tipo: "ministerio", resp: "" });
    const tC = { ministerio: "#0a84ff", staff: "#ff9f0a" };
    return (
      <div>
        {edit && (
          <>
            <button
              onClick={() => setSh(!sh)}
              style={
                sh
                  ? BK({
                      width: "100%",
                      padding: 12,
                      marginBottom: 14,
                      borderRadius: 13,
                    })
                  : BG({
                      width: "100%",
                      padding: 12,
                      marginBottom: 14,
                      borderRadius: 13,
                    })
              }
            >
              {sh ? "✕ Cancelar" : "＋ Nova Equipe"}
            </button>
            {sh && (
              <div
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <input
                  style={I}
                  placeholder="Nome *"
                  value={f.equipe}
                  onChange={(e) => setF({ ...f, equipe: e.target.value })}
                />
                <select
                  style={I}
                  value={f.tipo}
                  onChange={(e) => setF({ ...f, tipo: e.target.value })}
                >
                  <option value="ministerio">Ministério</option>
                  <option value="staff">Staff</option>
                </select>
                <input
                  style={I}
                  placeholder="Responsável"
                  value={f.resp}
                  onChange={(e) => setF({ ...f, resp: e.target.value })}
                />
                <button
                  onClick={async () => {
                    if (!f.equipe.trim()) return;
                    await addDoc(collection(db, "equipes"), {
                      ...f,
                      servos: [],
                    });
                    setF({ equipe: "", tipo: "ministerio", resp: "" });
                    setSh(false);
                    t("Criado!");
                  }}
                  style={BG({ padding: 12, borderRadius: 12 })}
                >
                  Criar
                </button>
              </div>
            )}
          </>
        )}
        {esc.map((eq) => (
          <Acc
            key={eq.id}
            title={eq.equipe}
            right={
              <Pill
                c={eq.tipo === "ministerio" ? "Ministério" : "Staff"}
                bg={`${tC[eq.tipo]}18`}
                tc={tC[eq.tipo]}
              />
            }
            onDel={
              edit
                ? async () => {
                    await deleteDoc(doc(db, "equipes", eq.id));
                    t("Removido.");
                  }
                : undefined
            }
          >
            <SL c="Responsável" mt={0} />
            <input
              style={I}
              placeholder="Responsável..."
              value={eq.resp}
              onChange={(e) =>
                uEs(eq.id, (x) => ({ ...x, resp: e.target.value }))
              }
            />
            <SL c="Membros" />
            {eq.servos.length > 0 ? (
              <Tags
                items={eq.servos || []}
                ax={tC[eq.tipo]}
                onX={
                  edit
                    ? async (i) => {
                        const novos = (eq.servos || []).filter(
                          (_, j) => j !== i,
                        );
                        await setDoc(
                          doc(db, "equipes", eq.id),
                          { servos: novos },
                          { merge: true },
                        );
                      }
                    : undefined
                }
              />
            ) : (
              <div
                style={{
                  color: G.tm,
                  fontSize: 12,
                  fontStyle: "italic",
                  margin: "4px 0 8px",
                }}
              >
                Nenhum
              </div>
            )}
            {edit && (
              <AddIn
                ph="Adicionar membro..."
                onAdd={async (n) => {
                  await setDoc(
                    doc(db, "equipes", eq.id),
                    { servos: [...(eq.servos || []), n] },
                    { merge: true },
                  );
                  t("✓");
                }}
                mt={8}
              />
            )}
          </Acc>
        ))}
      </div>
    );
  }
  // ── Toggle Component ─────────────────────────────────────────────────────────
  function Toggle({
    val,
    onToggle,
    labelOn,
    labelOff,
    colorOn = "#00c851",
    colorOff = "#636366",
  }) {
    return (
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: 42,
            height: 24,
            borderRadius: 20,
            background: val ? colorOn : colorOff,
            transition: "background var(--d-fast) var(--e-out)",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              transform: val ? "translateX(16px)" : "none",
              transition: "transform var(--d-fast) var(--e-sheet)",
            }}
          />
        </div>
        <span
          style={{ color: val ? colorOn : G.tm, fontSize: 12, fontWeight: 700 }}
        >
          {val ? labelOn : labelOff}
        </span>
      </div>
    );
  }
  function LiderInput({ u, campo, ph, users, upd }) {
    const [busca, setBusca] = useState(u[campo] || "");
    const [aberto, setAberto] = useState(false);
    const skipBlur = useRef(false);

    const filtrados = users.filter(
      (s) =>
        s.perfil === "servo" &&
        s.ativo !== false &&
        s.nome.toLowerCase().includes(busca.toLowerCase()) &&
        busca.length > 0 &&
        s.nome !== u[campo],
    );

    const limpar = async () => {
      setBusca("");
      await setDoc(doc(db, "users", u.id), { [campo]: "" }, { merge: true });
      upd(u.id, (x) => ({ ...x, [campo]: "" }));
    };

    return (
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => {
              if (!skipBlur.current) setAberto(false);
              skipBlur.current = false;
            }}
            placeholder={ph}
            style={{ ...I, fontSize: 12, padding: "9px 12px", flex: 1 }}
          />
          {busca && (
            <button
              onClick={limpar}
              style={{
                ...BK({ padding: "9px 12px", borderRadius: 10, fontSize: 13 }),
                color: "rgba(255,59,48,.6)",
                borderColor: "rgba(255,59,48,.3)",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
        {aberto && filtrados.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 999,
              background: "#1e1e1e",
              border: "1px solid #2a2a2a",
              borderRadius: 10,
              marginTop: 4,
              maxHeight: 160,
              overflowY: "auto",
            }}
          >
            {filtrados.map((s) => (
              <div
                key={s.id}
                onMouseDown={async () => {
                  skipBlur.current = true;
                  setBusca(s.nome);
                  setAberto(false);
                  await setDoc(
                    doc(db, "users", u.id),
                    { [campo]: s.nome },
                    { merge: true },
                  );
                  upd(u.id, (x) => ({ ...x, [campo]: s.nome }));
                }}
                style={{
                  padding: "10px 14px",
                  color: G.td,
                  fontSize: 13,
                  cursor: "pointer",
                  borderBottom: "1px solid #2a2a2a",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#2a2a2a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {s.nome}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  // ── SERVOS ───────────────────────────────────────────────────────────────────
  function PagarDepoisWidget({ u, upd, t }) {
    const [pdData, setPdData] = useState(u.pagarDepoisData || "");
    const [pdObs, setPdObs] = useState(u.pagarDepoisObs || "");
    const [pdAtivo, setPdAtivo] = useState(u.pago === 'pagar_depois');

    return (
      <>
        <div
          onClick={() => {
            if (pdAtivo) {
              setPdAtivo(false);
              const update = { pago: false, pagarDepoisData: null, pagarDepoisObs: null };
              setDoc(doc(db, "users", u.id), update, { merge: true });
              upd(u.id, (x) => ({ ...x, ...update }));
              t("Status removido.");
            } else {
              setPdAtivo(true);
            }
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: pdAtivo ? 10 : 0 }}
        >
          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${pdAtivo ? "#0a84ff" : "#444"}`, background: pdAtivo ? "rgba(10,132,255,.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {pdAtivo && <span style={{ color: "#0a84ff", fontSize: 11, fontWeight: 800 }}>✓</span>}
          </div>
          <span style={{ color: pdAtivo ? "#0a84ff" : G.td, fontSize: 13, fontWeight: 600 }}>Pagar depois</span>
        </div>
        {pdAtivo && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Data prevista</div>
              <input type="date" value={pdData} onChange={(e) => setPdData(e.target.value)} style={{ ...I, fontSize: 13, marginBottom: 0 }} />
            </div>
            <div>
              <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Observações</div>
              <input type="text" value={pdObs} onChange={(e) => setPdObs(e.target.value)} placeholder="Ex: vai pagar na sexta..." style={{ ...I, fontSize: 13, marginBottom: 0 }} />
            </div>
            <button
              onClick={async () => {
                const update = { pago: 'pagar_depois', pagarDepoisData: pdData, pagarDepoisObs: pdObs };
                await setDoc(doc(db, "users", u.id), update, { merge: true });
                upd(u.id, (x) => ({ ...x, ...update }));
                t("Salvo!");
              }}
              style={BG({ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700 })}
            >
              Salvar
            </button>
          </div>
        )}
      </>
    );
  }
  function SvV({ users, setUsers, esc, edit, t, dataLimitePagamento }) {
    const [filtroPerfil, setFiltroPerfil] = useState("todos");
    const [filtroStatus, setFiltroStatus] = useState("todos");
    const [filtroSexo, setFiltroSexo] = useState("todos");
    const [shFiltro, setShFiltro] = useState(false);
    const [sh, setSh] = useState(false);
    const [f, setF] = useState({
      nome: "",
      sob: "",
      email: "",
      perfil: "servo",
      fn: "",
      cpf: "",
      nascimento: "",
      sexo: "",
    });
    const [filtro, setFiltro] = useState("todos"); // mantido por compatibilidade
    const [loading, setLoading] = useState(false);
    const fnsDasEquipes = useMemo(
      () => [...new Set(esc.filter((e) => e.equipe).map((e) => e.equipe))],
      [esc],
    );
    const [busca, setBusca] = useState("");
    const upd = (id, fn) =>
      setUsers(users.map((u) => (u.id === id ? fn(u) : u)));
    const [dataTempPag, setDataTempPag] = useState(dataLimitePagamento || "");
    const [savingDataPag, setSavingDataPag] = useState(false);
    const [savingData, setSavingData] = useState(false);

    const salvarData = async () => {
      if (!dataTemp) return;
      setSavingData(true);
      setDataLimite(dataTemp);
      await setDoc(doc(db, "config", "uniformes"), { dataLimite: dataTemp }, { merge: true });
      setSavingData(false);
    };

    const salvarDataPag = async () => {
      if (!dataTempPag) {
        t("Selecione uma data", "w");
        return;
      }
      setSavingDataPag(true);
      await setDoc(
        doc(db, "config", "uniformes"),
        { dataLimitePagamento: dataTempPag },
        { merge: true },
      );
      setSavingDataPag(false);
      t("Data limite salva!");
    };

    const formatCpfSvV = (v) =>
      v.replace(/\D/g, "").slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

    const formatDataSvV = (v) =>
      v.replace(/\D/g, "").slice(0, 8)
        .replace(/(\d{2})(\d)/, "$1/$2")
        .replace(/(\d{2})(\d)/, "$1/$2");

    const brParaIsoSvV = (v) => {
      const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return null;
      const [, d, mo, y] = m;
      const dia = parseInt(d, 10), mes = parseInt(mo, 10), ano = parseInt(y, 10);
      if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > new Date().getFullYear()) return null;
      return `${y}-${mo}-${d}`;
    };

    const add = async () => {
      if (!f.nome.trim()) {
        t("Nome obrigatório", "w");
        return;
      }
      if (!f.email.trim() || !f.email.includes("@")) {
        t("Email inválido", "w");
        return;
      }
      const cpfLimpo = f.cpf.replace(/\D/g, "");
      if (!cpfLimpo || cpfLimpo.length !== 11) {
        t("CPF inválido", "w");
        return;
      }
      const nascimentoIso = brParaIsoSvV(f.nascimento);
      if (!nascimentoIso) {
        t("Data de nascimento inválida (DD/MM/AAAA)", "w");
        return;
      }
      if (!f.sexo) {
        t("Selecione o sexo", "w");
        return;
      }
      setLoading(true);
      try {
        const nm = `${f.nome.trim()} ${f.sob.trim()}`.trim();
        const res = await fetch(
          "https://us-central1-servos-peniel.cloudfunctions.net/criarServo",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: f.email.trim(),
              nome: nm,
              perfil: f.perfil,
              tipo: f.perfil,
              funcoes: f.fn ? [f.fn] : [],
            }),
          },
        );
        const data = await res.json();
        if (data.result?.uid) {
          await setDoc(
            doc(db, "users", data.result.uid),
            { cpf: cpfLimpo, nascimento: nascimentoIso, sexo: f.sexo },
            { merge: true },
          );
          setUsers([
            ...users,
            {
              id: data.result.uid,
              nome: nm,
              email: f.email.trim(),
              perfil: f.perfil,
              funcoes: f.fn ? [f.fn] : [],
              ativo: true,
              pago: false,
              cpf: cpfLimpo,
              nascimento: nascimentoIso,
              sexo: f.sexo,
            },
          ]);
          setF({ nome: "", sob: "", email: "", perfil: "servo", fn: "", cpf: "", nascimento: "", sexo: "" });
          setSh(false);
          t("Servo adicionado! Email de acesso enviado ✉️");
        } else {
          t(data.error || "Erro ao criar servo", "w");
        }
      } catch (err) {
        t("Erro: " + err.message, "w");
      }
      setLoading(false);
    };

  const ORDEM_PERFIL = (perfil) => {
    if (perfil === "pastor") return 0;
    if (perfil === "pastor_auxiliar") return 1;
    if (perfil === "lider_geral") return 2;
    if (perfil?.startsWith("lider_") && perfil !== "lider_celula") return 3;
    if (perfil === "lider_celula") return 4;
    if (perfil === "staff") return 5;
    if (perfil === "servo") return 6;
    if (perfil === "cozinha") return 7;
    return 8;
  };

  const filtroPerfilFn = (u) => {
    if (filtroPerfil === "todos") return true;
    if (filtroPerfil === "servo") return u.perfil === "servo";
    if (filtroPerfil === "cozinha") return u.perfil === "cozinha";
    if (filtroPerfil === "staff") return u.perfil === "staff";
    if (filtroPerfil === "lider") return u.perfil?.startsWith("lider_");
    if (filtroPerfil === "pastor") return u.perfil === "pastor" || u.perfil === "pastor_auxiliar";
    return true;
  };

  const isExentoPagamento = (u) => ["pastor", "pastor_auxiliar", "lider_geral"].includes(u.perfil);

  const filtroStatusFn = (u) => {
    if (filtroStatus === "todos") return true;
    if (filtroStatus === "pagos") return u.pago === true;
    if (filtroStatus === "pendentes") return !u.pago && !isExentoPagamento(u) && u.ativo !== false;
    if (filtroStatus === "abonados") return u.pago === "abonado" || isExentoPagamento(u);
    if (filtroStatus === "ativos") return u.ativo !== false;
    if (filtroStatus === "inativos") return u.ativo === false;
    if (filtroStatus === "primeiro_acesso") return u.primeiro === true;
    return true;
  };

  const filtroSexoFn = (u) => {
    if (filtroSexo === "todos") return true;
    return u.sexo === filtroSexo;
  };

  const filtrosAtivos = (filtroPerfil !== "todos" ? 1 : 0) + (filtroStatus !== "todos" ? 1 : 0) + (filtroSexo !== "todos" ? 1 : 0);

  const lista = users.filter(
    (u) =>
      u.perfil !== "admin" &&
      u.nome &&
      filtroPerfilFn(u) &&
      filtroStatusFn(u) &&
      filtroSexoFn(u) &&
      (u.nome || "").toLowerCase().includes(busca.toLowerCase()),
  ).sort((a, b) => {
    const ordemA = ORDEM_PERFIL(a.perfil);
    const ordemB = ORDEM_PERFIL(b.perfil);
    if (ordemA !== ordemB) return ordemA - ordemB;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  // Base padronizada: mesma regra de perfil usada no dashboard financeiro (Home),
  // exceto que Pastor/Pastor Auxiliar/Líder Geral entram no total e contam como
  // Abonados (não pagam inscrição, mas aparecem na contagem geral de servos).
  const PERFIS_ABONADOS = ["pastor", "pastor_auxiliar", "lider_geral"];
  const isAbonadoPorPerfil = (u) => PERFIS_ABONADOS.includes(u.perfil);
  const statsBaseTodos = users.filter((u) => u.nome && u.perfil !== "admin");
  const statsInativos = statsBaseTodos.filter((u) => u.ativo === false).length;
  const statsBase = statsBaseTodos.filter((u) => u.ativo !== false);
  const statsPagos = statsBase.filter((u) => !isAbonadoPorPerfil(u) && u.pago === true).length;
  const statsAbonados = statsBase.filter((u) => isAbonadoPorPerfil(u) || u.pago === "abonado").length;
  const statsPagarDepois = statsBase.filter((u) => !isAbonadoPorPerfil(u) && u.pago === "pagar_depois").length;
  const statsPendentes = statsBase.length - statsPagos - statsAbonados - statsPagarDepois;
  const statsTotal = statsBaseTodos.length;

    return (
      <div>
        {edit && (
          <button
            onClick={() => setSh(true)}
            style={BG({
              width: "100%",
              padding: 13,
              marginBottom: 12,
              borderRadius: 14,
            })}
          >
            + Adicionar Servo
          </button>
        )}

        {edit && (
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.cb}`,
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                color: G.t,
                fontWeight: 700,
                fontSize: 16,
                marginBottom: 10,
              }}
            >
              Data Limite — Pagamento do Servo
            </div>
            {!!dataLimitePagamento && dataTempPag === dataLimitePagamento ? (
              <>
                <div
                  style={{
                    color: G.td,
                    fontSize: 16,
                    padding: "10px 0",
                    marginBottom: 10,
                  }}
                >
                  {new Date(
                    dataLimitePagamento + "T12:00:00",
                  ).toLocaleDateString("pt-BR")}
                </div>
                <button
                  onClick={() => setDataTempPag("")}
                  style={BK({ width: "100%", padding: 12, borderRadius: 12 })}
                >
                  Alterar Data
                </button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <select
                    value={dataTempPag?.split("-")[2] || ""}
                    onChange={(e) => {
                      const p = dataTempPag?.split("-") || ["", "", ""];
                      setDataTempPag(`${p[0]}-${p[1]}-${e.target.value}`);
                    }}
                    style={{ ...I, flex: 1, marginBottom: 0 }}
                  >
                    <option value="">Dia</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={String(d).padStart(2, "0")}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dataTempPag?.split("-")[1] || ""}
                    onChange={(e) => {
                      const p = dataTempPag?.split("-") || ["", "", ""];
                      setDataTempPag(`${p[0]}-${e.target.value}-${p[2]}`);
                    }}
                    style={{ ...I, flex: 1, marginBottom: 0 }}
                  >
                    <option value="">Mês</option>
                    {[
                      "Jan",
                      "Fev",
                      "Mar",
                      "Abr",
                      "Mai",
                      "Jun",
                      "Jul",
                      "Ago",
                      "Set",
                      "Out",
                      "Nov",
                      "Dez",
                    ].map((m, i) => (
                      <option key={m} value={String(i + 1).padStart(2, "0")}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dataTempPag?.split("-")[0] || ""}
                    onChange={(e) => {
                      const p = dataTempPag?.split("-") || ["", "", ""];
                      setDataTempPag(`${e.target.value}-${p[1]}-${p[2]}`);
                    }}
                    style={{ ...I, flex: 1, marginBottom: 0 }}
                  >
                    <option value="">Ano</option>
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={salvarDataPag}
                  disabled={savingDataPag}
                  style={BG({
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    opacity: savingDataPag ? 0.7 : 1,
                  })}
                >
                  {savingDataPag ? "Salvando..." : "Salvar Data"}
                </button>
              </>
            )}
          </div>
        )}

        {/* BUSCA + FUNIL */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} color={G.tm} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              style={{ ...I, marginBottom: 0, paddingLeft: 34 }}
            />
          </div>
          <button
            onClick={() => setShFiltro(true)}
            style={{
              ...BK({ padding: "0 14px", borderRadius: 12, flexShrink: 0 }),
              position: "relative",
              borderColor: filtrosAtivos > 0 ? "rgba(10,132,255,.5)" : G.cb,
              color: filtrosAtivos > 0 ? "#0a84ff" : G.t,
              background: filtrosAtivos > 0 ? "rgba(10,132,255,.08)" : G.card,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SlidersHorizontal size={18} />
            {filtrosAtivos > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                background: "#0a84ff", color: "#fff",
                fontSize: 10, fontWeight: 800,
                borderRadius: "50%", width: 16, height: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {filtrosAtivos}
              </span>
            )}
          </button>
        </div>

        {edit && (
          <button
            onClick={async () => {
              const ExcelJS = await carregarExcelJS();
              const wb = new ExcelJS.Workbook();
              const ws = wb.addWorksheet("Servos");
              ws.columns = [
                { header: "Nome", key: "nome", width: 35 },
                { header: "Email", key: "email", width: 30 },
                { header: "CPF", key: "cpf", width: 18 },
                { header: "Nascimento", key: "nascimento", width: 14 },
                { header: "Perfil", key: "perfil", width: 22 },
                { header: "Pago", key: "pago", width: 10 },
              ];
              ws.getRow(1).font = { bold: true, color: { argb: "FF000000" } };
              ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD0D0D0" } };
              [...users].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")).forEach((u) => {
                ws.addRow({
                  nome: u.nome || "",
                  email: u.email || "",
                  cpf: u.cpf || "",
                  nascimento: u.nascimento
                    ? (u.nascimento.includes("-") && u.nascimento.length === 10
                        ? u.nascimento.split("-").reverse().join("/")
                        : u.nascimento)
                    : "",
                  perfil: PERFIS[u.perfil]?.l || u.perfil || "",
                  pago: u.pago ? "Pago" : "Pendente",
                });
              });
              const buf = await wb.xlsx.writeBuffer();
              const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "servos.xlsx"; a.click();
              URL.revokeObjectURL(url);
            }}
            style={BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 14 })}
          >
            Exportar Excel
          </button>
        )}
        <Sheet open={shFiltro} onClose={() => setShFiltro(false)} title="Filtros">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Perfil */}
            <div>
              <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Perfil</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["todos", "Todos os perfis"],
                  ["servo", "Servo"],
                  ["cozinha", "Cozinha"],
                  ["staff", "Staff"],
                  ["lider", "Líderes"],
                  ["pastor", "Pastores"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFiltroPerfil(val)}
                    style={{
                      ...BK({ width: "100%", padding: "11px 14px", borderRadius: 12, textAlign: "left", fontSize: 14 }),
                      borderColor: filtroPerfil === val ? "rgba(10,132,255,.5)" : "#2a2a2a",
                      color: filtroPerfil === val ? "#0a84ff" : G.td,
                      background: filtroPerfil === val ? "rgba(10,132,255,.08)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    {label}
                    {filtroPerfil === val && <span style={{ fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Status</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["todos", "Todos"],
                  ["pagos", "Pagos"],
                  ["pendentes", "Pendentes"],
                  ["abonados", "Abonados"],
                  ["ativos", "Ativos"],
                  ["inativos", "Inativos"],
                  ["primeiro_acesso", "1º Acesso"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFiltroStatus(val)}
                    style={{
                      ...BK({ width: "100%", padding: "11px 14px", borderRadius: 12, textAlign: "left", fontSize: 14 }),
                      borderColor: filtroStatus === val ? "rgba(48,209,88,.5)" : "#2a2a2a",
                      color: filtroStatus === val ? G.green : G.td,
                      background: filtroStatus === val ? "rgba(48,209,88,.08)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    {label}
                    {filtroStatus === val && <span style={{ fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Sexo */}
            <div>
              <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Sexo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["todos", "Todos"],
                  ["Masculino", "Masculino"],
                  ["Feminino", "Feminino"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFiltroSexo(val)}
                    style={{
                      ...BK({ width: "100%", padding: "11px 14px", borderRadius: 12, textAlign: "left", fontSize: 14 }),
                      borderColor: filtroSexo === val ? "rgba(255,45,146,.5)" : "#2a2a2a",
                      color: filtroSexo === val ? "#ff2d92" : G.td,
                      background: filtroSexo === val ? "rgba(255,45,146,.08)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    {label}
                    {filtroSexo === val && <span style={{ fontSize: 16 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Limpar */}
            {filtrosAtivos > 0 && (
              <button
                onClick={() => { setFiltroPerfil("todos"); setFiltroStatus("todos"); setFiltroSexo("todos"); }}
                style={{ ...BK({ width: "100%", padding: 12, borderRadius: 12 }), color: "#ff3b30", borderColor: "rgba(255,59,48,.3)" }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        </Sheet>

        <div
          style={{
            background: "#111",
            borderRadius: 12,
            padding: "12px 8px",
            textAlign: "center",
            borderTop: "2px solid #636366",
            marginBottom: 8,
          }}
        >
          <div style={{ color: G.t, fontSize: 26, fontWeight: 800 }}>{statsTotal}</div>
          <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>
            Total de Servos
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {[
            [statsPagos, "Pagos", G.green],
            [statsPendentes, "Pendentes", "#ff3b30"],
            [statsAbonados, "Abonados", "#636366"],
            [statsPagarDepois, "Pagar dep.", "#0a84ff"],
          ].map(([n, l, c]) => (
            <div
              key={l}
              style={{
                background: "#111",
                borderRadius: 12,
                padding: "10px 8px",
                textAlign: "center",
                borderTop: `2px solid ${c}`,
              }}
            >
              <div style={{ color: G.t, fontSize: 20, fontWeight: 800 }}>
                {n}
              </div>
              <div
                style={{
                  color: G.tm,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginTop: 3,
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            background: "#111",
            borderRadius: 12,
            padding: "10px 8px",
            textAlign: "center",
            borderTop: "2px solid #8e8e93",
            marginBottom: 14,
          }}
        >
          <div style={{ color: G.t, fontSize: 20, fontWeight: 800 }}>{statsInativos}</div>
          <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>
            Inativos
          </div>
        </div>

        {(() => {
          const partes = [];
          const labelsPerfil = { servo: "Servos", cozinha: "Cozinha", staff: "Staff", lider: "Líderes", pastor: "Pastores" };
          const labelsStatus = { pagos: "Pagos", pendentes: "Pendentes", abonados: "Abonados", ativos: "Ativos", inativos: "Inativos", primeiro_acesso: "1º Acesso" };
          if (filtroPerfil !== "todos") partes.push(labelsPerfil[filtroPerfil] || filtroPerfil);
          if (filtroStatus !== "todos") partes.push(labelsStatus[filtroStatus] || filtroStatus);
          if (filtroSexo !== "todos") partes.push(filtroSexo);
          if (busca.trim()) partes.push(`"${busca.trim()}"`);
          return (
            <div style={{ color: G.tm, fontSize: 12, textAlign: "left", marginBottom: 14 }}>
              Exibindo <strong style={{ color: G.t }}>{lista.length}</strong>
              {partes.length > 0 ? ` de ${partes.join(" · ")}` : ""}
            </div>
          );
        })()}

        {lista.map((u, i) => (
          <Acc
            key={i}
            title={u.nome}
            ax={
              u.perfil === "pastor" ? (u.pago ? "#bf5af2" : "#bf5af2") :
              u.perfil === "pastor_auxiliar" ? "#9b59b6" :
              u.perfil === "lider_geral" ? (u.pago ? "#0a84ff" : "#0a84ff") :
              u.perfil?.startsWith("lider_") ? (PERFIS[u.perfil]?.c || "#ff9f0a") :
              u.pago === true ? G.green : u.pago === 'abonado' ? "#636366" : u.pago === 'pagar_depois' ? "#0a84ff" : "#ff3b30"
            }
            right={
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {u.primeiro && (
                  <Pill c="1º acesso" bg="rgba(255,159,10,.15)" tc="#ff9f0a" />
                )}
                {!u.sexo && (
                  <Pill c="Sem sexo" bg="rgba(255,59,48,.12)" tc="#ff3b30" />
                )}
                {!u.ativo && (
                  <Pill c="Inativo" bg="rgba(99,99,102,.2)" tc="#636366" />
                )}
                {u.pago === true && (
                  <Pill c="Pago ✓" bg="rgba(0,200,81,.15)" tc={G.green} />
                )}
                {u.pago === 'abonado' && (
                  <Pill c="Abonado" bg="rgba(99,99,102,.2)" tc="#aaa" />
                )}
                {u.pago === 'pagar_depois' && (
                  <Pill c="Pagar depois" bg="rgba(10,132,255,.12)" tc="#0a84ff" />
                )}
                <Pill
                  c={PERFIS[u.perfil]?.l || u.perfil}
                  bg={`${PERFIS[u.perfil]?.c || "#636366"}18`}
                  tc={u.perfil === "servo" ? "#fff" : (PERFIS[u.perfil]?.c || "#fff")}
                />
              </div>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {u.email && (
                <div style={{ color: G.tm, fontSize: 12 }}>✉️ {u.email}</div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Ativo/Inativo */}
              <div style={{ background: "#111", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Status</div>
                <Toggle
                  val={u.ativo !== false}
                  onToggle={async () => {
                    await setDoc(doc(db, "users", u.id), { ativo: !u.ativo }, { merge: true });
                    upd(u.id, (x) => ({ ...x, ativo: !x.ativo }));
                  }}
                  labelOn="Ativo"
                  labelOff="Inativo"
                />
              </div>

              {/* Pagamento */}
              {u.perfil !== "admin" && u.perfil !== "pastor" && u.perfil !== "pastor_auxiliar" && u.perfil !== "lider_geral" && (
              <div style={{ background: "#111", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Pagamento</div>
                {/* Status atual */}
                <div style={{ marginBottom: 10 }}>
                  {u.pago === true && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <img src="/mp-logo.png" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                      <span style={{ color: G.green, fontSize: 13, fontWeight: 700 }}>Pago via Mercado Pago</span>
                    </div>
                  )}
                  {u.pago === 'abonado' && (
                    <span style={{ color: "#aaa", fontSize: 13, fontWeight: 700 }}>Abonado — pagamento dispensado</span>
                  )}
                  {u.pago === 'pagar_depois' && (
                    <div>
                      <span style={{ color: "#0a84ff", fontSize: 13, fontWeight: 700 }}>Pagar depois</span>
                      {u.pagarDepoisData && <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>📅 {new Date(u.pagarDepoisData + 'T12:00:00').toLocaleDateString('pt-BR')}</div>}
                      {u.pagarDepoisObs && <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>💬 {u.pagarDepoisObs}</div>}
                    </div>
                  )}
                  {!u.pago && (
                    <span style={{ color: "#ff3b30", fontSize: 13, fontWeight: 700 }}>Pendente</span>
                  )}
                </div>
                {/* Botão Abonar / Desfazer abono */}
                {u.pago !== true && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Pagar depois */}
                    {u.pago !== 'abonado' && (
                      <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px 12px" }}>
                        <PagarDepoisWidget u={u} upd={upd} t={t} />
                      </div>
                    )}
                    {/* Abonar */}
                    {u.pago !== 'pagar_depois' && (
                      <button
                        onClick={async () => {
                          const novoStatus = u.pago === 'abonado' ? false : 'abonado';
                          await setDoc(doc(db, "users", u.id), { pago: novoStatus }, { merge: true });
                          upd(u.id, (x) => ({ ...x, pago: novoStatus }));
                          t(novoStatus === 'abonado' ? "Servo abonado." : "Abono removido.");
                        }}
                        style={{
                          ...BK({ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700 }),
                          borderColor: u.pago === 'abonado' ? "rgba(255,159,10,.4)" : "rgba(99,99,102,.4)",
                          color: u.pago === 'abonado' ? "#ff9f0a" : "#aaa",
                          background: u.pago === 'abonado' ? "rgba(255,159,10,.08)" : "rgba(99,99,102,.08)",
                        }}
                      >
                        {u.pago === 'abonado' ? "↩ Desfazer abono" : "Abonar pagamento"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>
            </div>
          </Acc>
        ))}

        <Sheet open={sh} onClose={() => setSh(false)} title="Adicionar Servo">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "rgba(0,200,81,.08)",
                border: "1px solid rgba(0,200,81,.2)",
                borderRadius: 10,
                padding: "10px 13px",
                color: G.green,
                fontSize: 12,
              }}
            >
              ✉️ O servo receberá um email para criar a própria senha.
            </div>
            <input
              placeholder="Nome completo *"
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
              style={I}
            />
            <input
              placeholder="Email * (será usado para login)"
              type="email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
              style={{
                ...I,
                borderColor:
                  f.email && !f.email.includes("@")
                    ? "rgba(255,59,48,.4)"
                    : "#2a2a2a",
              }}
            />
            <input
              placeholder="CPF *"
              value={f.cpf}
              onChange={(e) => setF({ ...f, cpf: formatCpfSvV(e.target.value) })}
              style={I}
            />
            <input
              placeholder="Data de nascimento * (DD/MM/AAAA)"
              value={f.nascimento}
              onChange={(e) => setF({ ...f, nascimento: formatDataSvV(e.target.value) })}
              maxLength={10}
              style={I}
            />
            <div>
              <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Sexo
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Masculino", "Feminino"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setF({ ...f, sexo: opt })}
                    style={{
                      flex: 1,
                      padding: "12px 10px",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: `1px solid ${f.sexo === opt ? G.green : "#2a2a2a"}`,
                      background: f.sexo === opt ? "rgba(0,200,81,.12)" : "#1a1a1a",
                      color: f.sexo === opt ? G.green : G.td,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Perfil
              </div>
              <select
                value={f.perfil}
                onChange={(e) => setF({ ...f, perfil: e.target.value })}
                style={{ ...I, marginBottom: 0 }}
              >
                <option value="pastor">Pastor</option>
                <option value="pastor_auxiliar">Pastor Auxiliar</option>
                <option value="cozinha">Cozinha</option>
                <option value="staff">Staff</option>
                <option value="servo">Servo</option>
              </select>
            </div>
           <button
              onClick={add}
              disabled={loading}
              style={BG({
                width: "100%",
                padding: 14,
                borderRadius: 14,
                marginTop: 4,
                opacity: loading ? 0.7 : 1,
              })}
              >
              {loading ? "Cadastrando..." : "Confirmar e Enviar Email"}
            </button>
          </div>
        </Sheet>
      </div>
    );
  }
  function UniV({ uni, setUni, dataLimite, setDataLimite, dataLimitePagamento, dataLimitePedido, dataLimiteRestante, user, role, edit, t }) {
    const isAdm = edit;
    const hoje = new Date().toISOString().split("T")[0];
    const prazoDefinido = !!dataLimite;
    const prazoOk = prazoDefinido && hoje <= dataLimite;
    const meuPedido = uni.find((u) => u.userId === user.id);
    const bloqueado =
      (meuPedido && meuPedido.status !== "aberto") ||
      (meuPedido && !meuPedido.status) ||
      meuPedido?.naoQuerUniforme ||
      meuPedido?.pagoSinal === true ||
      meuPedido?.pagoIntegral === true;
    const [form, setForm] = useState(meuPedido || { camisa: "", qtdCamisas: "", calca: "", blusa: "", nomeCamiseta: "" });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (meuPedido) {
        setForm(meuPedido);
      }
    }, [meuPedido?.status]);

    const precoItem = (item, tam) => {
      if (!tam) return 0;
      const grande = ["G1", "G2", "G3", "G4"].includes(tam);
      if (item === "camisa") return grande ? 47 : 43;
      if (item === "blusa") return grande ? 115 : 105;
      if (item === "calca") return grande ? 90 : 80;
      return 0;
    };

    const totalPedido = () => {
      const camisa = precoItem("camisa", form.camisa) * (form.qtdCamisas || 1);
      const calca = precoItem("calca", form.calca) * (form.qtdCalcas || 1);
      const blusa = precoItem("blusa", form.blusa) * (form.qtdBlusas || 1);
      const calc = camisa + calca + blusa;
      // fallback: usa valorTotal salvo no Firestore quando form está vazio (ex: prazo encerrado)
      return calc > 0 ? calc : (meuPedido?.valorTotal || 0);
    };

    const salvarPedido = async () => {
      if (form.camisa && !form.nomeCamiseta?.trim()) {
        t("⚠️ Preencha o nome na camiseta antes de salvar.");
        return;
      }
      setSaving(true);
      const pedido = {
        nome: user.nome,
        perfil: user.perfil,
        nomeCamiseta: form.nomeCamiseta?.trim() || "",
        camisa: form.camisa,
        qtdCamisas: form.camisa ? (form.qtdCamisas || 1) : 0,
        calca: form.calca || "",
        qtdCalcas: form.calca ? (form.qtdCalcas || 1) : 0,
        blusa: form.blusa || "",
        qtdBlusas: form.blusa ? (form.qtdBlusas || 1) : 0,
        valorTotal: totalPedido(),
        status: "bloqueado",
        data: new Date().toLocaleString("pt-BR"),
      };
      await setDoc(doc(db, "uniformes", user.id), pedido);
      setSaving(false);
      t("Pedido salvo! ✓");
    };

    const solicitarAlteracao = async () => {
      await setDoc(
        doc(db, "uniformes", user.id),
        { status: "pendente" },
        { merge: true },
      );
      t("Solicitação enviada ao admin!");
    };

    // SERVO VIEW
    if (!isAdm)
      return (
        <div>
          {!prazoDefinido && (
            <div
              style={{
                background: "rgba(99,99,102,.1)",
                border: "1px solid #2a2a2a",
                borderRadius: 14,
                padding: 20,
                textAlign: "center",
                color: G.tm,
                fontSize: 13,
              }}
            >
              As solicitações de uniforme ainda não foram abertas.
              <br />
              Aguarde a data ser definida pelo admin.
            </div>
          )}
          {prazoDefinido && (
            <>
              <div
                style={{
                  background: prazoOk
                    ? "rgba(0,200,81,.08)"
                    : "rgba(255,59,48,.08)",
                  border: `1px solid ${prazoOk ? "rgba(0,200,81,.2)" : "rgba(255,59,48,.2)"}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    color: prazoOk ? G.green : "#ff6b6b",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {prazoOk ? "Prazo aberto" : "Prazo encerrado"}
                </div>
                <div style={{ color: G.tm, fontSize: 12, marginTop: 3 }}>
                  Data limite:{" "}
                  {new Date(dataLimite + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                  )}
                </div>
              </div>

              {prazoOk && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* STATUS DO PEDIDO */}
                  {meuPedido && meuPedido.status === "aberto" && (
                    <div
                      style={{
                        background: "rgba(255,159,10,.08)",
                        border: "1px solid rgba(255,159,10,.3)",
                        borderRadius: 12,
                        padding: "10px 14px",
                      }}
                    >
                      <div
                        style={{
                          color: "#ff9f0a",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        Alteracao aprovada — edite e salve novamente
                      </div>
                    </div>
                  )}
                  {meuPedido && meuPedido.status === "pendente" && (
                    <div
                      style={{
                        background: "rgba(255,159,10,.08)",
                        border: "1px solid rgba(255,159,10,.3)",
                        borderRadius: 12,
                        padding: "10px 14px",
                      }}
                    >
                      <div
                        style={{
                          color: "#ff9f0a",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        Solicitacao de alteracao enviada — aguardando aprovacao
                      </div>
                    </div>
                  )}
                  {/* CAMISETA */}
                  <div
                    style={{
                      background: G.card,
                      border: `1px solid ${G.cb}`,
                      borderRadius: 14,
                      padding: 14,
                      opacity: bloqueado ? 0.6 : 1,
                    }}
                  >
                    <div
                      style={{
                        color: G.t,
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      Camiseta{" "}
                    </div>
                    <div style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}>
                      <div style={{ color: "rgba(255,159,10,.8)", fontSize: 11, marginBottom: 8 }}>⚠️ Obrigatório ao menos 1 camiseta para quem serve pela primeira vez.</div>
                      Tamanho
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 7,
                        marginBottom: 14,
                      }}
                    >
                      <button
                        onClick={() => !bloqueado && setForm({ ...form, camisa: "", qtdCamisas: 0 })}
                        style={{
                          ...BK({ padding: "7px 13px", borderRadius: 50, fontSize: 12 }),
                          borderColor: !form.camisa ? "rgba(255,59,48,.5)" : "#2a2a2a",
                          color: !form.camisa ? "#ff6b6b" : G.td,
                          cursor: bloqueado ? "default" : "pointer",
                        }}
                      >
                        Nao quero
                      </button>
                      {TAMANHOS.map((tm) => (
                        <button
                          key={tm}
                          onClick={() =>
                            !bloqueado && setForm({ ...form, camisa: tm })
                          }
                          style={{
                            ...BK({
                              padding: "7px 13px",
                              borderRadius: 50,
                              fontSize: 12,
                              fontWeight: 700,
                            }),
                            borderColor:
                              form.camisa === tm
                                ? "rgba(0,200,81,.5)"
                                : "#2a2a2a",
                            color: form.camisa === tm ? G.green : G.td,
                            background:
                              form.camisa === tm
                                ? "rgba(0,200,81,.08)"
                                : "transparent",
                            cursor: bloqueado ? "default" : "pointer",
                          }}
                        >
                          {tm}
                        </button>
                      ))}
                    </div>
                    {form.camisa && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 14 }}>
                          <button onClick={() => !bloqueado && setForm({ ...form, qtdCamisas: Math.max(0, (form.qtdCamisas || 0) - 1) })} style={{ ...BK({ padding: "6px 18px", borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? "default" : "pointer" }}>−</button>
                          <span style={{ color: G.t, fontSize: 24, fontWeight: 800, minWidth: 24, textAlign: "center" }}>{form.qtdCamisas || 1}</span>
                          <button onClick={() => !bloqueado && setForm({ ...form, qtdCamisas: Math.min(3, (form.qtdCamisas || 0) + 1) })} style={{ ...BK({ padding: "6px 18px", borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? "default" : "pointer" }}>+</button>
                        </div>
                        <div style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}>Nome na Camiseta</div>
                        <input placeholder="Primeiro nome e sobrenome" value={form.nomeCamiseta || ""} disabled={bloqueado} onChange={(e) => setForm({ ...form, nomeCamiseta: e.target.value })} style={{ ...I, marginBottom: 0, opacity: bloqueado ? 0.6 : 1, cursor: bloqueado ? "default" : "text" }} />
                      </>
                    )}
                  </div>

                  {/* CALÇA */}
                  <div
                    style={{
                      background: G.card,
                      border: `1px solid ${G.cb}`,
                      borderRadius: 14,
                      padding: 14,
                      opacity: bloqueado ? 0.6 : 1,
                    }}
                  >
                    <div
                      style={{
                        color: G.t,
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 10,
                      }}
                    >
                      Calça
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 7,
                        marginBottom: 14,
                      }}
                    >
                      <button
                        onClick={() =>
                          !bloqueado &&
                          setForm({ ...form, calca: "", qtdCalcas: 1 })
                        }
                        style={{
                          ...BK({
                            padding: "7px 13px",
                            borderRadius: 50,
                            fontSize: 12,
                          }),
                          borderColor: !form.calca
                            ? "rgba(255,59,48,.5)"
                            : "#2a2a2a",
                          color: !form.calca ? "#ff6b6b" : G.td,
                          cursor: bloqueado ? "default" : "pointer",
                        }}
                      >
                        Nao quero
                      </button>
                      {TAMANHOS.map((tm) => (
                        <button
                          key={tm}
                          onClick={() =>
                            !bloqueado && setForm({ ...form, calca: tm })
                          }
                          style={{
                            ...BK({
                              padding: "7px 13px",
                              borderRadius: 50,
                              fontSize: 12,
                              fontWeight: 700,
                            }),
                            borderColor:
                              form.calca === tm
                                ? "rgba(0,200,81,.5)"
                                : "#2a2a2a",
                            color: form.calca === tm ? G.green : G.td,
                            background:
                              form.calca === tm
                                ? "rgba(0,200,81,.08)"
                                : "transparent",
                            cursor: bloqueado ? "default" : "pointer",
                          }}
                        >
                          {tm}
                        </button>
                      ))}
                    </div>
                    {form.calca && (
                      <>
                        <div
                          style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}
                        >
                          Quantidade (max. 3)
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                          }}
                        >
                          <button
                            onClick={() =>
                              !bloqueado &&
                              setForm({
                                ...form,
                                qtdCalcas: Math.max(1, (form.qtdCalcas || 1) - 1)
                              })
                            }
                            style={{
                              ...BK({
                                padding: "6px 18px",
                                borderRadius: 10,
                                fontSize: 20,
                                fontWeight: 700,
                              }),
                              cursor: bloqueado ? "default" : "pointer",
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              color: G.t,
                              fontSize: 24,
                              fontWeight: 800,
                              minWidth: 24,
                              textAlign: "center",
                            }}
                          >
                            {form.qtdCalcas || 1}
                          </span>
                          <button
                            onClick={() =>
                              !bloqueado &&
                              setForm({
                                ...form,
                                qtdCalcas: Math.min(
                                  3,
                                  (form.qtdCalcas || 1) + 1,
                                ),
                              })
                            }
                            style={{
                              ...BK({
                                padding: "6px 18px",
                                borderRadius: 10,
                                fontSize: 20,
                                fontWeight: 700,
                              }),
                              cursor: bloqueado ? "default" : "pointer",
                            }}
                          >
                            +
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* BLUSA DE FRIO */}
                  <div
                    style={{
                      background: G.card,
                      border: `1px solid ${G.cb}`,
                      borderRadius: 14,
                      padding: 14,
                      opacity: bloqueado ? 0.6 : 1,
                    }}
                  >
                    <div
                      style={{
                        color: G.t,
                        fontWeight: 700,
                        fontSize: 13,
                        marginBottom: 10,
                      }}
                    >
                      Blusa de Frio
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 7,
                        marginBottom: 14,
                      }}
                    >
                      <button
                        onClick={() =>
                          !bloqueado &&
                          setForm({ ...form, blusa: "", qtdBlusas: 1 })
                        }
                        style={{
                          ...BK({
                            padding: "7px 13px",
                            borderRadius: 50,
                            fontSize: 12,
                          }),
                          borderColor: !form.blusa
                            ? "rgba(255,59,48,.5)"
                            : "#2a2a2a",
                          color: !form.blusa ? "#ff6b6b" : G.td,
                          cursor: bloqueado ? "default" : "pointer",
                        }}
                      >
                        Nao quero
                      </button>
                      {TAMANHOS.map((tm) => (
                        <button
                          key={tm}
                          onClick={() =>
                            !bloqueado && setForm({ ...form, blusa: tm })
                          }
                          style={{
                            ...BK({
                              padding: "7px 13px",
                              borderRadius: 50,
                              fontSize: 12,
                              fontWeight: 700,
                            }),
                            borderColor:
                              form.blusa === tm
                                ? "rgba(0,200,81,.5)"
                                : "#2a2a2a",
                            color: form.blusa === tm ? G.green : G.td,
                            background:
                              form.blusa === tm
                                ? "rgba(0,200,81,.08)"
                                : "transparent",
                            cursor: bloqueado ? "default" : "pointer",
                          }}
                        >
                          {tm}
                        </button>
                      ))}
                    </div>
                    {form.blusa && (
                      <>
                        <div
                          style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}
                        >
                          Quantidade (max. 3)
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 20,
                          }}
                        >
                          <button
                            onClick={() =>
                              !bloqueado &&
                              setForm({
                                ...form,
                                qtdBlusas: Math.max(
                                  1,
                                  (form.qtdBlusas || 1) - 1,
                                ),
                              })
                            }
                            style={{
                              ...BK({
                                padding: "6px 18px",
                                borderRadius: 10,
                                fontSize: 20,
                                fontWeight: 700,
                              }),
                              cursor: bloqueado ? "default" : "pointer",
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              color: G.t,
                              fontSize: 24,
                              fontWeight: 800,
                              minWidth: 24,
                              textAlign: "center",
                            }}
                          >
                            {form.qtdBlusas || 1}
                          </span>
                          <button
                            onClick={() =>
                              !bloqueado &&
                              setForm({
                                ...form,
                                qtdBlusas: Math.min(
                                  3,
                                  (form.qtdBlusas || 1) + 1,
                                ),
                              })
                            }
                            style={{
                              ...BK({
                                padding: "6px 18px",
                                borderRadius: 10,
                                fontSize: 20,
                                fontWeight: 700,
                              }),
                              cursor: bloqueado ? "default" : "pointer",
                            }}
                          >
                            +
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* RESUMO DE VALORES */}
                  {(form.camisa || form.calca || form.blusa) && (
                    <div
                      style={{
                        background: G.card,
                        border: `1px solid ${G.cb}`,
                        borderRadius: 14,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          color: G.t,
                          fontWeight: 700,
                          fontSize: 13,
                          marginBottom: 10,
                        }}
                      >
                        Resumo do Pedido
                      </div>
                      {form.camisa && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ color: G.td, fontSize: 13 }}>
                            Camiseta {form.camisa} × {form.qtdCamisas || 1}
                          </span>
                          <span
                            style={{
                              color: G.t,
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                          >
                            R${" "}
                            {(
                              precoItem("camisa", form.camisa) *
                              (form.qtdCamisas || 1)
                            )
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                        </div>
                      )}
                      {form.calca && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ color: G.td, fontSize: 13 }}>
                            Calça {form.calca}
                          </span>
                          <span
                            style={{
                              color: G.t,
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                          >
                            R${" "}
                            {precoItem("calca", form.calca)
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                        </div>
                      )}
                      {form.blusa && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <span style={{ color: G.td, fontSize: 13 }}>
                            Blusa de Frio {form.blusa}
                          </span>
                          <span
                            style={{
                              color: G.t,
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                          >
                            R${" "}
                            {precoItem("blusa", form.blusa)
                              .toFixed(2)
                              .replace(".", ",")}
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          height: 1,
                          background: "#2a2a2a",
                          margin: "10px 0",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{ color: G.t, fontWeight: 700, fontSize: 14 }}
                        >
                          Total
                        </span>
                        <span
                          style={{ color: G.t, fontWeight: 800, fontSize: 14 }}
                        >
                          R$ {totalPedido().toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            color: G.green,
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          Sinal (50%)
                        </span>
                        <span
                          style={{
                            color: G.green,
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          R${" "}
                          {(totalPedido() * 0.5).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <div style={{ background: "rgba(255,159,10,.08)", border: "1px solid rgba(255,159,10,.2)", borderRadius: 10, padding: "10px 12px", marginTop: 10 }}>
                      <div style={{ color: "#ff9f0a", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>📋 Condições do pedido</div>
                      <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12, lineHeight: 1.7 }}>
                        {dataLimitePedido && <>
                        • Pedido até <strong style={{ color: "#fff" }}>{new Date(dataLimitePedido + "T12:00:00").toLocaleDateString("pt-BR")}
                          </strong><br/></>}
                        • Pedido mediante entrada de <strong style={{ color: "#fff" }}>50% do valor</strong><br/>
                        • O pedido só será confirmado mediante ao pagamento ao menos do Sinal
                        {dataLimiteRestante && <>• Restante até <strong style={{ color: "#fff" }}>{new Date(dataLimiteRestante + "T12:00:00").toLocaleDateString("pt-BR")}</strong></>}
                      </div>
                    </div>
                    </div>
                  )}

                  {/* BOTOES */}
                  {!meuPedido && (
                    <button
                      onClick={() => {
                        vibrar(50);
                        salvarPedido();
                      }}
                      disabled={saving}
                      style={BG({
                        width: "100%",
                        padding: 14,
                        borderRadius: 14,
                        opacity: saving ? 0.7 : 1,
                      })}
                    >
                      {saving ? "Salvando..." : "Salvar Pedido"}
                    </button>
                  )}
                  {!meuPedido && (
                    <button
                      onClick={async () => {
                        setSaving(true);
                        await setDoc(doc(db, "uniformes", user.id), { nome: user.nome, perfil: user.perfil, naoQuerUniforme: true, status: "bloqueado", data: new Date().toLocaleString("pt-BR") });
                        setSaving(false);
                        t("Registrado!");
                      }}
                      style={{ ...BK({ width: "100%", padding: 14, borderRadius: 14 }), borderColor: "rgba(255,59,48,.3)", color: "rgba(255,107,107,.8)" }}
                    >
                      Não vou pedir nada
                    </button>
                  )}
                  {meuPedido?.naoQuerUniforme && (
                    <div style={{ background: 'rgba(99,99,102,.1)', border: '1px solid #2a2a2a', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ color: G.tm, fontSize: 13, marginBottom: 10 }}>Você optou por não pedir uniforme.</div>
                      <button
                        onClick={async () => {
                          await deleteDoc(doc(db, 'uniformes', user.id));
                          t('Pode fazer seu pedido agora!');
                        }}
                        style={{ ...BK({ width: '100%', padding: 14, borderRadius: 14 }), color: G.green, borderColor: 'rgba(0,200,81,.3)' }}
                      >
                        Mudei de ideia
                      </button>
                    </div>
                  )}
                  {meuPedido && meuPedido.status === "aberto" && (
                    <button
                      onClick={salvarPedido}
                      disabled={saving}
                      style={BG({
                        width: "100%",
                        padding: 14,
                        borderRadius: 14,
                        opacity: saving ? 0.7 : 1,
                      })}
                    >
                      {saving ? "Salvando..." : "Salvar Alteracao"}
                    </button>
                  )}
                 {meuPedido && (meuPedido.status === "bloqueado" || !meuPedido.status) && !meuPedido.naoQuerUniforme && !meuPedido.pagoSinal && !meuPedido.pagoIntegral && (
                  <button
                    onClick={solicitarAlteracao}
                    disabled={!prazoOk}
                    style={{
                      ...BK({ width: "100%", padding: 14, borderRadius: 14 }),
                      borderColor: prazoOk ? "rgba(255,159,10,.4)" : "#2a2a2a",
                      color: prazoOk ? "#ff9f0a" : G.tm,
                      opacity: prazoOk ? 1 : 0.5,
                      cursor: prazoOk ? "pointer" : "default",
                    }}
                  >
                    Solicitar Alteracao
                  </button>
                )}

                  {/* Pagamento MP */}
                  {meuPedido && !meuPedido.naoQuerUniforme && (() => {
                    const pagoSinal    = meuPedido.pagoSinal === true;
                    const pagoIntegral = meuPedido.pagoIntegral === true;

                    if (pagoIntegral) return (
                      <div style={{ background: "rgba(0,200,81,.08)", border: "1px solid rgba(0,200,81,.2)", borderRadius: 14, padding: "12px 14px", marginTop: 8, textAlign: "center" }}>
                        <div style={{ color: G.green, fontWeight: 700, fontSize: 14 }}>✓ Pagamento integral confirmado</div>
                        <div style={{ color: G.tm, fontSize: 12, marginTop: 4 }}>Seu uniforme está garantido!</div>
                      </div>
                    );

                    if (pagoSinal) return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <div style={{ background: "rgba(255,159,10,.08)", border: "1px solid rgba(255,159,10,.25)", borderRadius: 14, padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ color: "#ff9f0a", fontWeight: 700, fontSize: 13 }}>✓ Sinal pago — falta o restante (50%)</div>
                          <div style={{ color: G.tm, fontSize: 12, marginTop: 2 }}>
                            R$ {(totalPedido() * 0.5).toFixed(2).replace(".", ",")} restantes
                          </div>
                        </div>
                        <div style={{ color: G.tm, fontSize: 11, textAlign: "center" }}>PIX ou Boleto</div>
                        <button onClick={async () => {
                          vibrar(50);
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_integral_pix', valor: totalPedido() * 0.5, descricao: 'Uniforme Servo — Restante 50%' }) });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                          Pagar restante — R$ {(totalPedido() * 0.5).toFixed(2).replace(".", ",")}
                        </button>
                        <div style={{ color: G.tm, fontSize: 11, textAlign: "center" }}>Cartão de Crédito (+5%)</div>
                        <button onClick={async () => {
                          vibrar(50);
                          const valorCartao = Math.ceil((totalPedido() * 0.5) / 0.9501 * 100) / 100;
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_integral_credito', valor: valorCartao, descricao: 'Uniforme Servo — Restante 50% Crédito' }) });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                          Pagar restante — R$ {(Math.ceil((totalPedido() * 0.5) / 0.9501 * 100) / 100).toFixed(2).replace(".", ",")}
                        </button>
                      </div>
                    );

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        <div style={{ color: G.tm, fontSize: 11, textAlign: "center", marginBottom: 4 }}>PIX ou Boleto</div>
                        <button onClick={async () => {
                          vibrar(50);
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_sinal_pix', valor: totalPedido() * 0.5, descricao: 'Uniforme Servo — Sinal 50%' }) });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                          Sinal — R$ {(totalPedido() * 0.5).toFixed(2).replace(".", ",")}
                        </button>
                        <button onClick={async () => {
                          vibrar(50);
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_integral_pix', valor: totalPedido(), descricao: 'Uniforme Servo — Pagamento Integral' }) });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                          Integral — R$ {totalPedido().toFixed(2).replace(".", ",")}
                        </button>
                        <div style={{ color: G.tm, fontSize: 11, textAlign: "center", marginTop: 4, marginBottom: 4 }}>Cartão de Crédito (+5%)</div>
                        <button onClick={async () => {
                          vibrar(50);
                          const valorCartao = Math.ceil((totalPedido() * 0.5) / 0.9501 * 100) / 100;
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_sinal_credito', valor: valorCartao, descricao: 'Uniforme Servo — Sinal 50% Crédito' }) });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                          Sinal — R$ {(Math.ceil((totalPedido() * 0.5) / 0.9501 * 100) / 100).toFixed(2).replace(".", ",")}
                        </button>
                        <button onClick={async () => {
                          vibrar(50);
                          const valorCartao = Math.ceil(totalPedido() / 0.9501 * 100) / 100;
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_integral_credito', valor: valorCartao, descricao: 'Uniforme Servo — Pagamento Integral Crédito' }) });
                            const data = await res.json();
                            if (data.init_point) window.location.href = data.init_point;
                          } catch { alert('Erro ao gerar pagamento.'); }
                        }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                          Integral — R$ {(Math.ceil(totalPedido() / 0.9501 * 100) / 100).toFixed(2).replace(".", ",")}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
              {!prazoOk && (() => {
                // Prazo de pedido encerrado — mas pagamento do restante pode ainda estar aberto
                const pagoSinal    = meuPedido?.pagoSinal === true;
                const pagoIntegral = meuPedido?.pagoIntegral === true;
                const temPedido    = meuPedido && !meuPedido.naoQuerUniforme;

                if (pagoIntegral) return (
                  <div style={{ background: "rgba(0,200,81,.08)", border: "1px solid rgba(0,200,81,.2)", borderRadius: 14, padding: 16, textAlign: "center", marginTop: 8 }}>
                    <div style={{ color: G.green, fontWeight: 700, fontSize: 15 }}>✓ Pagamento integral confirmado</div>
                    <div style={{ color: G.tm, fontSize: 13, marginTop: 6 }}>Seu uniforme está garantido!</div>
                    <div style={{ color: G.tm, fontSize: 12, marginTop: 6 }}>🎽 A entrega será realizada no pré-encontro.</div>
                  </div>
                );

                if (pagoSinal && temPedido) return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    <div style={{ background: "rgba(255,159,10,.08)", border: "1px solid rgba(255,159,10,.25)", borderRadius: 14, padding: "10px 14px", textAlign: "center" }}>
                      <div style={{ color: "#ff9f0a", fontWeight: 700, fontSize: 13 }}>✓ Sinal pago — falta o restante (50%)</div>
                      <div style={{ color: G.tm, fontSize: 12, marginTop: 2 }}>
                        R$ {(totalPedido() * 0.5).toFixed(2).replace(".", ",")} restantes
                      </div>
                      {dataLimiteRestante && (
                        <div style={{ color: G.tm, fontSize: 11, marginTop: 4 }}>
                          Prazo para pagamento: {new Date(dataLimiteRestante + "T12:00:00").toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </div>
                    <div style={{ color: G.tm, fontSize: 11, textAlign: "center" }}>PIX ou Boleto</div>
                    <button onClick={async () => {
                      vibrar(50);
                      try {
                        const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_integral_pix', valor: totalPedido() * 0.5, descricao: 'Uniforme Servo — Restante 50%' }) });
                        const data = await res.json();
                        if (data.init_point) window.location.href = data.init_point;
                      } catch { alert('Erro ao gerar pagamento.'); }
                    }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                      Pagar restante — R$ {(totalPedido() * 0.5).toFixed(2).replace(".", ",")}
                    </button>
                    <div style={{ color: G.tm, fontSize: 11, textAlign: "center" }}>Cartão de Crédito (+5%)</div>
                    <button onClick={async () => {
                      vibrar(50);
                      const valorCartao = Math.ceil((totalPedido() * 0.5) / 0.9501 * 100) / 100;
                      try {
                        const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encontristaId: user.id, nome: user.nome, email: user.email || '', tipo: 'uniforme_integral_credito', valor: valorCartao, descricao: 'Uniforme Servo — Restante 50% Crédito' }) });
                        const data = await res.json();
                        if (data.init_point) window.location.href = data.init_point;
                      } catch { alert('Erro ao gerar pagamento.'); }
                    }} style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 12 }), background: "#009ee3" }}>
                      Pagar restante — R$ {(Math.ceil((totalPedido() * 0.5) / 0.9501 * 100) / 100).toFixed(2).replace(".", ",")}
                    </button>
                  </div>
                );

                return (
                  <div style={{ color: G.tm, textAlign: "center", padding: 28, fontSize: 13 }}>
                    O prazo para solicitacao encerrou.
                  </div>
                );
              })()}
            </>
          )}
        </div>
      );

    // ADMIN VIEW
    const resumo = (key) =>
      TAMANHOS.reduce((a, tm) => {
        const qtdKey =
          key === "camisa"
            ? "qtdCamisas"
            : key === "calca"
              ? "qtdCalcas"
              : "qtdBlusas";
        return {
          ...a,
          [tm]: uniFiltrado.filter((u) => u[key] === tm && u[key] !== "")
           .reduce((s, u) => s + (u[qtdKey] || 1), 0),
        };
      }, {});

    const uniFiltrado = uni.filter(u => !u.naoQuerUniforme);
    const pendentes = uni.filter((u) => u.status === "pendente" && !u.naoQuerUniforme).length;
    const [dataTemp, setDataTemp] = useState(dataLimite);
    const [dataTempPag, setDataTempPag] = useState(dataLimitePagamento);
    const [savingData, setSavingData] = useState(false);
    const [dataLimitePedidoLocal, setDataLimitePedidoLocal] = useState(dataLimitePedido || "");
    const [dataLimiteRestanteLocal, setDataLimiteRestanteLocal] = useState(dataLimiteRestante || "");
    const [editPedido, setEditPedido] = useState(false);
    const [editRestante, setEditRestante] = useState(false);

    useEffect(() => { setDataLimitePedidoLocal(dataLimitePedido || ""); }, [dataLimitePedido]);
    useEffect(() => { setDataLimiteRestanteLocal(dataLimiteRestante || ""); }, [dataLimiteRestante]);

    const salvarData = async () => {
      if (!dataTemp) return;
      setSavingData(true);
      setDataLimite(dataTemp);
      await setDoc(doc(db, "config", "uniformes"), { dataLimite: dataTemp }, { merge: true });
      setSavingData(false);
    };

    const aprovar = async (userId) => {
      await setDoc(
        doc(db, "uniformes", userId),
        { status: "aberto" },
        { merge: true },
      );
      t("Alteracao aprovada!");
    };

    const reprovar = async (userId) => {
      await setDoc(
        doc(db, "uniformes", userId),
        { status: "bloqueado" },
        { merge: true },
      );
      t("Solicitacao reprovada.");
    };

    return (
      <div>
        {/* DATA LIMITE */}
        <div
          style={{
            background: G.card,
            border: `1px solid ${G.cb}`,
            borderRadius: 14,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: G.t,
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 10,
            }}
          >
            Data Limite para Solicitacoes
          </div>

          {!!dataLimite && dataTemp === dataLimite ? (
            <>
              <div
                style={{
                  color: G.td,
                  fontSize: 16,
                  padding: "10px 0",
                  marginBottom: 10,
                }}
              >
                {new Date(dataLimite + "T12:00:00").toLocaleDateString("pt-BR")}
              </div>
              <button
                onClick={() => setDataTemp("")}
                style={BK({ width: "100%", padding: 12, borderRadius: 12 })}
              >
                Alterar Data
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <select
                  value={dataTemp?.split("-")[2] || ""}
                  onChange={(e) => {
                    const parts = dataTemp?.split("-") || ["", "", ""];
                    setDataTemp(`${parts[0]}-${parts[1]}-${e.target.value}`);
                  }}
                  style={{ ...I, flex: 1, marginBottom: 0 }}
                >
                  <option value="">Dia</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d).padStart(2, "0")}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={dataTemp?.split("-")[1] || ""}
                  onChange={(e) => {
                    const parts = dataTemp?.split("-") || ["", "", ""];
                    setDataTemp(`${parts[0]}-${e.target.value}-${parts[2]}`);
                  }}
                  style={{ ...I, flex: 1, marginBottom: 0 }}
                >
                  <option value="">Mês</option>
                  {[
                    "Jan",
                    "Fev",
                    "Mar",
                    "Abr",
                    "Mai",
                    "Jun",
                    "Jul",
                    "Ago",
                    "Set",
                    "Out",
                    "Nov",
                    "Dez",
                  ].map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, "0")}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={dataTemp?.split("-")[0] || ""}
                  onChange={(e) => {
                    const parts = dataTemp?.split("-") || ["", "", ""];
                    setDataTemp(`${e.target.value}-${parts[1]}-${parts[2]}`);
                  }}
                  style={{ ...I, flex: 1, marginBottom: 0 }}
                >
                  <option value="">Ano</option>
                  {[2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={salvarData}
                disabled={savingData}
                style={BG({
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  opacity: savingData ? 0.7 : 1,
                })}
              >
                {savingData ? "Salvando..." : "Salvar Data"}
              </button>
            </>
          )}
          {!dataTemp && (
            <div style={{ color: "#ff9f0a", fontSize: 12, marginTop: 8 }}>
              Defina uma data para liberar solicitacoes aos servos.
            </div>
          )}
        </div>

        {/* ALERTA PENDENTES */}
        {pendentes > 0 && (
          <div
            style={{
              background: "rgba(255,159,10,.1)",
              border: "1px solid rgba(255,159,10,.3)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 14,
              color: "#ff9f0a",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {pendentes} solicitacao{pendentes > 1 ? "oes" : ""} de alteracao
            pendente{pendentes > 1 ? "s" : ""}
          </div>
        )}

        {/* DATAS DE PAGAMENTO UNIFORME */}
        <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ color: G.t, fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Condições de Pagamento</div>

          {/* Prazo para Pedido */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Prazo para Pedido</div>
            {dataLimitePedidoLocal && !editPedido ? (
              <>
                <div style={{ color: G.td, fontSize: 16, padding: "10px 0", marginBottom: 10 }}>
                  {new Date(dataLimitePedidoLocal + "T12:00:00").toLocaleDateString("pt-BR")}
                </div>
                <button onClick={() => setEditPedido(true)} style={BK({ width: "100%", padding: 12, borderRadius: 12 })}>Alterar Data</button>
              </>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" value={dataLimitePedidoLocal} onChange={e => setDataLimitePedidoLocal(e.target.value)} style={{ ...I, flex: 1, marginBottom: 0 }} />
                <button onClick={async () => {
                  await setDoc(doc(db, "config", "uniformes"), { dataLimitePedido: dataLimitePedidoLocal }, { merge: true });
                  setEditPedido(false);
                  t("Salvo!");
                }} style={BG({ padding: "12px 16px", borderRadius: 12 })}>✓</button>
              </div>
            )}
          </div>

          {/* Prazo para Restante */}
          <div>
            <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Prazo para Restante (50%)</div>
            {dataLimiteRestanteLocal && !editRestante ? (
              <>
                <div style={{ color: G.td, fontSize: 16, padding: "10px 0", marginBottom: 10 }}>
                  {new Date(dataLimiteRestanteLocal + "T12:00:00").toLocaleDateString("pt-BR")}
                </div>
                <button onClick={() => setEditRestante(true)} style={BK({ width: "100%", padding: 12, borderRadius: 12 })}>Alterar Data</button>
              </>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input type="date" value={dataLimiteRestanteLocal} onChange={e => setDataLimiteRestanteLocal(e.target.value)} style={{ ...I, flex: 1, marginBottom: 0 }} />
                <button onClick={async () => {
                  await setDoc(doc(db, "config", "uniformes"), { dataLimiteRestante: dataLimiteRestanteLocal }, { merge: true });
                  setEditRestante(false);
                  t("Salvo!");
                }} style={BG({ padding: "12px 16px", borderRadius: 12 })}>✓</button>
              </div>
            )}
          </div>
        </div>

        {/* RESUMO */}
        {uniFiltrado.length > 0 && (
            <Acc title={`Resumo (${uniFiltrado.length} pedidos)`} def={true}>
            {[
              { key: "camisa", label: "Camisetas" },
              { key: "calca", label: "Calcas" },
              { key: "blusa", label: "Blusas de Frio" },
            ].map(({ key, label }) => {
              const r = resumo(key);
              const total = Object.values(r).reduce((a, b) => a + b, 0);
              if (!total) return null;
              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ color: G.td, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    {label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {TAMANHOS.filter((tm) => r[tm] > 0).map((tm) => (
                      <Pill key={tm} c={`${tm}: ${r[tm]}`} bg="#1e1e1e" tc={G.td} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Financeiro uniformes */}
            {(() => {
              const precoItemFn = (item, tam, qtd) => {
                if (!tam) return 0;
                const grande = ["G1","G2","G3","G4"].includes(tam);
                let p = 0;
                if (item === "camisa") p = grande ? 47 : 43;
                else if (item === "blusa") p = grande ? 115 : 105;
                else if (item === "calca") p = grande ? 90 : 80;
                return p * (qtd || 1);
              };
              const calcTotal = (u) =>
                precoItemFn("camisa", u.camisa, u.qtdCamisas) +
                precoItemFn("calca", u.calca, u.qtdCalcas) +
                precoItemFn("blusa", u.blusa, u.qtdBlusas);

              const uniComPedido = uniFiltrado.filter(u => !u.naoQuerUniforme);
              let arrecadadoSinal = 0, arrecadadoIntegral = 0, aReceber = 0;

              uniComPedido.forEach(u => {
                const vTotal = u.valorTotal || calcTotal(u);
                if (u.pagoIntegral) {
                  arrecadadoIntegral += vTotal;
                } else if (u.pagoSinal) {
                  arrecadadoSinal += vTotal * 0.5;
                  aReceber += vTotal * 0.5;
                } else {
                  aReceber += vTotal;
                }
              });

              const totalArrecadado = arrecadadoSinal + arrecadadoIntegral;
              const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 1, background: G.cb, marginBottom: 12 }} />
                  <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Financeiro</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: G.green }} />
                        <span style={{ color: G.tm, fontSize: 13 }}>Arrecadado</span>
                      </div>
                      <span style={{ color: G.green, fontWeight: 800, fontSize: 15 }}>{fmt(totalArrecadado)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff9f0a' }} />
                        <span style={{ color: G.tm, fontSize: 13 }}>A receber</span>
                      </div>
                      <span style={{ color: '#ff9f0a', fontWeight: 800, fontSize: 15 }}>{fmt(aReceber)}</span>
                    </div>
                    <div style={{ height: 1, background: G.cb }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: G.tm, fontSize: 13, fontWeight: 700 }}>Total esperado</span>
                      <span style={{ color: G.t, fontWeight: 800, fontSize: 16 }}>{fmt(totalArrecadado + aReceber)}</span>
                    </div>
                    <div style={{ color: G.tm, fontSize: 10 }}>* Inclui sinal pago + restante pendente + integrais</div>
                  </div>
                </div>
              );
            })()}
          </Acc>
        )}

        {/* PEDIDOS */}
        <SL c={`Pedidos (${uniFiltrado.length})`} mt={14} />

        {/* EXPORTAR */}
        {uniFiltrado.length > 0 && (
          <button
            onClick={async () => {
              const TAMANHOS = ["P", "M", "G", "GG", "G1", "G2", "G3"];

              const buildAba = (wb, titulo, dados) => {
                const ws = wb.addWorksheet(titulo);

                ws.mergeCells("A1:H1");
                const title = ws.getCell("A1");
                title.value = `PEDIDO UNIFORMES — ${titulo.toUpperCase()} — ENCONTRO COM DEUS 2026`;
                title.font = { name: "Arial", bold: true, size: 12 };
                title.alignment = { horizontal: "center", vertical: "middle" };
                ws.getRow(1).height = 24;

                const secoes = [
                  [1, "CAMISETA"],
                  [4, "BLUSÃO DE FRIO"],
                  [7, "CALÇA"],
                ];
                secoes.forEach(([col, nome]) => {
                  ws.mergeCells(2, col, 2, col + 1);
                  const c = ws.getCell(2, col);
                  c.value = nome;
                  c.font = { name: "Arial", bold: true, size: 11 };
                  c.alignment = { horizontal: "center", vertical: "middle" };
                  c.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                  };
                });
                ws.getRow(2).height = 20;

                secoes.forEach(([col]) => {
                  ["NOME", "QTD"].forEach((h, i) => {
                    const c = ws.getCell(3, col + i);
                    c.value = h;
                    c.font = { name: "Arial", bold: true, size: 9 };
                    c.alignment = { horizontal: "center", vertical: "middle" };
                    c.border = {
                      top: { style: "thin" },
                      left: { style: "thin" },
                      bottom: { style: "thin" },
                      right: { style: "thin" },
                    };
                  });
                });
                ws.getRow(3).height = 16;

                [22, 6, 2, 22, 6, 2, 22, 6].forEach((w, i) => {
                  ws.getColumn(i + 1).width = w;
                });

                let row = 4;
                const totais = { camisa: {}, blusa: {}, calca: {} };
                const borda = {
                  top: { style: "thin" },
                  left: { style: "thin" },
                  bottom: { style: "thin" },
                  right: { style: "thin" },
                };
                const cinzaClaro = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFEEEEEE" },
                };
                const cinzaMedio = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFDDDDDD" },
                };
                const cinzaEscuro = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFBBBBBB" },
                };

                TAMANHOS.forEach((tm) => {
                  const cam = dados
                    .filter((u) => u.camisa === tm)
                    .map((u) => [u.nomeCamiseta || u.nome, u.qtdCamisas || 1]);
                  const blu = dados
                    .filter((u) => u.blusa === tm)
                    .map((u) => [u.nome, u.qtdBlusas || 1]);
                  const cal = dados
                    .filter((u) => u.calca === tm)
                    .map((u) => [u.nome, u.qtdCalcas || 1]);

                  if (!cam.length && !blu.length && !cal.length) return;

                  [1, 4, 7].forEach((col) => {
                    ws.mergeCells(row, col, row, col + 1);
                    const c = ws.getCell(row, col);
                    c.value = `TAMANHO ${tm}`;
                    c.font = { name: "Arial", bold: true, size: 9 };
                    c.fill = cinzaClaro;
                    c.alignment = { horizontal: "center", vertical: "middle" };
                    c.border = borda;
                  });
                  ws.getRow(row).height = 15;
                  row++;

                  const maxRows = Math.max(
                    cam.length,
                    blu.length,
                    cal.length,
                    1,
                  );
                  for (let i = 0; i < maxRows; i++) {
                    [
                      [1, cam],
                      [4, blu],
                      [7, cal],
                    ].forEach(([col, lista]) => {
                      if (i < lista.length) {
                        const c1 = ws.getCell(row + i, col);
                        c1.value = lista[i][0];
                        c1.font = { name: "Arial", size: 9 };
                        c1.alignment = {
                          horizontal: "left",
                          vertical: "middle",
                        };
                        c1.border = borda;
                        const c2 = ws.getCell(row + i, col + 1);
                        c2.value = lista[i][1];
                        c2.font = { name: "Arial", size: 9 };
                        c2.alignment = {
                          horizontal: "center",
                          vertical: "middle",
                        };
                        c2.border = borda;
                      } else {
                        [0, 1].forEach((o) => {
                          ws.getCell(row + i, col + o).border = borda;
                        });
                      }
                    });
                    ws.getRow(row + i).height = 14;
                  }
                  row += maxRows;

                  const tCam = cam.reduce((a, x) => a + x[1], 0);
                  const tBlu = blu.reduce((a, x) => a + x[1], 0);
                  const tCal = cal.reduce((a, x) => a + x[1], 0);
                  totais.camisa[tm] = tCam;
                  totais.blusa[tm] = tBlu;
                  totais.calca[tm] = tCal;

                  [
                    [1, tCam],
                    [4, tBlu],
                    [7, tCal],
                  ].forEach(([col, total]) => {
                    const c = ws.getCell(row, col);
                    c.value = `TOTAL ${tm}`;
                    c.font = { name: "Arial", bold: true, size: 9 };
                    c.fill = cinzaMedio;
                    c.alignment = { horizontal: "left", vertical: "middle" };
                    c.border = borda;
                    const c2 = ws.getCell(row, col + 1);
                    c2.value = total;
                    c2.font = { name: "Arial", bold: true, size: 9 };
                    c2.fill = cinzaMedio;
                    c2.alignment = { horizontal: "center", vertical: "middle" };
                    c2.border = borda;
                  });
                  ws.getRow(row).height = 15;
                  row += 2;
                });

                row++;
                [
                  [1, "camisa", "TOTAL CAMISETAS"],
                  [4, "blusa", "TOTAL BLUSÕES"],
                  [7, "calca", "TOTAL CALÇAS"],
                ].forEach(([col, key, label]) => {
                  const total = Object.values(totais[key]).reduce(
                    (a, b) => a + b,
                    0,
                  );
                  const c = ws.getCell(row, col);
                  c.value = label;
                  c.font = { name: "Arial", bold: true, size: 11 };
                  c.fill = cinzaEscuro;
                  c.alignment = { horizontal: "left", vertical: "middle" };
                  c.border = borda;
                  const c2 = ws.getCell(row, col + 1);
                  c2.value = total;
                  c2.font = { name: "Arial", bold: true, size: 11 };
                  c2.fill = cinzaEscuro;
                  c2.alignment = { horizontal: "center", vertical: "middle" };
                  c2.border = borda;
                });
                ws.getRow(row).height = 20;
              };

              const ExcelJS = await carregarExcelJS();
              const wb = new ExcelJS.Workbook();
              buildAba(wb, "SERVO", uni.filter((u) => (u.perfil === "servo" || u.perfil === "cozinha") && (u.pagoSinal || u.pagoIntegral) && !u.naoQuerUniforme));
              buildAba(wb, "STAFF", uni.filter((u) => u.perfil !== "servo" && u.perfil !== "cozinha" && (u.pagoSinal || u.pagoIntegral) && !u.naoQuerUniforme));

              wb.xlsx.writeBuffer().then((buffer) => {
                const blob = new Blob([buffer], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "uniformes.xlsx";
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
            style={{
              ...BG({
                width: "100%",
                padding: 12,
                borderRadius: 13,
                fontSize: 13,
                marginBottom: 14,
              }),
              background: "rgba(0,200,81,.15)",
              border: "1px solid rgba(0,200,81,.3)",
              color: G.green,
            }}
          >
            Exportar para Fornecedor (XLSX)
          </button>
        )}

        {uniFiltrado.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhum pedido ainda.
          </div>
        )}
        {uni.filter(u => !u.naoQuerUniforme).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR")).map((u, i) => {
          const pagoIntegral = u.pagoIntegral === true;
          const pagoSinal    = u.pagoSinal === true || pagoIntegral;

          const borderColor =
            pagoIntegral ? G.green :
            pagoSinal    ? "#ff9f0a" :
                          "#ff3b30";

          const statusColor =
            u.status === "pendente"
              ? "#ff9f0a"
              : u.status === "aberto"
                ? "#0a84ff"
                : G.green;
          const statusLabel =
            u.status === "pendente"
              ? "Aguardando aprovacao"
              : u.status === "aberto"
                ? "Liberado para editar"
                : "Pedido realizado";
          return (
            <Acc
              key={i}
              title={u.nome}
              ax={borderColor}
              right={
                <Pill
                  c={statusLabel}
                  bg="rgba(99,99,102,.15)"
                  tc="#636366"
                />
              }
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <Pill
                    c={`Camiseta ${u.camisa} x${u.qtdCamisas || 1}`}
                    bg="#1e1e1e"
                    tc={G.td}
                  />
                  {u.nomeCamiseta && (
                    <Pill
                      c={`Nome: ${u.nomeCamiseta}`}
                      bg="rgba(0,200,81,.1)"
                      tc={G.green}
                    />
                  )}
                  {u.calca && (
                    <Pill c={`Calca ${u.calca} x${u.qtdCalcas || 1}`} bg="#1e1e1e" tc={G.td} />
                  )}
                  {u.blusa && (
                    <Pill c={`Blusa ${u.blusa} x${u.qtdBlusas || 1}`} bg="#1e1e1e" tc={G.td} />
                  )}
                </div>

                {/* PAGAMENTO — via MP, sem toggle */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ color: G.tm, fontSize: 12, fontWeight: 600 }}>Pagamento</span>

                  {/* Sinal — só mostra se não pagou integral */}
                  {!pagoIntegral && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: G.tm, fontSize: 12 }}>Sinal (50%)</span>
                      {pagoSinal
                        ? <Pill c="✓ Pago" bg="rgba(0,200,81,.12)" tc={G.green} />
                        : <Pill c="Pendente" bg="rgba(255,59,48,.1)" tc="#ff6b6b" />
                      }
                    </div>
                  )}

                  {/* Integral */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: G.tm, fontSize: 12 }}>
                      {pagoSinal && !pagoIntegral ? "Restante (50%)" : "Integral"}
                    </span>
                    {pagoIntegral
                      ? <Pill c="✓ Pago" bg="rgba(0,200,81,.12)" tc={G.green} />
                      : <Pill c="Pendente" bg="rgba(255,59,48,.1)" tc="#ff6b6b" />
                    }
                  </div>
                </div>

                <div style={{ color: G.tm, fontSize: 11 }}>
                  Salvo em: {u.data}
                </div>
                {u.status === "pendente" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      onClick={() => aprovar(u.userId)}
                      style={BG({
                        flex: 1,
                        padding: "10px",
                        borderRadius: 12,
                        fontSize: 13,
                      })}
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => reprovar(u.userId)}
                      style={{
                        ...BK({
                          flex: 1,
                          padding: "10px",
                          borderRadius: 12,
                          fontSize: 13,
                        }),
                        borderColor: "rgba(255,59,48,.4)",
                        color: "#ff6b6b",
                      }}
                    >
                      Reprovar
                    </button>
                  </div>
                )}
              </div>
            </Acc>
          );
        })}
      </div>
    );
  }
  function AddFuncao({ u, fns, users, setUsers, t }) {
    const [busca, setBusca] = useState("");
    const [aberto, setAberto] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
    const inputRef = useRef(null);
    const skipBlur = useRef(false);

    const filtrados = fns.filter(
      (f) =>
        f.toLowerCase().includes(busca.toLowerCase()) &&
        busca.length > 0 &&
        !(u.funcoes || []).includes(f),
    );

    const abrirDropdown = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setPos({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
      setAberto(true);
    };

    const dropdown =
      aberto && filtrados.length > 0
        ? ReactDOM.createPortal(
            <div
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                zIndex: 9999,
                background: "#1e1e1e",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {filtrados.map((f, i) => (
                <div
                  key={i}
                  onMouseDown={async () => {
                    skipBlur.current = true;
                    const novas = [...(u.funcoes || []), f];
                    await setDoc(
                      doc(db, "users", u.id),
                      { funcoes: novas },
                      { merge: true },
                    );
                    setUsers(
                      users.map((x) =>
                        x.id === u.id ? { ...x, funcoes: novas } : x,
                      ),
                    );
                    setBusca("");
                    setAberto(false);
                    t("Função adicionada!");
                  }}
                  style={{
                    padding: "10px 14px",
                    color: G.td,
                    fontSize: 13,
                    cursor: "pointer",
                    borderBottom: "1px solid #2a2a2a",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#2a2a2a")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {f}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null;

    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              abrirDropdown();
            }}
            onFocus={abrirDropdown}
            onBlur={() => {
              if (!skipBlur.current) setAberto(false);
              skipBlur.current = false;
            }}
            placeholder="Adicionar função..."
            style={{ ...I, fontSize: 12, padding: "9px 12px", flex: 1 }}
          />
          <button
            onMouseDown={async () => {
              if (!busca.trim()) return;
              skipBlur.current = true;
              const novas = [...(u.funcoes || []), busca.trim()];
              await setDoc(
                doc(db, "users", u.id),
                { funcoes: novas },
                { merge: true },
              );
              setUsers(
                users.map((x) =>
                  x.id === u.id ? { ...x, funcoes: novas } : x,
                ),
              );
              setBusca("");
              t("Função adicionada!");
            }}
            style={BG({ padding: "9px 14px", borderRadius: 10, fontSize: 13 })}
          >
            +
          </button>
        </div>
        {dropdown}
      </div>
    );
  }
  // ── TESTEMUNHOS ──────────────────────────────────────────────────────────────
  function TestV({ encH, encM, t }) {
    const [busca, setBusca] = useState("");
    const [aberto, setAberto] = useState(false);
    const [testemunhos, setTestemunhos] = useState([]);
    const skipBlur = useRef(false);

    useEffect(() => {
      const unsub = onSnapshot(collection(db, "testemunhos"), (snap) => {
        setTestemunhos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }, []);

    const todos = [...encH, ...encM].sort((a, b) =>
      a.nome.localeCompare(b.nome),
    );

    const sugestoes = todos.filter(
      (e) =>
        e.nome.toLowerCase().includes(busca.toLowerCase()) &&
        busca.length > 0 &&
        !testemunhos.find((t) => t.encontristaId === e.id),
    );

    const adicionar = async (enc) => {
      await addDoc(collection(db, "testemunhos"), {
        encontristaId: enc.id,
        nome: enc.nome,
        celula: enc.celula || "",
        criadoEm: new Date().toLocaleString("pt-BR"),
      });
      setBusca("");
      setAberto(false);
      t("Testemunho adicionado! ✓");
    };

    const remover = async (id) => {
      await deleteDoc(doc(db, "testemunhos", id));
      t("Removido.");
    };

    return (
      <div>
        <div
          style={{
            background: "rgba(0,200,81,.08)",
            border: "1px solid rgba(0,200,81,.2)",
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: G.green,
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            Testemunhos no Culto
          </div>
          <div style={{ color: G.tm, fontSize: 12 }}>
            Encontristas que darão testemunho no culto pós-encontro.
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: 14 }}>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => {
              if (!skipBlur.current) setAberto(false);
              skipBlur.current = false;
            }}
            placeholder="Buscar encontrista..."
            style={{ ...I, fontSize: 13 }}
          />
          {aberto && sugestoes.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 999,
                background: "#1e1e1e",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                marginTop: 4,
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {sugestoes.map((e) => (
                <div
                  key={e.id}
                  onMouseDown={() => {
                    skipBlur.current = true;
                    adicionar(e);
                  }}
                  style={{
                    padding: "10px 14px",
                    color: G.td,
                    fontSize: 13,
                    cursor: "pointer",
                    borderBottom: "1px solid #2a2a2a",
                  }}
                  onMouseEnter={(ev) =>
                    (ev.currentTarget.style.background = "#2a2a2a")
                  }
                  onMouseLeave={(ev) =>
                    (ev.currentTarget.style.background = "transparent")
                  }
                >
                  <div style={{ color: G.t, fontWeight: 600 }}>{e.nome}</div>
                  <div style={{ color: G.tm, fontSize: 11 }}>
                    {e.celula || "Sem célula"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {testemunhos.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: "center",
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhum testemunho registrado ainda.
          </div>
        )}

        {testemunhos.map((t2) => (
          <div
            key={t2.id}
            className="fu"
            style={{
              background: G.card,
              border: `1px solid ${G.cb}`,
              borderLeft: `3px solid ${G.green}`,
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ color: G.t, fontWeight: 700, fontSize: 14 }}>
                {t2.nome}
              </div>
              {t2.celula && (
                <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                  {t2.celula}
                </div>
              )}
            </div>
            <span
              onClick={() => remover(t2.id)}
              style={{
                color: "rgba(255,59,48,.5)",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ×
            </span>
          </div>
        ))}
      </div>
    );
  }

export default function App() {
  const [sp, setSp] = useState(true);
  const [spSaindo, setSpSaindo] = useState(false);
  const spSaindoRef = useRef(false);
  // desmonta a splash só depois do fade — antes ela sumia num corte seco
  const fecharSplash = () => {
    if (spSaindoRef.current) return;
    spSaindoRef.current = true;
    setSpSaindo(true);
    setTimeout(() => setSp(false), durMs(280));
  };
  const [scr, setScr] = useState("welcome");
  const [user, setUser] = useState(null);
  const [pg, setPg] = useState("home");
  const pgRef = useRef(pg);
  useEffect(() => { pgRef.current = pg; }, [pg]);
  const menuRef = useRef(false);

  useEffect(() => {
    const safePush = () => {
      try {
        history.pushState({ marker: "buffer" }, "");
      } catch (err) {
        console.warn("history.pushState indisponível neste navegador:", err);
      }
    };
    safePush();
    const onPopState = () => {
      if (menuRef.current) {
        setMenu(false);
        safePush();
        return;
      }
      if (pgRef.current !== "home" && pgRef.current !== "smins") {
        setPg("home");
        safePush();
      }
      // se já está na home, deixa o botão voltar seguir o comportamento padrão
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [menu, setMenu] = useState(false);
  useEffect(() => { menuRef.current = menu; }, [menu]);
  // mantém o drawer montado durante a animação de saída
  const menuP = usePresenca(menu, 220);
  const [pagamentoId, setPagamentoId] = useState(null);
  const [encId, setEncId] = useState(null);
  const [termoCpf, setTermoCpf] = useState(null);
  const [users, setUsers] = useState([]);
  const [faqOpen, setFaqOpen] = useState(false);
  const [fns, setFns] = useState(FUNCOES_INIT);
  const [perfisExtra, setPerfisExtra] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "perfis_extra"), (snap) => {
      const lista = snap.exists() ? (snap.data().lista || []) : [];
      lista.forEach((p) => {
        if (p?.key) PERFIS[p.key] = { l: p.label, c: p.color || "#0a84ff" };
      });
      setPerfisExtra(lista);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "config", "inscricoes"),
      (snap) => {
        setInscricoesBloqueadas(snap.exists() ? !!snap.data().bloqueadas : false);
      },
      (err) => {
        console.error("Erro ao ler status das inscrições (provável regra do Firestore bloqueando leitura pública):", err);
      },
    );
    return () => unsub();
  }, []);

  const salvarInscricoesBloqueadas = async (valor) => {
    try {
      await setDoc(doc(db, "config", "inscricoes"), { bloqueadas: valor }, { merge: true });
      setInscricoesBloqueadas(valor);
      showT(valor ? "Inscrições bloqueadas." : "Inscrições reabertas!");
    } catch (err) {
      console.error("Erro ao salvar status das inscrições:", err);
      showT("Erro ao salvar.", "w");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "config", "funcoes_extra"));
        if (snap.exists()) {
          const extras = snap.data().lista || [];
          if (extras.length > 0) {
            setFns(prev => Array.from(new Set([...prev, ...extras])).sort((a, b) => a.localeCompare(b)));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar funções extras:", err);
      }
    })();
  }, []);

  const [esc, setEsc] = useState([]);
  const [qh, setQh] = useState(QH_INIT);
  const [qm, setQm] = useState(QM_INIT);
  const [on, setOn] = useState(ON_INIT);
  const [mins, setMins] = useState(MINS_INIT);
  const minsLoadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "config", "agenda"));
        if (snap.exists() && Array.isArray(snap.data().lista)) {
          setMins(snap.data().lista);
        } else {
          await setDoc(doc(db, "config", "agenda"), { lista: MINS_INIT });
        }
      } catch (err) {
        console.error("Erro ao carregar agenda:", err);
      } finally {
        minsLoadedRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!minsLoadedRef.current) return;
    setDoc(doc(db, "config", "agenda"), { lista: mins }).catch((err) =>
      console.error("Erro ao salvar agenda:", err),
    );
  }, [mins]);

  const [rest, setRest] = useState(REST_INIT);
  const [ck, setCk] = useState(CK_INIT);
  const [img, setImg] = useState([]);
  const unsubOcorrRef = useRef(null);
  const [ach, setAch] = useState([]);
  const [ocorr, setOcorr] = useState([]);
  const [crac, setCrac] = useState([]);
  const [sau, setSau] = useState([]);
  const [avs, setAvs] = useState([]);
  const [encH, setEncH] = useState([]);
  const [encM, setEncM] = useState([]);
  const [uni, setUni] = useState([]);
  const [dataLimiteUni, setDataLimiteUni] = useState("");
  const [toast, setToast] = useState(null);
  const toastKey = useRef(0);
  const [notif, setNotif] = useState(false);
  const unsubConfigRef = useRef(null);
  const unsubUniRef = useRef(null);
  const unsubAvsRef = useRef(null);
  const unsubEncRef = useRef(null);
  const unsubQHRef = useRef(null);
  const unsubQMRef = useRef(null);
  const unsubOnRef = useRef(null);
  const unsubUsersRef = useRef(null);
  const unsubEscRef = useRef(null);
  const unsubSauRef = useRef(null);
  const enviando = useRef(false);
  const enviandoAviso = useRef(false);
  const [quartoTab, setQuartoTab] = useState("M");
  const [quartosAbertos, setQuartosAbertos] = useState({});
  const [dataLimitePagamento, setDataLimitePagamento] = useState("");
  const [inscricoesBloqueadas, setInscricoesBloqueadas] = useState(false);
  const [avTextoServo, setAvTextoServo] = useState("");
  const [avPublicoServo, setAvPublicoServo] = useState("todos");
  const enviandoAvisoServoRef = useRef(false);
  const [dataLimitePedido, setDataLimitePedido] = useState("");
  const [dataLimiteRestante, setDataLimiteRestante] = useState("");
  const [backExpandidos, setBackExpandidos] = useState({});
  const [permissoes, setPermissoes] = useState({});
  const [backTab, setBackTab] = useState("grupos");
  const [backGruposAbertos, setBackGruposAbertos] = useState({});
  const backBuscaUserRef = useRef("");
  const unsubPermRef = useRef(null);

  // Inicializa quarto mães se não existir
  const inicializarQuartoMaes = async () => {
    const ref = doc(db, "quartos_m", "12");
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { num: 12, maes: true, lim: 9, servos: [], enc: [] });
    }
  };

  const salvarQuarto = async (colecao, quarto) => {
    await setDoc(doc(db, colecao, String(quarto.num)), quarto);
  };

  const deletarQuarto = async (colecao, num) => {
    await deleteDoc(doc(db, colecao, String(num)));
  };

  const salvarOnibus = async (onibus) => {
    await setDoc(doc(db, "onibus", String(onibus.num)), onibus);
  };

  const deletarOnibus = async (num) => {
    await deleteDoc(doc(db, "onibus", String(num)));
  };

  useEffect(() => {
    // Timeout de segurança: se o Firebase Auth não responder em 6s
    // (comum em WebViews do Instagram/WhatsApp no iOS que bloqueiam indexedDB),
    // libera a splash e manda para a tela de boas-vindas em vez de travar para sempre.
    const spTimeout = setTimeout(() => {
      if (!spSaindoRef.current) {
        console.warn("Firebase Auth não respondeu a tempo — liberando splash.");
        setScr((s) => (s === "welcome" ? "welcome" : s));
        fecharSplash();
      }
    }, 6000);
    return () => clearTimeout(spTimeout);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    console.log("URL params:", window.location.search);
    // Termo digital
    const termo = params.get("termo");
    const cpf = params.get("cpf");
    if (termo === "true" && cpf) {
      setTermoCpf(cpf);
      setScr("termo");
      fecharSplash();
      return;
    }

    const qr = params.get("qr");
    const qrId = params.get("id");
    if (qr === "true" && qrId) {
      setEncId(qrId);
      setScr("pagamento_confirmado");
      fecharSplash();
      return;
    }
    const pago = params.get("pago");
    const id = params.get("id");
    const statusMP = params.get("status");
    console.log('URL params:', window.location.search);
    const externalRef = params.get("external_reference");

    if (pago === "true" && id) {
      setScr("pagamento_confirmado");
      setEncId(id);  // ← troca setPagamentoId por setEncId
      window.history.replaceState({}, "", "/");
    } else if (pago === "pending" && id) {
      setScr("pagamento_pendente");
      setPagamentoId(id);
      window.history.replaceState({}, "", "/");
    } else if (statusMP === "pending" && externalRef) {
      setScr("pagamento_pendente");
      setPagamentoId(externalRef);
      window.history.replaceState({}, "", "/");
    } else if (statusMP === "approved" && externalRef) {
      setScr("pagamento_confirmado");
      setEncId(externalRef);
      window.history.replaceState({}, "", "/");
    }

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        inicializarQuartoMaes();
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();

          if (data.ativo === false) {
            await signOut(auth);
            fecharSplash();
            setScr("login");
            return;
          }

          setUser({ id: firebaseUser.uid, ...data });
          setScr("app");
          if (data.perfil === "servo") setPg("smins");

          unsubEscRef.current = onSnapshot(collection(db, "equipes"), (s) => {
            setEsc(s.docs.map((d) => ({ id: d.id, ...d.data() })));
          });

          unsubConfigRef.current = onSnapshot(doc(db, "config", "uniformes"), (s) => {
            if (s.exists()) {
              if (s.data().dataLimite) setDataLimiteUni(s.data().dataLimite);
              if (s.data().dataLimitePagamento) setDataLimitePagamento(s.data().dataLimitePagamento);
              if (s.data().dataLimitePedido) setDataLimitePedido(s.data().dataLimitePedido);
              if (s.data().dataLimiteRestante) setDataLimiteRestante(s.data().dataLimiteRestante);
            }
          });

          unsubUsersRef.current = onSnapshot(collection(db, "users"), (s) => {
            setUsers(s.docs.map((d) => {
              const data = d.data();
              const tipo = data.tipo || (
                data.perfil === "staff" ? "staff" :
                data.perfil?.startsWith("lider_") ? "lider" :
                "servo"
              );
              return { id: d.id, ...data, tipo };
            }));
          });

          unsubUniRef.current = onSnapshot(collection(db, "uniformes"), (s) => {
            setUni(s.docs.map((d) => ({ userId: d.id, ...d.data() })));
          });

          unsubAvsRef.current = onSnapshot(collection(db, "avisos"), (s) => {
            setAvs(
              s.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => b.createdAt - a.createdAt),
            );
          });

          unsubEncRef.current = onSnapshot(
            collection(db, "encontristas"),
            (s) => {
              const lista = s.docs.map((d) => ({ id: d.id, ...d.data() }));
              setEncM(lista.filter((e) => e.sexo === "Feminino"));
              setEncH(lista.filter((e) => e.sexo === "Masculino"));
              setCk(
                lista
                  // desistiu tem prioridade: registros antigos podem ter ficado
                  // com pagarDepois:true junto da desistência
                  .filter((e) => e.pago || (e.pagarDepois && !e.desistiu))
                  .map((e) => ({
                    id: e.id,
                    nome: e.nome,
                    gen: e.sexo === "Feminino" ? "M" : "H",
                    ok: e.chegou || false,
                    on: e.onibus || null,
                    whatsapp: e.whatsapp || null,
                    cpf: e.cpf || null,
                  })),
              );
            },
          );

          unsubQHRef.current = onSnapshot(collection(db, "quartos_h"), (s) => {
            if (!s.empty)
              setQh(s.docs.map((d) => d.data()).sort((a, b) => a.num - b.num));
          });

          unsubQMRef.current = onSnapshot(collection(db, "quartos_m"), (s) => {
            if (!s.empty)
              setQm(s.docs.map((d) => d.data()).sort((a, b) => a.num - b.num));
          });

          unsubOnRef.current = onSnapshot(collection(db, "onibus"), (s) => {
            setOn(
              s.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => a.num - b.num),
            );
          });
          
          unsubSauRef.current = onSnapshot(collection(db, 'saude'), (s) => {
            setSau(s.docs.map((d) => ({ id: d.id, ...d.data() })));
          });

          unsubOcorrRef.current = onSnapshot(collection(db, "ocorrencias"), (s) => {
            setOcorr(s.docs.map(d => d.data()).sort((a, b) => b.id - a.id));
          });

          unsubPermRef.current = onSnapshot(collection(db, "permissoes"), (s) => {
            const p = {};
            s.docs.forEach(d => { p[d.id] = d.data(); });
            setPermissoes(p);
          });

          if (Notification.permission !== "denied") {
            iniciarNotificacoes(firebaseUser.uid).then((token) => {
              if (token) setNotif(true);
            });
          }
        } else {
          setScr("welcome");
        }
      } else {
        unsubConfigRef.current?.();
        unsubUniRef.current?.();
        unsubAvsRef.current?.();
        unsubEncRef.current?.();
        unsubQHRef.current?.();
        unsubQMRef.current?.();
        unsubOnRef.current?.();
        unsubUsersRef.current?.();
        unsubEscRef.current?.();
        unsubSauRef.current?.();
        unsubPermRef.current?.();
        setScr("welcome");
      }
      fecharSplash();
    });

    return () => {
      unsubAuth();
      unsubConfigRef.current?.();
      unsubUniRef.current?.();
      unsubAvsRef.current?.();
      unsubEncRef.current?.();
      unsubQHRef.current?.();
      unsubQMRef.current?.();
      unsubOnRef.current?.();
      unsubUsersRef.current?.();
      unsubEscRef.current?.();
    };
  }, []);

  const salvarDataLimite = async (data) => {
    setDataLimiteUni(data);
    await setDoc(
      doc(db, "config", "uniformes"),
      { dataLimite: data },
      { merge: true },
    );
  };

  const temPermissao = (tela) => {
    if (role === "admin") return true;
    if (role === "lider_geral") return true;
    const telasFixas = ["mins", "avisos", "uniforme", "info", "cartas"];
    if (telasFixas.includes(tela)) return true;
    // Telas extras atribuídas individualmente ao usuário
    if ((user?.telasExtra || []).includes(tela)) return true;
    const p = permissoes[role];
    if (!p) return false;
    return (p.telas || []).includes(tela);
  };

  // `k` reinicia a animação quando um toast chega em cima do outro;
  // `saindo` toca o fade de saída antes de desmontar.
  const toastTimers = useRef([]);
  const showT = (m, tp = "s") => {
    toastTimers.current.forEach(clearTimeout);
    toastTimers.current = [];
    setToast({ m, tp, k: toastKey.current++, saindo: false });
    toastTimers.current.push(
      setTimeout(() => setToast((cur) => (cur ? { ...cur, saindo: true } : cur)), 2500),
      setTimeout(() => setToast(null), 2500 + durMs(220)),
    );
  };
  const nav = (p) => {
    setPg(p);
    setMenu(false);
  };
  const logout = async () => {
    unsubConfigRef.current?.();
    unsubUniRef.current?.();
    unsubAvsRef.current?.();
    unsubEncRef.current?.();
    unsubQHRef.current?.();
    unsubQMRef.current?.();
    unsubOnRef.current?.();
    unsubUsersRef.current?.();
    unsubEscRef.current?.();
    unsubOcorrRef.current?.();
    await signOut(auth);
    setUser(null);
    setScr("welcome");
    setPg("home");
  };

  const login = (f) => {
    setUser(f);
    setScr("app");
    const admins = ["admin", "lider_geral", "pastor"];
    if (!admins.includes(f.perfil)) setPg("smins");
  };

  const role = user?.perfil || "servo";
  const isAdm = role === "admin" || role === "lider_geral";
  const [liderMapOverrides, setLiderMapOverrides] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "config", "lider_map"));
        if (snap.exists()) {
          setLiderMapOverrides(snap.data() || {});
        }
      } catch (err) {
        console.error("Erro ao carregar lider_map:", err);
      }
    })();
  }, []);

  const canExtra = (tela) => (user?.telasExtra || []).includes(tela);
  const [ckSub, setCkSub] = useState("pend");
  const [ckGen, setCkGen] = useState("M");
  const [termoBusca, setTermoBusca] = useState("");

  const uQH = (n, fn) => setQh(prev => prev.map((q) => (q.num === n ? fn(q) : q)));
  const uQM = (n, fn) => setQm(prev => prev.map((q) => (q.num === n ? fn(q) : q)));
  const uOn = (n, fn) => setOn(on.map((o) => (o.num === n ? fn(o) : o)));
  const uEs = (id, fn) => setEsc(esc.map((e) => (e.id === id ? fn(e) : e)));
  const broadcast = (msg) => {
    if (
      notif &&
      "Notification" in window &&
      Notification.permission === "granted"
    )
      new Notification("🔔 servos.", { body: msg });
  };
  const sN = (nm, hr) => {
    broadcast(`${nm} — ${hr}`);
    showT(`${nm} — ${hr}`, "n");
  };
  const notifyAll = async (msg, publico = "todos") => {
    if (enviando.current) return;
    enviando.current = true;
    showT(msg, "n");
    try {
      await fetch(
        "https://us-central1-servos-peniel.cloudfunctions.net/notificarMinisterio",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titulo: msg, horario: "", publico }),
        },
      );
    } catch (err) {
      console.error("Erro ao notificar:", err);
    }
    enviando.current = false;
  };

  if (sp) return <Splash saindo={spSaindo} />;

  if (faqOpen) return <FAQ onVoltar={() => setFaqOpen(false)} />;

  if (scr === "pagamento_confirmado")
    return <ConfirmadoV encId={encId} onVoltar={() => setScr("welcome")} />;

  if (scr === "pagamento_pendente")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
          <img
            src="/IMG_2408.PNG"
            alt="Encontro com Deus"
            style={{
              width: 180,
              mixBlendMode: "screen",
              display: "block",
              margin: "0 auto 24px",
            }}
          />
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Pagamento pendente!
          </div>
          <div
            style={{
              color: "rgba(255,255,255,.5)",
              fontSize: 16,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            Seu pagamento está sendo processado. Assim que confirmado sua vaga
            será garantida!
          </div>
          <a
            href="https://wa.me/5511982222149?text=Olá!%20Realizei%20o%20pagamento%20do%20Encontro%20com%20Deus%20e%20gostaria%20de%20confirmar%20minha%20inscrição."
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              background: "#25d366",
              color: "#fff",
              textDecoration: "none",
              padding: "14px",
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 12,
            }}
          >
            Enviar comprovante no WhatsApp
          </a>
          <button
            onClick={() => setScr("welcome")}
            style={BK({ width: "100%", padding: 14, borderRadius: 14 })}
          >
            Voltar ao início
          </button>
        </div>
        <BotaoAjuda />
        <BotaoInsta />
      </div>
    );

  if (scr === "welcome")
  return (
    <Welcome
      onServos={() => setScr("login")}
      onEncontrista={() => setScr("inscricao")}
      onFaq={() => setFaqOpen(true)}
      onJaInscrito={() => setScr('ja_inscrito')}
      bloqueadas={inscricoesBloqueadas}
    />
  );

  if (scr === "inscricao" && inscricoesBloqueadas) {
    return (
      <Welcome
        onServos={() => setScr("login")}
        onEncontrista={() => {}}
        onFaq={() => setFaqOpen(true)}
        onJaInscrito={() => setScr('ja_inscrito')}
        bloqueadas={inscricoesBloqueadas}
      />
    );
  }

  if (scr === "inscricao")
    return (
      <Inscricao
        onVoltar={() => setScr("welcome")}
        onPago={(id) => {
          setEncId(id);
          setScr("pagamento_confirmado");
        }}
        onFaq={() => setFaqOpen(true)}
      />
    );

  if (scr === "termo")
    return <Termo cpf={termoCpf} onVoltar={() => setScr("welcome")} />;

  if (scr === 'ja_inscrito')
    return <JaInscritoV onVoltar={() => setScr('welcome')} bloqueadas={inscricoesBloqueadas} />;

  if (user?.primeiro) return (
    <PrimeiroAcessoV 
      user={user} 
      onConcluido={() => setUsers(prev => prev.map(u => u.id === user.id ? { ...u, primeiro: false } : u))} 
    />
  );

  if (scr === "login")
    return (
      <Login
        onLogin={login}
        onVoltar={() => setScr("welcome")}
        users={users}
        setUsers={setUsers}
      />
    );

  // menu drawer
  const MENU_ITEMS = [
    [Home, "home"],
    ...(temPermissao("servos") ? [[Users, "servos"]] : []),
    ...(temPermissao("enc") ? [[Users, "enc"]] : []),
    ...(temPermissao("checkin") ? [[CheckSquare, "checkin"]] : []),
    ...(temPermissao("termo") ? [[FileText, "termo"]] : []),
    ...(temPermissao("quartos") ? [[BedDouble, "quartos"]] : []),
    ...(temPermissao("onibus") ? [[Bus, "onibus"]] : []),
    ...(temPermissao("mins") ? [[Calendar, "mins"]] : []),
    ...(temPermissao("rest") ? [[ShieldOff, "rest"]] : []),
    ...(temPermissao("img") ? [[Image, "img"]] : []),
    ...(temPermissao("info") ? [[AlertTriangle, "info"]] : []),
    ...(temPermissao("ach") ? [[Search, "ach"]] : []),
    ...(temPermissao("crac") ? [[CreditCard, "crac"]] : []),
    ...(temPermissao("saude") ? [[PillIcon, "saude"]] : []),
    ...((role === "lider_cartas" || isAdm) ? [[FileText, "cartas"]] : []),
    ...(temPermissao("uniformes") ? [[Shirt, "uniformes"]] : []),
    ...(temPermissao("cozinha") ? [[ChefHat, "cozinha"]] : []),
    ...(temPermissao("test") ? [[HandHeart, "test"]] : []),
    ...(isAdm ? [[Settings, "back"]] : []),
  ];


    if (scr === "app" && !["admin", "lider_geral", "pastor"].includes(role)) {

    const MAPA_SERVO = {
      "perfil": [User, "sperfil", "Perfil"],
      "mins": [Calendar, "smins", "Agenda"],
      "avisos": [Megaphone, "savs", "Avisos"],
      "uniforme": [Shirt, "suni", "Uniforme"],
      "info": [AlertTriangle, "sinfo", "Ocorrências"],
      "rest": [ShieldOff, "srest", "Restrições"],
      "img": [Image, "simg", "Uso de Imagem"],
      "saude": [PillIcon, "ssaude", "Saúde"],
      "quartos": [BedDouble, "squartos", "Quartos"],
      "checkin": [CheckSquare, "scheckin", "Check-in"],
      "onibus": [Bus, "sonibus", "Ônibus"],
      "termo": [FileText, "stermo", "Termo"],
      "ach": [Search, "sach", "Achados & Perdidos"],
      "crac": [CreditCard, "scrac", "Crachás"], 
      "cartas": [FileText, "scartas", "Cartas"],
    };

    const SERVO_MENU = Object.entries(MAPA_SERVO)
      .filter(([tela]) => {
        if (tela === "perfil") return true;
        if (tela === "rest") return role === "lider_celula" || user?.liderCelula === true;
        if (tela === "img") return role === "lider_midia" || Object.values(user?.escala || {}).flat().includes("Mídia");
        return temPermissao(tela);
      })
      .map(([, item]) => item);

    return (
      <div style={{ minHeight: "100vh", background: G.bg, paddingBottom: 60 }}>
        {toast && <Toast key={toast.k} m={toast.m} tp={toast.tp} saindo={toast.saindo} />}
        {menuP.montado && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200 }} className={menuP.saindo ? "out" : undefined}>
            <div
              onClick={() => setMenu(false)}
              className={`scrim${menuP.saindo ? " out" : ""}`}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,.85)",
              }}
            />
            <div
              className={`drawer${menuP.saindo ? " out" : ""}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: 270,
                background: "#0d0d0d",
                borderRight: "1px solid #1a1a1a",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  padding: "22px 16px 16px",
                  borderBottom: "1px solid #1a1a1a",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#fff",
                      letterSpacing: -1,
                    }}
                  >
                    Peniel<span style={{ color: G.green }}>.</span>
                  </div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 3 }}>
                    {user.nome} · {PERFIS[role]?.l}
                  </div>
                </div>
                <button
                  onClick={() => setMenu(false)}
                  style={BK({
                    padding: "6px 10px",
                    borderRadius: 9,
                    fontSize: 12,
                  })}
                >
                  ✕
                </button>
              </div>
              {SERVO_MENU.map(([ic, p, lb]) => (
                <button
                  key={p}
                  onClick={() => {
                    setPg(p);
                    setMenu(false);
                  }}
                  className="press"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    background: pg === p ? "rgba(0,200,81,.08)" : "transparent",
                    border: "none",
                    borderLeft:
                      pg === p
                        ? `3px solid ${G.green}`
                        : "3px solid transparent",
                    padding: "12px 16px",
                    color: pg === p ? G.green : G.td,
                    fontSize: 13,
                    fontWeight: pg === p ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {(() => { const Icon = ic; return <Icon size={16} style={{ flexShrink: 0, width: 18 }} />; })()}
                  {lb}
                </button>
              ))}
              <button
                onClick={() => {
                  setMenu(false);
                  logout();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderLeft: "3px solid transparent",
                  borderTop: "1px solid #1a1a1a",
                  padding: "12px 16px",
                  color: "rgba(255,59,48,.6)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  textAlign: "left",
                  marginTop: 8,
                }}
              >
                <LogOut size={16} style={{ width: 18 }} />
                Sair
              </button>
            </div>
          </div>
        )}
        {/* top bar servo */}
        <div style={{
          background: "#000",
          borderBottom: "1px solid #1a1a1a",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          {/* Esquerda */}
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
            {(pg === "smins" || pg === "home") ? (
              <button onClick={() => setMenu(true)} style={BK({ padding: "8px 12px", borderRadius: 10, fontSize: 16 })}>☰</button>
            ) : (
              <button onClick={() => setPg("smins")} style={BK({ padding: "8px 13px", borderRadius: 10, fontSize: 13, fontWeight: 700 })}>←</button>
            )}
          </div>

          {/* Centro */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            {(pg === "smins" || pg === "home") ? (
              <img src="/IMG_2409.PNG" alt="Fonte" style={{ height: 44, opacity: 0.85 }} />
            ) : (
              <span key={pg} className="tt" style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>
                {pg === "sperfil" ? "Perfil"
                : pg === "savs" ? "Avisos"
                : pg === "suni" ? "Uniforme"
                : pg === "sinfo" ? "Ocorrências"
                : pg === "srest" ? "Restrições"
                : pg === "simg" ? "Uso de Imagem"
                : pg === "ssaude" ? "Saúde"
                : pg === "squartos" ? "Quartos"
                : pg === "scozinha" ? "Cozinha"
                : pg === "scheckin" ? "Check-in"
                : pg === "sonibus" ? "Ônibus"
                : pg === "senc" ? "Encontristas"
                : pg === "stermo" ? "Termo"
                : pg === "sach" ? "Achados & Perdidos"
                : pg === "scrac" ? "Crachás"
                : pg === "scartas" ? "Cartas"
                : ""}
              </span>
            )}
          </div>

          {/* Direita */}
          <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
            {(pg === "smins" || pg === "home") && user.pago && <Pill c="Pago ✓" bg="rgba(0,200,81,.15)" tc={G.green} />}
            {(pg === "smins" || pg === "home") && <Pill c={PERFIS[user.perfil]?.l || user.perfil} bg={`${PERFIS[user.perfil]?.c || G.green}18`} tc={PERFIS[user.perfil]?.c || G.green} />}
            <button
              onClick={async () => {
                const token = await iniciarNotificacoes(user?.id);
                if (token) { setNotif(true); showT("Notificações ativas!", "n"); }
                else showT("Permissão negada", "w");
              }}
              style={{ ...BK({ padding: "8px 11px", borderRadius: 10, fontSize: 13, borderColor: notif ? "rgba(0,200,81,.4)" : "#2a2a2a", color: notif ? G.green : G.td }), display: "flex", alignItems: "center" }}>
              <Bell size={16} />
            </button>
          </div>
        </div>
        {/* home com 3 cards */}
        {(pg === "smins" || pg === "home") && (
          <ServoHomeV
            liderMapOverrides={liderMapOverrides}
            user={user}
            mins={mins}
            avs={avs}
            ocorr={ocorr}
            setPg={setPg}
            pago={user?.pago}
            role={role}
            uni={uni}
            dataLimiteUni={dataLimiteUni}
            dataLimitePagamento={dataLimitePagamento}
            esc={esc}
            users={users}
            qh={qh}
            qm={qm}
            on={on}
          />
        )}
        <div
          key={pg}
          className="pg"
          style={{ padding: "16px 16px 0", maxWidth: 480, margin: "0 auto" }}
        >
          {pg === "sperfil" && <PerfilV user={user} setUser={setUser} t={showT} />}
          {pg === "savs" && (
            <div>
              {canAvisos(role) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  <select
                    onChange={(e) => { if (e.target.value) setAvTextoServo(e.target.value); }}
                    style={{ ...I, fontSize: 12 }}
                    defaultValue=""
                  >
                    <option value="">Usar template de aviso...</option>
                    {AVISOS_TEMPLATES.map((a, i) => (
                      <option key={i} value={a.txt}>{a.txt.substring(0, 50)}...</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["todos", "Todos"], ["homens", "Homens"], ["mulheres", "Mulheres"]].map(([k, l]) => (
                      <button
                        key={k}
                        onClick={() => setAvPublicoServo(k)}
                        style={{
                          flex: 1,
                          padding: "8px 6px",
                          borderRadius: 9,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: `1px solid ${avPublicoServo === k ? "#0a84ff" : "#2a2a2a"}`,
                          background: avPublicoServo === k ? "rgba(10,132,255,.12)" : "#1a1a1a",
                          color: avPublicoServo === k ? "#0a84ff" : G.td,
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={avTextoServo}
                      onChange={(e) => setAvTextoServo(e.target.value)}
                      placeholder="Escrever aviso..."
                      style={{ ...I, flex: 1 }}
                    />
                    <button
                      onClick={async () => {
                        if (enviandoAvisoServoRef.current) return;
                        if (!avTextoServo.trim()) return;
                        enviandoAvisoServoRef.current = true;
                        vibrar(100);
                        const txt = avTextoServo.trim();
                        const publico = avPublicoServo;
                        setAvTextoServo("");
                        const aviso = {
                          txt,
                          autor: user.nome,
                          autorPerfil: role,
                          publico,
                          hr: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                          createdAt: Date.now(),
                        };
                        await addDoc(collection(db, "avisos"), aviso);
                        notifyAll(`Aviso: ${txt}`, publico);
                        showT("Aviso publicado!");
                        setTimeout(() => { enviandoAvisoServoRef.current = false; }, 1500);
                      }}
                      style={BG({ padding: "13px 15px", borderRadius: 12 })}
                    >+</button>
                  </div>
                </div>
              )}
              {avs.length === 0 && (
                <div
                  style={{
                    color: G.tm,
                    textAlign: "center",
                    padding: 48,
                    fontSize: 13,
                  }}
                >
                  Nenhum aviso no momento. ✓
                </div>
              )}
              {avs.map((a) => (
                <div
                  key={a.id}
                  className="fu"
                  style={{
                    background: G.card,
                    border: `1px solid ${G.cb}`,
                    borderLeft: `3px solid ${G.green}`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ color: G.t, fontSize: 13, lineHeight: 1.6 }}>
                    {a.txt}
                  </div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    {a.autor}{a.autorPerfil && PERFIS[a.autorPerfil] ? ` · ${PERFIS[a.autorPerfil].l}` : ""} · {a.hr}
                    {a.publico === "homens" && <Pill c="Homens" bg="rgba(10,132,255,.12)" tc="#0a84ff" />}
                    {a.publico === "mulheres" && <Pill c="Mulheres" bg="rgba(255,45,146,.12)" tc="#ff2d92" />}
                  </div>
                  {canAvisos(role) && (
                    <span
                      onClick={async () => { await deleteDoc(doc(db, "avisos", a.id)); }}
                      style={{ color: "rgba(255,59,48,.6)", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "inline-block", marginTop: 6 }}
                    >
                      Excluir
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {pg === "suni" && (
            <UniV
              uni={uni}
              setUni={setUni}
              dataLimite={dataLimiteUni}
              setDataLimite={salvarDataLimite}
              dataLimitePagamento={dataLimitePagamento}
              user={user}
              role={role}
              edit={isAdm}
              dataLimitePedido={dataLimitePedido}
              dataLimiteRestante={dataLimiteRestante}
              t={showT}
            />
          )}
          {pg === "srest" && (role === "lider_celula" || user?.liderCelula === true) && (
            <ServoRestV user={user} encH={encH} encM={encM} t={showT} />
          )}
          {pg === "simg" && <ImgV encH={encH} encM={encM} />}
          {pg === "sinfo" && (
            <InfoV ocorr={ocorr} setOcorr={setOcorr} t={showT} notifyAll={notifyAll} user={user} />
          )}
          {pg === "squartos" && (
            temPermissao("quartos")
              ? <QV qh={qh} qm={qm} uQH={uQH} uQM={uQM} setQh={setQh} setQm={setQm} edit={canQ(role) || canExtra("quartos")} t={showT} encH={encH} encM={encM} users={users} salvarQuarto={salvarQuarto} deletarQuarto={deletarQuarto} tab={quartoTab} setTab={setQuartoTab} abertos={quartosAbertos} setAbertos={setQuartosAbertos} user={user} />
              : <TelaRestrita />
          )}
          {pg === "scheckin" && (
            temPermissao("checkin") 
              ? <CkV ck={ck} setCk={setCk} on={on} edit={
                  Object.values(user?.escala || {}).flat().includes("Check-in")
                } t={showT} sub={ckSub} setSub={setCkSub} gen={ckGen} setGen={setCkGen} setPg={setPg} setTermoBusca={setTermoBusca} /> 
              : <TelaRestrita />
          )}
          {pg === "stermo" && (
            temPermissao("termo") ? <TermoAdminV encH={encH} encM={encM} t={showT} buscaInicial={termoBusca} /> : <TelaRestrita />
          )}
          {pg === "sach" && (
            temPermissao("ach") ? <AchV ach={ach} setAch={setAch} t={showT} /> : <TelaRestrita />
          )}
          {pg === "scrac" && (
            temPermissao("crac") ? <ListV icon="🪪" color={G.green} items={crac} setItems={setCrac} edit={isAdm || canExtra("crac")} t={showT} ph="Nome do encontrista..." /> : <TelaRestrita />
          )}
          {pg === "scartas" && (
            <CartasV users={users} user={user} role={role} t={showT} />
          )}
          {pg === "sonibus" && (
            temPermissao("onibus") ? <OnV on={on} uOn={uOn} setOn={setOn} encH={encH} encM={encM} edit={isAdm || canExtra("onibus")} t={showT} salvarOnibus={salvarOnibus} deletarOnibus={deletarOnibus} users={users} /> : <TelaRestrita />
          )}
          {pg === "senc" && (
            temPermissao("enc") ? <EncV encH={encH} setEncH={setEncH} encM={encM} setEncM={setEncM} qh={qh} qm={qm} setQh={setQh} setQm={setQm} edit={isAdm || canExtra("enc")} t={showT} inscricoesBloqueadas={inscricoesBloqueadas} salvarInscricoesBloqueadas={salvarInscricoesBloqueadas} /> : <TelaRestrita />
          )}
          {pg === "scozinha" && (
            temPermissao("cozinha") ? <CozinhaV edit={isAdm || canExtra("cozinha")} t={showT} users={users} /> : <TelaRestrita />
          )}
          {pg === "ssaude" && (
            <SauV sau={sau} setSau={setSau} edit={isAdm || canExtra("saude")} t={showT} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: G.bg, paddingBottom: 60 }}>
      {toast && <Toast key={toast.k} m={toast.m} tp={toast.tp} saindo={toast.saindo} />}
      {menuP.montado && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} className={menuP.saindo ? "out" : undefined}>
          <div
            onClick={() => setMenu(false)}
            className={`scrim${menuP.saindo ? " out" : ""}`}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,.85)",
            }}
          />
          <div
            className={`drawer${menuP.saindo ? " out" : ""}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 270,
              background: "#0d0d0d",
              borderRight: "1px solid #1a1a1a",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                padding: "22px 16px 16px",
                borderBottom: "1px solid #1a1a1a",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: -1,
                  }}
                >
                  Peniel<span style={{ color: G.green }}>.</span>
                </div>
                <div style={{ color: G.tm, fontSize: 11, marginTop: 3 }}>
                  {user.nome} · {PERFIS[role]?.l}
                </div>
              </div>
              <button
                onClick={() => setMenu(false)}
                style={BK({
                  padding: "6px 10px",
                  borderRadius: 9,
                  fontSize: 12,
                })}
              >
                ✕
              </button>
            </div>
            {MENU_ITEMS.map(([ic, p]) => (
              <button
                key={p}
                onClick={() => nav(p)}
                className="press"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  background: pg === p ? "rgba(0,200,81,.08)" : "transparent",
                  border: "none",
                  borderLeft:
                    pg === p ? `3px solid ${G.green}` : "3px solid transparent",
                  padding: "12px 16px",
                  color: pg === p ? G.green : G.td,
                  fontSize: 13,
                  fontWeight: pg === p ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {(() => { const Icon = ic; return <Icon size={16} color="currentColor" style={{ flexShrink: 0, width: 18 }} />; })()}
                <span style={{ flex: 1 }}>{LABELS[p]}</span>
                {p === "uniformes" &&
                  uni.filter((u) => u.status === "pendente").length > 0 && (
                    <span
                      style={{
                        background: "#ff9f0a",
                        color: "#000",
                        borderRadius: 50,
                        fontSize: 10,
                        fontWeight: 800,
                        padding: "2px 7px",
                        minWidth: 18,
                        textAlign: "center",
                      }}
                    >
                      {uni.filter((u) => u.status === "pendente").length}
                    </span>
                  )}
              </button>
            ))}
            <button
              onClick={() => {
                setMenu(false);
                logout();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                background: "transparent",
                border: "none",
                borderLeft: "3px solid transparent",
                borderTop: "1px solid #1a1a1a",
                padding: "12px 16px",
                color: "rgba(255,59,48,.6)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                marginTop: 8,
              }}
            >
              <span style={{ fontSize: 16, width: 18, textAlign: "center" }}>
                ↪
              </span>
              Sair
            </button>
          </div>
        </div>
      )}
      <TB pg={pg} user={user} nav={nav} showT={showT} setMenu={setMenu} notif={notif} setNotif={setNotif} />
      <div key={pg} className="pg" style={{ padding: "16px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        {pg === "home" && (
          <HomeV
            enviandoAviso={enviandoAviso}
            role={role}
            user={user}
            ck={ck}
            mins={mins}
            ocorr={ocorr}
            avs={avs}
            qh={qh}
            qm={qm}
            on={on}
            nav={nav}
            edit={canG(role)}
            canAvisos={canAvisos(role)}
            encH={encH}
            encM={encM}
            addAv={async (txt, publico = "todos") => {
              const aviso = {
                txt,
                autor: user.nome,
                autorPerfil: role,
                publico,
                hr: new Date().toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                createdAt: Date.now(),
              };
              await addDoc(collection(db, "avisos"), aviso);
              notifyAll(`Aviso: ${txt}`, publico);
              showT("Aviso publicado!");
            }}
            delAv={async (id) => {
              await deleteDoc(doc(db, "avisos", id));
            }}
            users={users}
          />
        )}
        {pg === "checkin" && (
          <CkV ck={ck} setCk={setCk} on={on} edit={canG(role) || canExtra("checkin")} t={showT} sub={ckSub} setSub={setCkSub} gen={ckGen} setGen={setCkGen} setPg={setPg} setTermoBusca={setTermoBusca} telaTermo="termo" />
        )}
        {pg === "mins" && (
          <MinsV
            mins={mins}
            setMins={setMins}
            edit={canG(role)}
            role={role}
            t={showT}
            sN={sN}
          />
        )}
        {pg === "quartos" && (
          <QV
            qh={qh}
            qm={qm}
            uQH={uQH}
            uQM={uQM}
            setQh={setQh}
            setQm={setQm}
            edit={canQ(role) || canExtra("quartos")}
            t={showT}
            encH={encH}
            encM={encM}
            users={users}
            salvarQuarto={salvarQuarto}
            deletarQuarto={deletarQuarto}
            tab={quartoTab}
            setTab={setQuartoTab}
            abertos={quartosAbertos}
            setAbertos={setQuartosAbertos}
            user={user}
          />
        )}
        {pg === "enc" && (
          <EncV
            encH={encH}
            setEncH={setEncH}
            encM={encM}
            setEncM={setEncM}
            qh={qh}
            qm={qm}
            setQh={setQh}
            setQm={setQm}
            edit={canG(role)}
            t={showT}
            inscricoesBloqueadas={inscricoesBloqueadas}
            salvarInscricoesBloqueadas={salvarInscricoesBloqueadas}
          />
        )}
        {pg === "onibus" && (
          <OnV
            on={on}
            uOn={uOn}
            setOn={setOn}
            encH={encH}
            encM={encM}
            edit={canG(role)}
            t={showT}
            salvarOnibus={salvarOnibus}
            deletarOnibus={deletarOnibus}
            users={users}
          />
        )}
        {pg === "rest" && (
          <RestV
            users={users}
            encH={encH}
            encM={encM}
            qm={qm}
            setQm={setQm}
            role={role}
            t={showT}
          />
        )}
        {pg === "img" && <ImgV encH={encH} encM={encM} />}
        {pg === "info" && (
          <InfoV
            ocorr={ocorr}
            setOcorr={setOcorr}
            t={showT}
            notifyAll={notifyAll}
            user={user}
          />
        )}
        {pg === "ach" && <AchV ach={ach} setAch={setAch} t={showT} />}
        {pg === "crac" && (
          <ListV icon="🪪" color={G.green} items={crac} setItems={setCrac} edit={canG(role)} t={showT} ph="Nome do encontrista..." />
        )}
        {pg === "termo" && <TermoAdminV encH={encH} encM={encM} t={showT} buscaInicial={termoBusca} />}
        {pg === "saude" && (
          <SauV sau={sau} setSau={setSau} edit={canG(role)} t={showT} />
        )}
        {pg === "cozinha" && (
          <CozinhaV edit={canC(role)} t={showT} users={users} />
        )}
        {pg === "cartas" && (
          <CartasV users={users} user={user} role={role} t={showT} />
        )}
        {pg === "uniformes" && (
          <UniV
            uni={uni}
            setUni={setUni}
            dataLimite={dataLimiteUni}
            setDataLimite={salvarDataLimite}
            user={user}
            role={role}
            edit={isAdm}
            t={showT}
          />
        )}
        {pg === "equipes" && (
          <EqV
            esc={esc}
            setEsc={setEsc}
            uEs={uEs}
            edit={canG(role)}
            t={showT}
          />
        )}
        {pg === "servos" && (
          <SvV
            users={users}
            setUsers={setUsers}
            esc={esc}
            edit={isAdm}
            t={showT}
            dataLimitePagamento={dataLimitePagamento}
          />
        )}
        {pg === "test" &&
          ["admin", "lider_geral", "lider_templo", "pastor"].includes(role) && (
            <TestV encH={encH} encM={encM} t={showT} />
          )}
        {pg === "back" && isAdm && (
          <BackV
            users={users}
            setUsers={setUsers}
            fns={fns}
            setFns={setFns}
            t={showT}
            expandidos={backExpandidos}
            setExpandidos={setBackExpandidos}
            permissoes={permissoes}
            tab={backTab}
            setTab={setBackTab}
            gruposAbertos={backGruposAbertos}
            setGruposAbertos={setBackGruposAbertos}
            liderMapOverrides={liderMapOverrides}
            setLiderMapOverrides={setLiderMapOverrides}
            perfisExtra={perfisExtra}
            buscaUserRef={backBuscaUserRef}
          />
        )}
      </div>
    </div>
  );




























  // ── BACK OFFICE ──────────────────────────────────────────────────────────────
}

  function QuartoMaes({ m, oc, pct, edit, uQM, setQm, qm, AddServoSearch, AddEncAutocomplete, open, onToggle, EditQuarto, upd, t }) {
    return (
      <Acc
        title="Quarto Mães"
        ax="#ff9f0a"
        right={
          <Pill c={`${oc}/${m.lim}`} bg="rgba(255,159,10,.12)" tc="#ff9f0a" />
        }
        open={open}
        onToggle={onToggle}
      >
        <div
          style={{
            background: "#1e1e1e",
            borderRadius: 5,
            height: 5,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              background: "#ff9f0a",
              borderRadius: 5,
              height: 5,
              width: `${pct}%`,
            }}
          />
        </div>

        {edit && <EditQuarto q={m} upd={upd} t={t} />}

        <SL c={`Servos (${m.servos.length}/${m.limServos || 2})`} mt={0} />
        <Tags
          items={m.servos}
          ax={G.green}
          onX={
            edit
              ? (i) =>
                  uQM(m.num, (q) => ({
                    ...q,
                    servos: q.servos.filter((_, j) => j !== i),
                  }))
              : undefined
          }
        />
        <AddServoSearch quarto={m} updFn={uQM} />

        <SL c="Mães" />
        <Tags
          items={m.enc}
          ax="#ff9f0a"
          onX={
            edit
              ? (i) =>
                  uQM(m.num, (q) => ({
                    ...q,
                    enc: q.enc.filter((_, j) => j !== i),
                  }))
              : undefined
          }
        />
        <AddEncAutocomplete quarto={m} updFn={uQM} />
      </Acc>
    );
  }

  function QV({
    qh,
    qm,
    uQH,
    uQM,
    setQh,
    setQm,
    edit,
    t,
    encH,
    encM,
    users,
    salvarQuarto,
    deletarQuarto,
    tab,
    setTab,
    abertos,
    setAbertos,
    user,
  }) {
    // const [tab, setTab] = useState("M");
    const [shN, setShN] = useState(false);
    // const [abertos, setAbertos] = useState({});
    const toggleAcc = (key) => setAbertos(prev => ({ ...prev, [key]: !prev[key] }));  
    const [f, setF] = useState({ num: "", lim: 9, limServos: 2 });

    // Servos sem permissão de gestão só podem ver os quartos do próprio gênero
    const tabRestrita = user?.sexo === "Masculino" ? "H" : "M";
    useEffect(() => {
      if (!edit && tab !== tabRestrita) setTab(tabRestrita);
    }, [edit, tab, tabRestrita]);
    const tabEfetiva = edit ? tab : tabRestrita;
    const isH = tabEfetiva === "H";
    const colecao = isH ? "quartos_h" : "quartos_m";

    // Normaliza quartos para garantir que servos/enc sempre existam como array,
    // evitando crash caso algum quarto antigo tenha vindo sem esses campos.
    const normQuarto = (q) => ({ ...q, servos: q.servos || [], enc: q.enc || [] });
    qh = (qh || []).map(normQuarto);
    qm = (qm || []).map(normQuarto);
    
    const EditQuarto = ({ q, upd, t }) => {
    const [aberto, setAberto] = useState(false);
    const [num, setNum] = useState(q.num);
    const [lim, setLim] = useState(q.lim);
    const [limServos, setLimServos] = useState(q.limServos || 2);

    if (!aberto) return (
      <button
        onClick={() => setAberto(true)}
        style={{ ...BK({ padding: "7px 12px", borderRadius: 10, fontSize: 12, marginBottom: 8 }), borderColor: "rgba(255,159,10,.3)", color: "#ff9f0a" }}
      >
        Editar quarto
      </button>
    );

    return (
      <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Número</div>
            <input type="number" value={num} onChange={(e) => setNum(e.target.value)} style={{ ...I, fontSize: 13, padding: "8px 12px" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Limite</div>
            <input type="number" min="1" max="30" value={lim} onChange={(e) => setLim(e.target.value)} style={{ ...I, fontSize: 13, padding: "8px 12px" }} />
          </div>
        </div>
        <div>
          <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Servos por quarto</div>
          <input type="number" min="0" max="10" value={limServos} onChange={(e) => setLimServos(e.target.value)} style={{ ...I, fontSize: 13, padding: "8px 12px" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={async () => {
              await upd(q.num, (x) => ({ ...x, num: parseInt(num) || q.num, lim: parseInt(lim) || q.lim, limServos: parseInt(limServos) || 2 }));
              setAberto(false);
              t("Quarto atualizado!");
            }}
            style={BG({ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 })}
          >
            Salvar
          </button>
          <button onClick={() => setAberto(false)} style={BK({ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 })}>
            Cancelar
          </button>
        </div>
      </div>
    );
  };

    const upd = async (num, fn) => {
      const lista = isH ? qh : qm;
      const quarto = lista.find((q) => q.num === num);
      if (!quarto) return;
      const atualizado = fn(quarto);
      if (isH) uQH(num, () => atualizado);
      else uQM(num, () => atualizado);
      // Se número mudou, deletar doc antigo antes de criar novo
      if (atualizado.num !== num) {
        await deletarQuarto(colecao, num);
      }
      await salvarQuarto(colecao, atualizado);
    };

    const encConfirmados = (isH ? encH : encM).filter((e) => e.chegou);

    const todosServosAlocados = new Set([
      ...qh.flatMap((q) => q.servos),
      ...qm.flatMap((q) => q.servos),
    ]);

    const DIAS_QV = ["Quinta", "Sexta", "Sábado", "Domingo"];
    const servosDisponiveis = (users || []).filter(
      (u) =>
        u.perfil !== "admin" &&
        u.ativo !== false &&
        !todosServosAlocados.has(u.nome) &&
        u.sexo === (isH ? "Masculino" : "Feminino") &&
        DIAS_QV.some((d) => (u.escala?.[d] || []).includes("Servo de Quarto")),
    );

    const list = isH ? qh : qm.filter((q) => !q.maes);

    const delQuarto = async (num) => {
      await deletarQuarto(colecao, num);
      if (isH) setQh(qh.filter((q) => q.num !== num));
      else setQm(qm.filter((q) => q.num !== num));
      t("Quarto removido.");
    };

    const AddServoSearch = ({ quarto, updFn }) => {
      const [busca, setBusca] = useState("");
      const [aberto, setAberto] = useState(false);
      if (!edit || quarto.servos.length >= (quarto.limServos || 2)) return null;
      const filtrados = servosDisponiveis.filter((u) =>
        (u.nome || "").toLowerCase().includes(busca.toLowerCase()),
      );
      return (
        <div style={{ position: "relative", marginTop: 8 }}>
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            placeholder="Buscar servo..."
            style={{ ...I, fontSize: 12, padding: "9px 12px" }}
          />
          {aberto && filtrados.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 999,
                background: "#1e1e1e",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                marginTop: 4,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {filtrados.map((u) => (
                <div
                  key={u.id}
                  onMouseDown={() => {
                    updFn(quarto.num, (x) => ({
                      ...x,
                      servos: [...x.servos, u.nome],
                    }));
                    setBusca("");
                    setAberto(false);
                    t("✓");
                  }}
                  style={{
                    padding: "10px 14px",
                    color: G.td,
                    fontSize: 13,
                    cursor: "pointer",
                    borderBottom: "1px solid #2a2a2a",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#2a2a2a")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {u.nome}
                </div>
              ))}
            </div>
          )}
          {aberto && busca.length > 0 && filtrados.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 999,
                background: "#1e1e1e",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                marginTop: 4,
                padding: "10px 14px",
                color: G.tm,
                fontSize: 12,
              }}
            >
              Nenhum servo disponível
            </div>
          )}
        </div>
      );
    };

    const AddEncAutocomplete = ({ quarto, updFn }) => {
      const [busca, setBusca] = useState("");
      const [aberto, setAberto] = useState(false);
      const lv = quarto.lim - quarto.servos.length - quarto.enc.length;
      if (!edit || lv <= 0) return null;
      const fn = updFn || upd;
      const sugestoes = encConfirmados.filter(
        (e) =>
          (e.nome || "").toLowerCase().includes(busca.toLowerCase()) &&
          !quarto.enc.includes(e.nome) &&
          busca.length > 0,
      );
      const confirmar = (nome) => {
        if (!nome.trim()) return;
        fn(quarto.num, (x) => ({ ...x, enc: [...x.enc, nome.trim()] }));
        setBusca("");
        setAberto(false);
        t("✓");
      };
      return (
        <div style={{ position: "relative", marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAberto(true);
              }}
              onFocus={() => setAberto(true)}
              onBlur={() => setTimeout(() => setAberto(false), 150)}
              onKeyDown={(e) => e.key === "Enter" && confirmar(busca)}
              placeholder="Encontrista..."
              style={{ ...I, flex: 1, fontSize: 12, padding: "9px 12px" }}
            />
            <button
              onMouseDown={() => confirmar(busca)}
              style={BG({
                padding: "9px 14px",
                borderRadius: 10,
                fontSize: 13,
              })}
            >
              +
            </button>
          </div>
          {aberto && sugestoes.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 999,
                background: "#1e1e1e",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
                marginTop: 4,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {sugestoes.map((e) => (
                <div
                  onMouseDown={() => confirmar(e.nome)}
                  style={{
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {e.nome}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        {!edit && (
          <div
            style={{
              background: "rgba(255,159,10,.1)",
              border: "1px solid rgba(255,159,10,.2)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 12,
              color: "#ff9f0a",
              fontSize: 12,
            }}
          >
            👀 Somente visualização
          </div>
        )}
        {edit && (
          <Seg
            opts={[
              ["M", "Mulheres"],
              ["H", "Homens"],
            ]}
            val={tab}
            set={setTab}
          />
        )}

        {(() => {
          const todosQuartos = isH ? qh : qm;
          const totalVagas = todosQuartos.reduce((acc, q) => acc + (q.lim || 0), 0);
          const totalPreenchido = todosQuartos.reduce((acc, q) => acc + (q.servos?.length || 0) + (q.enc?.length || 0), 0);
          const pct = totalVagas > 0 ? Math.min(100, Math.round((totalPreenchido / totalVagas) * 100)) : 0;
          const bc = pct >= 100 ? "#ff3b30" : pct >= 80 ? "#ff9f0a" : G.green;
          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 10,
                marginBottom: 10,
              }}
            >
              <div style={{ background: "#111", borderRadius: 12, padding: "12px 8px", textAlign: "center", borderTop: "2px solid #636366" }}>
                <div style={{ color: G.t, fontSize: 22, fontWeight: 800 }}>{totalVagas - totalPreenchido}</div>
                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>
                  Vagas Livres
                </div>
              </div>
              <div style={{ background: "#111", borderRadius: 12, padding: "12px 8px", textAlign: "center", borderTop: `2px solid ${bc}` }}>
                <div style={{ color: G.t, fontSize: 22, fontWeight: 800 }}>{totalPreenchido}</div>
                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>
                  Preenchido ({pct}%)
                </div>
              </div>
            </div>
          );
        })()}

        {edit && (
          <button
            onClick={async () => {
              const ExcelJS = await carregarExcelJS();
              const wb = new ExcelJS.Workbook();

              const montarAba = (nomeAba, quartos, encontristas) => {
                const ws = wb.addWorksheet(nomeAba);
                ws.columns = [
                  { header: "Quarto", key: "quarto", width: 10 },
                  { header: "Nome", key: "nome", width: 35 },
                  { header: "Camiseta", key: "camiseta", width: 14 },
                ];
                ws.getRow(1).font = { bold: true, color: { argb: "FF000000" } };
                ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD0D0D0" } };
                [...quartos]
                  .sort((a, b) => a.num - b.num)
                  .forEach((q) => {
                    [...(q.enc || [])]
                      .sort((a, b) => a.localeCompare(b))
                      .forEach((nomeEnc) => {
                        const normalizar = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
                        const encontrista = encontristas.find((e) => normalizar(e.nome) === normalizar(nomeEnc));
                        ws.addRow({
                          quarto: q.num,
                          nome: nomeEnc,
                          camiseta: encontrista?.camiseta || "",
                        });
                      });
                  });
              };

              montarAba("Homens", qh, encH || []);
              montarAba("Mulheres", qm, encM || []);

              const buf = await wb.xlsx.writeBuffer();
              const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "encontristas_por_quarto.xlsx"; a.click();
              URL.revokeObjectURL(url);
            }}
            style={BG({ width: "100%", padding: 12, borderRadius: 13, marginBottom: 10 })}
          >
            Exportar Excel (por quarto)
          </button>
        )}

        {edit && (
          <>
            <button
              onClick={() => setShN(!shN)}
              style={
                shN
                  ? BK({
                      width: "100%",
                      padding: 12,
                      marginBottom: 10,
                      borderRadius: 13,
                    })
                  : BG({
                      width: "100%",
                      padding: 12,
                      marginBottom: 10,
                      borderRadius: 13,
                    })
              }
            >
              {shN ? "Cancelar" : "+ Novo Quarto"}
            </button>
            {shN && (
              <div
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <input
                  style={I}
                  placeholder="Número *"
                  type="number"
                  value={f.num}
                  onChange={(e) => setF({ ...f, num: e.target.value })}
                />
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{ color: G.tm, fontSize: 13, whiteSpace: "nowrap" }}
                  >
                    Limite de camas
                  </span>
                  <input
                    style={{ ...I, flex: 1 }}
                    type="number"
                    min="2"
                    max="20"
                    value={f.lim}
                    onChange={(e) =>
                      setF({ ...f, lim: parseInt(e.target.value) || 9 })
                    }
                  />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{ color: G.tm, fontSize: 13, whiteSpace: "nowrap" }}
                  >
                    Servos por quarto
                  </span>
                  <input
                    style={{ ...I, flex: 1 }}
                    type="number"
                    min="0"
                    max="10"
                    value={f.limServos ?? 2}
                    onChange={(e) =>
                      setF({ ...f, limServos: parseInt(e.target.value) ?? 2 })
                    }
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!f.num) return;
                    const nv = {
                      num: parseInt(f.num),
                      lim: f.lim,
                      limServos: f.limServos ?? 2,
                      servos: [],
                      enc: [],
                    };
                    await salvarQuarto(colecao, nv);
                    if (isH) setQh([...qh, nv]);
                    else setQm([...qm, nv]);
                    setF({ num: "", lim: 9, limServos: 2 });
                    setShN(false);
                    t("Quarto criado!");
                  }}
                  style={BG({ padding: 12, borderRadius: 12 })}
                >
                  Criar Quarto
                </button>
              </div>
            )}
          </>
        )}

        {/* Quarto Mães */}
        {!isH &&
          (() => {
            const m = qm.find((q) => q.maes);
            if (!m) return null;
            const oc = m.servos.length + m.enc.length;
            const pct = Math.min(100, Math.round((oc / m.lim) * 100));
            return (
              <QuartoMaes
                m={m}
                oc={oc}
                pct={pct}
                edit={edit}
                uQM={upd}
                setQm={setQm}
                qm={qm}
                AddServoSearch={AddServoSearch}
                AddEncAutocomplete={AddEncAutocomplete}
                open={!!abertos['maes']}
                onToggle={() => toggleAcc('maes')}
                EditQuarto={EditQuarto}
                upd={upd}
                t={t}
              />
            );
          })()}

        {/* Lista de quartos */}
        {list.map((q) => {
          const oc = q.servos.length + q.enc.length;
          const pct = Math.min(100, Math.round((oc / q.lim) * 100));
          const lv = q.lim - oc;
          const bc = pct >= 100 ? "#ff3b30" : pct >= 80 ? "#ff9f0a" : G.green;
          return (
            <Acc
              key={q.num}
              title={`Quarto ${q.num}`}
              right={<Pill c={`${oc}/${q.lim}`} bg={`${bc}18`} tc={bc} />}
              onDel={edit ? () => delQuarto(q.num) : undefined}
              open={!!abertos[q.num]}
              onToggle={() => toggleAcc(q.num)}
            >
              <div
                style={{
                  background: "#1e1e1e",
                  borderRadius: 5,
                  height: 5,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    background: bc,
                    borderRadius: 5,
                    height: 5,
                    width: `${pct}%`,
                    transition: "width var(--d-slow) var(--e-out)",
                  }}
                />
              </div>
              <div style={{ color: G.tm, fontSize: 11, marginBottom: 10 }}>
                {lv >= 0 ? `${lv} vagas` : "Lotado"}
              </div>

              {edit && <EditQuarto q={q} upd={upd} t={t} />}

              <SL c={`Servos (${q.servos.length}/${q.limServos || 2})`} mt={0} />
              <Tags
                items={q.servos}
                ax={G.green}
                onX={
                  edit
                    ? (i) =>
                        upd(q.num, (x) => ({
                          ...x,
                          servos: x.servos.filter((_, j) => j !== i),
                        }))
                    : undefined
                }
              />
              {edit && q.servos.length >= (q.limServos || 2) && (
                <div
                  style={{
                    color: G.tm,
                    fontSize: 11,
                    marginTop: 6,
                    fontStyle: "italic",
                  }}
                >
                  Limite de {q.limServos || 2} servos atingido.
                </div>
              )}
              <AddServoSearch quarto={q} updFn={upd} />

              <SL c="Encontristas" />
              {q.enc.length > 0 ? (
                <Tags
                  items={q.enc}
                  onX={
                    edit
                      ? (i) =>
                          upd(q.num, (x) => ({
                            ...x,
                            enc: x.enc.filter((_, j) => j !== i),
                          }))
                      : undefined
                  }
                />
              ) : (
                <div
                  style={{
                    color: G.tm,
                    fontSize: 12,
                    fontStyle: "italic",
                    margin: "4px 0 8px",
                  }}
                >
                  Nenhum ainda
                </div>
              )}
              <AddEncAutocomplete quarto={q} />
            </Acc>
          );
        })}
      </div>
    );
  }


function BackV({ users, setUsers, fns, setFns, t, expandidos, setExpandidos, permissoes, tab, setTab, gruposAbertos, setGruposAbertos, liderMapOverrides, setLiderMapOverrides, perfisExtra, buscaUserRef }) {
    const [buscaUser, setBuscaUserState] = useState(buscaUserRef?.current || "");
    const setBuscaUser = (v) => {
      setBuscaUserState(v);
      if (buscaUserRef) buscaUserRef.current = v;
    };
    // const [tab, setTab] = useState("usuarios");
    const [buscaFn, setBuscaFn] = useState("");
    const [filtroPerfilBack, setFiltroPerfilBack] = useState("todos");
    const [shFiltroBack, setShFiltroBack] = useState(false);
    const filtroPerfilBackFn = (u) => {
      if (filtroPerfilBack === "todos") return true;
      if (filtroPerfilBack === "servo") return u.perfil === "servo";
      if (filtroPerfilBack === "cozinha") return u.perfil === "cozinha";
      if (filtroPerfilBack === "staff") return u.perfil === "staff";
      if (filtroPerfilBack === "lider") return u.perfil?.startsWith("lider_");
      if (filtroPerfilBack === "pastor") return u.perfil === "pastor" || u.perfil === "pastor_auxiliar";
      return true;
    };
    const [shGrp, setShGrp] = useState(false);
    const [grpForm, setGrpForm] = useState({ label: "", cor: "#00c851" });

    const DIAS = ["Quinta", "Sexta", "Sábado", "Domingo"];
    const dC = { Quinta: "#ff6b35", Sexta: "#bf5af2", Sábado: G.green, Domingo: "#ff9f0a" };

    const pD = {
      admin: "Acesso total",
      lider_cartas: "Permissões customizadas",
      lider_celula: "Permissões customizadas",
      lider_geral: "Tudo exceto Back Office",
      lider_midia: "Líder Mídia",
      lider_quartos: "Edição de quartos",
      lider_staff: "Operacional",
      lider_templo: "Permissões customizadas",
      pastor: "Edição geral",
      pastor_auxiliar: "Somente visualização",
      servo: "Somente visualização",
      staff: "Operacional",
      lider_som: "Líder Som",
      lider_danca: "Líder Dança",
    };

    const toggleExpandido = (id) =>
      setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));

    const getEscala = (u) => u.escala || { Quinta: [], Sexta: [], Sábado: [], Domingo: [] };

    const FUNCOES_CONFLITO_QUARTO = ["Templo", "Som", "Cozinha"];
    const ehFuncaoConflitoQuarto = (f) => FUNCOES_CONFLITO_QUARTO.includes(f);

    const addFuncaoDia = async (u, dia, fn) => {
      if (!fn.trim()) return;
      const fnLimpa = fn.trim();
      const escala = getEscala(u);

      if (fnLimpa === "Servo de Quarto") {
        const temConflito = DIAS.some((d) =>
          (escala[d] || []).some((f) => ehFuncaoConflitoQuarto(f)),
        );
        if (temConflito) {
          t("Esse servo já tem Templo, Som ou Cozinha na escala — não pode ser Servo de Quarto.", "w");
          return;
        }
      }
      if (ehFuncaoConflitoQuarto(fnLimpa)) {
        const jaEhServoQuarto = DIAS.some((d) =>
          (escala[d] || []).includes("Servo de Quarto"),
        );
        if (jaEhServoQuarto) {
          t("Esse servo já é Servo de Quarto — não pode ter Templo, Som ou Cozinha.", "w");
          return;
        }
      }

      const novas = [...(escala[dia] || []), fnLimpa];
      const novaEscala = { ...escala, [dia]: novas };
      await setDoc(doc(db, "users", u.id), { escala: novaEscala }, { merge: true });
      setExpandidos(prev => ({ ...prev, [u.id]: true }))
      setUsers(users.map(x => x.id === u.id ? { ...x, escala: novaEscala } : x));
      t("✓");
    };

    const removeFuncaoDia = async (u, dia, i) => {
      const escala = getEscala(u);
      const novas = (escala[dia] || []).filter((_, j) => j !== i);
      const novaEscala = { ...escala, [dia]: novas };
      await setDoc(doc(db, "users", u.id), { escala: novaEscala }, { merge: true });
      setExpandidos(prev => ({ ...prev, [u.id]: true }))
      setUsers(users.map(x => x.id === u.id ? { ...x, escala: novaEscala } : x));
    };

    const totalFuncoes = (u) => {
      const escala = getEscala(u);
      return DIAS.reduce((a, d) => a + (escala[d]?.length || 0), 0);
    };

    return (
      <div>
        <Seg opts={[["grupos", "Perfis"], ["usuarios", "Escalas"], ["geral", "Funções"]]} val={tab} set={setTab} />
        <div style={{ marginTop: 14 }}>
          {tab === "grupos" && (
            <>
              <NovoPerfilForm perfisExtra={perfisExtra} t={t} />
              {Object.entries(PERFIS).filter(([k]) => k !== "admin").map(([k, v]) => {
                const telasAtivas = permissoes[k]?.telas || [];
                return (
                  <Acc
                    key={k}
                    title={v.l}
                    ax={v.c}
                    right={<Pill c={`${telasAtivas.length} telas`} bg="#1e1e1e" tc={G.tm} />}
                    open={!!gruposAbertos[k]}
                    onToggle={() => setGruposAbertos(prev => ({ ...prev, [k]: !prev[k] }))}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        ["mins", "Agenda"],
                        ["avisos", "Avisos"],
                        ["uniforme", "Uniforme"],
                        ["info", "Ocorrências"],
                        ["rest", "Restrições"],
                        ["img", "Uso de Imagem"],
                        ["checkin", "Check-in"],
                        ["termo", "Termo"],
                        ["quartos", "Quartos"],
                        ["enc", "Encontristas"],
                        ["onibus", "Ônibus"],
                        ["cozinha", "Cozinha"],
                        ["servos", "Servos"],
                        ["ach", "Achados & Perdidos"],
                        ["crac", "Crachás"],
                        ["saude", "Saúde"],
                        ["test", "Testemunhos"],
                        ["back", "Back Office"],
                      ].map(([id, label]) => {
                        const ativo = telasAtivas.includes(id);
                        return (
                          <div
                            key={id}
                            onClick={async () => {
                              const novas = ativo
                                ? telasAtivas.filter(t => t !== id)
                                : [...telasAtivas, id];
                              await setDoc(doc(db, "permissoes", k), { telas: novas }, { merge: true });
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 10px", borderRadius: 10, background: ativo ? "rgba(0,200,81,.08)" : "#111", border: `1px solid ${ativo ? "rgba(0,200,81,.2)" : "#1e1e1e"}` }}
                          >
                            <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${ativo ? G.green : "#444"}`, background: ativo ? "rgba(0,200,81,.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {ativo && <span style={{ color: G.green, fontSize: 11, fontWeight: 800 }}>✓</span>}
                            </div>
                            <span style={{ color: ativo ? G.t : G.td, fontSize: 13 }}>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Acc>
                );
              })}
            </>
          )}

          {tab === "usuarios" && (
            <>
              <button
                onClick={async () => {
                  const DIAS = ["Quinta", "Sexta", "Sábado", "Domingo"];
                  const ExcelJS = await carregarExcelJS();
              const wb = new ExcelJS.Workbook();
                  const ws = wb.addWorksheet("Escalas");
                  ws.columns = [
                    { header: "Nome", key: "nome", width: 35 },
                    { header: "Perfil", key: "perfil", width: 20 },
                    { header: "Quinta", key: "Quinta", width: 35 },
                    { header: "Sexta", key: "Sexta", width: 35 },
                    { header: "Sábado", key: "Sábado", width: 35 },
                    { header: "Domingo", key: "Domingo", width: 35 },
                  ];
                  ws.getRow(1).font = { bold: true };
                  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD0D0D0" } };
                  const lista = users
                    .filter(u => u.perfil !== "admin" && u.nome && u.ativo !== false)
                    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
                  lista.forEach(u => {
                    const escala = u.escala || {};
                    ws.addRow({
                      nome: u.nome || "",
                      perfil: PERFIS[u.perfil]?.l || u.perfil || "",
                      Quinta: (escala["Quinta"] || []).join(", "),
                      Sexta: (escala["Sexta"] || []).join(", "),
                      "Sábado": (escala["Sábado"] || []).join(", "),
                      Domingo: (escala["Domingo"] || []).join(", "),
                    });
                  });
                  const buf = await wb.xlsx.writeBuffer();
                  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "escalas.xlsx"; a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ ...BG({ width: "100%", padding: 12, borderRadius: 12, fontSize: 13, marginBottom: 12 }) }}
              >
                Exportar Escalas (XLSX)
              </button>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={buscaUser} onChange={(e) => setBuscaUser(e.target.value)} placeholder="🔍 Buscar usuário..." style={{ ...I, marginBottom: 0, flex: 1 }} />
                <button
                  onClick={() => setShFiltroBack(true)}
                  style={{
                    ...BK({ padding: "0 14px", borderRadius: 12, flexShrink: 0 }),
                    position: "relative",
                    borderColor: filtroPerfilBack !== "todos" ? "rgba(10,132,255,.5)" : G.cb,
                    color: filtroPerfilBack !== "todos" ? "#0a84ff" : G.t,
                    background: filtroPerfilBack !== "todos" ? "rgba(10,132,255,.08)" : G.card,
                    height: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SlidersHorizontal size={18} />
                  {filtroPerfilBack !== "todos" && (
                    <span style={{
                      position: "absolute", top: 4, right: 4,
                      background: "#0a84ff", color: "#fff",
                      fontSize: 10, fontWeight: 800,
                      borderRadius: "50%", width: 16, height: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      1
                    </span>
                  )}
                </button>
              </div>
              <Sheet open={shFiltroBack} onClose={() => setShFiltroBack(false)} title="Filtrar por perfil">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    ["todos", "Todos"],
                    ["pastor", "Pastores"],
                    ["lider", "Líderes"],
                    ["servo", "Servos"],
                    ["cozinha", "Cozinha"],
                    ["staff", "Staff"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => { setFiltroPerfilBack(val); setShFiltroBack(false); }}
                      style={{
                        ...BK({ width: "100%", padding: "11px 14px", borderRadius: 12, textAlign: "left", fontSize: 14 }),
                        borderColor: filtroPerfilBack === val ? "rgba(10,132,255,.5)" : "#2a2a2a",
                        color: filtroPerfilBack === val ? "#0a84ff" : G.td,
                        background: filtroPerfilBack === val ? "rgba(10,132,255,.08)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}
                    >
                      {label}
                      {filtroPerfilBack === val && <span style={{ fontSize: 16 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </Sheet>
              {users
               .filter(u =>
                  (u.nome || "").toLowerCase().includes(buscaUser.toLowerCase()) &&
                  u.perfil !== "admin" &&
                  u.nome &&
                  u.ativo !== false &&
                  u.primeiro !== true &&
                  filtroPerfilBackFn(u)
                )
                .sort((a, b) => {
                  const ORDEM = (p) => {
                    if (p === "pastor") return 0;
                    if (p === "pastor_auxiliar") return 1;
                    if (p === "lider_geral") return 2;
                    if (p?.startsWith("lider_")) return 3;
                    if (p === "servo") return 4;
                    if (p === "cozinha") return 5;
                    if (p === "staff") return 6;
                    return 7;
                  };
                  const diff = ORDEM(a.perfil) - ORDEM(b.perfil);
                  if (diff !== 0) return diff;
                  return a.nome.localeCompare(b.nome, "pt-BR");
                })
                .map((u, i) => {
                  const aberto = !!expandidos[u.id];
                  const escala = getEscala(u);
                  const total = totalFuncoes(u);

                  return (
                    <div key={i} className="fu" style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${PERFIS[u.perfil]?.c || G.green}`, borderRadius: 13, marginBottom: 7, overflow: "visible" }}>
                      
                      {/* Header */}
                      <div
                        onClick={() => toggleExpandido(u.id)}
                        style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                      >
                        <div>
                          <div style={{ color: G.t, fontWeight: 700, fontSize: 13 }}>{u.nome}</div>
                          <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                            {PERFIS[u.perfil]?.l || u.perfil}
                            {total > 0 && <span style={{ color: G.green, marginLeft: 6 }}>· {total} {total === 1 ? 'função' : 'funções'}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            value={u.perfil}
                            onClick={e => e.stopPropagation()}
                            onChange={async (e) => {
                              const novoPerfil = e.target.value;
                              await setDoc(doc(db, "users", u.id), { perfil: novoPerfil }, { merge: true });
                              setUsers(prev => prev.map(x => x.id === u.id ? { ...x, perfil: novoPerfil } : x));
                              setExpandidos(prev => ({ ...prev, [u.id]: true }));
                              t("Perfil atualizado!");
                            }}
                            style={{ ...I, width: "auto", padding: "6px 9px", fontSize: 11, borderRadius: 9 }}
                          >
                            {Object.entries(PERFIS).filter(([k]) => k !== "admin").map(([k, v]) => (
                              <option key={k} value={k}>{v.l}</option>
                            ))}
                          </select>
                          <span style={{ color: G.tm, fontSize: 12, transition: "transform var(--d-fast) var(--e-out)", display: "inline-block", transform: aberto ? "rotate(180deg)" : "none" }}>▾</span>
                        </div>
                      </div>

                      {/* Expandido */}
                      {aberto && (
                        <div style={{ borderTop: "1px solid #1e1e1e", padding: "12px 14px" }}>
                          {u.email && <div style={{ color: G.tm, fontSize: 12, marginBottom: 12 }}>✉️ {u.email}</div>}

                          {/* ADICIONA AQUI */}
                            {/* Toggle Líder de Célula — visível para servo */}
                            {(u.perfil === "servo" || u.perfil === "lider_celula") && (
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Líder de Célula</div>
                                <div style={{ display: "flex", gap: 8, marginBottom: u.liderCelula ? 10 : 0 }}>
                                  {[true, false].map(val => (
                                    <button
                                      key={String(val)}
                                      onClick={async () => {
                                        const novo = { liderCelula: val };
                                        if (!val) novo.celula = "";
                                        await setDoc(doc(db, "users", u.id), novo, { merge: true });
                                        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...novo } : x));
                                        t(val ? "Marcado como Líder de Célula." : "Líder de Célula removido.");
                                      }}
                                      style={{
                                        ...BK({ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700 }),
                                        background: (u.liderCelula === true) === val ? (val ? "rgba(255,107,53,.12)" : "rgba(99,99,102,.1)") : "transparent",
                                        borderColor: (u.liderCelula === true) === val ? (val ? "rgba(255,107,53,.5)" : "#444") : "#2a2a2a",
                                        color: (u.liderCelula === true) === val ? (val ? "#ff6b35" : G.td) : G.tm,
                                      }}
                                    >
                                      {val ? "Sim" : "Não"}
                                    </button>
                                  ))}
                                </div>
                                {u.liderCelula === true && (
                                  <select
                                    value={u.celula || ""}
                                    onChange={async (e) => {
                                      const novacelula = e.target.value;
                                      await setDoc(doc(db, "users", u.id), { celula: novacelula }, { merge: true });
                                      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, celula: novacelula } : x));
                                      t("Célula salva!");
                                    }}
                                    style={{ ...I, fontSize: 13 }}
                                  >
                                    <option value="">Selecione a célula...</option>
                                    {CELULAS.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}

{/* Telas extras individuais */}
                          {(() => {
                            const TELAS_LISTA = [
                              ["mins", "Agenda"],
                              ["avisos", "Avisos"],
                              ["uniforme", "Uniforme"],
                              ["info", "Ocorrências"],
                              ["rest", "Restrições"],
                              ["img", "Uso de Imagem"],
                              ["checkin", "Check-in"],
                              ["termo", "Termo"],
                              ["quartos", "Quartos"],
                              ["enc", "Encontristas"],
                              ["onibus", "Ônibus"],
                              ["cozinha", "Cozinha"],
                              ["servos", "Servos"],
                              ["ach", "Achados & Perdidos"],
                              ["crac", "Crachás"],
                              ["saude", "Saúde"],
                              ["test", "Testemunhos"],
                              ["back", "Back Office"],
                            ];
                            const telasPerfil = permissoes[u.perfil]?.telas || [];
                            const telasFixas = ["mins", "avisos", "uniforme", "info"];
                            const telasExtra = u.telasExtra || [];
                            // só mostra telas que o perfil NÃO tem por padrão
                            const telasDisponiveis = TELAS_LISTA.filter(([id]) =>
                              !telasPerfil.includes(id) && !telasFixas.includes(id)
                            );
                            if (!telasDisponiveis.length) return null;
                            return (
                              <div style={{ marginBottom: 12 }}>
                                <button
                                  onClick={() => setExpandidos(prev => ({ ...prev, [`telas_${u.id}`]: !prev[`telas_${u.id}`] }))}
                                  style={{ ...BK({ width: "100%", padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600 }), display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: telasExtra.length > 0 ? "rgba(10,132,255,.4)" : "#2a2a2a", background: telasExtra.length > 0 ? "rgba(10,132,255,.06)" : "transparent" }}
                                >
                                  <span style={{ color: telasExtra.length > 0 ? "#0a84ff" : G.td }}>
                                    Telas extras {telasExtra.length > 0 ? `(${telasExtra.length})` : ""}
                                  </span>
                                  <span style={{ color: G.tm, fontSize: 11 }}>{expandidos[`telas_${u.id}`] ? "▲" : "▼"}</span>
                                </button>
                                {expandidos[`telas_${u.id}`] && (
                                  <div style={{ marginTop: 6, background: "#111", borderRadius: 10, border: "1px solid #1e1e1e", overflow: "hidden" }}>
                                    {telasDisponiveis.map(([id, label], idx) => {
                                      const ativo = telasExtra.includes(id);
                                      return (
                                        <div
                                          key={id}
                                          onClick={async () => {
                                            const novas = ativo
                                              ? telasExtra.filter(t => t !== id)
                                              : [...telasExtra, id];
                                            await setDoc(doc(db, "users", u.id), { telasExtra: novas }, { merge: true });
                                            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, telasExtra: novas } : x));
                                            t(ativo ? `${label} removida.` : `${label} habilitada.`);
                                          }}
                                          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: ativo ? "rgba(10,132,255,.08)" : "transparent", borderTop: idx > 0 ? "1px solid #1e1e1e" : "none" }}
                                        >
                                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${ativo ? "#0a84ff" : "#444"}`, background: ativo ? "rgba(10,132,255,.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {ativo && <span style={{ color: "#0a84ff", fontSize: 11, fontWeight: 800 }}>✓</span>}
                                          </div>
                                          <span style={{ color: ativo ? G.t : G.td, fontSize: 13 }}>{label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Escala por dia */}
                          {DIAS.map(dia => (
                            <div key={dia} style={{ marginBottom: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dC[dia] }} />
                                <span style={{ color: dC[dia], fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{dia}</span>
                              </div>
                              
                              {/* Funções do dia */}
                              {(escala[dia] || []).length > 0 && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                                  {(escala[dia] || []).map((fn, j) => (
                                    <span
                                      key={j}
                                      onClick={() => removeFuncaoDia(u, dia, j)}
                                      style={{ background: `${dC[dia]}18`, border: `1px solid ${dC[dia]}44`, borderRadius: 50, padding: "4px 10px", color: dC[dia], fontSize: 11, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                                    >
                                      {fn} <span style={{ color: "rgba(255,59,48,.6)", fontWeight: 800 }}>×</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Input adicionar função */}
                              <AddFuncaoDia
                                dia={dia}
                                fns={fns}
                                onAdd={(fn) => addFuncaoDia(u, dia, fn)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}

          {tab === "geral" && (
            <>
              <NovaFuncaoForm fns={fns} setFns={setFns} t={t} />
              <input
                value={buscaFn}
                onChange={(e) => setBuscaFn(e.target.value)}
                placeholder="🔍 Buscar função..."
                style={{ ...I, marginBottom: 12 }}
              />
              {(() => {
                const DIAS_ORD = ["Quinta", "Sexta", "Sábado", "Domingo"];
                const dC = { Quinta: "#ff6b35", Sexta: "#bf5af2", Sábado: G.green, Domingo: "#ff9f0a" };
                const FUNCOES_COM_PERIODO = ["Panelas", "Louça", "Louças", "Servir comida", "Limpeza refeitório", "Servir Comida Pastores"];

                // Monta mapa: função -> [{ user, dia }] — inicia com todas as funções cadastradas
                const porFuncao = {};
                (fns || []).forEach(fn => { porFuncao[fn] = []; });
                (users || []).forEach(u => {
                  if (u.perfil === "admin" || !u.nome) return;
                  const escala = u.escala || {};
                  DIAS_ORD.forEach(dia => {
                    (escala[dia] || []).forEach(fn => {
                      if (!porFuncao[fn]) porFuncao[fn] = [];
                      porFuncao[fn].push({ nome: u.nome, dia, sexo: u.sexo });
                    });
                  });
                });

                const excluirFuncao = async (fn) => {
                  const novasFns = fns.filter(f => f !== fn);
                  setFns(novasFns);
                  try {
                    const extras = novasFns.filter(f => !FUNCOES_INIT.includes(f));
                    await setDoc(doc(db, "config", "funcoes_extra"), { lista: extras }, { merge: true });
                    t("Função excluída!");
                  } catch (err) {
                    console.error("Erro ao excluir função:", err);
                    t("Erro ao excluir função.", "w");
                  }
                };

                const funcoesOrdenadas = Object.keys(porFuncao)
                  // funções que sempre têm período (Almoço/Jantar) nunca aparecem "soltas" sem ninguém
                  .filter(fn => !FUNCOES_COM_PERIODO.includes(fn))
                  .filter(fn => fn.toLowerCase().includes(buscaFn.toLowerCase()))
                  .sort((a, b) => a.localeCompare(b));

                if (funcoesOrdenadas.length === 0) {
                  return (
                    <div style={{ color: G.tm, textAlign: "center", padding: 28, fontSize: 13 }}>
                      Nenhuma função encontrada.
                    </div>
                  );
                }

                return funcoesOrdenadas.map((fn) => {
                  const pessoas = porFuncao[fn];
                  const pessoasUnicas = new Set(pessoas.map(p => p.nome)).size;
                  return (
                    <Acc
                      key={fn}
                      title={fn}
                      right={
                        pessoasUnicas > 0
                          ? <Pill c={`${pessoasUnicas} ${pessoasUnicas === 1 ? "pessoa" : "pessoas"}`} bg="rgba(10,132,255,.12)" tc="#0a84ff" />
                          : <Pill c="Sem ninguém" bg="rgba(99,99,102,.15)" tc="#888" />
                      }
                    >
                      <LideresEditor fn={fn} liderMapOverrides={liderMapOverrides} setLiderMapOverrides={setLiderMapOverrides} t={t} />

                      {pessoasUnicas === 0 && (
                        <button
                          onClick={() => excluirFuncao(fn)}
                          style={{ ...BK({ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 12, marginTop: 10 }), color: "#ff3b30", borderColor: "rgba(255,59,48,.3)" }}
                        >
                          Excluir função
                        </button>
                      )}

                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", margin: "12px 0 6px" }}>
                        Escala
                      </div>
                      {pessoas.length === 0 ? (
                        <div style={{ color: G.tm, fontSize: 12, fontStyle: "italic", padding: "4px 0" }}>
                          Nenhum servo escalado nesta função ainda.
                        </div>
                      ) : (
                        DIAS_ORD.map(dia => {
                          const doDia = pessoas.filter(p => p.dia === dia);
                          if (doDia.length === 0) return null;
                          const mulheres = doDia.filter(p => p.sexo === "Feminino");
                          const homens = doDia.filter(p => p.sexo === "Masculino");
                          const semSexo = doDia.filter(p => p.sexo !== "Feminino" && p.sexo !== "Masculino");
                          return (
                            <div key={dia} style={{ marginBottom: 10 }}>
                              <div style={{ color: dC[dia], fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                                {dia} · {doDia.length}
                              </div>
                              {[
                                ["Mulheres", mulheres, "#ff2d92"],
                                ["Homens", homens, "#0a84ff"],
                                ["Sem sexo definido", semSexo, "#888"],
                              ].map(([grupoLabel, grupo, cor]) => grupo.length === 0 ? null : (
                                <div key={grupoLabel} style={{ marginBottom: 6, marginLeft: 4 }}>
                                  <div style={{ color: cor, fontSize: 10, fontWeight: 700, marginBottom: 3 }}>
                                    {grupoLabel} · {grupo.length}
                                  </div>
                                  {grupo.map((p, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, marginLeft: 8 }}>
                                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: cor }} />
                                      <span style={{ color: G.td, fontSize: 13 }}>{p.nome}</span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        })
                      )}
                    </Acc>
                  );
                });
              })()}
            </>
          )}
        </div>
      </div>
    );
  }

function LideresEditor({ fn, liderMapOverrides, setLiderMapOverrides, t }) {
  const [sh, setSh] = useState(false);

  const PERFIS_LIDER = [
    "lider_geral", "lider_staff", "lider_quartos", "lider_templo",
    "lider_midia", "lider_cartas", "lider_som", "lider_danca", "lider_celula",
  ];

  const atual = liderMapOverrides[fn] || LIDER_MAP_DEFAULT[fn] || ["lider_staff"];

  const toggle = async (perfil) => {
    const novo = atual.includes(perfil)
      ? atual.filter(p => p !== perfil)
      : [...atual, perfil];
    const final = novo.length > 0 ? novo : ["lider_staff"];
    const novosOverrides = { ...liderMapOverrides, [fn]: final };
    setLiderMapOverrides(novosOverrides);
    try {
      await setDoc(doc(db, "config", "lider_map"), { [fn]: final }, { merge: true });
      t("Liderança atualizada!");
    } catch (err) {
      console.error("Erro ao salvar lider_map:", err);
      t("Erro ao salvar.", "w");
    }
  };

  return (
    <div>
      <button
        onClick={() => setSh(!sh)}
        style={{ ...BK({ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 12 }), display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: "rgba(10,132,255,.3)", color: "#0a84ff" }}
      >
        <span>Líder(es) responsável(eis) ({atual.length})</span>
        <span style={{ fontSize: 10 }}>{sh ? "▲" : "▼"}</span>
      </button>
      {sh && (
        <div style={{ marginTop: 6, background: "#111", borderRadius: 10, border: "1px solid #1e1e1e", overflow: "hidden" }}>
          {PERFIS_LIDER.map((perfil, idx) => {
            const ativo = atual.includes(perfil);
            return (
              <div
                key={perfil}
                onClick={() => toggle(perfil)}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: ativo ? "rgba(10,132,255,.08)" : "transparent", borderTop: idx > 0 ? "1px solid #1e1e1e" : "none" }}
              >
                <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${ativo ? "#0a84ff" : "#444"}`, background: ativo ? "rgba(10,132,255,.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {ativo && <span style={{ color: "#0a84ff", fontSize: 11, fontWeight: 800 }}>✓</span>}
                </div>
                <span style={{ color: ativo ? G.t : G.td, fontSize: 13 }}>{PERFIS[perfil]?.l || perfil}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PerfilV({ user, setUser, t }) {
  const [cpf, setCpf] = useState(user.cpf || "");
  const isoParaBr = (v) =>
    v && v.includes("-") && v.length === 10 ? v.split("-").reverse().join("/") : v || "";
  const [nascimentoBr, setNascimentoBr] = useState(isoParaBr(user.nascimento));
  const [sexo, setSexo] = useState(user.sexo || "");
  const [salvando, setSalvando] = useState(false);
  const bloqueado = !!(user.cpf && user.nascimento && user.sexo);

  const formatCpf = (v) =>
    v
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

  const formatDataBr = (v) =>
    v
      .replace(/\D/g, "")
      .slice(0, 8)
      .replace(/(\d{2})(\d)/, "$1/$2")
      .replace(/(\d{2})(\d)/, "$1/$2");

  const brParaIso = (v) => {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    const dia = parseInt(d, 10), mes = parseInt(mo, 10), ano = parseInt(y, 10);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900 || ano > new Date().getFullYear()) return null;
    return `${y}-${mo}-${d}`;
  };

  const salvar = async () => {
    const cpfLimpo = cpf.replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      t("Informe um CPF válido.", "w");
      return;
    }
    const nascimentoIso = brParaIso(nascimentoBr);
    if (!nascimentoIso) {
      t("Informe a data de nascimento no formato DD/MM/AAAA.", "w");
      return;
    }
    if (!sexo) {
      t("Selecione o sexo.", "w");
      return;
    }
    setSalvando(true);
    try {
      await setDoc(doc(db, "users", user.id), { cpf: cpfLimpo, nascimento: nascimentoIso, sexo }, { merge: true });
      setUser((prev) => ({ ...prev, cpf: cpfLimpo, nascimento: nascimentoIso, sexo }));
      t("Perfil atualizado!");
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      t("Erro ao salvar.", "w");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
        <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
          Nome
        </div>
        <div style={{ color: G.t, fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{user.nome}</div>
        <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
          Email
        </div>
        <div style={{ color: G.t, fontSize: 15, fontWeight: 600 }}>{user.email}</div>
      </div>
      <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 16 }}>
        <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          CPF
        </div>
        {bloqueado ? (
          <div style={{ color: G.t, fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{formatCpf(user.cpf)}</div>
        ) : (
          <input
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            placeholder="000.000.000-00"
            style={{ ...I, marginBottom: 14 }}
          />
        )}
        <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          Data de Nascimento
        </div>
        {bloqueado ? (
          <div style={{ color: G.t, fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            {isoParaBr(user.nascimento)}
          </div>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            value={nascimentoBr}
            onChange={(e) => setNascimentoBr(formatDataBr(e.target.value))}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            style={{ ...I, marginBottom: 14 }}
          />
        )}
        <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
          Sexo
        </div>
        {bloqueado ? (
          <div style={{ color: G.t, fontSize: 15, fontWeight: 600, marginBottom: 14 }}>{user.sexo}</div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {["Masculino", "Feminino"].map((opt) => (
              <button
                key={opt}
                onClick={() => setSexo(opt)}
                style={{
                  flex: 1,
                  padding: "12px 10px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${sexo === opt ? G.green : "#2a2a2a"}`,
                  background: sexo === opt ? "rgba(0,200,81,.12)" : "#1a1a1a",
                  color: sexo === opt ? G.green : G.td,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {bloqueado ? (
          <div style={{ color: G.tm, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
            Dados salvos. Para corrigir algo, procure a liderança.
          </div>
        ) : (
          <button
            onClick={salvar}
            disabled={salvando}
            style={BG({ width: "100%", padding: 13, borderRadius: 12, opacity: salvando ? 0.7 : 1 })}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        )}
      </div>
    </div>
  );
}

function NovoPerfilForm({ perfisExtra, t }) {
  const [sh, setSh] = useState(false);
  const [label, setLabel] = useState("");
  const [cor, setCor] = useState("#0a84ff");

  const slugify = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const criar = async () => {
    const limpo = label.trim();
    if (!limpo) return;
    const key = slugify(limpo);
    if (!key) {
      t("Nome inválido.", "w");
      return;
    }
    if (PERFIS[key]) {
      t("Já existe um perfil com esse nome.", "w");
      return;
    }
    const novo = { key, label: limpo, color: cor };
    const novaLista = [...(perfisExtra || []), novo];
    PERFIS[key] = { l: limpo, c: cor };
    try {
      await setDoc(doc(db, "config", "perfis_extra"), { lista: novaLista }, { merge: true });
      t("Perfil criado!");
      setLabel("");
      setCor("#0a84ff");
      setSh(false);
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      t("Erro ao salvar perfil.", "w");
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {!sh ? (
        <button onClick={() => setSh(true)} style={BG({ width: "100%", padding: 12, borderRadius: 12 })}>
          + Novo Perfil
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar()}
            placeholder="Nome do novo perfil... (ex: Líder Decoração)"
            style={{ ...I, flex: 1, marginBottom: 0 }}
          />
          <input
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #2a2a2a", background: "transparent", cursor: "pointer", padding: 0 }}
          />
          <button onClick={criar} style={BG({ padding: "10px 16px", borderRadius: 12 })}>Criar</button>
          <button onClick={() => { setSh(false); setLabel(""); }} style={BK({ padding: "10px 16px", borderRadius: 12 })}>✕</button>
        </div>
      )}
    </div>
  );
}

function NovaFuncaoForm({ fns, setFns, t }) {
  const [sh, setSh] = useState(false);
  const [nome, setNome] = useState("");

  const criar = async () => {
    const limpo = nome.trim();
    if (!limpo) return;
    if (fns.some(f => f.toLowerCase() === limpo.toLowerCase())) {
      t("Essa função já existe.", "w");
      return;
    }
    const novasFns = [...fns, limpo].sort((a, b) => a.localeCompare(b));
    setFns(novasFns);
    setNome("");
    setSh(false);
    try {
      // Salva só as funções que não estão no FUNCOES_INIT original (extras criadas pelo admin)
      const extras = novasFns.filter(f => !FUNCOES_INIT.includes(f));
      await setDoc(doc(db, "config", "funcoes_extra"), { lista: extras }, { merge: true });
      t("Função criada!");
    } catch (err) {
      console.error("Erro ao salvar função:", err);
      t("Função criada localmente, mas houve erro ao salvar.", "w");
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {!sh ? (
        <button onClick={() => setSh(true)} style={BG({ width: "100%", padding: 12, borderRadius: 12 })}>
          + Nova Função
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar()}
            placeholder="Nome da nova função..."
            style={{ ...I, flex: 1, marginBottom: 0 }}
          />
          <button onClick={criar} style={BG({ padding: "10px 16px", borderRadius: 12 })}>Criar</button>
          <button onClick={() => { setSh(false); setNome(""); }} style={BK({ padding: "10px 16px", borderRadius: 12 })}>✕</button>
        </div>
      )}
    </div>
  );
}

function AddFuncaoDia({ dia, fns, onAdd }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const [pendente, setPendente] = useState(null); // função aguardando seleção de período
  const inputRef = useRef(null);
  const skipBlur = useRef(false);
  const dC = { Quinta: "#ff6b35", Sexta: "#bf5af2", Sábado: G.green, Domingo: "#ff9f0a" };
  const cor = dC[dia];
  const FUNCOES_COM_PERIODO = ["Panelas", "Louça", "Louças", "Servir comida", "Limpeza refeitório", "Servir Comida Pastores"];

  const filtrados = fns.filter(f =>
    f.toLowerCase().includes(busca.toLowerCase()) && busca.length > 0
  );

  const abrirDropdown = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
    }
    setAberto(true);
  };

  const confirmar = (fn) => {
    if (FUNCOES_COM_PERIODO.includes(fn)) {
      setPendente(fn);
      setBusca('');
      setAberto(false);
      return;
    }
    onAdd(fn);
    setBusca('');
    setAberto(false);
  };

  const confirmarPeriodo = (periodo) => {
    onAdd(`${pendente} - ${periodo}`);
    setPendente(null);
  };

  const dropdown = aberto && filtrados.length > 0
    ? ReactDOM.createPortal(
        <div style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 10, maxHeight: 160, overflowY: 'auto' }}>
          {filtrados.map((fn, i) => (
            <div
              key={i}
              onMouseDown={() => { skipBlur.current = true; confirmar(fn); }}
              style={{ padding: '9px 12px', color: G.td, fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {fn}
            </div>
          ))}
        </div>,
        document.body
      )
    : null;

  if (pendente) {
    return (
      <div style={{ background: '#1a1a1a', borderRadius: 10, padding: 10, border: `1px solid ${cor}44` }}>
        <div style={{ color: G.td, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{pendente} — qual período?</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => confirmarPeriodo('Almoço')} style={{ ...BG({ flex: 1, padding: '8px 10px', borderRadius: 9, fontSize: 12 }), background: cor }}>Almoço</button>
          <button onClick={() => confirmarPeriodo('Jantar')} style={{ ...BG({ flex: 1, padding: '8px 10px', borderRadius: 9, fontSize: 12 }), background: cor }}>Jantar</button>
          <button onClick={() => setPendente(null)} style={BK({ padding: '8px 10px', borderRadius: 9, fontSize: 12 })}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={busca}
          onChange={e => { setBusca(e.target.value); abrirDropdown(); }}
          onFocus={abrirDropdown}
          onBlur={() => { if (!skipBlur.current) setAberto(false); skipBlur.current = false; }}
          onKeyDown={e => e.key === 'Enter' && busca.trim() && confirmar(busca.trim())}
          placeholder={`+ Função na ${dia}...`}
          style={{ ...I, flex: 1, fontSize: 16, padding: '7px 10px', borderColor: `${cor}44` }}
        />
        <button
          onMouseDown={() => busca.trim() && confirmar(busca.trim())}
          style={{ ...BG({ padding: '7px 12px', borderRadius: 9, fontSize: 12 }), background: cor }}
        >+</button>
      </div>
      {dropdown}
    </div>
  );
}
