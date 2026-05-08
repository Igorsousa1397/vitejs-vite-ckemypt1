import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, collection, getDocs, onSnapshot, updateDoc, addDoc, deleteDoc, createUserWithEmailAndPassword, sendPasswordResetEmail } from './firebase';
import { useState, useMemo, useEffect, useRef } from 'react';
import { messaging, getToken, onMessage } from './firebase';
import { QRCodeSVG as QRCode } from "qrcode.react";
import { Html5QrcodeScanner } from 'html5-qrcode';
import jsPDF from 'jspdf'
import ExcelJS from 'exceljs';

const vibrar = (ms = 50) => {
  if ('vibrate' in navigator) navigator.vibrate(ms);
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const iniciarNotificacoes = async (userId = null) => {
  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token && userId) {
      await setDoc(doc(db, 'tokens', userId), {
        token,
        userId,
        data: new Date().toISOString()
      }, { merge: true });
    }
    return token;
  } catch (err) {
    console.error('Erro FCM:', err);
    return null;
  }
};

const G = {
  bg: '#0a0a0a',
  green: '#00c851',
  card: '#161616',
  cb: '#222',
  t: '#fff',
  td: 'rgba(255,255,255,.55)',
  tm: 'rgba(255,255,255,.28)',
};
const css = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}html,body{background:#0a0a0a;font-family:'Inter',sans-serif;}
input,select,button,textarea{font-family:'Inter',sans-serif;}
input::placeholder,textarea::placeholder{color:rgba(255,255,255,.25);}
input:focus,select:focus,textarea:focus{outline:none!important;border-color:rgba(0,200,81,.6)!important;}
::-webkit-scrollbar{width:0}
@keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes su{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes sp{0%{opacity:1}75%{opacity:1}100%{opacity:0}}
.fu{animation:fu .35s ease both}.sheet{animation:su .3s ease both}.splash{animation:sp 2.2s ease forwards}`;

const I = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 12,
  padding: '13px 15px',
  color: '#fff',
  fontSize: 14,
  width: '100%',
};
const GA = {
  color: '#00c851',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  marginTop: 10,
  display: 'block',
};
const BG = (x = {}) => ({
  background: G.green,
  color: '#000',
  border: 'none',
  borderRadius: 12,
  padding: '13px 18px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  ...x,
});
const BK = (x = {}) => ({
  background: 'transparent',
  border: '1px solid #2a2a2a',
  color: G.td,
  borderRadius: 12,
  padding: '11px 15px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  ...x,
});

const PERFIS = {
  admin: { l: 'Admin', c: '#00c851' },
  lider_geral: { l: 'Líder Geral', c: '#0a84ff' },
  pastor: { l: 'Pastor', c: '#bf5af2' },
  lider_staff: { l: 'Líder Staff', c: '#ff9f0a' },
  lider_quartos: { l: 'Líder Quartos', c: '#ff6b35' },
  lider_cozinha: { l: 'Líder Cozinha', c: '#ff2d55' },
  lider_templo: { l: 'Líder Templo', c: '#64b5f6' },
  servo: { l: 'Servo', c: '#636366' },
  lider_midia: { l: 'Líder Mídia', c: '#ffd60a' },
  lider_celula: { l: 'Líder de Célula', c: '#ff6b35' }
};

const canG = (p) =>
  ['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(p);
const canQ = (p) => ['admin', 'lider_quartos'].includes(p);
const canC = (p) => ['admin', 'lider_cozinha'].includes(p);
const canN = (p) => ['admin', 'lider_geral', 'pastor'].includes(p);
const canM = (p) => ['admin', 'lider_geral', 'lider_midia'].includes(p);

// ── tiny components ──────────────────────────────────────────────────────────
const Pill = ({ c, bg, tc }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 50,
      padding: '3px 10px',
      fontSize: 11,
      fontWeight: 700,
      background: bg || 'rgba(0,200,81,.12)',
      color: tc || G.green,
      whiteSpace: 'nowrap',
    }}
  >
    {c}
  </span>
);
const Tag = ({ c, ax, onX }) => (
  <span
    style={{
      background: '#1e1e1e',
      border: `1px solid ${ax ? ax + '33' : '#2a2a2a'}`,
      borderLeft: ax ? `3px solid ${ax}` : undefined,
      borderRadius: 50,
      padding: '5px 11px',
      color: G.td,
      fontSize: 12,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
    }}
  >
    {c}
    {onX && (
      <span
        onClick={onX}
        style={{
          cursor: 'pointer',
          color: 'rgba(255,80,80,.8)',
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
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
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
      textTransform: 'uppercase',
      marginTop: mt,
      marginBottom: 7,
    }}
  >
    {c}
  </div>
);
const Seg = ({ opts, val, set }) => (
  <div
    style={{
      display: 'flex',
      background: '#111',
      borderRadius: 12,
      padding: 3,
      gap: 3,
      border: '1px solid #1a1a1a',
    }}
  >
    {opts.map(([k, v]) => (
      <button
        key={k}
        onClick={() => set(k)}
        style={{
          flex: 1,
          background: val === k ? '#fff' : 'transparent',
          color: val === k ? '#000' : G.td,
          border: 'none',
          borderRadius: 10,
          padding: '9px 4px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {v}
      </button>
    ))}
  </div>
);
const Toast = ({ m, tp }) => (
  <div
    style={{
      position: 'fixed',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: tp === 'w' ? '#ff3b30' : tp === 'n' ? '#0a84ff' : G.green,
      color: tp ? '#fff' : '#000',
      borderRadius: 50,
      padding: '10px 20px',
      fontSize: 13,
      fontWeight: 700,
      zIndex: 9999,
      whiteSpace: 'nowrap',
    }}
  >
    {tp === 'n' ? '🔔 ' : ''}
    {m}
  </div>
);

function AddIn({ onAdd, ph = 'Adicionar...', mt = 12 }) {
  const [v, setV] = useState('');
  const go = () => {
    if (v.trim()) {
      onAdd(v.trim());
      setV('');
    }
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: mt }}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder={ph}
        style={{
          ...I,
          flex: 1,
          padding: '11px 13px',
          fontSize: 13,
          borderRadius: 10,
        }}
      />
      <button
        onClick={go}
        style={BG({ padding: '11px 15px', borderRadius: 10, fontSize: 13 })}
      >
        +
      </button>
    </div>
  );
}

function Acc({ title, right, ax, children, onDel, def = false }) {
  const [o, setO] = useState(def);
  return (
    <div style={{
      background: G.card,
      border: `1px solid ${G.cb}`,
      borderLeft: ax ? `3px solid ${ax}` : `1px solid ${G.cb}`,
      borderRadius: 16,
      marginBottom: 8,
      overflow: 'visible', // ← era 'hidden', trocar para 'visible'
    }}>
      <div
        onClick={() => setO(!o)}
        style={{
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            color: G.t,
            fontWeight: 600,
            fontSize: 14,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
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
                onDel();
              }}
              style={{
                color: 'rgba(255,60,60,.4)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              🗑
            </span>
          )}
          <span
            style={{
              color: G.tm,
              fontSize: 12,
              transition: 'transform .2s',
              display: 'inline-block',
              transform: o ? 'rotate(180deg)' : 'none',
            }}
          >
            ▾
          </span>
        </div>
      </div>
      {o && (
        <>
          <div style={{ height: 1, background: '#1e1e1e' }} />
          <div style={{ padding: '14px 16px' }}>{children}</div>
        </>
      )}
    </div>
  );
}

function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)' }}
      />
      <div
        className="sheet"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#141414',
          borderRadius: '20px 20px 0 0',
          padding: '0 0 40px',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 20px 16px',
            borderBottom: '1px solid #1e1e1e',
          }}
        >
          <span style={{ color: G.t, fontWeight: 700, fontSize: 16 }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={BK({ padding: '6px 12px', borderRadius: 10, fontSize: 13 })}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '20px 20px 0' }}>{children}</div>
      </div>
    </div>
  );
}

// ── DATA ─────────────────────────────────────────────────────────────────────
const FUNCOES_INIT = [
  'Som',
  'Banheiro',
  'Cozinha',
  'Intercessão',
  'Templo',
  'Malas',
  'Crachá',
  'Refeitório',
  'Cantina',
  'Ônibus — Responsável',
  'Ônibus — Servo Templo',
  'Louça',
];

const QH_INIT = [];

const QM_INIT = [{ num: 12, maes: true, lim: 9, servos: [], enc: [] }];


const ON_INIT = [];
const MINS_INIT = [
  { id: 1, dia: 'Sexta', nome: 'Encontro com o Mundo, Encontro com Deus', hora: '23:00', sent: false },
  { id: 2, dia: 'Sábado', nome: 'Ministração Peniel', hora: '08:30', sent: false },
  { id: 3, dia: 'Sábado', nome: 'Ministração Cura', hora: '10:30', sent: false },
  { id: 4, dia: 'Sábado', nome: 'Ministração Escamas', hora: '15:30', sent: false },
  { id: 5, dia: 'Sábado', nome: 'Ministração Libertação', hora: '17:00', sent: false },
  { id: 6, dia: 'Sábado', nome: 'Ministração Amor de Deus', hora: '21:30', sent: false },
  { id: 7, dia: 'Domingo', nome: 'Ministração Sonhos', hora: '08:30', sent: false },
  { id: 8, dia: 'Domingo', nome: 'Unção de Multiplicação', hora: '09:30', sent: false },
  { id: 9, dia: 'Domingo', nome: 'Batismo com Espírito Santo', hora: '10:30', sent: false },
  { id: 10, dia: 'Domingo', nome: 'Oração Estilo de Vida', hora: '15:00', sent: false },
  { id: 11, dia: 'Domingo', nome: 'Recados Pós Encontro', hora: '16:00', sent: false },
];

const AVISOS_TEMPLATES = [
  { txt: '⏰ Faltam 15 minutos para o Ato. Preparem-se!' },
  { txt: '⏰ Faltam 10 minutos para o Ato. Preparem-se!' },
  { txt: '⏰ Faltam 5 minutos para o Ato. Preparem-se!' },
  { txt: '☕ Café da Manhã às 08h30.' },
  { txt: '🍽️ Almoço às 13h. Retorno às 15h30.' },
  { txt: '☕ Café da tarde às 16h40.' },
  { txt: '🍽️ Jantar às 20h.' },
  { txt: '🍽️ Almoço às 13h30. Retorno às 15h.' },
  { txt: '📢 Recados pós encontro. Obrigado por servir!' },
];

const REST_INIT = [
  {
    id: 1,
    cel: 'Célula Ebenézer',
    ps: [
      'Rita Sousa',
      'Iraci Sousa',
      'Nelci Silva',
      'Aline Silva',
      'Kelly Cristina',
      'Gabrielli Ferreira',
    ],
  },
  {
    id: 2,
    cel: 'Célula Getsêmani',
    ps: ['Nathalia Stefany', 'Helen Christine', 'Thalita Farias'],
  },
];
const LOUÇA_INIT = [
  {
    id: 1,
    r: 'Sexta noite — Pratos',
    s: ['Ev. Bárbara', 'Paulinha', 'Larissa'],
  },
  { id: 2, r: 'Sexta noite — Panelas', s: ['Ev. Gabriel', 'Nicolas', 'Luan'] },
  {
    id: 3,
    r: 'Almoço Sábado — Pratos',
    s: ['Caroline', 'Tauani', 'Letícia', 'Ana Clara'],
  },
  {
    id: 4,
    r: 'Almoço Sábado — Panelas',
    s: ['Denis', 'José', 'Samuel', 'Marcio'],
  },
  { id: 5, r: 'Janta Sábado — Pratos', s: ['Luana', 'Isabel', 'Tais', 'Duda'] },
  {
    id: 6,
    r: 'Janta Sábado — Panelas',
    s: ['Bruno', 'Igor', 'Thalyson', 'Tião'],
  },
  {
    id: 7,
    r: 'Almoço Domingo — Pratos',
    s: ['Ev. Beatriz', 'Jaqueline', 'Leia', 'Amanda'],
  },
  {
    id: 8,
    r: 'Almoço Domingo — Panelas',
    s: ['Ev. Caíque', 'João Clesio', 'Davi', 'Valter'],
  },
];
const USERS_INIT = [
  {
    id: 1,
    nome: 'Admin',
    senha: 'admin123',
    perfil: 'admin',
    primeiro: false,
    funcoes: [],
    ativo: true,
    pago: true,
  },
  {
    id: 2,
    nome: 'Pr. Eliel',
    senha: '123456',
    perfil: 'pastor',
    primeiro: true,
    funcoes: [],
    ativo: true,
    pago: true,
  },
  {
    id: 3,
    nome: 'Thamires Lima',
    senha: '123456',
    perfil: 'lider_geral',
    primeiro: true,
    funcoes: [],
    ativo: true,
    pago: false,
  },
  {
    id: 4,
    nome: 'Silas Costa',
    senha: '123456',
    perfil: 'lider_staff',
    primeiro: true,
    funcoes: ['Banheiro'],
    ativo: true,
    pago: true,
  },
  {
    id: 5,
    nome: 'Caio Silva',
    senha: '123456',
    perfil: 'servo',
    primeiro: true,
    funcoes: ['Som'],
    ativo: false,
    pago: false,
  },
];
const UNI_INIT = [];
const DATA_LIMITE_UNI = '2025-12-01';
const CK_INIT = [
  { id: 1, nome: 'Ana Paula Santos', gen: 'M', ok: true, on: '1' },
  { id: 2, nome: 'Maria Fernanda', gen: 'M', ok: false, on: null },
  { id: 3, nome: 'João Pedro Alves', gen: 'H', ok: true, on: '2' },
  { id: 4, nome: 'Marcos Vinícius', gen: 'H', ok: false, on: null },
];
const LABELS = {
  home: 'Início',
  servos: 'Servos',
  checkin: 'Check-in',
  mins: 'Ministrações',
  quartos: 'Quartos',
  enc: 'Encontristas',
  onibus: 'Ônibus',
  rest: 'Restrições',
  img: 'Uso de Imagem',
  info: 'Informações',
  ach: 'Achados & Perdidos',
  crac: 'Crachás',
  saude: 'Saúde',
  louça: 'Louça',
  equipes: 'Equipes',
  back: 'Back Office',
  uniformes: 'Uniformes',
  termo: 'Termo',
};

// ── SPLASH ───────────────────────────────────────────────────────────────────
function Splash({ done }) {
  return (
    <div className="splash" style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <style>{css}</style>
      <div style={{ textAlign: 'center' }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus"
          style={{ width: 200, mixBlendMode: 'screen', display: 'block', margin: '0 auto' }} />
      </div>
    </div>
  );
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, onVoltar }){
  const [email,setEmail]=useState('');
  const [senha,setSenha]=useState('');
  const [showSenha,setShowSenha]=useState(false);
  const [e,setE]=useState('');
  const [load,setLoad]=useState(false);

  const go=async()=>{
    if(!email.trim()||!senha.trim()){setE('Preencha todos os campos.');return;}
    setLoad(true);setE('');
    try{
      const cred=await signInWithEmailAndPassword(auth,email,senha);
      const snap=await getDoc(doc(db,'users',cred.user.uid));
      if (snap.data().ativo === false) {
        await signOut(auth);
        setE('Seu acesso está desativado. Fale com o administrador.');
        setLoad(false);
        return;
      }
      if(!snap.exists()){setE('Usuário não encontrado no sistema.');setLoad(false);return;}
      onLogin({id:cred.user.uid,...snap.data()});
    }catch(err){
      setE('Email ou senha incorretos.');
    }
    setLoad(false);
  };

  return(
    <div style={{minHeight:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <style>{css}</style>
      {/* Botão voltar */}
      <button onClick={onVoltar}
        style={{position:'fixed',top:16,left:16,background:'transparent',border:'1px solid #2a2a2a',color:'rgba(255,255,255,.6)',borderRadius:10,padding:'8px 13px',fontSize:13,fontWeight:700,cursor:'pointer',zIndex:10}}>
        ←
      </button>
      <div style={{width:'100%',maxWidth:360}}>
        <div style={{marginBottom:36,textAlign:'center'}}>
          <img src="/IMG_2408.PNG" alt="Encontro com Deus"
            style={{width:180,mixBlendMode:'screen',display:'block',margin:'0 auto 4px'}}/>
          <div style={{color:G.tm,fontSize:12,letterSpacing:2,textTransform:'uppercase'}}>Portal do Encontro</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={I}/>
          <div style={{position:'relative'}}>
            <input
              placeholder="Senha"
              type={showSenha ? 'text' : 'password'}
              value={senha}
              onChange={e=>setSenha(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&go()}
              style={{...I, paddingRight:44}}
            />
            <button onClick={()=>setShowSenha(!showSenha)}
              style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:G.tm,cursor:'pointer',fontSize:16,padding:4}}>
              {showSenha ? '◯' : '◉'}
            </button>
          </div>
          {e&&<div style={{color:'#ff3b30',fontSize:12,background:'rgba(255,59,48,.1)',borderRadius:10,padding:'10px 14px'}}>{e}</div>}
          <button onClick={() => { vibrar(); go(); }} disabled={load} style={BG({width:'100%',padding:14,borderRadius:14,marginTop:4,opacity:load?0.7:1})}>
            {load?'Entrando...':'Entrar'}
          </button>
          <div style={{color:G.tm,fontSize:12,textAlign:'center'}}>Solicite acesso ao administrador</div>
        </div>
        <div style={{textAlign:'center',marginTop:40}}>
          <img src="/IMG_2409.PNG" alt="Fonte - Comunidade Peniel"
            style={{width:110,mixBlendMode:'screen',opacity:0.85}}/>
        </div>
      </div>
    </div>
  );
}


// ── WELCOME ──────────────────────────────────────────────────────────────────
function Welcome({ onServos, onEncontrista }) {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, paddingBottom: 48 }}>
      <style>{css}</style>
      <img src="/campo.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus"
          style={{ width: 280, mixBlendMode: 'screen', display: 'block', margin: '0 auto 40px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <button onClick={onEncontrista}
            style={BG({ width: '100%', padding: 16, borderRadius: 16, fontSize: 16 })}>
            Encontrista
          </button>
          <button onClick={onServos}
            style={{ ...BK({ width: '100%', padding: 16, borderRadius: 16, fontSize: 16 }), borderColor: 'rgba(255,255,255,.3)', color: '#fff' }}>
            Servo
          </button>
        </div>
        <img src="/IMG_2409.PNG" alt="Fonte - Comunidade Peniel"
          style={{ width: 90, mixBlendMode: 'screen', opacity: 0.8, margin: '0 auto' }} />
      </div>
    </div>
  );
}

// ── INSCRIÇÃO ─────────────────────────────────────────────────────────────────
const CELULAS = [
  'Betesda', 'Beraká', 'Reobote', 'Baluarte', 'Emaús', 'Lavi', 'Fire',
  'Kerygma', 'Ebenézer', 'Betel', 'Transbordo', 'Ekklesia', 'Atos 29',
  'Yeshua', 'Identidade', 'Pedra Angular', 'Carta Viva', 'Luz do mundo',
  'Gileade', 'Ekballo', 'A Forja', 'Nahal', 'Deus Forte', 'Essência',
  'Jeova Rafah', 'Peniel - Santa Catarina', 'Outra', 'Não faço parte de célula',
];

function Inscricao({ onVoltar, onPago }) {
  const [form, setForm] = useState({
    igreja: '', nome: '', cpf: '', nascimento: '', sexo: '',
    whatsapp: '', celula: '', camiseta: '', emergencia: '',
    medicamento: '', doenca: '', autorizaImagem: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [encId, setEncId] = useState(null);
  const [msgPagamento, setMsgPagamento] = useState('');

  const salvar = async () => {
      if (!form.nome.trim() || !form.sexo || !form.whatsapp.trim() || !form.emergencia.trim() || !form.medicamento.trim() || !form.doenca.trim()) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }
    if (!form.autorizaImagem) {
      alert('Responda sobre o uso de imagem');
      return;
    }
    const cpfLimpo = form.cpf.replace(/[\.\-]/g, '').trim();
    if (cpfLimpo && cpfLimpo.length !== 11) {
      alert('CPF inválido. Deve ter 11 dígitos.');
      return;
    }
    if (form.nascimento) {
      const nascimento = new Date(form.nascimento);
      const hoje = new Date();
      const idade = hoje.getFullYear() - nascimento.getFullYear() -
        (hoje < new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate()) ? 1 : 0);
      if (idade < 14) {
        alert('É necessário ter pelo menos 14 anos para se inscrever.');
        return;
      }
    }
    setSaving(true);
    try {
      const snap = await getDocs(collection(db, 'encontristas'));
      if (cpfLimpo) {
        const cpfExiste = snap.docs.some(d => d.data().cpf === cpfLimpo);
        if (cpfExiste) {
          alert('Este CPF já está cadastrado!');
          setSaving(false);
          return;
        }
      }
      const waLimpo = form.whatsapp.replace(/\D/g, '');
      const waExiste = snap.docs.some(d => d.data().whatsapp?.replace(/\D/g, '') === waLimpo);
      if (waExiste) {
        alert('Este WhatsApp já está cadastrado!');
        setSaving(false);
        return;
      }
      const docRef = await addDoc(collection(db, 'encontristas'), {
        ...form,
        cpf: cpfLimpo,
        criadoEm: new Date().toLocaleString('pt-BR'),
      });
      setEncId(docRef.id);
      setDone(true);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro: ' + err.message);
    }
    setSaving(false);
  };

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{css}</style>
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus"
          style={{ width: 180, mixBlendMode: 'screen', display: 'block', margin: '0 auto 24px' }} />
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Inscrição realizada!</div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Para confirmar sua vaga, realize o pagamento abaixo.
        </div>
        <button
          onClick={async () => {
            vibrar(50);
            try {
              const win = window.open('', '_blank');
              const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encontristaId: encId, nome: form.nome, email: '' }),
              });
              const data = await res.json();
              if (data.init_point) {
                win.location.href = data.init_point;
              } else {
                win.close();
                alert('Erro ao gerar pagamento.');
              }
            } catch (err) {
              alert('Erro ao gerar pagamento.');
            }
          }}
          style={{ ...BG({ width: '100%', padding: 16, borderRadius: 14, fontSize: 15, marginBottom: 12 }), background: '#009ee3' }}>
          Pagar com Cartão, Boleto ou PIX
        </button>
        <div style={{ background: 'rgba(251,146,60,.1)', border: '1px solid rgba(251,146,60,.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 12, textAlign: 'left' }}>
          <div style={{ color: '#fb923c', fontWeight: 800, fontSize: 13, marginBottom: 6, textAlign: 'center' }}>IMPORTANTE</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, lineHeight: 1.6 }}>
            Após realizar o pagamento, retorne a este aplicativo e clique em "Já paguei — verificar" para obter seu QR Code de acesso ao evento. Guarde-o com cuidado — ele será necessário no check-in.
          </div>
        </div>
        <button
          onClick={async () => {
            vibrar(50);
            const snap = await getDoc(doc(db, 'encontristas', encId));
            if (snap.exists() && snap.data().pago) {
              onPago(encId);
            } else {
              setMsgPagamento('Pagamento ainda não confirmado. Aguarde alguns instantes e tente novamente.');
              setTimeout(() => setMsgPagamento(''), 4000);
            }
          }}
          style={BG({ width: '100%', padding: 14, borderRadius: 14, marginBottom: 8 })}>
          ✓ Já paguei — verificar
        </button>
        {msgPagamento && (
          <div style={{ background: 'rgba(255,59,48,.1)', border: '1px solid rgba(255,59,48,.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, color: '#ff6b6b', fontSize: 13, lineHeight: 1.5 }}>
            {msgPagamento}
          </div>
        )}
        <button onClick={onVoltar} style={BK({ width: '100%', padding: 14, borderRadius: 14 })}>
          Voltar
        </button>
      </div>
    </div>
  );

  const iI = { ...I, marginBottom: 0 };
  const SLi = ({ c }) => (
    <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 20 }}>{c}</div>
  );
  const Radio = ({ val, set, opts }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {opts.map(o => (
        <button key={o} onClick={() => set(o)}
          style={{ ...BK({ padding: '8px 14px', borderRadius: 50, fontSize: 13 }), borderColor: val === o ? 'rgba(0,200,81,.5)' : '#2a2a2a', color: val === o ? G.green : G.td, background: val === o ? 'rgba(0,200,81,.08)' : 'transparent' }}>
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 40 }}>
      <style>{css}</style>
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={onVoltar} style={BK({ padding: '8px 13px', borderRadius: 10, fontSize: 13, fontWeight: 700 })}>←</button>
        <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Inscrição — Encontro com Deus</span>
      </div>
      <div style={{ padding: '20px 20px 0', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ background: 'rgba(0,200,81,.08)', border: '1px solid rgba(0,200,81,.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 8, color: G.green, fontSize: 13, lineHeight: 1.6 }}>
          Dias 26, 27 e 28 de Junho · Estrada do Tronco 485, Itaquaquecetuba
        </div>

        <SLi c="Igreja *" />
        <Radio val={form.igreja} set={v => setForm({ ...form, igreja: v })}
          opts={['Fonte Cajamar', 'Fonte Itajaí', 'Fonte Barueri']} />

        <SLi c="Nome completo *" />
        <input placeholder="Sem abreviações" value={form.nome}
          onChange={e => setForm({ ...form, nome: e.target.value })} style={iI} />

        <SLi c="CPF *" />
        <input
          placeholder="000.000.000-00"
          value={form.cpf}
          maxLength={14}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9xX]/g, '').slice(0, 11);
            const mask = v
              .replace(/(\w{3})(\w)/, '$1.$2')
              .replace(/(\w{3})(\w)/, '$1.$2')
              .replace(/(\w{3})(\w{1,2})$/, '$1-$2');
            setForm({ ...form, cpf: mask });
          }}
          style={iI}
        />

        <SLi c="Data de Nascimento *" />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={form.nascimento?.split('-')[2] || ''}
            onChange={e => setForm({ ...form, nascimento: `${form.nascimento?.split('-')[0] || ''}-${form.nascimento?.split('-')[1] || ''}-${e.target.value}` })}
            style={{ ...iI, flex: 1 }}>
            <option value="">Dia</option>
            {Array.from({length: 31}, (_, i) => i + 1).map(d => (
              <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
            ))}
          </select>
          <select value={form.nascimento?.split('-')[1] || ''}
            onChange={e => setForm({ ...form, nascimento: `${form.nascimento?.split('-')[0] || ''}-${e.target.value}-${form.nascimento?.split('-')[2] || ''}` })}
            style={{ ...iI, flex: 1 }}>
            <option value="">Mês</option>
            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <select value={form.nascimento?.split('-')[0] || ''}
            onChange={e => setForm({ ...form, nascimento: `${e.target.value}-${form.nascimento?.split('-')[1] || ''}-${form.nascimento?.split('-')[2] || ''}` })}
            style={{ ...iI, flex: 1 }}>
            <option value="">Ano</option>
            {Array.from({length: 80}, (_, i) => new Date().getFullYear() - 14 - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <SLi c="Sexo *" />
        <Radio val={form.sexo} set={v => setForm({ ...form, sexo: v })}
          opts={['Feminino', 'Masculino']} />

        <SLi c="WhatsApp *" />
        <input
          placeholder="(11) 99999-9999"
          value={form.whatsapp}
          type="tel"
          maxLength={15}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 11);
            const mask = v
              .replace(/(\d{2})(\d)/, '($1) $2')
              .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
            setForm({ ...form, whatsapp: mask });
          }}
          style={iI}
        />

        <SLi c="Célula *" />
        <select value={form.celula} onChange={e => setForm({ ...form, celula: e.target.value })} style={iI}>
          <option value="">Selecione sua célula...</option>
          {CELULAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <SLi c="Tamanho da Camiseta *" />
        <Radio val={form.camiseta} set={v => setForm({ ...form, camiseta: v })}
          opts={['P', 'M', 'G', 'GG', 'EXG', 'G1', 'G2', 'G3']} />

        <SLi c="Autoriza uso de imagem? *" />
        <Radio val={form.autorizaImagem} set={v => setForm({ ...form, autorizaImagem: v })}
          opts={['Sim', 'Não']} />

        <SLi c="Contato de Emergência *" />
        <input placeholder="Nome e telefone" value={form.emergencia}
          onChange={e => setForm({ ...form, emergencia: e.target.value })} style={iI} />

        <SLi c="Toma algum medicamento? *" />
        <input placeholder="Qual?" value={form.medicamento}
          onChange={e => setForm({ ...form, medicamento: e.target.value })} style={iI} />

        <SLi c="Tem alguma doença crônica *?" />
        <input placeholder="Qual?" value={form.doenca}
          onChange={e => setForm({ ...form, doenca: e.target.value })} style={iI} />

        <button onClick={salvar} disabled={saving}
          style={BG({ width: '100%', padding: 16, borderRadius: 16, marginTop: 28, fontSize: 15, opacity: saving ? 0.7 : 1 })}>
          {saving ? 'Enviando...' : 'Enviar Inscrição'}
        </button>
      </div>
    </div>
  );
}

function Termo({ cpf, onVoltar }) {
  const [enc, setEnc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rg, setRg] = useState('');
  const [cep, setCep] = useState('');
  const [num, setNum] = useState('');
  const [comp, setComp] = useState('');
  const [end, setEnd] = useState('');
  const [loadCep, setLoadCep] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [saving, setSaving] = useState(false);

  const buscarCep = async (valor) => {
    const limpo = valor.replace(/\D/g, '');
    if (limpo.length !== 8) return;
    setLoadCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEnd(`${data.logradouro}, ${data.bairro}, ${data.localidade}/${data.uf}`);
      }
    } catch {}
    setLoadCep(false);
  };

  useEffect(() => {
    const buscar = async () => {
      try {
        const snap = await getDocs(collection(db, 'encontristas'));
        const found = snap.docs.find(d => d.data().cpf === cpf.replace(/\D/g, ''));
        if (found) {
          const data = found.data();
          setEnc({ id: found.id, ...data });
          if (data.termoAssinado) setAssinado(true);
          if (data.rg) setRg(data.rg);
          if (data.endereco) setEnd(data.endereco);
        }
      } catch (err) {
        console.error('Erro ao buscar:', err);
      } finally {
        setLoading(false);
      }
    };
    buscar();
  }, [cpf]);

  const assinar = async () => {
    if (!rg.trim() || !end.trim() || !num.trim() || !comp.trim()) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!aceite) {
      alert('Você precisa aceitar os termos para assinar.');
      return;
    }
    setSaving(true);
    const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
    const endCompleto = `${end}, ${num}, ${comp}`;
    const termoTexto = `Termo de Concordância...`; // mantém o texto completo

    try {
      await setDoc(doc(db, 'encontristas', enc.id), {
        rg,
        endereco: endCompleto,
        termoAssinado: true,
        termoAssinadoEm: agora,
      }, { merge: true });
    } catch (err) {
      console.error('Erro ao salvar encontrista:', err);
      setSaving(false);
      alert('Erro ao salvar. Tente novamente.');
      return;
    }

    try {
      await addDoc(collection(db, 'termos'), {
        encontristaId: enc.id,
        nome: enc.nome,
        cpf: enc.cpf,
        rg,
        endereco: endCompleto,
        sexo: enc.sexo,
        igreja: enc.igreja,
        autorizaImagem: enc.autorizaImagem,
        assinadoEm: agora,
        termoTexto,
      });
    } catch (err) {
      console.error('Erro ao salvar termo:', err);
      // não bloqueia — o encontrista já foi marcado como assinado
    }

    setAssinado(true);
    setSaving(false);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 14 }}>Carregando...</div>
    </div>
  );

  if (!enc) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>CPF não encontrado</div>
        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 13, marginBottom: 24 }}>Verifique o CPF informado ou fale com a organização.</div>
        <button onClick={onVoltar} style={BK({ padding: '12px 24px', borderRadius: 12 })}>Voltar</button>
      </div>
    </div>
  );

  if (assinado) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{css}</style>
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus"
          style={{ width: 140, mixBlendMode: 'screen', display: 'block', margin: '0 auto 20px' }} />
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Termo assinado!</div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, lineHeight: 1.6 }}>
          Seu termo foi registrado com sucesso. Pode fechar esta página.
        </div>
      </div>
    </div>
  );

  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#000', paddingBottom: 60 }}>
      <style>{css}</style>
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center' }}>Termo de Concordância</div>
      </div>
      <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>
          Termo de Concordância com as Ministrações e Autorização de Uso de Imagem
        </div>
        <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 11, textAlign: 'center', marginBottom: 24 }}>
          Encontro com Deus — 26, 27 e 28 de junho de 2026
        </div>

        <div style={{ background: '#111', borderRadius: 14, padding: '16px', marginBottom: 20, border: '1px solid #222' }}>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Dados do Signatário</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>Nome</div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{enc.nome}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>CPF</div>
              <div style={{ color: '#fff', fontSize: 14 }}>{enc.cpf}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11 }}>Autorização de uso de imagem</div>
              <div style={{ color: '#fff', fontSize: 14 }}>{enc.autorizaImagem || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginBottom: 4 }}>RG *</div>
              <input
                placeholder="Digite seu RG"
                value={rg}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 9);
                  const mask = v
                    .replace(/(\d{2})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d{1})$/, '$1-$2');
                  setRg(mask);
                }}
                style={I}
              />
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginBottom: 4 }}>CEP</div>
              <input
                placeholder="00000-000"
                value={cep}
                maxLength={9}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                  const mask = v.replace(/(\d{5})(\d)/, '$1-$2');
                  setCep(mask);
                  buscarCep(v);
                }}
                style={I}
              />
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginBottom: 4 }}>
                Número *
              </div>
              <input
                placeholder="Ex: 241"
                value={num}
                onChange={e => setNum(e.target.value)}
                style={I}
              />
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginBottom: 4 }}>Complemento *</div>
              <input
                placeholder="Ex: Apto 12, Casa 1"
                value={comp}
                onChange={e => setComp(e.target.value)}
                style={I}
              />
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 11, marginBottom: 4 }}>
                Endereço * {loadCep && <span style={{ color: G.tm }}>buscando...</span>}
              </div>
              <input
                placeholder="Rua, número, bairro, cidade"
                value={end}
                onChange={e => setEnd(e.target.value)}
                style={I}
              />
            </div>
          </div>
        </div>

        <div style={{ background: '#0d0d0d', borderRadius: 14, padding: '16px', marginBottom: 20, border: '1px solid #1a1a1a' }}>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, lineHeight: 1.8 }}>
            <p style={{ marginBottom: 12 }}>
              O(a) signatário(a) manifesta concordância com o registro, utilização e divulgação de sua imagem em mídias sociais da <strong style={{ color: '#fff' }}>Igreja Apostólica Fonte</strong> (CNPJ 52.268.825/0001-95), localizada à Rua Catiguá nº 130, Ipês (Polvilho), Cajamar/SP, CEP 07750-000.
            </p>
            <p style={{ marginBottom: 12 }}>
              A autorização é referente a imagens e vídeos do evento <strong style={{ color: '#fff' }}>"Encontro com Deus"</strong>, nos dias 26, 27 e 28 de junho de 2026.
            </p>
            <p style={{ marginBottom: 12 }}>
              Também concorda com as regras do evento, destacando que <strong style={{ color: '#fff' }}>não é permitido nenhum tipo de registro e/ou gravação pelos inscritos</strong> — apenas pela organização.
            </p>
            <p style={{ marginBottom: 0 }}>
              Por fim, declara que toda participação foi voluntária, em conformidade com a legislação vigente, não infringindo o art. 208 do Código Penal.
            </p>
          </div>
        </div>

        <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
          Assinado em: Cajamar, {hoje}.<br />
          Igreja Apostólica Fonte (IF) — Av. Tenente Marques, 5014, Portais (Polvilho), Cajamar/SP, CEP 07790-845 | Tel: (11) 94718-7017
        </div>

        <div
          onClick={() => setAceite(!aceite)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#111', borderRadius: 14, padding: '14px', marginBottom: 20, border: `1px solid ${aceite ? 'rgba(0,200,81,.4)' : '#222'}`, cursor: 'pointer' }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${aceite ? G.green : '#444'}`, background: aceite ? 'rgba(0,200,81,.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            {aceite && <span style={{ color: G.green, fontSize: 13, fontWeight: 800 }}>✓</span>}
          </div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, lineHeight: 1.6 }}>
            Li e concordo com todos os termos acima, incluindo as regras do evento e a autorização de uso de imagem.
          </div>
        </div>

        <button
          onClick={assinar}
          disabled={saving}
          style={BG({ width: '100%', padding: 16, borderRadius: 14, fontSize: 15, opacity: saving ? 0.7 : 1 })}>
          {saving ? 'Assinando...' : 'Assinar Termo'}
        </button>
      </div>
    </div>
  );
}

function TermoAdminV({ encH, encM, t }) {
  const [aba, setAba] = useState('enviar');
  const [s, setS] = useState('');
  const [termos, setTermos] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'termos'), (snap) => {
      setTermos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const todos = [...encH, ...encM].filter(e => e.pago && e.chegou && e.onibus);

  const lista = useMemo(() => {
    const filtrado = todos.filter(e =>
      e.nome.toLowerCase().includes(s.toLowerCase())
    );
    if (aba === 'enviar') return filtrado.filter(e => !e.termoEnviado && !e.termoAssinado);
    if (aba === 'aguardando') return filtrado.filter(e => e.termoEnviado && !e.termoAssinado);
    return filtrado.filter(e => e.termoAssinado);
  }, [todos, aba, s]);

  const enviar = async (enc) => {
    const tel = enc.whatsapp?.replace(/\D/g, '');
    if (!tel) { t('WhatsApp não cadastrado'); return; }
    const link = `https://servos-peniel.vercel.app?termo=true&cpf=${enc.cpf}`;
    const msg = encodeURIComponent(`Olá ${enc.nome.split(' ')[0]}! Assine o termo do evento Encontro com Deus: ${link}`);
    await setDoc(doc(db, 'encontristas', enc.id), { termoEnviado: true }, { merge: true });
    t('Termo enviado!');
    window.location.href = `https://wa.me/55${tel}?text=${msg}`;
  };

  const exportarPDF = (enc) => {
    const termo = termos.find(t => t.encontristaId === enc.id);
    if (!termo) { alert('Dados do termo não encontrados.'); return; }
    
    const pdf = new jsPDF();
    const margin = 20;
    const pageW = 210;
    let y = 20;

    const line = (txt, size = 11, bold = false, align = 'left') => {
      pdf.setFontSize(size);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      const maxW = pageW - margin * 2;
      const lines = pdf.splitTextToSize(String(txt || ''), maxW);
      const x = align === 'center' ? pageW / 2 : margin;
      pdf.text(lines, x, y, { align });
      y += lines.length * (size * 0.45) + 5;
    };

    const hr = () => {
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;
    };

    // Cabeçalho
    pdf.setFillColor(240, 240, 240);
    pdf.rect(0, 0, pageW, 30, 'F');
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 30, 30);
    pdf.text('Igreja Apostólica Fonte', pageW / 2, 13, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('R. Catiguá, 130 - Ipês (Polvilho), Cajamar - SP, 07750-000 | Tel: (11) 94718-7017', pageW / 2, 21, { align: 'center' });
    y = 40;

    // Título
    pdf.setTextColor(30, 30, 30);
    line('Termo de Concordância com as Ministrações e Autorização de Uso de Imagem', 14, true, 'center');
    y += 2;
    hr();

    // Dados do signatário
    line('DADOS DO SIGNATÁRIO', 10, true);
    y += 2;
    
    const campo = (label, valor) => {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(120, 120, 120);
      pdf.text(label, margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(11);
      const lines = pdf.splitTextToSize(String(valor || '—'), 170);
      y += 5;
      pdf.text(lines, margin, y);
      y += lines.length * 6 + 4;
    };

    campo('Nome', termo.nome);
    campo('CPF', termo.cpf);
    campo('RG', termo.rg);
    campo('Endereço', termo.endereco);
    campo('Autorização de uso de imagem', termo.autorizaImagem);
    campo('Sexo', termo.sexo);
    campo('Igreja', termo.igreja || '—');
    
    y += 2;
    hr();

    // Texto do termo
    line('TERMO', 10, true);
    y += 2;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);
    const textoLimpo = (termo.termoTexto || '').replace(/\\n/g, '\n');
    const paragrafos = textoLimpo.split('\n').filter(p => p.trim());
    paragrafos.forEach(p => {
      const lines = pdf.splitTextToSize(p, 170);
      if (y + lines.length * 6 > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(lines, margin, y);
      y += lines.length * 6 + 4;
    });

    y += 8;
    hr();

    // Assinatura
    line(`Assinado em: ${termo.assinadoEm || '—'}`, 10);
    y += 10;
    pdf.setDrawColor(30, 30, 30);
    pdf.line(margin, y, margin + 80, y);
    y += 6;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(termo.nome, margin, y);
    y += 5;
    pdf.setTextColor(120, 120, 120);
    pdf.text('Assinatura do participante', margin, y);

    // Rodapé
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Igreja Apostólica Fonte — CNPJ 52.268.825/0001-95`, margin, 287);
      pdf.text(`Página ${i} de ${totalPages}`, pageW - margin, 287, { align: 'right' });
    }

    pdf.save(`termo_${termo.nome.trim().replace(/ /g, '_')}.pdf`);
  };

  const cnt = (a) => {
    if (a === 'enviar') return todos.filter(e => !e.termoEnviado && !e.termoAssinado).length;
    if (a === 'aguardando') return todos.filter(e => e.termoEnviado && !e.termoAssinado).length;
    return todos.filter(e => e.termoAssinado).length;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          ['enviar', 'Enviar'],
          ['aguardando', 'Aguardando'],
          ['assinado', 'Assinados'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setAba(key)}
            style={{ flex: 1, background: aba === key ? G.green : '#111', color: aba === key ? '#000' : G.td, border: 'none', borderRadius: 10, padding: '9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {label} ({cnt(key)})
          </button>
        ))}
      </div>

      <input
        value={s}
        onChange={e => setS(e.target.value)}
        placeholder="Buscar por nome..."
        style={{ ...I, marginBottom: 10 }}
      />

      {lista.length === 0 && (
        <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>
          Nenhum encontrista aqui.
        </div>
      )}
      {lista.map(enc => (
        <div key={enc.id} className="fu"
          style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${aba === 'assinado' ? G.green : aba === 'aguardando' ? '#ff9f0a' : '#2a2a2a'}`, borderRadius: 13, padding: '12px 14px', marginBottom: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>{enc.nome}</div>
            <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
              {enc.sexo} · {enc.igreja || '—'}
            </div>
            {aba === 'assinado' && enc.termoAssinadoEm && (
              <div style={{ color: G.green, fontSize: 11, marginTop: 2 }}>
                Assinado em {enc.termoAssinadoEm}
              </div>
            )}
          </div>
          {aba === 'enviar' && (
            <button onClick={() => enviar(enc)}
              style={BG({ padding: '8px 14px', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap' })}>
              Enviar
            </button>
          )}
          {aba === 'aguardando' && (
            <button onClick={() => enviar(enc)}
              style={{ ...BK({ padding: '8px 14px', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap' }), color: '#ff9f0a', borderColor: 'rgba(255,159,10,.3)' }}>
              Reenviar
            </button>
          )}
          {aba === 'assinado' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => exportarPDF(enc)}
                style={BK({ padding: '8px 14px', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap' })}>
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
export default function App() {
  const [sp, setSp] = useState(true);
  const [scr, setScr] = useState('welcome');
  const [user, setUser] = useState(null);
  const [pg, setPg] = useState('home');
  const [menu, setMenu] = useState(false);
  const [pagamentoId, setPagamentoId] = useState(null);
  const [encId, setEncId] = useState(null);
  const [termoCpf, setTermoCpf] = useState(null);
  const [users, setUsers] = useState([]);
  const [fns, setFns] = useState(FUNCOES_INIT);
  const [esc, setEsc] = useState([]);
  const [qh, setQh] = useState(QH_INIT);
  const [qm, setQm] = useState(QM_INIT);
  const [on, setOn] = useState(ON_INIT);
  const [mins, setMins] = useState(MINS_INIT);
  const [rest, setRest] = useState(REST_INIT);
  const [louça, setLouça] = useState(LOUÇA_INIT);
  const [ck, setCk] = useState(CK_INIT);
  const [img, setImg] = useState([]);
  const [ocorr, setOcorr] = useState([]);
  const [ach, setAch] = useState([]);
  const [crac, setCrac] = useState([]);
  const [sau, setSau] = useState([]);
  const [avs, setAvs] = useState([]);
  const [encH, setEncH] = useState([]);
  const [encM, setEncM] = useState([]);
  const [uni, setUni] = useState([]);
  const [dataLimiteUni, setDataLimiteUni] = useState('');
  const [toast, setToast] = useState(null);
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
  const [dataLimitePagamento, setDataLimitePagamento] = useState('');

  // Inicializa quarto mães se não existir
  const inicializarQuartoMaes = async () => {
    const ref = doc(db, 'quartos_m', '12');
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
    await setDoc(doc(db, 'onibus', String(onibus.num)), onibus);
  };

  const deletarOnibus = async (num) => {
    await deleteDoc(doc(db, 'onibus', String(num)));
  };

  
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  console.log('URL params:', window.location.search);
  // Termo digital
  const termo = params.get('termo');
  const cpf = params.get('cpf');
  if (termo === 'true' && cpf) {
    setTermoCpf(cpf);
    setScr('termo');
    setSp(false); 
    return;
  }

  const qr = params.get('qr');
  const qrId = params.get('id');
  if (qr === 'true' && qrId) {
    setEncId(qrId);
    setScr('pagamento_confirmado');
    setSp(false);
    return;
  }
  const pago = params.get('pago');
  const id = params.get('id');
  const statusMP = params.get('status')
  const externalRef = params.get('external_reference');

  if (pago === 'true' && id) {
    setScr('pagamento_confirmado');
    setPagamentoId(id);
    window.history.replaceState({}, '', '/');
  } else if (pago === 'pending' && id) {
    setScr('pagamento_pendente');
    setPagamentoId(id);
    window.history.replaceState({}, '', '/');
  } else if (statusMP === 'pending' && externalRef) {
    setScr('pagamento_pendente');
    setPagamentoId(externalRef);
    window.history.replaceState({}, '', '/');
  } else if (statusMP === 'approved' && externalRef) {
    setScr('pagamento_confirmado');
    setPagamentoId(externalRef);
    window.history.replaceState({}, '', '/');
  }

  const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      inicializarQuartoMaes()
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        
        if (data.ativo === false) {
          await signOut(auth);
          setSp(false);
          setScr('login');
          return;
        }
        
        setUser({ id: firebaseUser.uid, ...data });
        setScr('app');
        if (data.perfil === 'servo') setPg('smins');

        unsubEscRef.current = onSnapshot(collection(db, 'equipes'), (s) => {
          setEsc(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        unsubConfigRef.current = onSnapshot(doc(db, 'config', 'uniformes'), (s) => {
          if (s.exists()) {
            if (s.data().dataLimite) setDataLimiteUni(s.data().dataLimite);
            if (s.data().dataLimitePagamento) setDataLimitePagamento(s.data().dataLimitePagamento);
          }
        });

        unsubUsersRef.current = onSnapshot(collection(db, 'users'), (s) => {
          setUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        unsubUniRef.current = onSnapshot(collection(db, 'uniformes'), (s) => {
          setUni(s.docs.map(d => ({ userId: d.id, ...d.data() })));
        });

        unsubAvsRef.current = onSnapshot(collection(db, 'avisos'), (s) => {
          setAvs(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
        });

        unsubEncRef.current = onSnapshot(collection(db, 'encontristas'), (s) => {
          const lista = s.docs.map(d => ({ id: d.id, ...d.data() }));
          setEncM(lista.filter(e => e.sexo === 'Feminino'));
          setEncH(lista.filter(e => e.sexo === 'Masculino'));
          setCk(lista.filter(e => e.pago).map(e => ({
            id: e.id, nome: e.nome,
            gen: e.sexo === 'Feminino' ? 'M' : 'H',
            ok: e.chegou || false,
            on: e.onibus || null,
            whatsapp: e.whatsapp || null,
            cpf: e.cpf || null,
          })));
        });

        unsubQHRef.current = onSnapshot(collection(db, 'quartos_h'), (s) => {
          if (!s.empty) setQh(s.docs.map(d => d.data()).sort((a, b) => a.num - b.num));
        });

        unsubQMRef.current = onSnapshot(collection(db, 'quartos_m'), (s) => {
          if (!s.empty) setQm(s.docs.map(d => d.data()).sort((a, b) => a.num - b.num));
        });

        unsubOnRef.current = onSnapshot(collection(db, 'onibus'), (s) => {
          setOn(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.num - b.num));
        });

        if (Notification.permission !== 'denied') {
          iniciarNotificacoes(firebaseUser.uid).then(token => {
            if (token) setNotif(true);
          });
        }
      } else {
        setScr('welcome');
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
      setScr('welcome');
    }
    setSp(false);
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
    await setDoc(doc(db, 'config', 'uniformes'), { dataLimite: data }, { merge: true });
  };
  
  const showT = (m, tp = 's') => {
    setToast({ m, tp });
    setTimeout(() => setToast(null), 2500);
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
    await signOut(auth);
    setUser(null);
    setScr('welcome');
    setPg('home');
  };
  const login = (f) => {
    setUser(f);
    setScr('app');
    if (f.perfil === 'servo') setPg('smins');
  };
  const role = user?.perfil || 'servo';
  const isAdm = role === 'admin';
  
  const uQH = (n, fn) => setQh(qh.map((q) => (q.num === n ? fn(q) : q)));
  const uQM = (n, fn) => setQm(qm.map((q) => (q.num === n ? fn(q) : q)));
  const uOn = (n, fn) => setOn(on.map((o) => (o.num === n ? fn(o) : o)));
  const uEs = (id, fn) => setEsc(esc.map((e) => (e.id === id ? fn(e) : e)));
  const broadcast = (msg) => {
    if (notif && 'Notification' in window && Notification.permission === 'granted')
      new Notification('🔔 servos.', { body: msg });
  };
  const sN = (nm, hr) => {
    broadcast(`${nm} — ${hr}`);
    showT(`${nm} — ${hr}`, 'n');
  };
  const notifyAll = async (msg) => {
    showT(msg, 'n');
    try {
      await fetch('https://us-central1-servos-peniel.cloudfunctions.net/notificarMinisterio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: msg, horario: '' }),
      });
    } catch (err) {
      console.error('Erro ao notificar:', err);
    }
  };
  
 if (sp) return <Splash done={() => setSp(false)} />;

  if (scr === 'pagamento_confirmado') return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{css}</style>
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus"
          style={{ width: 140, mixBlendMode: 'screen', display: 'block', margin: '0 auto 20px' }} />
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Pagamento confirmado!</div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          Sua vaga está garantida.
        </div>

        {/* QR CODE */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 20, display: 'inline-block', marginBottom: 16 }}>
          <QRCode value={encId || 'sem-id'} size={200} />
        </div>

        {/* AVISO IMPORTANTE */}
        <div style={{ background: 'rgba(251,146,60,.1)', border: '1px solid rgba(251,146,60,.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ color: '#fb923c', fontWeight: 800, fontSize: 14, marginBottom: 6 }}>TIRE UM PRINT DESTA TELA AGORA</div>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, lineHeight: 1.6 }}>
            Este QR Code é seu ingresso. Sem ele você não conseguirá fazer o check-in no evento. Não perca!
          </div>
        </div>

        <button onClick={() => setScr('welcome')} style={BK({ width: '100%', padding: 14, borderRadius: 14 })}>
          Voltar ao início
        </button>
      </div>
    </div>
  );

  if (scr === 'pagamento_pendente') return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <style>{css}</style>
      <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus"
          style={{ width: 180, mixBlendMode: 'screen', display: 'block', margin: '0 auto 24px' }} />
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Pagamento pendente!</div>
        <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Seu pagamento está sendo processado. Assim que confirmado sua vaga será garantida!
        </div>
        <a href="https://wa.me/5511982222149?text=Olá!%20Realizei%20o%20pagamento%20do%20Encontro%20com%20Deus%20e%20gostaria%20de%20confirmar%20minha%20inscrição."
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', background: '#25d366', color: '#fff', textDecoration: 'none', padding: '14px', borderRadius: 14, fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          Enviar comprovante no WhatsApp
        </a>
        <button onClick={() => setScr('welcome')} style={BK({ width: '100%', padding: 14, borderRadius: 14 })}>
          Voltar ao início
        </button>
      </div>
    </div>
  );

  if (scr === 'welcome') return (
    <Welcome
      onServos={() => setScr('login')}
      onEncontrista={() => setScr('inscricao')}
    />
  );

  if (scr === 'inscricao') return (
    <Inscricao
      onVoltar={() => setScr('welcome')}
      onPago={(id) => { setEncId(id); setScr('pagamento_confirmado'); }}
    />
  );

  if (scr === 'termo') return (
    <Termo cpf={termoCpf} onVoltar={() => setScr('welcome')} />
  );

if (scr === 'login') return <Login onLogin={login} onVoltar={() => setScr('welcome')} users={users} setUsers={setUsers} />;
  // shared top bar
  const TB = () => (
    <div
      style={{
        background: '#000',
        borderBottom: '1px solid #1a1a1a',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {pg === 'home' ? (
        <button
          onClick={() => setMenu(true)}
          style={BK({ padding: '8px 12px', borderRadius: 10, fontSize: 16 })}
        >
          ☰
        </button>
      ) : (
        <button
          onClick={() => nav('home')}
          style={BK({
            padding: '8px 13px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
          })}
        >
          ←
        </button>
      )}
      <span
        style={{
          flex: 1,
          color: G.t,
          fontSize: 15,
          fontWeight: 700,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {LABELS[pg] || 'servos.'}
      </span>
      <button
        onClick={async () => {
          const token = await iniciarNotificacoes(user?.id);;
          if (token) {
            setNotif(true);
            showT('Notificações ativas!', 'n');
          } else {
            showT('Permissão negada', 'w');
          }
        }}
        style={BK({
          padding: '8px 11px',
          borderRadius: 10,
          fontSize: 13,
          borderColor: notif ? 'rgba(0,200,81,.4)' : '#2a2a2a',
          color: notif ? G.green : G.td,
        })}
      >
        🔔
      </button>
    </div>
  );

  // menu drawer
  const MENU_ITEMS = [
    ['🏠', 'home'],
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff', 'lider_quartos'].includes(role) ? [['👤', 'servos']] : []),
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(role) ? [['👥', 'enc']] : []),
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(role) ? [['✓', 'checkin']] : []),
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(role) ? [['✎', 'termo']] : []),
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff', 'lider_quartos'].includes(role) ? [['🛏', 'quartos']] : []),
    ['🚌', 'onibus'],
    ['🔔', 'mins'],
    ['⛔', 'rest'],
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(role) ? [['📷', 'img']] : []),
    ['⚠️', 'info'],
    ['🔎', 'ach'],
    ['🪪', 'crac'],
    ['💊', 'saude'],
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(role) ? [['👕', 'uniformes']] : []),
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff', 'lider_cozinha'].includes(role) ? [['🍽️', 'louça']] : []),
    ...(['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(role) ? [['📋', 'equipes']] : []),
    ...(isAdm ? [['⚙️', 'back']] : []),
  ];

  // ── SERVO SHELL ──
  if (scr === 'app' && role === 'servo') {
    const SERVO_MENU = [
      ['🔔', 'smins', 'Ministrações'],
      ['📢', 'savs', 'Avisos'],
      ['👕', 'suni', 'Uniforme'],
      ['⚠️', 'sinfo', 'Ocorrências'],
      ...(role === 'lider_midia' || (user?.funcoes || []).includes('Mídia')
          ? [['📷', 'simg', 'Uso de Imagem']]
          : []),
      ];
    return (
      <div style={{ minHeight: '100vh', background: G.bg, paddingBottom: 60 }}>
        <style>{css}</style>
        {toast && <Toast m={toast.m} tp={toast.tp} />}
        {menu && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
            <div
              onClick={() => setMenu(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,.85)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: 270,
                background: '#0d0d0d',
                borderRight: '1px solid #1a1a1a',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  padding: '22px 16px 16px',
                  borderBottom: '1px solid #1a1a1a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: '#fff',
                      letterSpacing: -1,
                    }}
                  >
                    servos<span style={{ color: G.green }}>.</span>
                  </div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 3 }}>
                    {user.nome} · {PERFIS[role]?.l}
                  </div>
                </div>
                <button
                  onClick={() => setMenu(false)}
                  style={BK({
                    padding: '6px 10px',
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    background: pg === p ? 'rgba(0,200,81,.08)' : 'transparent',
                    border: 'none',
                    borderLeft: pg === p ? `3px solid ${G.green}` : '3px solid transparent',
                    padding: '12px 16px',
                    color: pg === p ? G.green : G.td,
                    fontSize: 13,
                    fontWeight: pg === p ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{ic}</span>
                  {lb}
                </button>
              ))}
              <button onClick={() => { setMenu(false); logout(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'transparent', border: 'none', borderLeft: '3px solid transparent', borderTop: '1px solid #1a1a1a', padding: '12px 16px', color: 'rgba(255,59,48,.6)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', marginTop: 8 }}>
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>↪</span>
                Sair
              </button>
            </div>
          </div>
        )}
        {/* top bar servo */}
        <div
          style={{
            background: '#000',
            borderBottom: '1px solid #1a1a1a',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          {pg === 'smins' ? (
            <button
              onClick={() => setMenu(true)}
              style={BK({
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 16,
              })}
            >
              ☰
            </button>
          ) : (
            <button
              onClick={() => setPg('smins')}
              style={BK({
                padding: '8px 13px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
              })}
            >
              ←
            </button>
          )}
          <span style={{ flex: 1, color: G.t, fontSize: 15, fontWeight: 700 }}>
            {pg === 'smins'
              ? 'Ministrações'
              : pg === 'savs'
              ? 'Avisos'
              : pg === 'suni'
              ? 'Uniforme'
              : pg === 'sinfo'
              ? 'Ocorrências'
              : 'Atribuições'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {user.pago && <Pill c="Pago ✓" bg="rgba(0,200,81,.15)" tc={G.green} />}
              <Pill c={PERFIS[user.perfil]?.l || user.perfil} bg={`${PERFIS[user.perfil]?.c || G.green}18`} tc={PERFIS[user.perfil]?.c || G.green} />
            </div>
            <button
              onClick={async () => {
                const token = await iniciarNotificacoes(user?.id);
                if (token) {
                  setNotif(true);
                  showT('Notificações ativas!', 'n');
                } else {
                  showT('Permissão negada', 'w');
                }
              }}
              style={BK({
                padding: '8px 11px',
                borderRadius: 10,
                fontSize: 13,
                borderColor: notif ? 'rgba(0,200,81,.4)' : '#2a2a2a',
                color: notif ? G.green : G.td,
              })}
            >
              🔔
            </button>
          </div>
        </div>
        {/* home com 3 cards */}
        {pg === 'smins' && (
          <ServoHomeV 
            user={user} 
            mins={mins} 
            avs={avs} 
            setPg={setPg}
            pago={user?.pago}
            uni={uni}
            dataLimiteUni={dataLimiteUni}
            dataLimitePagamento={dataLimitePagamento}
            esc={esc}
            users={users}
          />
        )}
        <div
          style={{ padding: '16px 16px 0', maxWidth: 480, margin: '0 auto' }}
        >
          {pg === 'savs' && (
            <div>{avs.length === 0 && (
              <div style={{ color: G.tm, textAlign: 'center', padding: 48, fontSize: 13 }}>
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
                    padding: '12px 14px',
                    marginBottom: 8,
                  }}
                >
                  <div style={{ color: G.t, fontSize: 13, lineHeight: 1.6 }}>
                    {a.txt}
                  </div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 4 }}>
                    {a.autor} · {a.hr}
                  </div>
                </div>
              ))}
            </div>
          )}
          {pg === 'suni' && (
            <UniV
              uni={uni}
              setUni={setUni}
              dataLimite={dataLimiteUni}
              setDataLimite={salvarDataLimite}
              dataLimitePagamento={dataLimitePagamento}
              user={user}
              role={role}
              edit={isAdm}
              t={showT}
            />
          )}
          {pg === 'sinfo' && (
            <InfoV
              ocorr={ocorr}
              setOcorr={setOcorr}
              t={showT}
              notifyAll={notifyAll}
            />
          )}
          {pg === 'satr' && (
            <div>
              {(user.funcoes || []).length > 0 ? (user.funcoes || []).map((f, i) => {
                // Busca o perfil de líder que tem essa função
                const perfilLider = (users || []).find(u =>
                  ['lider_staff', 'lider_templo', 'lider_cozinha', 'lider_quartos'].includes(u.perfil) &&
                  (u.funcoes || []).includes(f)
                );

                // Nomes dos líderes atribuídos
                const nomesLideres = [perfilLider?.liderEncontro, perfilLider?.liderEncontro2].filter(Boolean);

                // Colegas: mesma função, não é o próprio user, não é líder
                const colegas = (users || []).filter(u =>
                  u.id !== user.id &&
                  u.ativo !== false &&
                  u.perfil === 'servo' &&
                  (u.funcoes || []).includes(f) &&
                  !nomesLideres.includes(u.nome)
                );

                return (
                  <div key={i} className="fu"
                    style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${G.green}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{ color: G.green }}>📋</span>
                      <span style={{ color: G.t, fontWeight: 700, fontSize: 14 }}>{f}</span>
                    </div>

                    {nomesLideres.length > 0 && (
                      <>
                        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Líder</div>
                        {nomesLideres.map((l, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0a84ff', flexShrink: 0 }} />
                            <span style={{ color: '#64b5f6', fontSize: 13, fontWeight: l === user.nome ? 700 : 400 }}>
                              {l}{l === user.nome ? ' (você)' : ''}
                            </span>
                          </div>
                        ))}
                      </>
                    )}

                    {colegas.length > 0 && (
                      <>
                        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: nomesLideres.length ? 8 : 0 }}>Equipe</div>
                        {colegas.map((c, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: G.green, flexShrink: 0 }} />
                            <span style={{ color: G.td, fontSize: 13 }}>{c.nome}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              }) : (
                <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>Sem atribuições. Fale com o admin.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: G.bg, paddingBottom: 60 }}>
      <style>{css}</style>
      {toast && <Toast m={toast.m} tp={toast.tp} />}
      {menu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div
            onClick={() => setMenu(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,.85)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 270,
              background: '#0d0d0d',
              borderRight: '1px solid #1a1a1a',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '22px 16px 16px',
                borderBottom: '1px solid #1a1a1a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: -1,
                  }}
                >
                  servos<span style={{ color: G.green }}>.</span>
                </div>
                <div style={{ color: G.tm, fontSize: 11, marginTop: 3 }}>
                  {user.nome} · {PERFIS[role]?.l}
                </div>
              </div>
              <button
                onClick={() => setMenu(false)}
                style={BK({
                  padding: '6px 10px',
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  background: pg === p ? 'rgba(0,200,81,.08)' : 'transparent',
                  border: 'none',
                  borderLeft: pg === p ? `3px solid ${G.green}` : '3px solid transparent',
                  padding: '12px 16px',
                  color: pg === p ? G.green : G.td,
                  fontSize: 13,
                  fontWeight: pg === p ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{ic}</span>
                {LABELS[p]}
              </button>
            ))}
            <button onClick={() => { setMenu(false); logout(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'transparent', border: 'none', borderLeft: '3px solid transparent', borderTop: '1px solid #1a1a1a', padding: '12px 16px', color: 'rgba(255,59,48,.6)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', marginTop: 8 }}>
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>↪</span>
              Sair
            </button>
          </div>
        </div>
      )}
      <TB />
      <div style={{ padding: '16px 16px 0', maxWidth: 480, margin: '0 auto' }}>
        {pg === 'home' && (
          <HomeV
            role={role}
            ck={ck}
            mins={mins}
            ocorr={ocorr}
            avs={avs}
            qh={qh}
            qm={qm}
            on={on}
            nav={nav}
            edit={canG(role)}
            encH={encH}
            encM={encM}
            addAv={async (txt) => {
              const aviso = {
                txt,
                autor: user.nome,
                hr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                createdAt: Date.now(),
              };
              await addDoc(collection(db, 'avisos'), aviso);
              notifyAll(`Aviso: ${txt}`);
              showT('Aviso publicado!');
            }}
            delAv={async (id) => {
              await deleteDoc(doc(db, 'avisos', id));
            }}
          />
        )}
        {pg === 'checkin' && (
          <CkV ck={ck} setCk={setCk} on={on} edit={canG(role)} t={showT} />
        )}
        {pg === 'mins' && (
          <MinsV
            mins={mins}
            setMins={setMins}
            edit={canG(role)}
            role={role}
            t={showT}
            sN={sN}
          />
        )}
        {pg === 'termo' && (
          <TermoAdminV
            encH={encH}
            encM={encM}
            t={showT}
          />
        )}
        {pg === 'quartos' && (
          <QV
            qh={qh} qm={qm}
            uQH={uQH} uQM={uQM}
            setQh={setQh} setQm={setQm}
            edit={canQ(role)}
            t={showT}
            encH={encH} encM={encM}
            users={users}
            salvarQuarto={salvarQuarto}
            deletarQuarto={deletarQuarto}
          />
        )}
        {pg === 'enc' && (
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
          />
        )}
        {pg === 'onibus' && (
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
          />
        )}
        {pg === 'rest' && (
          <RestV
            rest={rest}
            setRest={setRest}
            qm={qm}
            setQm={setQm}
            edit={canG(role)}
            role={role}
            t={showT}
          />
        )}
        {pg === 'img' && (
          <ImgV encH={encH} encM={encM} />
        )}
        {pg === 'info' && (
          <InfoV
            ocorr={ocorr}
            setOcorr={setOcorr}
            t={showT}
            notifyAll={notifyAll}
          />
        )}
        {pg === 'ach' && <AchV ach={ach} setAch={setAch} t={showT} />}
        {pg === 'crac' && (
          <ListV
            icon="🪪"
            color={G.green}
            items={crac}
            setItems={setCrac}
            edit={canG(role)}
            t={showT}
            ph="Nome do encontrista..."
          />
        )}
        {pg === 'saude' && (
          <SauV sau={sau} setSau={setSau} edit={canG(role)} t={showT} />
        )}
        {pg === 'louça' && (
          <LouçaV
            louça={louça}
            setLouça={setLouça}
            edit={canC(role)}
            t={showT}
          />
        )}
        {pg === 'uniformes' && (
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
        {pg === 'equipes' && (
          <EqV
            esc={esc}
            setEsc={setEsc}
            uEs={uEs}
            edit={canG(role)}
            t={showT}
          />
        )}
        {pg === 'servos' && (
          <SvV
            users={users}
            setUsers={setUsers}
            esc={esc}
            edit={isAdm}
            t={showT}
            dataLimitePagamento={dataLimitePagamento}
          />
        )}
        {pg === 'back' && isAdm && (
          <BackV
            users={users}
            setUsers={setUsers}
            fns={fns}
            setFns={setFns}
            t={showT}
          />
        )}
      </div>
    </div>
  );
}

// ── SERVO HOME ───────────────────────────────────────────────────────────────
function ServoHomeV({ user, mins, avs, setPg, pago, uni, dataLimiteUni, dataLimitePagamento, esc, users }) {
  const [tab, setTab] = useState('mins');
  const [slide, setSlide] = useState(0);
  const dC = { Sexta: '#bf5af2', Sábado: G.green, Domingo: '#ff9f0a' };
  const prox = mins.find((m) => !m.sent);
  const meuPedido = uni.find((u) => u.userId === user.id);

  // Monta slides
  const slides = [];
  if (prox) slides.push({ tipo: 'min', data: prox });
  if (!pago && dataLimitePagamento) slides.push({ tipo: 'pagamento' });
  if ((!meuPedido || meuPedido.status === 'aberto') && dataLimiteUni) slides.push({ tipo: 'uniforme' });

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setSlide(s => (s + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const slideAtual = slides[slide];

  return (
    <div>
      <div style={{ padding: '16px 16px 0', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: G.t }}>
            Olá, {user.nome.split(' ')[0]}<span style={{ color: G.green }}>.</span>
          </div>
          <div style={{ color: G.tm, fontSize: 12, marginTop: 3 }}>Encontro com Deus</div>
        </div>

        {/* 3 quick cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            ['📢', 'Avisos', 'savs'],
            ['👕', 'Uniforme', 'suni'],
            ['⚠️', 'Ocorrências', 'sinfo'],
          ].map(([ic, l, p]) => (
            <div key={p} onClick={() => setPg(p)}
              style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '14px 10px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{ic}</div>
              <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* SLIDE */}
        {slides.length > 0 && (
          <div style={{ marginBottom: 14, position: 'relative' }}>
            {/* Dots */}
            {slides.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                {slides.map((_, i) => (
                  <div key={i} onClick={() => setSlide(i)}
                    style={{ width: i === slide ? 16 : 6, height: 6, borderRadius: 3, background: i === slide ? G.green : '#333', transition: 'all .3s', cursor: 'pointer' }} />
                ))}
              </div>
            )}

            {/* Slide: próxima ministração */}
            {slideAtual?.tipo === 'min' && (
              <div style={{ background: 'rgba(10,132,255,.1)', border: '1px solid rgba(10,132,255,.2)', borderRadius: 14, padding: '13px 14px' }}>
                <div style={{ color: '#64b5f6', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Próxima</div>
                <div style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>{prox.nome}</div>
                <div style={{ color: G.tm, fontSize: 12, marginTop: 2 }}>{prox.dia} · {prox.hora}</div>
              </div>
            )}

            {/* Slide: pagamento pendente */}
            {slideAtual?.tipo === 'pagamento' && (
              <div style={{ background: 'rgba(255,59,48,.08)', border: '1px solid rgba(255,59,48,.25)', borderRadius: 14, padding: '13px 14px' }}>
                <div style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>⚠️ Pagamento Pendente</div>
                <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, lineHeight: 1.5 }}>
                  Valor: <strong style={{ color: '#fff' }}>R$ 220,00</strong>
                </div>
                <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Prazo: <strong style={{ color: '#ff6b6b' }}>{new Date(dataLimitePagamento + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                </div>
              </div>
            )}

            {/* Slide: uniforme pendente */}
            {slideAtual?.tipo === 'uniforme' && (
              <div onClick={() => setPg('suni')} style={{ background: 'rgba(255,159,10,.08)', border: '1px solid rgba(255,159,10,.25)', borderRadius: 14, padding: '13px 14px', cursor: 'pointer' }}>
                <div style={{ color: '#ff9f0a', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>👕 Uniforme</div>
                <div style={{ color: G.t, fontSize: 14, fontWeight: 700 }}>
                  {meuPedido?.status === 'aberto' ? 'Alteração aprovada — atualize seu pedido' : 'Você ainda não fez seu pedido de uniforme'}
                </div>
                <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                  Prazo: <strong style={{ color: '#ff9f0a' }}>{new Date(dataLimiteUni + 'T12:00:00').toLocaleDateString('pt-BR')}</strong> · Toque para acessar
                </div>
              </div>
            )}
          </div>
        )}

        {/* seg control */}
        <Seg opts={[['mins', 'Ministrações'], ['atr', 'Atribuições']]} val={tab} set={setTab} />
        <div style={{ marginTop: 12 }}>
          {tab === 'mins' && mins.map((m) => (
            <div key={m.id} className="fu"
              style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${dC[m.dia]}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>{m.nome}</div>
              <div style={{ color: G.tm, fontSize: 12, marginTop: 3 }}>{m.dia} · {m.hora}</div>
            </div>
          ))}
          {tab === 'atr' && (
            <div>
              {(user.funcoes || []).length > 0 ? (user.funcoes || []).map((f, i) => {

                const perfilLider = (users || []).find(u =>
                  ['lider_staff', 'lider_templo', 'lider_cozinha', 'lider_quartos'].includes(u.perfil) &&
                  (u.funcoes || []).includes(f)
                );

                const nomesLideres = [perfilLider?.liderEncontro, perfilLider?.liderEncontro2].filter(Boolean);

                const colegas = (users || []).filter(u =>
                  u.id !== user.id &&
                  u.ativo !== false &&
                  u.perfil === 'servo' &&
                  (u.funcoes || []).includes(f) &&
                  !nomesLideres.includes(u.nome)
                );

                return (
                  <div key={i} className="fu"
                    style={{ background: G.card, border: `1px solid ${G.cb}`, borderLeft: `3px solid ${G.green}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{ color: G.green }}>📋</span>
                      <span style={{ color: G.t, fontWeight: 700, fontSize: 14 }}>{f}</span>
                    </div>

                    {nomesLideres.length > 0 && (
                      <>
                        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Líder</div>
                        {nomesLideres.map((l, j) => (
                          <div key={j} style={{ marginBottom: 4 }}>
                            <span style={{ color: G.td, fontSize: 13, fontWeight: l === user.nome ? 700 : 400 }}>
                              {l}{l === user.nome ? ' (você)' : ''}
                            </span>
                          </div>
                        ))}
                      </>
                    )}

                    {colegas.length > 0 && (
                      <>
                        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: nomesLideres.length ? 8 : 0 }}>Equipe</div>
                        {colegas.map((c, j) => (
                          <div key={j} style={{ marginBottom: 4 }}>
                            <span style={{ color: G.td, fontSize: 13 }}>{c.nome}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              }) : (
                <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>Sem atribuições. Fale com o admin.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HOME ─────────────────────────────────────────────────────────────────────
function HomeV({ role, ck, mins, ocorr, avs, qh, qm, on, nav, edit, encH, encM, addAv, delAv }) {
  const [tab, setTab] = useState('mins');
  const [av, setAv] = useState('');
  const ch = ck.filter((c) => c.ok).length,
    tot = ck.length;
  const oc = ocorr.filter((o) => !o.res).length;
  const tEnc = [...qh, ...qm].reduce((a, q) => a + q.enc.length, 0);
  const tPass = on.reduce((a, o) => {
    const passCheckin = [...(encH || []), ...(encM || [])].filter(e => 
      e.onibus === String(o.num) || e.onibus === o.num
    ).length;
    const passManual = o.passManual?.length || 0;
    const servos = o.servos?.length || 0;
    return a + passCheckin + passManual + servos;
  }, 0);
  const prox = mins.find((m) => !m.sent);
  const dC = { Sexta: '#bf5af2', Sábado: G.green, Domingo: '#ff9f0a' };
  const ns = (n) => {
    const s = String(n);
    return {
      color: G.t,
      fontWeight: 800,
      letterSpacing: -1,
      fontSize: s.length > 5 ? 18 : s.length > 3 ? 24 : 32,
    };
  };
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          [`${ch}/${tot}`, 'Check-in', 'checkin'],
          [`${tPass}/${on.reduce((a, o) => a + (o.poltronas || 40), 0)}`, 'Ônibus', 'onibus'],
          [tEnc, 'Quartos', 'quartos'],
          [oc, 'Ocorrências', 'info'],
        ].map(([n, l, p]) => (
          <div
            key={l}
            onClick={() => nav(p)}
            style={{
              background: '#111',
              border: '1px solid #1a1a1a',
              borderRadius: 16,
              padding: '28px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={ns(n)}>{n}</div>
            <div
              style={{
                color: G.tm,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginTop: 4,
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
      <Seg
        opts={[
          ['mins', 'Ministrações'],
          ['avs', 'Avisos'],
          ['status', 'Status'],
        ]}
        val={tab}
        set={setTab}
      />
      <div style={{ marginTop: 12 }}>
        {tab === 'mins' &&
          mins.map((m) => (
            <div
              key={m.id}
              className="fu"
              style={{
                background: G.card,
                border: `1px solid ${G.cb}`,
                borderLeft: `3px solid ${m.sent ? G.green : dC[m.dia]}`,
                borderRadius: 13,
                padding: '12px 14px',
                marginBottom: 7,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: G.t, fontWeight: 600, fontSize: 13 }}>
                  {m.nome}
                </div>
                <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                  {m.dia} · {m.hora}
                </div>
              </div>
              {m.sent && (
                <Pill c="✓ Enviado" bg="rgba(0,200,81,.1)" tc={G.green} />
              )}
            </div>
          ))}
        {tab === 'avs' && (
          <>
            {edit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                <select
                  onChange={(e) => { if (e.target.value) setAv(e.target.value); }}
                  style={{ ...I, fontSize: 12 }}
                  defaultValue=""
                >
                  <option value="">Usar template de aviso...</option>
                  {AVISOS_TEMPLATES.map((a, i) => (
                    <option key={i} value={a.txt}>{a.txt.substring(0, 50)}...</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={av}
                    onChange={(e) => setAv(e.target.value)}
                    placeholder="Escrever aviso..."
                    style={{ ...I, flex: 1 }}
                  />
                  <button
                    onClick={() => {
                      if (av.trim()) {
                        vibrar(100);
                        addAv(av.trim());
                        setAv('');
                      }
                    }}
                    style={BG({ padding: '13px 15px', borderRadius: 12 })}
                  >
                    +
                  </button>
                </div>
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
                  borderRadius: 13,
                  padding: '12px 14px',
                  marginBottom: 7,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: G.t, fontSize: 13, lineHeight: 1.6 }}>
                    {a.txt}
                  </div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 4 }}>
                    {a.autor} · {a.hr}
                  </div>
                </div>
                {edit && (
                  <span
                    onClick={() => delAv(a.id)}
                    style={{
                      color: 'rgba(255,59,48,.5)',
                      cursor: 'pointer',
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </span>
                )}
              </div>
            ))}
          </>
        )}
        {tab === 'status' && (
          <>
            {prox ? (
              <div
                style={{
                  background: 'rgba(10,132,255,.1)',
                  border: '1px solid rgba(10,132,255,.2)',
                  borderRadius: 14,
                  padding: '14px',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    color: '#64b5f6',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Próximo
                </div>
                <div style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>
                  {prox.nome}
                </div>
                <div style={{ color: G.tm, fontSize: 12, marginTop: 2 }}>
                  {prox.dia} · {prox.hora}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: G.card,
                  borderRadius: 14,
                  padding: 14,
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                <div style={{ color: G.green, fontWeight: 700 }}>
                  ✓ Todos notificados
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                ['✓', 'checkin'],
                ['🛏', 'quartos'],
                ['🚌', 'onibus'],
                ['⛔', 'rest'],
                ['📋', 'equipes'],
                ['🔎', 'ach'],
                ['🪪', 'crac'],
                ['💊', 'saude'],
                ['🍽️', 'louça'],
                ['👤', 'servos'],
              ].map(([ic, p]) => (
                <button
                  key={p}
                  onClick={() => nav(p)}
                  style={{
                    ...BK({
                      padding: '8px 13px',
                      borderRadius: 50,
                      fontSize: 12,
                      fontWeight: 600,
                    }),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {ic} {LABELS[p]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── CHECK-IN ─────────────────────────────────────────────────────────────────
function CkV({ ck, setCk, on, edit, t }) {
  const [sub, setSub] = useState('pend');
  const [gen, setGen] = useState('M');
  const [s, setS] = useState('');
  const [sh, setSh] = useState(false);
  const [shQr, setShQr] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [f, setF] = useState({ nome: '', sob: '', gen: 'M' });
  const scannerRef = useRef(null);
  const [highlightId, setHighlightId] = useState(null);
  const highlightRef = useRef(null);

  useEffect(() => {
    if (!shQr) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }
    setScanMsg('');
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 220 }, false);
      scanner.render(
        async (decodedText) => {
          await scanner.clear();
          scannerRef.current = null;
          setShQr(false);
          const enc = ck.find((c) => c.id === decodedText);
          if (!enc) {
            t('QR Code não reconhecido');
            return;
          }
          if (enc.ok) {
            t(`${enc.nome} já fez check-in ✓`);
            return;
          }
          await setDoc(doc(db, 'encontristas', enc.id), { chegou: true }, { merge: true });
          vibrar(60);
          t(`✅ Check-in: ${enc.nome}`);
          const encGen = enc.gen === 'M' ? 'M' : 'H';
          setGen(encGen);
          setSub('conf');
          setHighlightId(enc.id);
          setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
          // WhatsApp com link do termo
          if (enc.whatsapp) {
            const tel = enc.whatsapp.replace(/\D/g, '');
            const link = `https://servos-peniel.vercel.app?termo=true&cpf=${enc.cpf}`;
            const msg = encodeURIComponent(`Olá ${enc.nome.split(' ')[0]}! Seu check-in foi confirmado 🎉\nAssine o termo do evento: ${link}`);
            const a = document.createElement('a');
            a.href = `https://wa.me/55${tel}?text=${msg}`;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        },
        (err) => {}
      );
      scannerRef.current = scanner;
    }, 300);
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [shQr]);

  const lista = useMemo(
    () =>
      ck.filter(
        (c) =>
          c.gen === gen &&
          (sub === 'pend' ? !c.ok : c.ok) &&
          c.nome.toLowerCase().includes(s.toLowerCase())
      ),
    [ck, gen, sub, s]
  );
  const cnt = (g, ok) => ck.filter((c) => c.gen === g && (ok ? c.ok : !c.ok)).length;
  const ns = (n) => {
    const s = String(n);
    return { color: G.t, fontWeight: 800, fontSize: s.length > 5 ? 16 : s.length > 3 ? 20 : 24 };
  };
  const add = async () => {
    if (!f.nome.trim()) return;
    const novoEnc = {
      nome: `${f.nome.trim()} ${f.sob.trim()}`.trim(),
      sexo: f.gen === 'M' ? 'Feminino' : 'Masculino',
      chegou: false,
      onibus: null,
      criadoEm: new Date().toLocaleString('pt-BR'),
    };
    await addDoc(collection(db, 'encontristas'), novoEnc);
    setF({ nome: '', sob: '', gen: 'M' });
    setSh(false);
    t('Encontrista adicionado!');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          [ck.length, 'Total', '#636366'],
          [ck.filter((c) => c.ok).length, 'Chegaram', G.green],
          [ck.filter((c) => !c.ok).length, 'Pendentes', '#ff9f0a'],
        ].map(([n, l, c]) => (
          <div key={l} style={{ background: '#111', borderRadius: 14, padding: '12px 8px', textAlign: 'center', borderTop: `2px solid ${c}` }}>
            <div style={ns(n)}>{n}</div>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Botão scanner */}
      <button
        onClick={() => setShQr(true)}
        style={BG({ width: '100%', padding: 14, marginBottom: 10, borderRadius: 14, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 })}>
        📷 Escanear QR Code
      </button>

      <Seg opts={[['M', '♀ Mulheres'], ['H', '♂ Homens']]} val={gen} set={setGen} />
      <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
        <button onClick={() => setSub('pend')}
          style={{ flex: 1, background: sub === 'pend' ? '#ff9f0a' : '#111', color: sub === 'pend' ? '#000' : G.td, border: 'none', borderRadius: 10, padding: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Pendentes ({cnt(gen, false)})
        </button>
        <button onClick={() => setSub('conf')}
          style={{ flex: 1, background: sub === 'conf' ? G.green : '#111', color: sub === 'conf' ? '#000' : G.td, border: 'none', borderRadius: 10, padding: '9px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Confirmados ({cnt(gen, true)})
        </button>
      </div>
      <input value={s} onChange={(e) => setS(e.target.value)} placeholder="🔍 Buscar..." style={{ ...I, marginBottom: 10 }} />
      {lista.length === 0 && (
        <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>Nenhum encontrista aqui.</div>
      )}
      {lista.map((c) => (
        <div key={c.id} className="fu"
            ref={c.id === highlightId ? highlightRef : null}
            style={{ background: G.card, border: `1px solid ${c.id === highlightId ? '#fb923c' : c.ok ? 'rgba(0,200,81,.3)' : G.cb}`, borderLeft: `3px solid ${c.id === highlightId ? '#fb923c' : c.ok ? G.green : '#2a2a2a'}`, borderRadius: 13, padding: '12px 14px', marginBottom: 7 }}>          
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <button
              onClick={async () => {
                vibrar(30);
                const novoOk = !c.ok;
                await setDoc(doc(db, 'encontristas', c.id), { chegou: novoOk }, { merge: true });
                if (novoOk) {
                  setSub('conf');
                  setHighlightId(c.id);
                  setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                } else {
                  setHighlightId(null);
                }
              }}
              style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${c.ok ? G.green : '#333'}`, background: c.ok ? 'rgba(0,200,81,.15)' : 'transparent', color: G.green, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {c.ok ? '✓' : ''}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
              {c.on && <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>🚌 Ônibus {c.on}</div>}
            </div>
            {c.ok && (
              <select
                value={c.on || ''}
                onChange={async (e) => {
                  await setDoc(doc(db, 'encontristas', c.id), { onibus: e.target.value || null }, { merge: true });
                }}
                style={{ ...I, width: 'auto', padding: '6px 10px', fontSize: 11, borderRadius: 9 }}>
                <option value="">Ônibus?</option>
                {on.filter(o => o.tipo !== 'Servos').map((o) => (
                  <option key={o.num} value={o.num}>Ônibus {o.num} — {o.tipo}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      ))}

      {/* Sheet do scanner */}
      <Sheet open={shQr} onClose={() => setShQr(false)} title="Escanear QR Code">
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: G.tm, fontSize: 13, marginBottom: 16 }}>
            Aponte a câmera para o QR Code do encontrista
          </div>
          <div id="qr-reader" style={{ width: '100%' }} />
          {scanMsg && (
            <div style={{ marginTop: 12, color: G.tm, fontSize: 13 }}>{scanMsg}</div>
          )}
          <button
            onClick={() => setShQr(false)}
            style={{ marginTop: 20, color: G.tm, background: 'none', border: 'none', fontSize: 13, cursor: 'pointer' }}>
            Fazer manualmente
          </button>
        </div>
      </Sheet>

      {/* Sheet adicionar encontrista */}
      <Sheet open={sh} onClose={() => setSh(false)} title="Adicionar Encontrista">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input placeholder="Nome *" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} style={I} />
          <input placeholder="Sobrenome" value={f.sob} onChange={(e) => setF({ ...f, sob: e.target.value })} style={I} />
          <Seg opts={[['M', '♀ Feminino'], ['H', '♂ Masculino']]} val={f.gen} set={(v) => setF({ ...f, gen: v })} />
          <button onClick={add} style={BG({ width: '100%', padding: 14, borderRadius: 14, marginTop: 4 })}>
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
  const [f, setF] = useState({ dia: 'Sexta', nome: '', hora: '' });
  const [highlightId, setHighlightId] = useState(null);
  const highlightRef = useRef(null);

  const dC = { Sexta: '#bf5af2', Sábado: G.green, Domingo: '#ff9f0a' };
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
                      width: '100%',
                      padding: 12,
                      marginBottom: 14,
                      borderRadius: 14,
                    }),
                  }
                : {
                    ...BG({
                      width: '100%',
                      padding: 12,
                      marginBottom: 14,
                      borderRadius: 14,
                    }),
                  }
            }
          >
            {sh ? '✕ Cancelar' : '＋ Nova Ministração / Ato'}
          </button>
          {sh && (
            <div
              style={{
                background: G.card,
                border: `1px solid ${G.cb}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <select
                style={I}
                value={f.dia}
                onChange={(e) => setF({ ...f, dia: e.target.value })}
              >
                {['Sexta', 'Sábado', 'Domingo'].map((d) => (
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
                  setF({ dia: 'Sexta', nome: '', hora: '' });
                  setSh(false);
                  t('Adicionado!');
                }}
                style={BG({ padding: 12, borderRadius: 12 })}
              >
                Adicionar
              </button>
            </div>
          )}
        </>
      )}
      {['Sexta', 'Sábado', 'Domingo'].map((dia) => {
        const list = mins.filter((m) => m.dia === dia);
        if (!list.length) return null;
        return (
          <div key={dia} style={{ marginBottom: 18 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dC[dia],
                }}
              />
              <span
                style={{
                  color: G.td,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
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
                  padding: '12px 14px',
                  marginBottom: 7,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ color: G.t, fontWeight: 600, fontSize: 13 }}>
                      {m.nome}
                    </div>
                    <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                      {m.hora}
                      {m.sent ? ' · ✓' : ''}
                    </div>
                  </div>
                  <div
                    style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                  >
                    {canN(role) &&
                      (!m.sent ? (
                        <button
                        onClick={async () => {
                          vibrar(50);
                          setMins(mins.map((x) => x.id === m.id ? { ...x, sent: true } : x));
                          try {
                            await fetch('https://us-central1-servos-peniel.cloudfunctions.net/notificarMinisterio', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ titulo: `🙏 ${m.nome}`, horario: m.hora }),
                            });
                            t('Notificação enviada! 🔔');
                          } catch (err) {
                            sN(m.nome, m.hora); // fallback local
                          }
                        }}
                        style={{
                          background: 'rgba(10,132,255,.15)',
                          border: '1px solid rgba(10,132,255,.3)',
                          color: '#64b5f6',
                          borderRadius: 9,
                          padding: '6px 11px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🔔
                      </button>
                      ) : (
                        <button
                          onClick={() =>
                            setMins(
                              mins.map((x) =>
                                x.id === m.id ? { ...x, sent: false } : x
                              )
                            )
                          }
                          style={BK({
                            padding: '6px 10px',
                            borderRadius: 9,
                            fontSize: 11,
                          })}
                        >
                          ↩
                        </button>
                      ))}
                    {edit && (
                      <span
                        onClick={() =>
                          setMins(mins.filter((x) => x.id !== m.id))
                        }
                        style={{
                          color: 'rgba(255,59,48,.4)',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        🗑
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

function QuartoMaes({ m, oc, pct, edit, uQM, setQm, qm, AddServoSearch, AddEncAutocomplete }) {
  const [numEdit, setNumEdit] = useState(m.num);
  const [limEdit, setLimEdit] = useState(m.lim);

  return (
    <Acc title="🤱 Quarto Mães" ax="#ff9f0a"
      right={<Pill c={`${oc}/${m.lim}`} bg="rgba(255,159,10,.12)" tc="#ff9f0a" />}>
      <div style={{ background: '#1e1e1e', borderRadius: 5, height: 5, marginBottom: 8 }}>
        <div style={{ background: '#ff9f0a', borderRadius: 5, height: 5, width: `${pct}%` }} />
      </div>

      {edit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Número</div>
            <input type="number" value={numEdit}
              onChange={e => setNumEdit(e.target.value)}
              onBlur={() => setQm(qm.map(q => q.maes ? { ...q, num: parseInt(numEdit) || m.num } : q))}
              style={{ ...I, fontSize: 13, padding: '8px 12px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Limite</div>
            <input type="number" min="1" max="30" value={limEdit}
              onChange={e => setLimEdit(e.target.value)}
              onBlur={() => setQm(qm.map(q => q.maes ? { ...q, lim: parseInt(limEdit) || m.lim } : q))}
              style={{ ...I, fontSize: 13, padding: '8px 12px' }} />
          </div>
        </div>
      )}

      <SL c={`Servos (${m.servos.length}/2)`} mt={0} />
      <Tags items={m.servos} ax={G.green}
        onX={edit ? i => uQM(m.num, q => ({ ...q, servos: q.servos.filter((_, j) => j !== i) })) : undefined} />
      <AddServoSearch quarto={m} updFn={uQM} />

      <SL c="Mães" />
      <Tags items={m.enc} ax="#ff9f0a"
        onX={edit ? i => uQM(m.num, q => ({ ...q, enc: q.enc.filter((_, j) => j !== i) })) : undefined} />
      <AddEncAutocomplete quarto={m} updFn={uQM} />
    </Acc>
  );
}

// ── QUARTOS ──────────────────────────────────────────────────────────────────
function QV({ qh, qm, uQH, uQM, setQh, setQm, edit, t, encH, encM, users, salvarQuarto, deletarQuarto }) {
  const [tab, setTab] = useState('M');
  const [shN, setShN] = useState(false);
  const [f, setF] = useState({ num: '', lim: 9 });
  const isH = tab === 'H';
  const colecao = isH ? 'quartos_h' : 'quartos_m';

  const upd = async (num, fn) => {
  const onibus = on.find(o => o.num === num);
  if (!onibus) return;
  const normalizado = {
    ...onibus,
    malas: Array.isArray(onibus.malas) ? onibus.malas : [],
    resp: Array.isArray(onibus.resp) ? onibus.resp : [],
    templo: Array.isArray(onibus.templo) ? onibus.templo : [],
    servos: Array.isArray(onibus.servos) ? onibus.servos : [],
    passManual: Array.isArray(onibus.passManual) ? onibus.passManual : [],
  };
  const atualizado = fn(normalizado);
  setOn(on.map(o => o.num === num ? atualizado : o));
  await salvarOnibus(atualizado);
};

  const encConfirmados = (isH ? encH : encM).filter(e => e.chegou);

  const todosServosAlocados = new Set([
    ...qh.flatMap(q => q.servos),
    ...qm.flatMap(q => q.servos),
  ]);

  const servosDisponiveis = (users || []).filter(u =>
    u.perfil !== 'admin' &&
    u.ativo !== false &&
    !todosServosAlocados.has(u.nome)
  );

  const list = (isH ? qh : qm.filter(q => !q.maes));

  const delQuarto = async (num) => {
    await deletarQuarto(colecao, num);
    if (isH) setQh(qh.filter(q => q.num !== num));
    else setQm(qm.filter(q => q.num !== num));
    t('Quarto removido.');
  };

  const AddServoSearch = ({ quarto, updFn }) => {
    const [busca, setBusca] = useState('');
    const [aberto, setAberto] = useState(false);
    if (!edit || quarto.servos.length >= 2) return null;
    const filtrados = servosDisponiveis.filter(u =>
      u.nome.toLowerCase().includes(busca.toLowerCase())
    );
    return (
      <div style={{ position: 'relative', marginTop: 8 }}>
        <input
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar servo..."
          style={{ ...I, fontSize: 12, padding: '9px 12px' }}
        />
        {aberto && busca.length > 0 && filtrados.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 10,
            marginTop: 4, maxHeight: 180, overflowY: 'auto',
          }}>
            {filtrados.map(u => (
              <div key={u.id}
                onMouseDown={() => {
                  updFn(quarto.num, x => ({ ...x, servos: [...x.servos, u.nome] }));
                  setBusca('');
                  setAberto(false);
                  t('✓');
                }}
                style={{ padding: '10px 14px', color: G.td, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {u.nome}
              </div>
            ))}
          </div>
        )}
        {aberto && busca.length > 0 && filtrados.length === 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 10,
            marginTop: 4, padding: '10px 14px', color: G.tm, fontSize: 12,
          }}>
            Nenhum servo disponível
          </div>
        )}
      </div>
    );
  };

  const AddEncAutocomplete = ({ quarto, updFn }) => {
    const [busca, setBusca] = useState('');
    const [aberto, setAberto] = useState(false);
    const lv = quarto.lim - quarto.servos.length - quarto.enc.length;
    if (!edit || lv <= 0) return null;
    const fn = updFn || upd;
    const sugestoes = encConfirmados.filter(e =>
      e.nome.toLowerCase().includes(busca.toLowerCase()) &&
      !quarto.enc.includes(e.nome) &&
      busca.length > 0
    );
    const confirmar = (nome) => {
      if (!nome.trim()) return;
      fn(quarto.num, x => ({ ...x, enc: [...x.enc, nome.trim()] }));
      setBusca('');
      setAberto(false);
      t('✓');
    };
    return (
      <div style={{ position: 'relative', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setAberto(true); }}
            onFocus={() => setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            onKeyDown={e => e.key === 'Enter' && confirmar(busca)}
            placeholder="Encontrista..."
            style={{ ...I, flex: 1, fontSize: 12, padding: '9px 12px' }}
          />
          <button
            onMouseDown={() => confirmar(busca)}
            style={BG({ padding: '9px 14px', borderRadius: 10, fontSize: 13 })}
          >
            +
          </button>
        </div>
        {aberto && sugestoes.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 10,
            marginTop: 4, maxHeight: 180, overflowY: 'auto',
          }}>
            {sugestoes.map(e => (
              <div
                onMouseDown={() => toggle(e.id)}
                style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
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
        <div style={{ background: 'rgba(255,159,10,.1)', border: '1px solid rgba(255,159,10,.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, color: '#ff9f0a', fontSize: 12 }}>
          👀 Somente visualização
        </div>
      )}
      <Seg opts={[['M', '♀ Mulheres'], ['H', '♂ Homens']]} val={tab} set={setTab} />

      {edit && (
        <>
          <button onClick={() => setShN(!shN)}
            style={shN
              ? BK({ width: '100%', padding: 12, marginBottom: 10, borderRadius: 13 })
              : BG({ width: '100%', padding: 12, marginBottom: 10, borderRadius: 13 })}>
            {shN ? '✕ Cancelar' : '＋ Novo Quarto'}
          </button>
          {shN && (
            <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 16, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input style={I} placeholder="Número *" type="number" value={f.num} onChange={e => setF({ ...f, num: e.target.value })} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: G.tm, fontSize: 13, whiteSpace: 'nowrap' }}>Limite de camas</span>
                <input style={{ ...I, flex: 1 }} type="number" min="2" max="20" value={f.lim} onChange={e => setF({ ...f, lim: parseInt(e.target.value) || 9 })} />
              </div>
              <button onClick={async () => {
                if (!f.num) return;
                const nv = { num: parseInt(f.num), lim: f.lim, servos: [], enc: [] };
                await salvarQuarto(colecao, nv);
                if (isH) setQh([...qh, nv]);
                else setQm([...qm, nv]);
                setF({ num: '', lim: 9 });
                setShN(false);
                t('Quarto criado!');
              }} style={BG({ padding: 12, borderRadius: 12 })}>
                Criar Quarto
              </button>
            </div>
          )}
        </>
      )}

      {/* Quarto Mães */}
      {!isH && (() => {
        const m = qm.find(q => q.maes);
        if (!m) return null;
        const oc = m.servos.length + m.enc.length;
        const pct = Math.min(100, Math.round((oc / m.lim) * 100));
        return <QuartoMaes m={m} oc={oc} pct={pct}
          edit={edit} uQM={upd} setQm={setQm} qm={qm}
          AddServoSearch={AddServoSearch}
          AddEncAutocomplete={AddEncAutocomplete}
        />;
      })()}

      {/* Lista de quartos */}
      {list.map(q => {
        const oc = q.servos.length + q.enc.length;
        const pct = Math.min(100, Math.round((oc / q.lim) * 100));
        const lv = q.lim - oc;
        const bc = pct >= 100 ? '#ff3b30' : pct >= 80 ? '#ff9f0a' : G.green;
        return (
          <Acc key={q.num} title={`Quarto ${q.num}`}
            right={<Pill c={`${oc}/${q.lim}`} bg={`${bc}18`} tc={bc} />}
            onDel={edit ? () => delQuarto(q.num) : undefined}
          >
            <div style={{ background: '#1e1e1e', borderRadius: 5, height: 5, marginBottom: 8 }}>
              <div style={{ background: bc, borderRadius: 5, height: 5, width: `${pct}%`, transition: 'width .3s' }} />
            </div>
            <div style={{ color: G.tm, fontSize: 11, marginBottom: 10 }}>
              {lv >= 0 ? `${lv} vagas` : 'Lotado'}
            </div>

            <SL c={`Servos (${q.servos.length}/2)`} mt={0} />
            <Tags items={q.servos} ax={G.green}
              onX={edit ? i => upd(q.num, x => ({ ...x, servos: x.servos.filter((_, j) => j !== i) })) : undefined} />
            {edit && q.servos.length >= 2 && (
              <div style={{ color: G.tm, fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>Limite de 2 servos atingido.</div>
            )}
            <AddServoSearch quarto={q} updFn={upd} />

            <SL c="Encontristas" />
            {q.enc.length > 0 ? (
              <Tags items={q.enc}
                onX={edit ? i => upd(q.num, x => ({ ...x, enc: x.enc.filter((_, j) => j !== i) })) : undefined} />
            ) : (
              <div style={{ color: G.tm, fontSize: 12, fontStyle: 'italic', margin: '4px 0 8px' }}>Nenhum ainda</div>
            )}
            <AddEncAutocomplete quarto={q} />
          </Acc>
        );
      })}
    </div>
  );
}

// ── ENCONTRISTAS ─────────────────────────────────────────────────────────────
function EncV({ encH, setEncH, encM, setEncM, qh, qm, setQh, setQm, edit, t }) {
  const [g, setG] = useState('M');
  const [expandido, setExpandido] = useState({});
  const lista = (g === 'M' ? encM : encH).sort((a, b) => a.nome.localeCompare(b.nome));
  const dist = () => {
    if (!lista.length) { t('Nenhum encontrista', 'w'); return; }
    const qs = (g === 'H' ? qh : qm).filter((q) => !q.maes);
    const sh = [...lista].sort(() => Math.random() - 0.5);
    const cp = qs.map((q) => ({ ...q, enc: [...q.enc] }));
    sh.forEach((p, i) => {
      const d = cp.filter((q) => q.enc.length + q.servos.length < q.lim);
      if (d.length > 0) d[i % d.length].enc.push(p.nome);
    });
    if (g === 'H') setQh(qh.map((q) => cp.find((c) => c.num === q.num) || q));
    else setQm(qm.map((q) => cp.find((c) => c.num === q.num) || q));
    t(`${lista.length} distribuídos!`);
  };
  const toggle = (id) => setExpandido(prev => ({ ...prev, [id]: !prev[id] }));

  const msgPendente = (nome) =>
    `Olá, ${nome.split(' ')[0]}! 🙏\n\nVi que você se inscreveu no *Encontro com Deus* mas ainda não confirmou sua vaga.\n\nEsse fim de semana pode mudar sua vida de uma forma que você nunca imaginou. Um encontro real com Deus transforma, liberta e renova — e você merece viver isso! 💫\n\nPodemos te ajudar? Ficou com alguma dúvida sobre o pagamento ou sobre o evento? É só falar, estamos aqui! ❤️`;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          [encM.length + encH.length, 'Total Geral', '#636366'],
          [lista.filter(e => e.pago).length, 'Pagos', G.green],
          [lista.filter(e => !e.pago).length, 'Pendentes', '#ff3b30'],
        ].map(([n, l, c]) => (
          <div key={l} style={{ background: '#111', borderRadius: 12, padding: '10px 8px', textAlign: 'center', borderTop: `2px solid ${c}` }}>
            <div style={{ color: G.t, fontSize: 22, fontWeight: 800 }}>{n}</div>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
      <Seg opts={[['M', '♀ Mulheres'], ['H', '♂ Homens']]} val={g} set={setG} />
      <div style={{ marginTop: 10 }}>
        <button onClick={dist}
          style={{ ...BG({ width: '100%', padding: 12, marginTop: 10, marginBottom: 14, borderRadius: 13 }), background: 'rgba(10,132,255,.15)', border: '1px solid rgba(10,132,255,.3)', color: '#64b5f6' }}>
          Distribuir nos Quartos
        </button>
        {lista.length === 0 && (
          <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>Nenhum encontrista.</div>
        )}
        {lista.map((e) => {
          const aberto = expandido[e.id];
          const waNumero = e.whatsapp?.replace(/\D/g, '');
          return (
            <div key={e.id} className="fu"
              style={{ background: G.card, border: `1px solid ${e.pago ? 'rgba(0,200,81,.25)' : 'rgba(255,59,48,.2)'}`, borderLeft: `3px solid ${e.pago ? G.green : '#ff3b30'}`, borderRadius: 13, marginBottom: 7, overflow: 'hidden' }}>
              
              {/* Header clicável inteiro */}
              <div
                onClick={() => toggle(e.id)}
                style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: G.t, fontWeight: 700, fontSize: 14 }}>{e.nome}</div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>{e.igreja || '—'} · {e.celula || 'Sem célula'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {e.pagamentoId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e2 => e2.stopPropagation()}>
                      <img src="/mp-logo.png" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ color: G.green, fontSize: 11, fontWeight: 700 }}>Pago</span>
                    </div>
                  ) : (
                    <div onClick={async (e2) => {
                      e2.stopPropagation();
                      if (!edit) return;
                      vibrar(30);
                      await setDoc(doc(db, 'encontristas', e.id), { pago: !e.pago }, { merge: true });
                    }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: edit ? 'pointer' : 'default', userSelect: 'none' }}>
                      <div style={{ width: 34, height: 20, borderRadius: 20, background: e.pago ? G.green : '#ff3b30', transition: 'background .2s', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 2, left: e.pago ? 15 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                      </div>
                      <span style={{ color: e.pago ? G.green : '#ff3b30', fontSize: 11, fontWeight: 700, minWidth: 44 }}>
                        {e.pago ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  )}
                  <span style={{ color: G.tm, fontSize: 12, transition: 'transform .2s', display: 'inline-block', transform: aberto ? 'rotate(180deg)' : 'none' }}>▾</span>
                </div>
              </div>

              {/* Detalhes expandidos */}
              {aberto && (
                <div style={{ borderTop: '1px solid #1e1e1e', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>CPF</div>
                      <div style={{ color: G.td, fontSize: 12 }}>{e.cpf ? e.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Nascimento</div>
                      <div style={{ color: G.td, fontSize: 12 }}>{e.nascimento || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Camiseta</div>
                      <div style={{ color: G.td, fontSize: 12 }}>{e.camiseta || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Emergência</div>
                      <div style={{ color: G.td, fontSize: 12 }}>{e.emergencia || '—'}</div>
                    </div>
                    {e.medicamento && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Medicamento</div>
                        <div style={{ color: G.td, fontSize: 12 }}>{e.medicamento}</div>
                      </div>
                    )}
                    {e.doenca && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Doença Crônica</div>
                        <div style={{ color: G.td, fontSize: 12 }}>{e.doenca}</div>
                      </div>
                    )}
                  </div>

                  {/* Reenviar QR Code */}
                  {e.pago && waNumero && (
                    <a
                      href={`https://wa.me/55${waNumero}?text=${encodeURIComponent(`Olá ${e.nome.split(' ')[0]}! Segue o link para acessar seu QR Code do Encontro com Deus: https://servos-peniel.vercel.app?qr=true&id=${e.id}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(10,132,255,.1)', border: '1px solid rgba(10,132,255,.3)', color: '#64b5f6', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      Reenviar QR Code
                    </a>
                  )}

                  {/* Botão WhatsApp contato */}
                  {waNumero && (
                    <button
                      onClick={async () => {
                        if (!e.pago) {
                          try {
                            const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarPagamento', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ encontristaId: e.id, nome: e.nome, email: '' }),
                            });
                            const data = await res.json();
                            if (data.init_point) {
                              const msg = `${msgPendente(e.nome)}\n\nSua vaga está reservada! Clique aqui para pagar: ${data.init_point}`;
                              window.location.href = `https://wa.me/55${waNumero}?text=${encodeURIComponent(msg)}`;
                            }
                          } catch {
                            t('Erro ao gerar link de pagamento', 'w');
                          }
                        } else {
                          window.location.href = `https://wa.me/55${waNumero}`;
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.3)', color: '#25d366', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                      💬 Entrar em contato — {e.whatsapp}
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
  const [f, setF] = useState({ tipo: o.tipo, poltronas: o.poltronas || 40 });

  if (!aberto) return (
    <button onClick={() => setAberto(true)}
      style={{ ...BK({ width: '100%', padding: 8, borderRadius: 10, fontSize: 12, marginBottom: 8 }), borderColor: 'rgba(255,159,10,.3)', color: '#ff9f0a' }}>
      ✏️ Editar informações
    </button>
  );

  return (
    <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ color: G.tm, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Editar Ônibus {o.num}</div>
      <div>
        <div style={{ color: G.tm, fontSize: 11, marginBottom: 6 }}>Tipo</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Feminino', 'Masculino', 'Servos'].map(tipo => (
            <button key={tipo} onClick={() => setF({ ...f, tipo })}
              style={{ ...BK({ padding: '6px 12px', borderRadius: 50, fontSize: 12 }), borderColor: f.tipo === tipo ? 'rgba(0,200,81,.5)' : '#2a2a2a', color: f.tipo === tipo ? G.green : G.td, background: f.tipo === tipo ? 'rgba(0,200,81,.08)' : 'transparent' }}>
              {tipo}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ color: G.tm, fontSize: 11, marginBottom: 6 }}>Poltronas</div>
        <input type="number" value={f.poltronas}
          onChange={e => setF({ ...f, poltronas: parseInt(e.target.value) || 40 })}
          style={{ ...I, marginBottom: 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={async () => {
          await onSave({ ...o, tipo: f.tipo, poltronas: f.poltronas });
          setAberto(false);
        }}
          style={BG({ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 })}>
          Salvar
        </button>
        <button onClick={() => setAberto(false)}
          style={BK({ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 })}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── ÔNIBUS ───────────────────────────────────────────────────────────────────
function OnV({ on, uOn, setOn, encH, encM, edit, t, salvarOnibus, deletarOnibus }) {
  const [confirmDel, setConfirmDel] = useState(null); 
  const [shN, setShN] = useState(false);
  const [f, setF] = useState({ num: '', tipo: 'Feminino', poltronas: 40 });

  const passageirosPorOnibus = (num, tipo) => {
    const lista = tipo === 'Feminino' ? encM : tipo === 'Masculino' ? encH : [];
    return lista.filter(e => e.onibus === String(num) || e.onibus === num);
  };

  const criarOnibus = async () => {
    if (!f.num) { t('Informe o número', 'w'); return; }
    const existe = on.find(o => o.num === parseInt(f.num));
    if (existe) { t('Ônibus já existe', 'w'); return; }
    const novo = {
      num: parseInt(f.num),
      tipo: f.tipo,
      poltronas: parseInt(f.poltronas) || 40,
      resp: [], templo: [], servos: [], passManual: [],
      malas: [],
    };
    await salvarOnibus(novo);
    setOn([...on, novo].sort((a, b) => a.num - b.num));
    setF({ num: '', tipo: 'Feminino', poltronas: 40 });
    setShN(false);
    t('Ônibus criado!');
  };

  const delOnibus = async (num) => {
    setConfirmDel(num);
  };

  const upd = async (num, fn) => {
    const lista = isH ? qh : qm;
    const quarto = lista.find(q => q.num === num);
    if (!quarto) return;
    const atualizado = fn(quarto);
    if (isH) uQH(num, () => atualizado);
    else uQM(num, () => atualizado);
    await salvarQuarto(colecao, atualizado);
  };

  const tipoColor = { Feminino: '#bf5af2', Masculino: '#0a84ff', Servos: G.green };

  // Componente de mala com dropdown
    const AddMala = ({ num }) => {
    const [tipoMala, setTipoMala] = useState('Feminino');
    if (!edit) return null;
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <select value={tipoMala} onChange={e => setTipoMala(e.target.value)}
          style={{ ...I, fontSize: 12, padding: '9px 10px', borderRadius: 10 }}>
          <option value="Feminino">♀ Feminino</option>
          <option value="Masculino">♂ Masculino</option>
          <option value="Servos">👤 Servos</option>
        </select>
        <button onClick={() => {
          upd(num, x => ({ ...x, malas: [...(x.malas || []), tipoMala] }));
          t('✓');
        }} style={BG({ padding: '9px 14px', borderRadius: 10, fontSize: 13 })}>+</button>
      </div>
    );
  };

  

return (
  <div>
    {/* MODAL CONFIRMAR DELETE */}
    {confirmDel !== null && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
        <div style={{ background: '#1c1c1e', borderRadius: 18, padding: 24, maxWidth: 320, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗑</div>
          <div style={{ color: G.t, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Deletar Ônibus {confirmDel}?</div>
          <div style={{ color: G.tm, fontSize: 13, marginBottom: 20 }}>Esta ação não pode ser desfeita.</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setConfirmDel(null)}
              style={BK({ flex: 1, padding: 12, borderRadius: 12, fontSize: 14 })}>
              Cancelar
            </button>
            <button onClick={async () => {
              await deletarOnibus(confirmDel);
              setOn(on.filter(o => o.num !== confirmDel));
              setConfirmDel(null);
            }}
              style={{ ...BK({ flex: 1, padding: 12, borderRadius: 12, fontSize: 14 }), borderColor: 'rgba(255,59,48,.4)', color: '#ff6b6b' }}>
              Deletar
            </button>
          </div>
        </div>
      </div>
    )}

    {edit && (
      <>
        <button onClick={() => setShN(!shN)}
          style={shN
            ? BK({ width: '100%', padding: 12, marginBottom: 10, borderRadius: 13 })
            : BG({ width: '100%', padding: 12, marginBottom: 10, borderRadius: 13 })}>
          {shN ? '✕ Cancelar' : '＋ Novo Ônibus'}
        </button>
        {shN && (
          <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 16, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Número *</div>
                <input style={I} placeholder="Ex: 1" type="number" value={f.num}
                  onChange={e => setF({ ...f, num: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Poltronas</div>
                <input style={I} placeholder="Ex: 40" type="number" value={f.poltronas}
                  onChange={e => setF({ ...f, poltronas: e.target.value })} />
              </div>
            </div>
            <div>
              <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Tipo</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Feminino', 'Masculino', 'Servos'].map(tipo => (
                  <button key={tipo} onClick={() => setF({ ...f, tipo })}
                    style={{ ...BK({ padding: '8px 14px', borderRadius: 50, fontSize: 12, fontWeight: 700 }),
                      borderColor: f.tipo === tipo ? `${tipoColor[tipo]}80` : '#2a2a2a',
                      color: f.tipo === tipo ? tipoColor[tipo] : G.td,
                      background: f.tipo === tipo ? `${tipoColor[tipo]}12` : 'transparent' }}>
                    {tipo === 'Feminino' ? '♀' : tipo === 'Masculino' ? '♂' : '👤'} {tipo}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={criarOnibus} style={BG({ padding: 12, borderRadius: 12 })}>
              Criar Ônibus
            </button>
          </div>
        )}
      </>
    )}

    {on.length === 0 && (
      <div style={{ color: G.tm, textAlign: 'center', padding: 32, fontSize: 13 }}>
        Nenhum ônibus cadastrado.
      </div>
    )}

    {on.map(o => {
      const pass = passageirosPorOnibus(o.num, o.tipo);
      const tc = tipoColor[o.tipo] || G.green;
      const passManual = o.passManual || [];
      const servos = o.servos || [];
      const malas = Array.isArray(o.malas) ? o.malas : [];
      const ocupados = (o.tipo === 'Servos'
        ? servos.length
        : o.resp.length + o.templo.length + pass.length + passManual.length);
      const poltronas = o.poltronas || 40;
      const pct = Math.min(100, Math.round((ocupados / poltronas) * 100));
      const bc = pct >= 100 ? '#ff3b30' : pct >= 80 ? '#ff9f0a' : G.green;

      return (
        <Acc key={o.num} title={`🚌 Ônibus ${o.num}`} ax={tc}
          right={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Pill c={o.tipo} bg={`${tc}18`} tc={tc} />
              <Pill c={`${ocupados}/${poltronas}`} bg={`${bc}18`} tc={bc} />
            </div>
          }
          onDel={edit ? () => delOnibus(o.num) : undefined}
        >
          <div style={{ background: '#1e1e1e', borderRadius: 5, height: 5, marginBottom: 8 }}>
            <div style={{ background: bc, borderRadius: 5, height: 5, width: `${pct}%`, transition: 'width .3s' }} />
          </div>
          <div style={{ color: G.tm, fontSize: 11, marginBottom: 10 }}>
            {poltronas - ocupados >= 0 ? `${poltronas - ocupados} vagas` : 'Lotado'}
          </div>

          {edit && <EditOnibus o={o} onSave={salvarOnibus} />}

          {o.tipo === 'Servos' ? (
            <>
              <SL c={`Servos (${servos.length})`} mt={0} />
              <Tags items={servos} ax={G.green}
                onX={edit ? i => upd(o.num, x => ({ ...x, servos: x.servos.filter((_, j) => j !== i) })) : undefined} />
              {edit && (
                <AddIn ph="Adicionar servo..." onAdd={n => upd(o.num, x => ({ ...x, servos: [...(x.servos || []), n] }))} mt={8} />
              )}
            </>
          ) : (
            <>
              <SL c="Responsáveis" mt={0} />
              <Tags items={o.resp || []} ax={G.green}
                onX={edit ? i => upd(o.num, x => ({ ...x, resp: x.resp.filter((_, j) => j !== i) })) : undefined} />
              {edit && (
                <AddIn ph="Adicionar responsável..." onAdd={n => upd(o.num, x => ({ ...x, resp: [...(x.resp || []), n] }))} mt={8} />
              )}
              <SL c="Servos do Templo" />
              <Tags items={o.templo || []} ax="#0a84ff"
                onX={edit ? i => upd(o.num, x => ({ ...x, templo: x.templo.filter((_, j) => j !== i) })) : undefined} />
              {edit && (
                <AddIn ph="Servo do templo..." onAdd={n => upd(o.num, x => ({ ...x, templo: [...(x.templo || []), n] }))} mt={8} />
              )}
              <SL c={`Passageiros via Check-in (${pass.length})`} />
              {pass.length > 0 ? (
                <Tags items={pass.map(p => p.nome)} />
              ) : (
                <div style={{ color: G.tm, fontSize: 12, fontStyle: 'italic', margin: '4px 0 8px' }}>
                  Nenhum ainda — atribua pelo Check-in
                </div>
              )}
              <SL c={`Passageiros Manual (${passManual.length})`} />
              <Tags items={passManual}
                onX={edit ? i => upd(o.num, x => ({ ...x, passManual: x.passManual.filter((_, j) => j !== i) })) : undefined} />
              {edit && (
                <AddIn ph="Adicionar passageiro manual..." onAdd={n => upd(o.num, x => ({ ...x, passManual: [...(x.passManual || []), n] }))} mt={8} />
              )}
            </>
          )}

          <SL c={`Malas (${malas.length})`} />
          {malas.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {malas.map((tipo, i) => (
                <Tag key={i} c={`${tipo === 'Feminino' ? '♀' : tipo === 'Masculino' ? '♂' : '👤'} ${tipo}`}
                  ax={tipoColor[tipo]}
                  onX={edit ? () => upd(o.num, x => ({ ...x, malas: x.malas.filter((_, j) => j !== i) })) : undefined} />
              ))}
            </div>
          ) : (
            <div style={{ color: G.tm, fontSize: 12, fontStyle: 'italic', margin: '4px 0 8px' }}>Nenhuma mala</div>
          )}
          <AddMala num={o.num} />
        </Acc>
      );
    })}
  </div>
);
}

// ── RESTRIÇÕES ───────────────────────────────────────────────────────────────
function RestV({ rest, setRest, qm, setQm, edit, role, t }) {
  const can = ['admin', 'lider_geral', 'pastor'].includes(role);
  const dist = () => {
    const todos = rest.flatMap((r) => r.ps);
    if (!todos.length) {
      t('Nenhuma pessoa', 'w');
      return;
    }
    const qs = qm.filter((q) => !q.maes);
    const sh = [...todos].sort(() => Math.random() - 0.5);
    let nv = [...qm].map((q) =>
      q.maes ? q : { ...q, enc: q.enc.filter((e) => !todos.includes(e)) }
    );
    sh.forEach((p, i) => {
      const num = qs[i % qs.length].num;
      nv = nv.map((q) => (q.num === num ? { ...q, enc: [...q.enc, p] } : q));
    });
    setQm(nv);
    t('Distribuído!');
  };
  return (
    <div>
      <div
        style={{
          background: 'rgba(255,59,48,.08)',
          border: '1px solid rgba(255,59,48,.2)',
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 12,
          display: 'flex',
          gap: 10,
        }}
      >
        <span>⛔</span>
        <div>
          <div style={{ color: '#ff6b6b', fontWeight: 700, fontSize: 13 }}>
            Não podem ficar no mesmo quarto
          </div>
          <div
            style={{
              color: 'rgba(255,107,107,.6)',
              fontSize: 12,
              marginTop: 2,
            }}
          >
            Membros da mesma célula.
          </div>
        </div>
      </div>
      {can && (
        <button
          onClick={dist}
          style={{
            ...BG({
              width: '100%',
              padding: 12,
              marginBottom: 10,
              borderRadius: 13,
            }),
            background: 'rgba(10,132,255,.15)',
            border: '1px solid rgba(10,132,255,.3)',
            color: '#64b5f6',
          }}
        >
          🎲 Distribuir Aleatoriamente
        </button>
      )}
      {can && (
        <AddIn
          ph="Novo grupo / célula..."
          onAdd={(n) => {
            const id = Math.max(...rest.map((r) => r.id), 0) + 1;
            setRest([...rest, { id, cel: n, ps: [] }]);
            t('Grupo criado!');
          }}
          mt={0}
        />
      )}
      {rest.map((r) => (
        <Acc
          key={r.id}
          title={r.cel}
          ax="rgba(255,59,48,.5)"
          right={
            <Pill c={`${r.ps.length}`} bg="rgba(255,59,48,.1)" tc="#ff6b6b" />
          }
          onDel={
            can
              ? () => {
                  setRest(rest.filter((x) => x.id !== r.id));
                  t('Removido.');
                }
              : undefined
          }
        >
          <Tags
            items={r.ps}
            ax="rgba(255,59,48,.5)"
            onX={
              can
                ? (i) =>
                    setRest(
                      rest.map((x) =>
                        x.id === r.id
                          ? { ...x, ps: x.ps.filter((_, j) => j !== i) }
                          : x
                      )
                    )
                : undefined
            }
          />
          {can && (
            <AddIn
              ph="Adicionar pessoa..."
              onAdd={(n) => {
                setRest(
                  rest.map((x) =>
                    x.id === r.id ? { ...x, ps: [...x.ps, n] } : x
                  )
                );
                t('✓');
              }}
              mt={8}
            />
          )}
        </Acc>
      ))}
    </div>
  );
}

function ImgV({ encH, encM }) {
  const todos = [...encH, ...encM].filter(e => e.autorizaImagem === 'Não');
  return (
    <div>
      <div style={{ background: 'rgba(255,214,10,.08)', border: '1px solid rgba(255,214,10,.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, color: '#ffd60a', fontSize: 12 }}>
        📷 Encontristas que NÃO autorizaram uso de imagem
      </div>
      {todos.length === 0 && (
        <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>
          Todos autorizaram! ✓
        </div>
      )}
      {todos.map((e, i) => (
        <div key={e.id} className="fu"
          style={{ background: G.card, border: '1px solid rgba(255,214,10,.2)', borderLeft: '3px solid #ffd60a', borderRadius: 13, padding: '12px 14px', marginBottom: 7 }}>
          <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>{e.nome}</div>
          <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>{e.sexo} · {e.celula || 'Sem célula'}</div>
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
          ph={ph || 'Nome...'}
          onAdd={(n) => {
            setItems([...items, { id: Date.now(), nome: n }]);
            t('✓');
          }}
          mt={0}
        />
      )}
      <div style={{ height: 8 }} />
      {items.length === 0 && (
        <div
          style={{
            color: G.tm,
            textAlign: 'center',
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
            padding: '12px 14px',
            marginBottom: 7,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
            {icon} {p.nome}
          </span>
          {edit && (
            <span
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              style={{
                color: 'rgba(255,59,48,.5)',
                cursor: 'pointer',
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
function InfoV({ ocorr, setOcorr, t, notifyAll }) {
  const [sh, setSh] = useState(false);
  const [f, setF] = useState({ tipo: '', local: '', desc: '' });
  const registrar = () => {
    if (!f.tipo) return;
    const nova = {
      id: Date.now(),
      ...f,
      res: false,
      hr: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setOcorr([nova, ...ocorr]);
    notifyAll(`⚠️ Ocorrência: ${f.tipo}${f.local ? ' — ' + f.local : ''}`);
    setF({ tipo: '', local: '', desc: '' });
    setSh(false);
    t('Registrado!');
  };
  return (
    <div>
      <button
        onClick={() => setSh(!sh)}
        style={
          sh
            ? BK({
                width: '100%',
                padding: 12,
                marginBottom: 14,
                borderRadius: 13,
              })
            : {
                ...BG({
                  width: '100%',
                  padding: 12,
                  marginBottom: 14,
                  borderRadius: 13,
                }),
                background: 'linear-gradient(135deg,#ff9f0a,#ff6b00)',
              }
        }
      >
        {sh ? '✕ Cancelar' : '＋ Registrar Ocorrência'}
      </button>
      {sh && (
        <div
          style={{
            background: G.card,
            border: `1px solid ${G.cb}`,
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
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
              '🚽 Banheiro entupido',
              '🚿 Chuveiro quebrado',
              '🛏️ Cama quebrada',
              '💡 Elétrico',
              '🚪 Porta',
              '🌡️ Temperatura',
              '⚠️ Outro',
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
            style={{ ...I, minHeight: 60, resize: 'vertical' }}
            placeholder="Descrição..."
            value={f.desc}
            onChange={(e) => setF({ ...f, desc: e.target.value })}
          />
          <button
            onClick={() => { vibrar(80); registrar(); }}
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
            textAlign: 'center',
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
              o.res ? 'rgba(0,200,81,.25)' : 'rgba(255,159,10,.2)'
            }`,
            borderLeft: `3px solid ${o.res ? G.green : '#ff9f0a'}`,
            borderRadius: 13,
            padding: '13px 14px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
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
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginLeft: 10,
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <button
                onClick={() =>
                  setOcorr(
                    ocorr.map((x) =>
                      x.id === o.id ? { ...x, res: !x.res } : x
                    )
                  )
                }
                style={{
                  background: o.res
                    ? 'rgba(0,200,81,.1)'
                    : 'rgba(255,159,10,.1)',
                  border: `1px solid ${
                    o.res ? 'rgba(0,200,81,.3)' : 'rgba(255,159,10,.3)'
                  }`,
                  color: o.res ? G.green : '#ff9f0a',
                  borderRadius: 9,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {o.res ? '✓ OK' : 'Resolver'}
              </button>
              <span
                onClick={() => setOcorr(ocorr.filter((x) => x.id !== o.id))}
                style={{
                  color: 'rgba(255,59,48,.35)',
                  cursor: 'pointer',
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

// ── ACHADOS ──────────────────────────────────────────────────────────────────
function AchV({ ach, setAch, t }) {
  const [sh, setSh] = useState(false);
  const [f, setF] = useState({ item: '', local: '', dono: '' });
  return (
    <div>
      <button
        onClick={() => setSh(!sh)}
        style={
          sh
            ? BK({
                width: '100%',
                padding: 12,
                marginBottom: 14,
                borderRadius: 13,
              })
            : BG({
                width: '100%',
                padding: 12,
                marginBottom: 14,
                borderRadius: 13,
              })
        }
      >
        {sh ? '✕ Cancelar' : '＋ Registrar Item Encontrado'}
      </button>
      {sh && (
        <div
          style={{
            background: G.card,
            border: `1px solid ${G.cb}`,
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
            display: 'flex',
            flexDirection: 'column',
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
                  hr: new Date().toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
                ...ach,
              ]);
              setF({ item: '', local: '', dono: '' });
              setSh(false);
              t('Registrado!');
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
            textAlign: 'center',
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
              a.ent ? 'rgba(0,200,81,.25)' : 'rgba(191,90,242,.2)'
            }`,
            borderLeft: `3px solid ${a.ent ? G.green : '#bf5af2'}`,
            borderRadius: 13,
            padding: '13px 14px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
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
                display: 'flex',
                gap: 6,
                marginLeft: 10,
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <button
                onClick={() =>
                  setAch(
                    ach.map((x) => (x.id === a.id ? { ...x, ent: !x.ent } : x))
                  )
                }
                style={{
                  background: a.ent
                    ? 'rgba(0,200,81,.1)'
                    : 'rgba(191,90,242,.1)',
                  border: `1px solid ${
                    a.ent ? 'rgba(0,200,81,.3)' : 'rgba(191,90,242,.3)'
                  }`,
                  color: a.ent ? G.green : '#bf5af2',
                  borderRadius: 9,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {a.ent ? '✓ Entregue' : 'Entregar'}
              </button>
              <span
                onClick={() => setAch(ach.filter((x) => x.id !== a.id))}
                style={{
                  color: 'rgba(255,59,48,.35)',
                  cursor: 'pointer',
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
  const [f, setF] = useState({ nome: '', quarto: '', cond: '', obs: '' });
  return (
    <div>
      <div
        style={{
          background: 'rgba(255,59,48,.07)',
          border: '1px solid rgba(255,59,48,.15)',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 12,
          display: 'flex',
          gap: 10,
        }}
      >
        <span>💊</span>
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
                  width: '100%',
                  padding: 12,
                  marginBottom: 14,
                  borderRadius: 13,
                })
              : BG({
                  width: '100%',
                  padding: 12,
                  marginBottom: 14,
                  borderRadius: 13,
                })
          }
        >
          {sh ? '✕ Cancelar' : '＋ Adicionar Registro'}
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
            display: 'flex',
            flexDirection: 'column',
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
            style={{ ...I, minHeight: 55, resize: 'vertical' }}
            placeholder="Obs..."
            value={f.obs}
            onChange={(e) => setF({ ...f, obs: e.target.value })}
          />
          <button
            onClick={() => {
              if (!f.nome || !f.cond) return;
              setSau([...sau, { id: Date.now(), ...f }]);
              setF({ nome: '', quarto: '', cond: '', obs: '' });
              setSh(false);
              t('Registrado!');
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
            textAlign: 'center',
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
            border: '1px solid rgba(255,59,48,.2)',
            borderLeft: '3px solid #ff3b30',
            borderRadius: 13,
            padding: '13px 14px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ color: G.t, fontWeight: 700, fontSize: 13 }}>
                💊 {s.nome}
              </div>
              {s.quarto && (
                <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                  🛏️ Quarto {s.quarto}
                </div>
              )}
              <div
                style={{
                  color: '#ff6b6b',
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
            {edit && (
              <span
                onClick={() => setSau(sau.filter((x) => x.id !== s.id))}
                style={{
                  color: 'rgba(255,59,48,.4)',
                  cursor: 'pointer',
                  fontSize: 16,
                  marginLeft: 10,
                }}
              >
                ×
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── LOUÇA ────────────────────────────────────────────────────────────────────
function LouçaV({ louça, setLouça, edit, t }) {
  return (
    <div>
      {!edit && (
        <div
          style={{
            background: 'rgba(255,159,10,.1)',
            border: '1px solid rgba(255,159,10,.2)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 14,
            color: '#ff9f0a',
            fontSize: 12,
          }}
        >
          👀 Edição permitida ao Líder de Cozinha
        </div>
      )}
      {louça.map((l) => (
        <Acc
          key={l.id}
          title={`🍽️ ${l.r}`}
          right={<Pill c={l.s.length} bg="#1e1e1e" tc={G.td} />}
        >
          <Tags
            items={l.s}
            onX={
              edit
                ? (i) =>
                    setLouça(
                      louça.map((x) =>
                        x.id === l.id
                          ? { ...x, s: x.s.filter((_, j) => j !== i) }
                          : x
                      )
                    )
                : undefined
            }
          />
          {edit && (
            <AddIn
              ph="Adicionar pessoa..."
              onAdd={(n) => {
                setLouça(
                  louça.map((x) =>
                    x.id === l.id ? { ...x, s: [...x.s, n] } : x
                  )
                );
                t('✓');
              }}
              mt={8}
            />
          )}
        </Acc>
      ))}
    </div>
  );
}

// ── EQUIPES ──────────────────────────────────────────────────────────────────
function EqV({ esc, setEsc, uEs, edit, t }) {
  const [sh, setSh] = useState(false);
  const [f, setF] = useState({ equipe: '', tipo: 'ministerio', resp: '' });
  const tC = { ministerio: '#0a84ff', staff: '#ff9f0a' };
  return (
    <div>
      {edit && (
        <>
          <button
            onClick={() => setSh(!sh)}
            style={
              sh
                ? BK({
                    width: '100%',
                    padding: 12,
                    marginBottom: 14,
                    borderRadius: 13,
                  })
                : BG({
                    width: '100%',
                    padding: 12,
                    marginBottom: 14,
                    borderRadius: 13,
                  })
            }
          >
            {sh ? '✕ Cancelar' : '＋ Nova Equipe'}
          </button>
          {sh && (
            <div
              style={{
                background: G.card,
                border: `1px solid ${G.cb}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 14,
                display: 'flex',
                flexDirection: 'column',
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
                  await addDoc(collection(db, 'equipes'), { ...f, servos: [] });
                  setF({ equipe: '', tipo: 'ministerio', resp: '' });
                  setSh(false);
                  t('Criado!');
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
              c={eq.tipo === 'ministerio' ? 'Ministério' : 'Staff'}
              bg={`${tC[eq.tipo]}18`}
              tc={tC[eq.tipo]}
            />
          }
          onDel={edit ? async () => {
            await deleteDoc(doc(db, 'equipes', eq.id));
            t('Removido.');
          } : undefined}
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
              onX={edit ? async (i) => {
              const novos = (eq.servos || []).filter((_, j) => j !== i);
                await setDoc(doc(db, 'equipes', eq.id), { servos: novos }, { merge: true });
              } : undefined}
            />
          ) : (
            <div
              style={{
                color: G.tm,
                fontSize: 12,
                fontStyle: 'italic',
                margin: '4px 0 8px',
              }}
            >
              Nenhum
            </div>
          )}
          {edit && (
            <AddIn
              ph="Adicionar membro..."
              onAdd={async (n) => {
                await setDoc(doc(db, 'equipes', eq.id), { servos: [...(eq.servos || []), n] }, { merge: true });
                t('✓');
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
  colorOn = '#00c851',
  colorOff = '#636366',
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 42,
          height: 24,
          borderRadius: 20,
          background: val ? colorOn : colorOff,
          transition: 'background .2s',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: val ? 19 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .2s',
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
  const [busca, setBusca] = useState(u[campo] || '');
  const [aberto, setAberto] = useState(false);
  const skipBlur = useRef(false);

  const filtrados = users.filter(s =>
    s.perfil === 'servo' && s.ativo !== false &&
    s.nome.toLowerCase().includes(busca.toLowerCase()) &&
    busca.length > 0 &&
    s.nome !== u[campo]
  );

  const limpar = async () => {
    setBusca('');
    await setDoc(doc(db, 'users', u.id), { [campo]: '' }, { merge: true });
    upd(u.id, x => ({ ...x, [campo]: '' }));
  };

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => { if (!skipBlur.current) setAberto(false); skipBlur.current = false; }}
          placeholder={ph}
          style={{ ...I, fontSize: 12, padding: '9px 12px', flex: 1 }}
        />
        {busca && (
          <button onClick={limpar}
            style={{ ...BK({ padding: '9px 12px', borderRadius: 10, fontSize: 13 }), color: 'rgba(255,59,48,.6)', borderColor: 'rgba(255,59,48,.3)', flexShrink: 0 }}>
            ✕
          </button>
        )}
      </div>
      {aberto && filtrados.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 10,
          marginTop: 4, maxHeight: 160, overflowY: 'auto',
        }}>
          {filtrados.map(s => (
            <div key={s.id}
              onMouseDown={async () => {
                skipBlur.current = true;
                setBusca(s.nome);
                setAberto(false);
                await setDoc(doc(db, 'users', u.id), { [campo]: s.nome }, { merge: true });
                upd(u.id, x => ({ ...x, [campo]: s.nome }));
              }}
              style={{ padding: '10px 14px', color: G.td, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #2a2a2a' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
function SvV({ users, setUsers, esc, edit, t, dataLimitePagamento }) {
  const [filtroPerfil, setFiltroPerfil] = useState('todos');
  const [sh, setSh] = useState(false);
  const [f, setF] = useState({ nome: '', sob: '', email: '', perfil: 'servo', fn: '' });
  const [filtro, setFiltro] = useState('todos');
  const [loading, setLoading] = useState(false);
  const fnsDasEquipes = useMemo(() => [...new Set(esc.filter(e => e.equipe).map((e) => e.equipe))], [esc]);
  const [busca, setBusca] = useState('');
  const upd = (id, fn) => setUsers(users.map((u) => (u.id === id ? fn(u) : u)));
  const [dataTempPag, setDataTempPag] = useState(dataLimitePagamento || '');
  const [savingDataPag, setSavingDataPag] = useState(false);

  const salvarDataPag = async () => {
    if (!dataTempPag) { t('Selecione uma data', 'w'); return; }
    setSavingDataPag(true);
    await setDoc(doc(db, 'config', 'uniformes'), { dataLimitePagamento: dataTempPag }, { merge: true });
    setSavingDataPag(false);
    t('Data limite salva!');
  };

  const add = async () => {
    if (!f.nome.trim()) { t('Nome obrigatório', 'w'); return; }
    if (!f.email.trim() || !f.email.includes('@')) { t('Email inválido', 'w'); return; }
    if (!f.fn) { t('Selecione uma equipe/função', 'w'); return; }
    setLoading(true);
    try {
      const nm = `${f.nome.trim()} ${f.sob.trim()}`.trim();
      const res = await fetch('https://us-central1-servos-peniel.cloudfunctions.net/criarServo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.email.trim(),
          nome: nm,
          perfil: f.perfil,
          funcoes: f.fn ? [f.fn] : [],
        }),
      });
      const data = await res.json();
      if (data.result?.uid) {
        setUsers([...users, { id: data.result.uid, nome: nm, email: f.email.trim(), perfil: f.perfil, funcoes: f.fn ? [f.fn] : [], ativo: true, pago: false }]);
        setF({ nome: '', sob: '', email: '', perfil: 'servo', fn: '' });
        setSh(false);
        t('Servo adicionado! Email de acesso enviado ✉️');
      } else {
        t(data.error || 'Erro ao criar servo', 'w');
      }
    } catch (err) {
      t('Erro: ' + err.message, 'w');
    }
    setLoading(false);
  };

  const lista = users.filter(
    (u) => u.perfil !== 'admin' &&
      (filtro === 'todos' ? true : filtro === 'ativos' ? u.ativo !== false : !u.ativo) &&
      (filtroPerfil === 'todos' ? true :
      filtroPerfil === 'lideres' ? ['lider_geral', 'lider_staff', 'lider_quartos', 'lider_cozinha', 'lider_templo', 'pastor'].includes(u.perfil) :
      filtroPerfil === 'servo' ? u.perfil === 'servo' :
      u.perfil === 'lider_celula') &&
      u.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div>
      {edit && (
        <button onClick={() => setSh(true)} style={BG({ width: '100%', padding: 13, marginBottom: 12, borderRadius: 14 })}>
          + Adicionar Servo
        </button>
      )}

      {edit && (
        <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ color: G.t, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Data Limite — Pagamento do Servo</div>
          {!!dataLimitePagamento && dataTempPag === dataLimitePagamento ? (
            <>
              <div style={{ color: G.td, fontSize: 14, padding: '10px 0', marginBottom: 10 }}>
                {new Date(dataLimitePagamento + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
              <button onClick={() => setDataTempPag('')} style={BK({ width: '100%', padding: 12, borderRadius: 12 })}>
                Alterar Data
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select value={dataTempPag?.split('-')[2] || ''}
                  onChange={e => { const p = dataTempPag?.split('-') || ['','','']; setDataTempPag(`${p[0]}-${p[1]}-${e.target.value}`); }}
                  style={{ ...I, flex: 1, marginBottom: 0 }}>
                  <option value="">Dia</option>
                  {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                    <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                  ))}
                </select>
                <select value={dataTempPag?.split('-')[1] || ''}
                  onChange={e => { const p = dataTempPag?.split('-') || ['','','']; setDataTempPag(`${p[0]}-${e.target.value}-${p[2]}`); }}
                  style={{ ...I, flex: 1, marginBottom: 0 }}>
                  <option value="">Mês</option>
                  {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  ))}
                </select>
                <select value={dataTempPag?.split('-')[0] || ''}
                  onChange={e => { const p = dataTempPag?.split('-') || ['','','']; setDataTempPag(`${e.target.value}-${p[1]}-${p[2]}`); }}
                  style={{ ...I, flex: 1, marginBottom: 0 }}>
                  <option value="">Ano</option>
                  {[2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button onClick={salvarDataPag} disabled={savingDataPag}
                style={BG({ width: '100%', padding: 12, borderRadius: 12, opacity: savingDataPag ? 0.7 : 1 })}>
                {savingDataPag ? 'Salvando...' : 'Salvar Data'}
              </button>
            </>
          )}
        </div>
      )}

      {/* FILTRO DE PERFIL */}
      <div style={{ marginBottom: 10 }}>
        <Seg opts={[
          ['todos', 'Todos'],
          ['lideres', 'Líderes'],
          ['servo', 'Servos'],
          ['lider_celula', 'Células'],
        ]} val={filtroPerfil} set={setFiltroPerfil} />
      </div>

      {/* FILTRO ATIVO/INATIVO */}
      <div style={{ marginBottom: 10 }}>
        <Seg opts={[['todos', 'Todos'], ['ativos', 'Ativos'], ['inativos', 'Inativos']]} val={filtro} set={setFiltro} />
      </div>

      {/* BUSCA */}
      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="🔍 Buscar..."
        style={{ ...I, marginBottom: 14 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          [users.filter((u) => u.perfil !== 'admin').length, 'Total', '#636366'],
          [users.filter((u) => u.perfil !== 'admin' && u.ativo !== false).length, 'Ativos', G.green],
          [users.filter((u) => u.perfil === 'servo' && u.pago).length, 'Pagos', '#0a84ff'],
        ].map(([n, l, c]) => (
          <div key={l} style={{ background: '#111', borderRadius: 12, padding: '10px 8px', textAlign: 'center', borderTop: `2px solid ${c}` }}>
            <div style={{ color: G.t, fontSize: 20, fontWeight: 800 }}>{n}</div>
            <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {lista.map((u, i) => (
        <Acc key={i} title={u.nome} right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!u.ativo && <Pill c="Inativo" bg="rgba(99,99,102,.2)" tc="#636366" />}
            {u.perfil === 'servo' && u.pago && <Pill c="Pago ✓" bg="rgba(0,200,81,.15)" tc={G.green} />}
            <Pill c={PERFIS[u.perfil]?.l || u.perfil} bg={`${PERFIS[u.perfil]?.c || G.green}18`} tc={PERFIS[u.perfil]?.c || G.green} />
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {u.email && <div style={{ color: G.tm, fontSize: 12 }}>✉️ {u.email}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', borderRadius: 12, padding: '12px 14px' }}
              onClick={e => e.stopPropagation()}>
              <Toggle
                val={u.ativo !== false}
                onToggle={async () => {
                  await setDoc(doc(db, 'users', u.id), { ativo: !u.ativo }, { merge: true });
                  upd(u.id, (x) => ({ ...x, ativo: !x.ativo }));
                }}
                labelOn="Ativo"
                labelOff="Inativo"
              />
              {u.perfil === 'servo' && (
                <Toggle
                  val={!!u.pago}
                  onToggle={async () => {
                    await setDoc(doc(db, 'users', u.id), { pago: !u.pago }, { merge: true });
                  }}
                  labelOn="Pago ✓"
                  labelOff="Pendente"
                  colorOn="#0a84ff"
                />
              )}
            </div>

            {u.perfil !== 'servo' && u.perfil !== 'pastor' && u.perfil !== 'lider_geral' && (
              <div onClick={e => e.stopPropagation()}>
                <SL c="Líderes" mt={0} />
                <LiderInput u={u} campo="liderEncontro" ph="Servo 1..." users={users} upd={upd} />
                <LiderInput u={u} campo="liderEncontro2" ph="Servo 2..." users={users} upd={upd} />
              </div>
            )}

            {u.funcoes?.length > 0 && <><SL c="Funções" mt={0} /><Tags items={u.funcoes} /></>}
          </div>
        </Acc>
      ))}

      <Sheet open={sh} onClose={() => setSh(false)} title="Adicionar Servo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'rgba(0,200,81,.08)', border: '1px solid rgba(0,200,81,.2)', borderRadius: 10, padding: '10px 13px', color: G.green, fontSize: 12 }}>
            ✉️ O servo receberá um email para criar a própria senha.
          </div>
          <input placeholder="Nome *" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} style={I} />
          <input placeholder="Sobrenome" value={f.sob} onChange={(e) => setF({ ...f, sob: e.target.value })} style={I} />
          <input placeholder="Email * (será usado para login)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
            style={{ ...I, borderColor: f.email && !f.email.includes('@') ? 'rgba(255,59,48,.4)' : '#2a2a2a' }} />
          <select style={I} value={f.perfil} onChange={(e) => setF({ ...f, perfil: e.target.value })}>
            {Object.entries(PERFIS).filter(([k]) => k !== 'admin').map(([k, v]) => (
              <option key={k} value={k}>{v.l}</option>
            ))}
          </select>
          <select style={{ ...I, borderColor: !f.fn ? 'rgba(255,59,48,.4)' : '#2a2a2a' }} value={f.fn} onChange={(e) => setF({ ...f, fn: e.target.value })}>
            <option value="">⚠️ Equipe / Função *</option>
            {fnsDasEquipes.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
          </select>
          <button onClick={add} disabled={loading} style={BG({ width: '100%', padding: 14, borderRadius: 14, marginTop: 4, opacity: loading ? 0.7 : 1 })}>
            {loading ? 'Cadastrando...' : 'Confirmar e Enviar Email'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

const TAMANHOS = ['P', 'M', 'G', 'G1', 'G2', 'G3'];

function UniV({ uni, setUni, dataLimite, setDataLimite, dataLimitePagamento, user, role, edit, t }) {
  const isAdm = edit;
  const hoje = new Date().toISOString().split('T')[0];
  const prazoDefinido = !!dataLimite;
  const prazoOk = prazoDefinido && hoje <= dataLimite;
  const meuPedido = uni.find((u) => u.userId === user.id);
  const bloqueado = meuPedido && meuPedido.status !== 'aberto' || (meuPedido && !meuPedido.status);
  const [form, setForm] = useState(
    meuPedido || { camisa: '', qtdCamisas: 1, calca: '', blusa: '', nomeCamiseta: '' }
  );
  const [saving, setSaving] = useState(false);

  const precoItem = (item, tam) => {
    if (!tam) return 0;
    const grande = ['G1', 'G2', 'G3', 'G4'].includes(tam);
    if (item === 'camisa') return grande ? 43 : 37;
    if (item === 'blusa') return grande ? 105 : 90;
    if (item === 'calca') return grande ? 75 : 70;
    return 0;
  };
  
  const totalPedido = () => {
    const camisa = precoItem('camisa', form.camisa) * (form.qtdCamisas || 1);
    const calca = precoItem('calca', form.calca) * (form.qtdCalcas || 1);
    const blusa = precoItem('blusa', form.blusa) * (form.qtdBlusas || 1);
    return camisa + calca + blusa;
  };

  const salvarPedido = async () => {
    if (!form.camisa) { t('Selecione o tamanho da camiseta', 'w'); return; }
    if (!form.nomeCamiseta?.trim()) { t('Informe o nome para a camiseta', 'w'); return; }
    setSaving(true);
    const pedido = {
      nome: user.nome,
      perfil: user.perfil,
      nomeCamiseta: form.nomeCamiseta.trim(),
      camisa: form.camisa,
      qtdCamisas: form.qtdCamisas || 1,
      calca: form.calca || '',
      qtdCalcas: form.qtdCalcas || 1,
      blusa: form.blusa || '',
      qtdBlusas: form.qtdBlusas || 1,
      status: 'bloqueado',
      data: new Date().toLocaleString('pt-BR'),
    };
    await setDoc(doc(db, 'uniformes', user.id), pedido);
    setSaving(false);
    t('Pedido salvo! ✓');
  };

  const solicitarAlteracao = async () => {
    await setDoc(doc(db, 'uniformes', user.id), { status: 'pendente' }, { merge: true });
    t('Solicitação enviada ao admin!');
  };

  // SERVO VIEW
  if (!isAdm) return (
    <div>
      {!prazoDefinido && (
        <div style={{ background: 'rgba(99,99,102,.1)', border: '1px solid #2a2a2a', borderRadius: 14, padding: 20, textAlign: 'center', color: G.tm, fontSize: 13 }}>
          As solicitações de uniforme ainda não foram abertas.<br />
          Aguarde a data ser definida pelo admin.
        </div>
      )}
      {prazoDefinido && (
        <>
          <div style={{ background: prazoOk ? 'rgba(0,200,81,.08)' : 'rgba(255,59,48,.08)', border: `1px solid ${prazoOk ? 'rgba(0,200,81,.2)' : 'rgba(255,59,48,.2)'}`, borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ color: prazoOk ? G.green : '#ff6b6b', fontWeight: 700, fontSize: 13 }}>
              {prazoOk ? 'Prazo aberto' : 'Prazo encerrado'}
            </div>
            <div style={{ color: G.tm, fontSize: 12, marginTop: 3 }}>
              Data limite: {new Date(dataLimite + 'T12:00:00').toLocaleDateString('pt-BR')}
            </div>
          </div>

          {prazoOk && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* STATUS DO PEDIDO */}
              {meuPedido && meuPedido.status === 'aberto' && (
                <div style={{ background: 'rgba(255,159,10,.08)', border: '1px solid rgba(255,159,10,.3)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ color: '#ff9f0a', fontWeight: 700, fontSize: 13 }}>
                    Alteracao aprovada — edite e salve novamente
                  </div>
                </div>
              )}
              {meuPedido && meuPedido.status === 'pendente' && (
                <div style={{ background: 'rgba(255,159,10,.08)', border: '1px solid rgba(255,159,10,.3)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ color: '#ff9f0a', fontWeight: 700, fontSize: 13 }}>
                    Solicitacao de alteracao enviada — aguardando aprovacao
                  </div>
                </div>
              )}
              {/* CAMISETA */}
              <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 14, opacity: bloqueado ? 0.6 : 1 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Camiseta <Pill c="Inclusa" bg="rgba(0,200,81,.12)" tc={G.green} />
                </div>
                <div style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}>Tamanho</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                  {TAMANHOS.map((tm) => (
                    <button key={tm} onClick={() => !bloqueado && setForm({ ...form, camisa: tm })}
                      style={{ ...BK({ padding: '7px 13px', borderRadius: 50, fontSize: 12, fontWeight: 700 }), borderColor: form.camisa === tm ? 'rgba(0,200,81,.5)' : '#2a2a2a', color: form.camisa === tm ? G.green : G.td, background: form.camisa === tm ? 'rgba(0,200,81,.08)' : 'transparent', cursor: bloqueado ? 'default' : 'pointer' }}>
                      {tm}
                    </button>
                  ))}
                </div>
                <div style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}>Quantidade (max. 3)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
                  <button onClick={() => !bloqueado && setForm({ ...form, qtdCamisas: Math.max(1, (form.qtdCamisas || 1) - 1) })}
                    style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>−</button>
                  <span style={{ color: G.t, fontSize: 24, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>
                    {form.qtdCamisas || 1}
                  </span>
                  <button onClick={() => !bloqueado && setForm({ ...form, qtdCamisas: Math.min(3, (form.qtdCamisas || 1) + 1) })}
                    style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>+</button>
                </div>
                <div style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}>Nome na Camiseta</div>
                <input
                  placeholder="Primeiro nome e sobrenome"
                  value={form.nomeCamiseta || ''}
                  disabled={bloqueado}
                  onChange={e => setForm({ ...form, nomeCamiseta: e.target.value })}
                  style={{ ...I, marginBottom: 0, opacity: bloqueado ? 0.6 : 1, cursor: bloqueado ? 'default' : 'text' }}
                />
              </div>

              {/* CALÇA */}
              <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 14, opacity: bloqueado ? 0.6 : 1 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Calca</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                  <button onClick={() => !bloqueado && setForm({ ...form, calca: '', qtdCalcas: 1 })}
                    style={{ ...BK({ padding: '7px 13px', borderRadius: 50, fontSize: 12 }), borderColor: !form.calca ? 'rgba(255,59,48,.5)' : '#2a2a2a', color: !form.calca ? '#ff6b6b' : G.td, cursor: bloqueado ? 'default' : 'pointer' }}>
                    Nao quero
                  </button>
                  {TAMANHOS.map((tm) => (
                    <button key={tm} onClick={() => !bloqueado && setForm({ ...form, calca: tm })}
                      style={{ ...BK({ padding: '7px 13px', borderRadius: 50, fontSize: 12, fontWeight: 700 }), borderColor: form.calca === tm ? 'rgba(0,200,81,.5)' : '#2a2a2a', color: form.calca === tm ? G.green : G.td, background: form.calca === tm ? 'rgba(0,200,81,.08)' : 'transparent', cursor: bloqueado ? 'default' : 'pointer' }}>
                      {tm}
                    </button>
                  ))}
                </div>
                {form.calca && (
                  <>
                    <div style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}>Quantidade (max. 3)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <button onClick={() => !bloqueado && setForm({ ...form, qtdCalcas: Math.max(1, (form.qtdCalcas || 1) - 1) })}
                        style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>−</button>
                      <span style={{ color: G.t, fontSize: 24, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>
                        {form.qtdCalcas || 1}
                      </span>
                      <button onClick={() => !bloqueado && setForm({ ...form, qtdCalcas: Math.min(3, (form.qtdCalcas || 1) + 1) })}
                        style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>+</button>
                    </div>
                  </>
                )}
              </div>

              {/* BLUSA DE FRIO */}
              <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 14, opacity: bloqueado ? 0.6 : 1 }}>
                <div style={{ color: G.t, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Blusa de Frio</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
                  <button onClick={() => !bloqueado && setForm({ ...form, blusa: '', qtdBlusas: 1 })}
                    style={{ ...BK({ padding: '7px 13px', borderRadius: 50, fontSize: 12 }), borderColor: !form.blusa ? 'rgba(255,59,48,.5)' : '#2a2a2a', color: !form.blusa ? '#ff6b6b' : G.td, cursor: bloqueado ? 'default' : 'pointer' }}>
                    Nao quero
                  </button>
                  {TAMANHOS.map((tm) => (
                    <button key={tm} onClick={() => !bloqueado && setForm({ ...form, blusa: tm })}
                      style={{ ...BK({ padding: '7px 13px', borderRadius: 50, fontSize: 12, fontWeight: 700 }), borderColor: form.blusa === tm ? 'rgba(0,200,81,.5)' : '#2a2a2a', color: form.blusa === tm ? G.green : G.td, background: form.blusa === tm ? 'rgba(0,200,81,.08)' : 'transparent', cursor: bloqueado ? 'default' : 'pointer' }}>
                      {tm}
                    </button>
                  ))}
                </div>
                {form.blusa && (
                  <>
                    <div style={{ color: G.tm, fontSize: 11, marginBottom: 8 }}>Quantidade (max. 3)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <button onClick={() => !bloqueado && setForm({ ...form, qtdBlusas: Math.max(1, (form.qtdBlusas || 1) - 1) })}
                        style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>−</button>
                      <span style={{ color: G.t, fontSize: 24, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>
                        {form.qtdBlusas || 1}
                      </span>
                      <button onClick={() => !bloqueado && setForm({ ...form, qtdBlusas: Math.min(3, (form.qtdBlusas || 1) + 1) })}
                        style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>+</button>
                    </div>
                  </>
                )}
              </div>

{/* RESUMO DE VALORES */}
              {(form.camisa || form.calca || form.blusa) && (
                <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 14 }}>
                  <div style={{ color: G.t, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Resumo do Pedido</div>
                  {form.camisa && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: G.td, fontSize: 13 }}>Camiseta {form.camisa} × {form.qtdCamisas || 1}</span>
                      <span style={{ color: G.t, fontWeight: 600, fontSize: 13 }}>
                        R$ {(precoItem('camisa', form.camisa) * (form.qtdCamisas || 1)).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                  {form.calca && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: G.td, fontSize: 13 }}>Calca {form.calca}</span>
                      <span style={{ color: G.t, fontWeight: 600, fontSize: 13 }}>R$ {precoItem('calca', form.calca).toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  {form.blusa && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: G.td, fontSize: 13 }}>Blusa de Frio {form.blusa}</span>
                      <span style={{ color: G.t, fontWeight: 600, fontSize: 13 }}>R$ {precoItem('blusa', form.blusa).toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: '#2a2a2a', margin: '10px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: G.t, fontWeight: 700, fontSize: 14 }}>Total</span>
                    <span style={{ color: G.t, fontWeight: 800, fontSize: 14 }}>R$ {totalPedido().toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: G.green, fontWeight: 700, fontSize: 13 }}>Sinal (50%)</span>
                    <span style={{ color: G.green, fontWeight: 800, fontSize: 13 }}>R$ {(totalPedido() * 0.5).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div style={{ color: G.tm, fontSize: 11, marginTop: 8 }}>* Encomenda mediante 50% do valor</div>
                </div>
              )}

              {/* BOTOES */}
              {!meuPedido && (
                <button onClick={() => { vibrar(50); salvarPedido(); }} disabled={saving}
                  style={BG({ width: '100%', padding: 14, borderRadius: 14, opacity: saving ? 0.7 : 1 })}>
                  {saving ? 'Salvando...' : 'Salvar Pedido'}
                </button>
              )}
              {meuPedido && meuPedido.status === 'aberto' && (
                <button onClick={salvarPedido} disabled={saving}
                  style={BG({ width: '100%', padding: 14, borderRadius: 14, opacity: saving ? 0.7 : 1 })}>
                  {saving ? 'Salvando...' : 'Salvar Alteracao'}
                </button>
              )}
              {meuPedido && (meuPedido.status === 'bloqueado' || !meuPedido.status) && (
                <button onClick={solicitarAlteracao}
                  style={{ ...BK({ width: '100%', padding: 14, borderRadius: 14 }), borderColor: 'rgba(255,159,10,.4)', color: '#ff9f0a' }}>
                  Solicitar Alteracao
                </button>
              )}

              {/* PIX Uniforme */}
              <div style={{ background: G.card, border: '1px solid #2a2a2a', borderRadius: 14, padding: 16, marginTop: 8 }}>
                <div style={{ color: G.tm, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Pagamento do Uniforme</div>
                <div style={{ color: G.td, fontSize: 12, marginBottom: 6 }}>PIX Nubank — Thaís Bezerra da Silva Rodrigues</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ color: G.t, fontWeight: 700, fontSize: 15, flex: 1 }}>40617537895</div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('40617537895');
                      vibrar(50);
                      t('Chave PIX copiada! ✓');
                    }}
                    style={{ ...BK({ padding: '6px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700 }), borderColor: 'rgba(0,200,81,.4)', color: G.green, whiteSpace: 'nowrap' }}>
                    📋 Copiar
                  </button>
                </div>
                <a href="https://wa.me/5511997187584?text=Olá%20Thaís!%20Realizei%20o%20pagamento%20do%20uniforme%20e%20gostaria%20de%20enviar%20o%20comprovante."
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.3)', color: '#25d366', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  💬 Enviar comprovante para Thaís
                </a>
              </div>

            </div>
          )}
          {!prazoOk && (
            <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>
              O prazo para solicitacao encerrou.
            </div>
          )}
        </>
      )}
    </div>
  );

  // ADMIN VIEW
  const resumo = (key) => TAMANHOS.reduce((a, tm) => {
  const qtdKey = key === 'camisa' ? 'qtdCamisas' : key === 'calca' ? 'qtdCalcas' : 'qtdBlusas';
  return {
    ...a,
    [tm]: uni.filter(u => u[key] === tm).reduce((s, u) => s + (u[qtdKey] || 1), 0)
    };
  }, {});

  const pendentes = uni.filter(u => u.status === 'pendente').length;
  const [dataTemp, setDataTemp] = useState(dataLimite);
  const [dataTempPag, setDataTempPag] = useState(dataLimitePagamento); 

  const aprovar = async (userId) => {
    await setDoc(doc(db, 'uniformes', userId), { status: 'aberto' }, { merge: true });
    t('Alteracao aprovada!');
  };

  const reprovar = async (userId) => {
    await setDoc(doc(db, 'uniformes', userId), { status: 'bloqueado' }, { merge: true });
    t('Solicitacao reprovada.');
  };

  return (
    <div>
      {/* DATA LIMITE */}
      <div style={{ background: G.card, border: `1px solid ${G.cb}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <div style={{ color: G.t, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Data Limite para Solicitacoes</div>
        
        {!!dataLimite && dataTemp === dataLimite ? (
          <>
            <div style={{ color: G.td, fontSize: 14, padding: '10px 0', marginBottom: 10 }}>
              {new Date(dataLimite + 'T12:00:00').toLocaleDateString('pt-BR')}
            </div>
            <button onClick={() => setDataTemp('')}
              style={BK({ width: '100%', padding: 12, borderRadius: 12 })}>
              Alterar Data
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <select
                value={dataTemp?.split('-')[2] || ''}
                onChange={e => {
                  const parts = dataTemp?.split('-') || ['', '', ''];
                  setDataTemp(`${parts[0]}-${parts[1]}-${e.target.value}`);
                }}
                style={{ ...I, flex: 1, marginBottom: 0 }}>
                <option value="">Dia</option>
                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                  <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                ))}
              </select>
              <select
                value={dataTemp?.split('-')[1] || ''}
                onChange={e => {
                  const parts = dataTemp?.split('-') || ['', '', ''];
                  setDataTemp(`${parts[0]}-${e.target.value}-${parts[2]}`);
                }}
                style={{ ...I, flex: 1, marginBottom: 0 }}>
                <option value="">Mês</option>
                {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                ))}
              </select>
              <select
                value={dataTemp?.split('-')[0] || ''}
                onChange={e => {
                  const parts = dataTemp?.split('-') || ['', '', ''];
                  setDataTemp(`${e.target.value}-${parts[1]}-${parts[2]}`);
                }}
                style={{ ...I, flex: 1, marginBottom: 0 }}>
                <option value="">Ano</option>
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={salvarData} disabled={savingData}
              style={BG({ width: '100%', padding: 12, borderRadius: 12, opacity: savingData ? 0.7 : 1 })}>
              {savingData ? 'Salvando...' : 'Salvar Data'}
            </button>
          </>
        )}
        {!dataTemp && (
          <div style={{ color: '#ff9f0a', fontSize: 12, marginTop: 8 }}>Defina uma data para liberar solicitacoes aos servos.</div>
        )}
      </div>

      {/* ALERTA PENDENTES */}
      {pendentes > 0 && (
        <div style={{ background: 'rgba(255,159,10,.1)', border: '1px solid rgba(255,159,10,.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, color: '#ff9f0a', fontWeight: 700, fontSize: 13 }}>
          {pendentes} solicitacao{pendentes > 1 ? 'oes' : ''} de alteracao pendente{pendentes > 1 ? 's' : ''}
        </div>
      )}

      {/* RESUMO */}
      {uni.length > 0 && (
        <Acc title={`Resumo (${uni.length} pedidos)`} def={true}>
          {[
            { key: 'camisa', label: 'Camisetas' },
            { key: 'calca', label: 'Calcas' },
            { key: 'blusa', label: 'Blusas de Frio' },
          ].map(({ key, label }) => {
            const r = resumo(key);
            const total = Object.values(r).reduce((a, b) => a + b, 0);
            if (!total) return null;
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ color: G.td, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  {label}
                  {key === 'camisa' && (
                    <span style={{ color: G.tm, marginLeft: 8 }}>
                      (total: {uni.reduce((a, u) => a + (u.qtdCamisas || 1), 0)})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TAMANHOS.filter(tm => r[tm] > 0).map(tm => (
                    <Pill key={tm} c={`${tm}: ${r[tm]}`} bg="#1e1e1e" tc={G.td} />
                  ))}
                </div>
              </div>
            );
          })}
        </Acc>
      )}

      {/* PEDIDOS */}
      <SL c={`Pedidos (${uni.length})`} mt={14} />

      {/* EXPORTAR */}
      {uni.length > 0 && (
        <button
          onClick={() => {
            const TAMANHOS = ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3'];

            const buildAba = (wb, titulo, dados) => {
              const ws = wb.addWorksheet(titulo);

              ws.mergeCells('A1:H1');
              const title = ws.getCell('A1');
              title.value = `PEDIDO UNIFORMES — ${titulo.toUpperCase()} — ENCONTRO COM DEUS 2026`;
              title.font = { name: 'Arial', bold: true, size: 12 };
              title.alignment = { horizontal: 'center', vertical: 'middle' };
              ws.getRow(1).height = 24;

              const secoes = [[1, 'CAMISETA'], [4, 'BLUSÃO DE FRIO'], [7, 'CALÇA']];
              secoes.forEach(([col, nome]) => {
                ws.mergeCells(2, col, 2, col + 1);
                const c = ws.getCell(2, col);
                c.value = nome;
                c.font = { name: 'Arial', bold: true, size: 11 };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              });
              ws.getRow(2).height = 20;

              secoes.forEach(([col]) => {
                ['NOME', 'QTD'].forEach((h, i) => {
                  const c = ws.getCell(3, col + i);
                  c.value = h;
                  c.font = { name: 'Arial', bold: true, size: 9 };
                  c.alignment = { horizontal: 'center', vertical: 'middle' };
                  c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
              });
              ws.getRow(3).height = 16;

              [22, 6, 2, 22, 6, 2, 22, 6].forEach((w, i) => {
                ws.getColumn(i + 1).width = w;
              });

              let row = 4;
              const totais = { camisa: {}, blusa: {}, calca: {} };
              const borda = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              const cinzaClaro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
              const cinzaMedio = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };
              const cinzaEscuro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBBBBB' } };

              TAMANHOS.forEach(tm => {
                const cam = dados.filter(u => u.camisa === tm).map(u => [u.nomeCamiseta || u.nome, u.qtdCamisas || 1]);
                const blu = dados.filter(u => u.blusa === tm).map(u => [u.nome, u.qtdBlusas || 1]);
                const cal = dados.filter(u => u.calca === tm).map(u => [u.nome, u.qtdCalcas || 1]);

                if (!cam.length && !blu.length && !cal.length) return;

                [1, 4, 7].forEach(col => {
                  ws.mergeCells(row, col, row, col + 1);
                  const c = ws.getCell(row, col);
                  c.value = `TAMANHO ${tm}`;
                  c.font = { name: 'Arial', bold: true, size: 9 };
                  c.fill = cinzaClaro;
                  c.alignment = { horizontal: 'center', vertical: 'middle' };
                  c.border = borda;
                });
                ws.getRow(row).height = 15;
                row++;

                const maxRows = Math.max(cam.length, blu.length, cal.length, 1);
                for (let i = 0; i < maxRows; i++) {
                  [[1, cam], [4, blu], [7, cal]].forEach(([col, lista]) => {
                    if (i < lista.length) {
                      const c1 = ws.getCell(row + i, col);
                      c1.value = lista[i][0]; c1.font = { name: 'Arial', size: 9 }; c1.alignment = { horizontal: 'left', vertical: 'middle' }; c1.border = borda;
                      const c2 = ws.getCell(row + i, col + 1);
                      c2.value = lista[i][1]; c2.font = { name: 'Arial', size: 9 }; c2.alignment = { horizontal: 'center', vertical: 'middle' }; c2.border = borda;
                    } else {
                      [0, 1].forEach(o => { ws.getCell(row + i, col + o).border = borda; });
                    }
                  });
                  ws.getRow(row + i).height = 14;
                }
                row += maxRows;

                const tCam = cam.reduce((a, x) => a + x[1], 0);
                const tBlu = blu.reduce((a, x) => a + x[1], 0);
                const tCal = cal.reduce((a, x) => a + x[1], 0);
                totais.camisa[tm] = tCam; totais.blusa[tm] = tBlu; totais.calca[tm] = tCal;

                [[1, tCam], [4, tBlu], [7, tCal]].forEach(([col, total]) => {
                  const c = ws.getCell(row, col);
                  c.value = `TOTAL ${tm}`; c.font = { name: 'Arial', bold: true, size: 9 }; c.fill = cinzaMedio; c.alignment = { horizontal: 'left', vertical: 'middle' }; c.border = borda;
                  const c2 = ws.getCell(row, col + 1);
                  c2.value = total; c2.font = { name: 'Arial', bold: true, size: 9 }; c2.fill = cinzaMedio; c2.alignment = { horizontal: 'center', vertical: 'middle' }; c2.border = borda;
                });
                ws.getRow(row).height = 15;
                row += 2;
              });

              row++;
              [[1, 'camisa', 'TOTAL CAMISETAS'], [4, 'blusa', 'TOTAL BLUSÕES'], [7, 'calca', 'TOTAL CALÇAS']].forEach(([col, key, label]) => {
                const total = Object.values(totais[key]).reduce((a, b) => a + b, 0);
                const c = ws.getCell(row, col);
                c.value = label; c.font = { name: 'Arial', bold: true, size: 11 }; c.fill = cinzaEscuro; c.alignment = { horizontal: 'left', vertical: 'middle' }; c.border = borda;
                const c2 = ws.getCell(row, col + 1);
                c2.value = total; c2.font = { name: 'Arial', bold: true, size: 11 }; c2.fill = cinzaEscuro; c2.alignment = { horizontal: 'center', vertical: 'middle' }; c2.border = borda;
              });
              ws.getRow(row).height = 20;
            };

            const wb = new ExcelJS.Workbook();
            buildAba(wb, 'SERVO', uni.filter(u => u.perfil === 'servo'));
            buildAba(wb, 'STAFF', uni.filter(u => u.perfil !== 'servo'));

            wb.xlsx.writeBuffer().then(buffer => {
              const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'uniformes.xlsx';
              a.click();
              URL.revokeObjectURL(url);
            });
          }}
          style={{ ...BG({ width: '100%', padding: 12, borderRadius: 13, fontSize: 13, marginBottom: 14 }), background: 'rgba(0,200,81,.15)', border: '1px solid rgba(0,200,81,.3)', color: G.green }}>
          Exportar para Fornecedor (XLSX)
        </button>
      )}

      {uni.length === 0 && (
        <div style={{ color: G.tm, textAlign: 'center', padding: 28, fontSize: 13 }}>Nenhum pedido ainda.</div>
      )}
      {uni.map((u, i) => {
        const statusColor = u.status === 'pendente' ? '#ff9f0a' : u.status === 'aberto' ? '#0a84ff' : G.green;
        const statusLabel = u.status === 'pendente' ? 'Aguardando aprovacao' : u.status === 'aberto' ? 'Liberado para editar' : 'Confirmado';
        return (
          <Acc key={i} title={u.nome} ax={statusColor}
            right={<Pill c={statusLabel} bg={`${statusColor}18`} tc={statusColor} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Pill c={`Camiseta ${u.camisa} x${u.qtdCamisas || 1}`} bg="#1e1e1e" tc={G.td} />
                {u.nomeCamiseta && <Pill c={`Nome: ${u.nomeCamiseta}`} bg="rgba(0,200,81,.1)" tc={G.green} />}
                {u.calca && <Pill c={`Calca ${u.calca}`} bg="#1e1e1e" tc={G.td} />}
                {u.blusa && <Pill c={`Blusa ${u.blusa}`} bg="#1e1e1e" tc={G.td} />}
              </div>

              {/* FLAG PAGO */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: G.tm, fontSize: 12 }}>Pagamento</span>
                <div
                  onClick={async () => {
                    await setDoc(doc(db, 'uniformes', u.userId), { pago: !u.pago }, { merge: true });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <div style={{ width: 34, height: 20, borderRadius: 20, background: u.pago ? G.green : '#ff3b30', transition: 'background .2s', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 2, left: u.pago ? 15 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                  </div>
                  <span style={{ color: u.pago ? G.green : '#ff3b30', fontSize: 12, fontWeight: 700 }}>
                    {u.pago ? 'Pago' : 'Pendente'}
                  </span>
                </div>
              </div>

              <div style={{ color: G.tm, fontSize: 11 }}>Salvo em: {u.data}</div>
              {u.status === 'pendente' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => aprovar(u.userId)}
                    style={BG({ flex: 1, padding: '10px', borderRadius: 12, fontSize: 13 })}>
                    Aprovar
                  </button>
                  <button onClick={() => reprovar(u.userId)}
                    style={{ ...BK({ flex: 1, padding: '10px', borderRadius: 12, fontSize: 13 }), borderColor: 'rgba(255,59,48,.4)', color: '#ff6b6b' }}>
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

// ── BACK OFFICE ──────────────────────────────────────────────────────────────
function BackV({ users, setUsers, fns, setFns, t }) {
  const [tab, setTab] = useState('grupos');
  const [shGrp, setShGrp] = useState(false);
  const [grpForm, setGrpForm] = useState({ label: '', cor: '#00c851' });
  const [perfis, setPerfis] = useState(PERFIS);
  const pD = {
    admin: 'Acesso total',
    lider_geral: 'Tudo exceto Back Office',
    pastor: 'Edição geral',
    lider_staff: 'Operacional',
    lider_quartos: 'Edição de quartos',
    lider_cozinha: 'Edição da louça',
    servo: 'Somente visualização',
    lider_midia: 'Líder Mídia',
  };
  return (
    <div>
      <Seg
        opts={[
          ['grupos', 'Grupos'],
          ['usuarios', 'Usuários'],
        ]}
        val={tab}
        set={setTab}
      />
      <div style={{ marginTop: 14 }}>
        {tab === 'grupos' && (
          <>
            <button
              onClick={() => setShGrp(!shGrp)}
              style={
                shGrp
                  ? BK({
                      width: '100%',
                      padding: 12,
                      marginBottom: 12,
                      borderRadius: 13,
                    })
                  : BG({
                      width: '100%',
                      padding: 12,
                      marginBottom: 12,
                      borderRadius: 13,
                    })
              }
            >
              {shGrp ? '✕ Cancelar' : '＋ Criar Grupo de Acesso'}
            </button>
            {shGrp && (
              <div
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <input
                  style={I}
                  placeholder="Nome do grupo (ex: Líder Louça) *"
                  value={grpForm.label}
                  onChange={(e) =>
                    setGrpForm({ ...grpForm, label: e.target.value })
                  }
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ color: G.tm, fontSize: 13 }}>
                    Cor do grupo
                  </span>
                  <input
                    type="color"
                    value={grpForm.cor}
                    onChange={(e) =>
                      setGrpForm({ ...grpForm, cor: e.target.value })
                    }
                    style={{
                      ...I,
                      width: 60,
                      padding: 4,
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  />
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: grpForm.cor,
                    }}
                  />
                </div>
                <div style={{ color: G.tm, fontSize: 12, lineHeight: 1.5 }}>
                  As permissões do novo grupo serão configuradas pelo
                  desenvolvedor. Use para organização visual por enquanto.
                </div>
                <button
                  onClick={() => {
                    if (!grpForm.label.trim()) return;
                    const key = grpForm.label
                      .toLowerCase()
                      .replace(/\s+/g, '_')
                      .replace(/[^a-z_]/g, '');
                    t(
                      `Grupo "${grpForm.label}" criado! Informe ao dev para configurar permissões.`
                    );
                    setGrpForm({ label: '', cor: '#00c851' });
                    setShGrp(false);
                  }}
                  style={BG({ padding: 12, borderRadius: 12 })}
                >
                  Criar Grupo
                </button>
              </div>
            )}
            {Object.entries(PERFIS).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderLeft: `3px solid ${v.c}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 3,
                  }}
                >
                  <span style={{ color: G.t, fontWeight: 700, fontSize: 13 }}>
                    {v.l}
                  </span>
                  <Pill
                    c={`${users.filter((u) => u.perfil === k).length} usuários`}
                    bg="#1e1e1e"
                    tc={G.tm}
                  />
                </div>
                <div style={{ color: G.tm, fontSize: 12 }}>
                  {pD[k] || 'Permissões customizadas'}
                </div>
              </div>
            ))}
          </>
        )}
        {tab === 'usuarios' &&
          users.map((u, i) => (
            <div
              key={i}
              className="fu"
              style={{
                background: G.card,
                border: `1px solid ${G.cb}`,
                borderLeft: `3px solid ${PERFIS[u.perfil]?.c || G.green}`,
                borderRadius: 13,
                padding: '12px 14px',
                marginBottom: 7,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ color: G.t, fontWeight: 700, fontSize: 13 }}>
                    {u.nome}
                  </div>
                  <div
                    style={{
                      color: G.tm,
                      fontSize: 11,
                      marginTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    ●●●●●●
                    {u.primeiro && (
                      <Pill
                        c="1º acesso"
                        bg="rgba(255,159,10,.12)"
                        tc="#ff9f0a"
                      />
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={u.perfil}
                    onChange={(e) => {
                      setUsers(
                        users.map((x) =>
                          x.id === u.id ? { ...x, perfil: e.target.value } : x
                        )
                      );
                      t('Perfil atualizado!');
                    }}
                    style={{
                      ...I,
                      width: 'auto',
                      padding: '6px 9px',
                      fontSize: 11,
                      borderRadius: 9,
                    }}
                  >
                    {Object.entries(PERFIS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.l}
                      </option>
                    ))}
                  </select>
                  {u.perfil === 'servo' && (
                    <span
                      onClick={() => {
                        setUsers(users.filter((x) => x.id !== u.id));
                        t('Removido.');
                      }}
                      style={{
                        color: 'rgba(255,59,48,.4)',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      🗑
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        {tab === 'funcoes' && (
          <>
            <AddIn
              ph="Nova função..."
              onAdd={(n) => {
                if (!fns.includes(n.trim())) {
                  setFns([...fns, n.trim()]);
                  t('Função criada!');
                } else t('Já existe', 'w');
              }}
              mt={0}
            />
            <div style={{ height: 10 }} />
            {fns.map((fn, i) => (
              <div
                key={i}
                className="fu"
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderLeft: `3px solid ${G.green}`,
                  borderRadius: 13,
                  padding: '12px 14px',
                  marginBottom: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
                  📋 {fn}
                </span>
                <span
                  onClick={() => {
                    setFns(fns.filter((_, j) => j !== i));
                    t('Removido.');
                  }}
                  style={{
                    color: 'rgba(255,59,48,.4)',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  🗑
                </span>
              </div>
            ))}
            <div
              style={{
                background: 'rgba(0,200,81,.08)',
                border: '1px solid rgba(0,200,81,.15)',
                borderRadius: 12,
                padding: '10px 14px',
                marginTop: 10,
                color: G.tm,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Funções criadas aqui aparecem no dropdown ao adicionar servo.
            </div>
          </>
        )}
      </div>
    </div>
  );
}