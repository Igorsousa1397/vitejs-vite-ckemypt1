import { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, getDoc, setDoc, collection, getDocs, onSnapshot, updateDoc, addDoc, deleteDoc, createUserWithEmailAndPassword, sendPasswordResetEmail } from './firebase';
import { useState, useMemo, useEffect } from 'react';
import { messaging, getToken, onMessage } from './firebase';

const VAPID_KEY = 'BBVluqF6EX97RYmDoQDIIS1C4UB7aFocmFR3sZIEkcXeB2L81JCov9407bX6HEDlBguNflnrhLVgSDUeeYXLQ_4';

const iniciarNotificacoes = async (userId = null) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      await setDoc(doc(db, 'tokens', token), { 
        token, 
        userId: userId || 'unknown',
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
  servo: { l: 'Servo', c: '#636366' },
};
const canG = (p) =>
  ['admin', 'lider_geral', 'pastor', 'lider_staff'].includes(p);
const canQ = (p) => ['admin', 'lider_quartos'].includes(p);
const canC = (p) => ['admin', 'lider_cozinha'].includes(p);
const canN = (p) => ['admin', 'lider_geral', 'pastor'].includes(p);

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
    <div
      style={{
        background: G.card,
        border: `1px solid ${G.cb}`,
        borderLeft: ax ? `3px solid ${ax}` : `1px solid ${G.cb}`,
        borderRadius: 16,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
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
const ESCALAS_INIT = [
  {
    id: 1,
    equipe: 'Som',
    tipo: 'ministerio',
    servos: ['Caio', 'Hiago', 'Islany'],
    resp: 'Caio',
  },
  {
    id: 2,
    equipe: 'Banheiro',
    tipo: 'staff',
    servos: ['Silas', 'Letícia', 'Duda'],
    resp: 'Silas & Letícia',
  },
  {
    id: 3,
    equipe: 'Cozinha',
    tipo: 'staff',
    servos: ['Pra. Kevelen'],
    resp: 'Pra. Kevelen',
  },
  {
    id: 4,
    equipe: 'Intercessão',
    tipo: 'ministerio',
    servos: ['Pr. André', 'Cris', 'Kelly'],
    resp: 'Pr. André / Cris',
  },
  {
    id: 5,
    equipe: 'Templo',
    tipo: 'ministerio',
    servos: ['Simone', 'Thaís', 'Brenda'],
    resp: 'Tiago / Brenda',
  },
  {
    id: 6,
    equipe: 'Malas',
    tipo: 'staff',
    servos: ['Cris', 'Gabriel'],
    resp: '',
  },
  {
    id: 7,
    equipe: 'Crachá',
    tipo: 'staff',
    servos: ['Thais', 'Gustavo'],
    resp: '',
  },
  {
    id: 8,
    equipe: 'Refeitório',
    tipo: 'staff',
    servos: ['Felipe', 'Jeferson'],
    resp: '',
  },
  {
    id: 9,
    equipe: 'Cantina',
    tipo: 'staff',
    servos: ['Dona Cris', 'Silvio'],
    resp: 'Dona Cris',
  },
];
const QH_INIT = [
  { num: 6, lim: 12, servos: ['Luan', 'Jeferson'], enc: [] },
  { num: 7, lim: 12, servos: ['Felipe', 'Sostenes'], enc: [] },
  { num: 8, lim: 12, servos: ['Bruno', 'Rodnei'], enc: [] },
  { num: 9, lim: 12, servos: ['Nicolas', 'Denis'], enc: [] },
  { num: 10, lim: 12, servos: ['Silas', 'João Clesio'], enc: [] },
  { num: 11, lim: 12, servos: ['Gustavo', 'Thalyson'], enc: [] },
];
const QM_INIT = [
  {
    num: 12,
    maes: true,
    lim: 9,
    servos: ['Lorenna', 'Rayza'],
    enc: ['Daniela dos Anjos', 'Gabriela Patucci'],
  },
  { num: 13, lim: 9, servos: ['Larissa C.', 'Larissa O.'], enc: [] },
  { num: 14, lim: 9, servos: ['Eduarda', 'Carolina B.'], enc: [] },
  { num: 15, lim: 9, servos: ['Caroline G.', 'Tais C.'], enc: [] },
  { num: 16, lim: 9, servos: ['Tauane', 'Tais'], enc: [] },
  { num: 17, lim: 9, servos: ['Leia', 'Ev Barbara'], enc: [] },
  { num: 18, lim: 9, servos: ['Ev Beatriz', 'Jaque'], enc: [] },
  { num: 19, lim: 9, servos: ['Ana Beatriz', 'Letícia P.'], enc: [] },
  { num: 20, lim: 9, servos: ['Paulinha', 'Miriam'], enc: [] },
  { num: 21, lim: 9, servos: ['Tainá', 'Kelly'], enc: [] },
  { num: 22, lim: 9, servos: ['Raquel', 'Ana Clara'], enc: [] },
];
const ON_INIT = [
  { num: 1, resp: ['Islany', 'Silas'], templo: ['Tainá', 'Thais'], pass: [] },
  { num: 2, resp: ['Tiago', 'Simone'], templo: ['Tiago', 'Simone'], pass: [] },
  {
    num: 3,
    resp: ['Brenda', 'João Clesio'],
    templo: ['Brenda', 'Ev. Raimundo'],
    pass: [],
  },
  { num: 4, resp: ['Larissa', 'Felipe'], templo: ['Cris', 'Rodnei'], pass: [] },
  {
    num: 5,
    resp: ['Kelly', 'Sostenes'],
    templo: ['Samuel', 'Miriam'],
    pass: [],
  },
  {
    num: 6,
    resp: ['Letícia', 'Gabriel'],
    templo: ['Gabriel', 'Pr Amilton'],
    pass: [],
  },
];
const MINS_INIT = [
  { id: 1, dia: 'Sexta', nome: '1ª Ministração', hora: '20:00', sent: false },
  { id: 2, dia: 'Sexta', nome: 'Ato — 1ª Min.', hora: '21:30', sent: false },
  { id: 3, dia: 'Sábado', nome: '2ª Ministração', hora: '09:00', sent: false },
  { id: 4, dia: 'Sábado', nome: 'Ato — 2ª Min.', hora: '10:30', sent: false },
  { id: 5, dia: 'Sábado', nome: '3ª Ministração', hora: '14:00', sent: false },
  { id: 6, dia: 'Sábado', nome: 'Ato — 3ª Min.', hora: '15:30', sent: false },
  { id: 7, dia: 'Sábado', nome: 'Fogueira', hora: '20:00', sent: false },
  { id: 8, dia: 'Domingo', nome: '4ª Ministração', hora: '09:00', sent: false },
  { id: 9, dia: 'Domingo', nome: 'Ato Final', hora: '10:30', sent: false },
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
  servos: 'Servos',
  back: 'Back Office',
  uniformes: 'Uniformes',
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
function Login({ onLogin }){
  const [email,setEmail]=useState('');
  const [senha,setSenha]=useState('');
  const [e,setE]=useState('');
  const [load,setLoad]=useState(false);

  const go=async()=>{
    if(!email.trim()||!senha.trim()){setE('Preencha todos os campos.');return;}
    setLoad(true);setE('');
    try{
      const cred=await signInWithEmailAndPassword(auth,email,senha);
      const snap=await getDoc(doc(db,'users',cred.user.uid));
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
      <div style={{width:'100%',maxWidth:360}}>
      <div style={{marginBottom:36,textAlign:'center'}}>
        <img src="/IMG_2408.PNG" alt="Encontro com Deus"
          style={{width:180,mixBlendMode:'screen',display:'block',margin:'0 auto 4px'}}/>
        <div style={{color:G.tm,fontSize:12,letterSpacing:2,textTransform:'uppercase'}}>Portal do Encontro</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={I}/>
          <input placeholder="Senha" type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} style={I}/>
          {e&&<div style={{color:'#ff3b30',fontSize:12,background:'rgba(255,59,48,.1)',borderRadius:10,padding:'10px 14px'}}>{e}</div>}
          <button onClick={go} disabled={load} style={BG({width:'100%',padding:14,borderRadius:14,marginTop:4,opacity:load?0.7:1})}>
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

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [sp, setSp] = useState(true);
  const [scr, setScr] = useState('login');
  const [user, setUser] = useState(null);
  const [pg, setPg] = useState('home');
  const [menu, setMenu] = useState(false);
  const [users, setUsers] = useState(USERS_INIT);
  const [fns, setFns] = useState(FUNCOES_INIT);
  const [esc, setEsc] = useState(ESCALAS_INIT);
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
  
  useEffect(() => {
  const unsubConfig = onSnapshot(doc(db, 'config', 'uniformes'), (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      if (d.dataLimite) setDataLimiteUni(d.dataLimite);
    }
  });

  const unsubUni = onSnapshot(collection(db, 'uniformes'), (snap) => {
    setUni(snap.docs.map(d => ({ userId: d.id, ...d.data() })));
  });

  const unsubAvs = onSnapshot(collection(db, 'avisos'), (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setAvs(lista.sort((a, b) => b.createdAt - a.createdAt));
  });

  const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        setUser({ id: firebaseUser.uid, ...snap.data() });
        setScr('app');
        if (snap.data().perfil === 'servo') setPg('smins');
        if (Notification.permission === 'granted') {
        iniciarNotificacoes(firebaseUser.uid).then(token => {
          if (token) setNotif(true);
        });
      }
      }
    }
    setSp(false);
  });

  return () => {
    unsubConfig();
    unsubUni();
    unsubAvs();
    unsubAuth();
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
  await signOut(auth);
  setUser(null);
  setScr('login');
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
  const notifyAll = (msg) => {
    broadcast(msg);
    showT(msg, 'n');
  };
  
  if (sp) return <Splash done={() => setSp(false)} />;
  if (scr === 'login')
    return <Login onLogin={login} users={users} setUsers={setUsers} />;

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
      <button
        onClick={logout}
        style={BK({ padding: '8px 11px', borderRadius: 10, fontSize: 12 })}
      >
        Sair
      </button>
    </div>
  );

  // menu drawer
  const MENU_ITEMS = [
    ['🏠', 'home'],
    ['✓', 'checkin'],
    ['🔔', 'mins'],
    ['🛏', 'quartos'],
    ['👥', 'enc'],
    ['🚌', 'onibus'],
    ['⛔', 'rest'],
    ['📷', 'img'],
    ['⚠️', 'info'],
    ['🔎', 'ach'],
    ['🪪', 'crac'],
    ['💊', 'saude'],
    ['👕', 'uniformes'],
    ['🍽️', 'louça'],
    ['📋', 'equipes'],
    ['👤', 'servos'],
    ...(isAdm ? [['⚙️', 'back']] : []),
  ];

  // ── SERVO SHELL ──
  if (scr === 'app' && role === 'servo') {
    const SERVO_MENU = [
      ['🔔', 'smins', 'Ministrações'],
      ['📢', 'savs', 'Avisos'],
      ['👕', 'suni', 'Uniforme'],
      ['⚠️', 'sinfo', 'Ocorrências'],
      ['📋', 'satr', 'Atribuições'],
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
                    borderLeft:
                      pg === p
                        ? `3px solid ${G.green}`
                        : '3px solid transparent',
                    padding: '12px 16px',
                    color: pg === p ? G.green : G.td,
                    fontSize: 13,
                    fontWeight: pg === p ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{ fontSize: 14, width: 18, textAlign: 'center' }}
                  >
                    {ic}
                  </span>
                  {lb}
                </button>
              ))}
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
            <Pill c={PERFIS[role].l} bg="rgba(99,99,102,.2)" tc={G.tm} />
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
            <button
              onClick={logout}
              style={BK({
                padding: '7px 11px',
                borderRadius: 10,
                fontSize: 12,
              })}
            >
              Sair
            </button>
          </div>
        </div>
        {/* home com 3 cards */}
        {pg === 'smins' && (
          <ServoHomeV user={user} mins={mins} avs={avs} setPg={setPg} />
        )}
        <div
          style={{ padding: '16px 16px 0', maxWidth: 480, margin: '0 auto' }}
        >
          {pg === 'savs' && (
            <div>
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
              user={user}
              role="servo"
              edit={false}
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
              {(user.funcoes || []).length > 0 ? (
                (user.funcoes || []).map((f, i) => (
                  <div
                    key={i}
                    className="fu"
                    style={{
                      background: G.card,
                      border: `1px solid ${G.cb}`,
                      borderLeft: `3px solid ${G.green}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <span style={{ color: G.green }}>📋</span>
                    <span style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
                      {f}
                    </span>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    color: G.tm,
                    textAlign: 'center',
                    padding: 32,
                    fontSize: 13,
                  }}
                >
                  Sem atribuições. Fale com o admin.
                </div>
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
                  borderLeft:
                    pg === p ? `3px solid ${G.green}` : '3px solid transparent',
                  padding: '12px 16px',
                  color: pg === p ? G.green : G.td,
                  fontSize: 13,
                  fontWeight: pg === p ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>
                  {ic}
                </span>
                {LABELS[p]}
              </button>
            ))}
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
        {pg === 'quartos' && (
          <QV
            qh={qh}
            qm={qm}
            uQH={uQH}
            uQM={uQM}
            setQh={setQh}
            setQm={setQm}
            edit={canQ(role)}
            t={showT}
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
          <OnV on={on} uOn={uOn} edit={canG(role)} t={showT} />
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
          <ListV
            icon="📷"
            color="#ffd60a"
            items={img}
            setItems={setImg}
            edit={canG(role)}
            t={showT}
            ph="Nome do encontrista..."
          />
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
function ServoHomeV({ user, mins, avs, setPg }) {
  const [tab, setTab] = useState('mins');
  const dC = { Sexta: '#bf5af2', Sábado: G.green, Domingo: '#ff9f0a' };
  const prox = mins.find((m) => !m.sent);
  return (
    <div>
      {/* greeting */}
      <div style={{ padding: '16px 16px 0', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: G.t }}>
            Olá, {user.nome.split(' ')[0]}
            <span style={{ color: G.green }}>.</span>
          </div>
          <div style={{ color: G.tm, fontSize: 12, marginTop: 3 }}>
            Encontro com Deus
          </div>
        </div>
        {/* 3 quick cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {[
            ['📢', 'Avisos', 'savs'],
            ['👕', 'Uniforme', 'suni'],
            ['⚠️', 'Ocorrências', 'sinfo'],
          ].map(([ic, l, p]) => (
            <div
              key={p}
              onClick={() => setPg(p)}
              style={{
                background: '#111',
                border: '1px solid #1a1a1a',
                borderRadius: 14,
                padding: '14px 10px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>{ic}</div>
              <div
                style={{
                  color: G.tm,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>
        {/* próxima ministração destaque */}
        {prox && (
          <div
            style={{
              background: 'rgba(10,132,255,.1)',
              border: '1px solid rgba(10,132,255,.2)',
              borderRadius: 14,
              padding: '13px 14px',
              marginBottom: 14,
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
              Próxima
            </div>
            <div style={{ color: G.t, fontSize: 15, fontWeight: 700 }}>
              {prox.nome}
            </div>
            <div style={{ color: G.tm, fontSize: 12, marginTop: 2 }}>
              {prox.dia} · {prox.hora}
            </div>
          </div>
        )}
        {/* seg control */}
        <Seg
          opts={[
            ['mins', 'Ministrações'],
            ['atr', 'Atribuições'],
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
                  borderLeft: `3px solid ${dC[m.dia]}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  marginBottom: 8,
                }}
              >
                <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
                  {m.nome}
                </div>
                <div style={{ color: G.tm, fontSize: 12, marginTop: 3 }}>
                  {m.dia} · {m.hora}
                </div>
              </div>
            ))}
          {tab === 'atr' &&
            (user.funcoes || []).length > 0 &&
            (user.funcoes || []).map((f, i) => (
              <div
                key={i}
                className="fu"
                style={{
                  background: G.card,
                  border: `1px solid ${G.cb}`,
                  borderLeft: `3px solid ${G.green}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ color: G.green }}>📋</span>
                <span style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
                  {f}
                </span>
              </div>
            ))}
          {tab === 'atr' && !(user.funcoes || []).length && (
            <div
              style={{
                color: G.tm,
                textAlign: 'center',
                padding: 28,
                fontSize: 13,
              }}
            >
              Sem atribuições. Fale com o admin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HOME ─────────────────────────────────────────────────────────────────────
function HomeV({
  role,
  ck,
  mins,
  ocorr,
  avs,
  qh,
  qm,
  on,
  nav,
  edit,
  addAv,
  delAv,
}) {
  const [tab, setTab] = useState('mins');
  const [av, setAv] = useState('');
  const ch = ck.filter((c) => c.ok).length,
    tot = ck.length;
  const oc = ocorr.filter((o) => !o.res).length;
  const tEnc = [...qh, ...qm].reduce((a, q) => a + q.enc.length, 0);
  const tPass = on.reduce((a, o) => a + o.pass.length, 0);
  const prox = mins.find((m) => !m.sent);
  const dC = { Sexta: '#bf5af2', Sábado: G.green, Domingo: '#ff9f0a' };
  const ns = (n) => {
    const s = String(n);
    return {
      color: G.t,
      fontWeight: 800,
      letterSpacing: -1,
      fontSize: s.length > 5 ? 16 : s.length > 3 ? 20 : 26,
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
          [tPass, 'Ônibus', 'onibus'],
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
              padding: '14px 12px',
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={av}
                  onChange={(e) => setAv(e.target.value)}
                  placeholder="Escrever aviso..."
                  style={{ ...I, flex: 1 }}
                />
                <button
                  onClick={() => {
                    if (av.trim()) {
                      addAv(av.trim());
                      setAv('');
                    }
                  }}
                  style={BG({ padding: '13px 15px', borderRadius: 12 })}
                >
                  +
                </button>
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
  const [f, setF] = useState({ nome: '', sob: '', gen: 'M' });
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
  const add = () => {
    if (!f.nome.trim()) return;
    setCk([
      ...ck,
      {
        id: Date.now(),
        nome: `${f.nome.trim()} ${f.sob.trim()}`.trim(),
        gen: f.gen,
        ok: false,
        on: null,
      },
    ]);
    setF({ nome: '', sob: '', gen: 'M' });
    setSh(false);
    t('Encontrista adicionado!');
  };
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          [ck.length, 'Total', '#636366'],
          [ck.filter((c) => c.ok).length, 'Chegaram', G.green],
          [ck.filter((c) => !c.ok).length, 'Pendentes', '#ff9f0a'],
        ].map(([n, l, c]) => (
          <div
            key={l}
            style={{
              background: '#111',
              borderRadius: 14,
              padding: '12px 8px',
              textAlign: 'center',
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
                textTransform: 'uppercase',
                marginTop: 3,
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <button
          onClick={() => setSh(true)}
          style={BG({
            width: '100%',
            padding: 13,
            marginBottom: 12,
            borderRadius: 14,
          })}
        >
          + Adicionar Encontrista
        </button>
      )}
      <Seg
        opts={[
          ['M', '♀ Mulheres'],
          ['H', '♂ Homens'],
        ]}
        val={gen}
        set={setGen}
      />
      <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
        <button
          onClick={() => setSub('pend')}
          style={{
            flex: 1,
            background: sub === 'pend' ? '#ff9f0a' : '#111',
            color: sub === 'pend' ? '#000' : G.td,
            border: 'none',
            borderRadius: 10,
            padding: '9px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Pendentes ({cnt(gen, false)})
        </button>
        <button
          onClick={() => setSub('conf')}
          style={{
            flex: 1,
            background: sub === 'conf' ? G.green : '#111',
            color: sub === 'conf' ? '#000' : G.td,
            border: 'none',
            borderRadius: 10,
            padding: '9px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
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
          style={{
            color: G.tm,
            textAlign: 'center',
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
          style={{
            background: G.card,
            border: `1px solid ${c.ok ? 'rgba(0,200,81,.3)' : G.cb}`,
            borderLeft: `3px solid ${c.ok ? G.green : '#2a2a2a'}`,
            borderRadius: 13,
            padding: '12px 14px',
            marginBottom: 7,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <button
              onClick={() =>
                setCk(ck.map((x) => (x.id === c.id ? { ...x, ok: !x.ok } : x)))
              }
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: `2px solid ${c.ok ? G.green : '#333'}`,
                background: c.ok ? 'rgba(0,200,81,.15)' : 'transparent',
                color: G.green,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {c.ok ? '✓' : ''}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ color: G.t, fontWeight: 600, fontSize: 14 }}>
                {c.nome}
              </div>
              {c.on && (
                <div style={{ color: G.tm, fontSize: 11, marginTop: 2 }}>
                  🚌 Ônibus {c.on}
                </div>
              )}
            </div>
            {c.ok && (
              <select
                value={c.on || ''}
                onChange={(e) =>
                  setCk(
                    ck.map((x) =>
                      x.id === c.id ? { ...x, on: e.target.value || null } : x
                    )
                  )
                }
                style={{
                  ...I,
                  width: 'auto',
                  padding: '6px 10px',
                  fontSize: 11,
                  borderRadius: 9,
                }}
              >
                <option value="">Ônibus?</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    Ônibus {n}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ))}
      <Sheet
        open={sh}
        onClose={() => setSh(false)}
        title="Adicionar Encontrista"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              ['M', '♀ Feminino'],
              ['H', '♂ Masculino'],
            ]}
            val={f.gen}
            set={(v) => setF({ ...f, gen: v })}
          />
          <button
            onClick={add}
            style={BG({
              width: '100%',
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
  const [f, setF] = useState({ dia: 'Sexta', nome: '', hora: '' });
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
                          onClick={() => {
                            setMins(
                              mins.map((x) =>
                                x.id === m.id ? { ...x, sent: true } : x
                              )
                            );
                            sN(m.nome, m.hora);
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

// ── QUARTOS ──────────────────────────────────────────────────────────────────
function QV({ qh, qm, uQH, uQM, setQh, setQm, edit, t }) {
  const [tab, setTab] = useState('M');
  const [s, setS] = useState('');
  const [shN, setShN] = useState(false);
  const [f, setF] = useState({ num: '', lim: 9, s1: '', s2: '' });
  const isH = tab === 'H';
  const upd = isH ? uQH : uQM;
  const list = (isH ? qh : qm.filter((q) => !q.maes)).filter(
    (q) =>
      !s ||
      q.servos.some((x) => x.toLowerCase().includes(s.toLowerCase())) ||
      q.enc.some((x) => x.toLowerCase().includes(s.toLowerCase())) ||
      String(q.num).includes(s)
  );
  const addS = (num, n) => {
    const q = (isH ? qh : qm).find((x) => x.num === num);
    if (q?.servos.length >= 2) {
      t('Máximo 2 servos', 'w');
      return;
    }
    upd(num, (x) => ({ ...x, servos: [...x.servos, n] }));
    t('✓');
  };
  return (
    <div>
      {!edit && (
        <div
          style={{
            background: 'rgba(255,159,10,.1)',
            border: '1px solid rgba(255,159,10,.2)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 12,
            color: '#ff9f0a',
            fontSize: 12,
          }}
        >
          👀 Somente visualização
        </div>
      )}
      <Seg
        opts={[
          ['M', '♀ Mulheres'],
          ['H', '♂ Homens'],
        ]}
        val={tab}
        set={setTab}
      />
      <input
        style={{ ...I, marginTop: 10, marginBottom: 10 }}
        placeholder="🔍 Buscar..."
        value={s}
        onChange={(e) => setS(e.target.value)}
      />
      {edit && (
        <>
          <button
            onClick={() => setShN(!shN)}
            style={
              shN
                ? BK({
                    width: '100%',
                    padding: 12,
                    marginBottom: 10,
                    borderRadius: 13,
                  })
                : BG({
                    width: '100%',
                    padding: 12,
                    marginBottom: 10,
                    borderRadius: 13,
                  })
            }
          >
            {shN ? '✕ Cancelar' : '＋ Novo Quarto'}
          </button>
          {shN && (
            <div
              style={{
                background: G.card,
                border: `1px solid ${G.cb}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 10,
                display: 'flex',
                flexDirection: 'column',
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
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span
                  style={{ color: G.tm, fontSize: 13, whiteSpace: 'nowrap' }}
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
              <input
                style={I}
                placeholder="Servo 1 (opcional)"
                value={f.s1}
                onChange={(e) => setF({ ...f, s1: e.target.value })}
              />
              <input
                style={I}
                placeholder="Servo 2 (opcional)"
                value={f.s2}
                onChange={(e) => setF({ ...f, s2: e.target.value })}
              />
              <div style={{ color: G.tm, fontSize: 11 }}>
                Máximo 2 servos por quarto
              </div>
              <button
                onClick={() => {
                  if (!f.num) return;
                  const sv = [f.s1, f.s2].filter(Boolean).slice(0, 2);
                  const nv = {
                    num: parseInt(f.num),
                    lim: f.lim,
                    servos: sv,
                    enc: [],
                  };
                  if (isH) setQh([...qh, nv]);
                  else setQm([...qm, nv]);
                  setF({ num: '', lim: 9, s1: '', s2: '' });
                  setShN(false);
                  t('Quarto criado!');
                }}
                style={BG({ padding: 12, borderRadius: 12 })}
              >
                Criar Quarto
              </button>
            </div>
          )}
        </>
      )}
      {!isH &&
        (() => {
          const m = qm.find((q) => q.maes);
          if (!m) return null;
          const oc = m.servos.length + m.enc.length,
            pct = Math.min(100, Math.round((oc / m.lim) * 100));
          return (
            <Acc
              title="🤱 Quarto Mães"
              ax="#ff9f0a"
              right={
                <Pill
                  c={`${oc}/${m.lim}`}
                  bg="rgba(255,159,10,.12)"
                  tc="#ff9f0a"
                />
              }
            >
              <div
                style={{
                  background: '#1e1e1e',
                  borderRadius: 5,
                  height: 5,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    background: '#ff9f0a',
                    borderRadius: 5,
                    height: 5,
                    width: `${pct}%`,
                  }}
                />
              </div>
              <SL c={`Servos (${m.servos.length}/2)`} mt={0} />
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
              {edit && m.servos.length < 2 && (
                <AddIn ph="Servo..." onAdd={(n) => addS(m.num, n)} mt={8} />
              )}
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
              {edit && (
                <AddIn
                  ph="Adicionar mãe..."
                  onAdd={(n) => {
                    uQM(m.num, (q) => ({ ...q, enc: [...q.enc, n] }));
                    t('✓');
                  }}
                />
              )}
            </Acc>
          );
        })()}
      {list.map((q) => {
        const oc = q.servos.length + q.enc.length,
          pct = Math.min(100, Math.round((oc / q.lim) * 100));
        const lv = q.lim - oc,
          el = q.lim - q.servos.length - q.enc.length;
        const bc = pct >= 100 ? '#ff3b30' : pct >= 80 ? '#ff9f0a' : G.green;
        return (
          <Acc
            key={q.num}
            title={`Quarto ${q.num}`}
            right={<Pill c={`${oc}/${q.lim}`} bg={`${bc}18`} tc={bc} />}
          >
            <div
              style={{
                background: '#1e1e1e',
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
                  transition: 'width .3s',
                }}
              />
            </div>
            <div style={{ color: G.tm, fontSize: 11, marginBottom: 10 }}>
              {lv >= 0 ? `${lv} vagas` : 'Lotado'} · Enc. livres:{' '}
              {Math.max(0, el)}
            </div>
            <SL c={`Servos (${q.servos.length}/2)`} mt={0} />
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
            {edit && q.servos.length < 2 && (
              <AddIn ph="Servo..." onAdd={(n) => addS(q.num, n)} mt={8} />
            )}
            {edit && q.servos.length >= 2 && (
              <div
                style={{
                  color: G.tm,
                  fontSize: 11,
                  marginTop: 6,
                  fontStyle: 'italic',
                }}
              >
                Limite de 2 servos atingido.
              </div>
            )}
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
                  fontStyle: 'italic',
                  margin: '4px 0 8px',
                }}
              >
                Nenhum ainda
              </div>
            )}
            {edit && (
              <AddIn
                ph="Encontrista..."
                onAdd={(n) => {
                  if (el <= 0) {
                    t('Quarto lotado!', 'w');
                    return;
                  }
                  upd(q.num, (x) => ({ ...x, enc: [...x.enc, n] }));
                  t('✓');
                }}
              />
            )}
          </Acc>
        );
      })}
    </div>
  );
}

// ── ENCONTRISTAS ─────────────────────────────────────────────────────────────
function EncV({ encH, setEncH, encM, setEncM, qh, qm, setQh, setQm, edit, t }) {
  const [g, setG] = useState('M');
  const lista = g === 'M' ? encM : encH;
  const setL = g === 'M' ? setEncM : setEncH;
  const dist = () => {
    if (!lista.length) {
      t('Nenhum encontrista', 'w');
      return;
    }
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
  return (
    <div>
      <Seg
        opts={[
          ['M', '♀ Mulheres'],
          ['H', '♂ Homens'],
        ]}
        val={g}
        set={setG}
      />
      <div style={{ marginTop: 10 }}>
        {edit && (
          <AddIn
            ph="Adicionar encontrista..."
            onAdd={(n) => {
              setL([...lista, { id: Date.now(), nome: n }]);
              t('✓');
            }}
            mt={0}
          />
        )}
        <button
          onClick={dist}
          style={{
            ...BG({
              width: '100%',
              padding: 12,
              marginTop: 10,
              marginBottom: 14,
              borderRadius: 13,
            }),
            background: 'rgba(10,132,255,.15)',
            border: '1px solid rgba(10,132,255,.3)',
            color: '#64b5f6',
          }}
        >
          🎲 Distribuir nos Quartos
        </button>
        {lista.length === 0 && (
          <div
            style={{
              color: G.tm,
              textAlign: 'center',
              padding: 28,
              fontSize: 13,
            }}
          >
            Nenhum encontrista.
          </div>
        )}
        {lista.map((e, i) => (
          <div
            key={e.id}
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
              {e.nome}
            </span>
            {edit && (
              <span
                onClick={() => setL(lista.filter((_, j) => j !== i))}
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
    </div>
  );
}

// ── ÔNIBUS ───────────────────────────────────────────────────────────────────
function OnV({ on, uOn, edit, t }) {
  return (
    <div>
      {on.map((o) => (
        <Acc
          key={o.num}
          title={`🚌 Ônibus ${o.num}`}
          right={
            <Pill
              c={o.resp.length + o.templo.length + o.pass.length}
              bg="#1e1e1e"
              tc={G.td}
            />
          }
        >
          <SL c="Responsáveis" mt={0} />
          <Tags
            items={o.resp}
            ax={G.green}
            onX={
              edit
                ? (i) =>
                    uOn(o.num, (x) => ({
                      ...x,
                      resp: x.resp.filter((_, j) => j !== i),
                    }))
                : undefined
            }
          />
          {edit && (
            <AddIn
              ph="Adicionar responsável..."
              onAdd={(n) => {
                uOn(o.num, (x) => ({ ...x, resp: [...x.resp, n] }));
                t('✓');
              }}
              mt={8}
            />
          )}
          <SL c="Servos do Templo" />
          <Tags
            items={o.templo}
            ax="#0a84ff"
            onX={
              edit
                ? (i) =>
                    uOn(o.num, (x) => ({
                      ...x,
                      templo: x.templo.filter((_, j) => j !== i),
                    }))
                : undefined
            }
          />
          {edit && (
            <AddIn
              ph="Servo do templo..."
              onAdd={(n) => {
                uOn(o.num, (x) => ({ ...x, templo: [...x.templo, n] }));
                t('✓');
              }}
              mt={8}
            />
          )}
          <SL c="Passageiros" />
          {o.pass.length > 0 ? (
            <Tags
              items={o.pass}
              onX={
                edit
                  ? (i) =>
                      uOn(o.num, (x) => ({
                        ...x,
                        pass: x.pass.filter((_, j) => j !== i),
                      }))
                  : undefined
              }
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
              Nenhum ainda
            </div>
          )}
          {edit && (
            <AddIn
              ph="Passageiro..."
              onAdd={(n) => {
                uOn(o.num, (x) => ({ ...x, pass: [...x.pass, n] }));
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
            onClick={registrar}
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
                onClick={() => {
                  if (!f.equipe.trim()) return;
                  const id = Math.max(...esc.map((e) => e.id), 0) + 1;
                  setEsc([...esc, { ...f, id, servos: [] }]);
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
          onDel={
            edit
              ? () => {
                  setEsc(esc.filter((e) => e.id !== eq.id));
                  t('Removido.');
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
              items={eq.servos}
              ax={tC[eq.tipo]}
              onX={
                edit
                  ? (i) =>
                      uEs(eq.id, (x) => ({
                        ...x,
                        servos: x.servos.filter((_, j) => j !== i),
                      }))
                  : undefined
              }
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
              onAdd={(n) => {
                uEs(eq.id, (x) => ({ ...x, servos: [...x.servos, n] }));
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

// ── SERVOS ───────────────────────────────────────────────────────────────────
function SvV({ users, setUsers, esc, edit, t }) {
  const [sh, setSh] = useState(false);
  const [f, setF] = useState({ nome: '', sob: '', email: '', perfil: 'servo', fn: '' });
  const [filtro, setFiltro] = useState('todos');
  const [loading, setLoading] = useState(false);
  const fnsDasEquipes = useMemo(() => [...new Set(esc.map((e) => e.equipe))], [esc]);
  const upd = (id, fn) => setUsers(users.map((u) => (u.id === id ? fn(u) : u)));

  const add = async () => {
    if (!f.nome.trim()) { t('Nome obrigatório', 'w'); return; }
    if (!f.email.trim() || !f.email.includes('@')) { t('Email inválido', 'w'); return; }
    if (!f.fn) { t('Selecione uma equipe/função', 'w'); return; }
    setLoading(true);
    try {
      // Cria usuário no Firebase Auth com senha temporária
      const { createUserWithEmailAndPassword, sendPasswordResetEmail } = await import('firebase/auth');
      const cred = await createUserWithEmailAndPassword(auth, f.email.trim(), 'Temp@' + Date.now());
      // Gera link de reset via Firebase
      await sendPasswordResetEmail(auth, f.email.trim());
      // Envia email bonito via Resend
      const nm = `${f.nome.trim()} ${f.sob.trim()}`.trim();
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer re_MtPh49dU_G1HyboAVP2wCDCtGDCXzhxHw',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: f.email.trim(),
          subject: '🙏 Seu acesso ao Portal dos Servos está pronto',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:16px;overflow:hidden">
              <div style="background:#000;padding:32px;text-align:center;border-bottom:3px solid #00c851">
                <div style="font-size:36px;font-weight:900;letter-spacing:-2px">servos<span style="color:#00c851">.</span></div>
                <div style="color:rgba(255,255,255,.4);font-size:12px;letter-spacing:3px;text-transform:uppercase;margin-top:6px">Encontro com Deus</div>
              </div>
              <div style="padding:32px">
                <p style="font-size:18px;font-weight:700;margin-bottom:8px">Olá, ${nm.split(' ')[0]}! 👋</p>
                <p style="color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:24px">
                  Você foi cadastrado como servo do <strong style="color:#fff">Encontro com Deus</strong> — Comunidade Peniel.<br><br>
                  Clique no botão abaixo para criar sua senha e acessar o portal dos servos.
                </p>
                <div style="text-align:center;margin:28px 0">
                  <a href="https://servos-peniel.vercel.app" style="background:#00c851;color:#000;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block">
                    Acessar o Portal dos Servos →
                  </a>
                </div>
                <p style="color:rgba(255,255,255,.4);font-size:12px;line-height:1.6;margin-top:24px;border-top:1px solid #1a1a1a;padding-top:20px">
                  Você recebeu esse email porque foi cadastrado como servo do Encontro com Deus.<br>
                  Em caso de dúvidas, fale com o administrador.
                </p>
              </div>
              <div style="background:#000;padding:20px;text-align:center">
                <div style="font-size:13px;font-weight:700;color:#00c851">servos. — Comunidade Peniel</div>
                <div style="color:rgba(255,255,255,.3);font-size:11px;margin-top:4px">Encontro com Deus · Sexta · Sábado · Domingo</div>
              </div>
            </div>
          `,
        }),
      });
      // Salva no Firestore
      const { setDoc, doc: firestoreDoc } = await import('firebase/firestore');
      const novoUser = {
        nome: nm, email: f.email.trim(), perfil: f.perfil,
        funcoes: f.fn ? [f.fn] : [], ativo: true, pago: false, primeiro: true,
      };
      await setDoc(firestoreDoc(db, 'users', cred.user.uid), novoUser);
      setUsers([...users, { id: cred.user.uid, ...novoUser }]);
      setF({ nome: '', sob: '', email: '', perfil: 'servo', fn: '' });
      setSh(false);
      t('Servo adicionado! Email de acesso enviado ✉️');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') t('Email já cadastrado', 'w');
      else t('Erro ao cadastrar: ' + err.message, 'w');
    }
    setLoading(false);
  };

  const lista = users.filter(
    (u) => u.perfil !== 'admin' &&
      (filtro === 'todos' ? true : filtro === 'ativos' ? u.ativo !== false : !u.ativo)
  );

  return (
    <div>
      {edit && (
        <button onClick={() => setSh(true)} style={BG({ width: '100%', padding: 13, marginBottom: 12, borderRadius: 14 })}>
          + Adicionar Servo
        </button>
      )}
      <div style={{ marginBottom: 14 }}>
        <Seg opts={[['todos', 'Todos'], ['ativos', 'Ativos'], ['inativos', 'Inativos']]} val={filtro} set={setFiltro} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          [users.filter((u) => u.perfil !== 'admin').length, 'Total', '#636366'],
          [users.filter((u) => u.perfil !== 'admin' && u.ativo !== false).length, 'Ativos', G.green],
          [users.filter((u) => u.perfil !== 'admin' && u.pago).length, 'Pagos', '#0a84ff'],
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
            <Pill c={PERFIS[u.perfil]?.l || u.perfil} bg={`${PERFIS[u.perfil]?.c || G.green}18`} tc={PERFIS[u.perfil]?.c || G.green} />
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {u.email && <div style={{ color: G.tm, fontSize: 12 }}>✉️ {u.email}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', borderRadius: 12, padding: '12px 14px' }}>
              <Toggle val={u.ativo !== false} onToggle={() => upd(u.id, (x) => ({ ...x, ativo: !x.ativo }))} labelOn="Ativo" labelOff="Inativo" />
              {u.perfil !== 'pastor' && (
                <Toggle val={!!u.pago} onToggle={() => upd(u.id, (x) => ({ ...x, pago: !x.pago }))} labelOn="Pago ✓" labelOff="Pendente" colorOn="#0a84ff" />
              )}
            </div>
            {u.funcoes?.length > 0 && <><SL c="Funções" mt={0} /><Tags items={u.funcoes} /></>}
            {u.primeiro && <Pill c="⚠️ Email de acesso enviado — aguardando 1º login" bg="rgba(255,159,10,.12)" tc="#ff9f0a" />}
            {edit && (
              <span onClick={() => { setUsers(users.filter((x) => x.id !== u.id)); t('Removido.'); }}
                style={{ color: 'rgba(255,59,48,.4)', cursor: 'pointer', fontSize: 12, textAlign: 'right' }}>
                🗑 Remover
              </span>
            )}
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

function UniV({ uni, setUni, dataLimite, setDataLimite, user, role, edit, t }) {
  const isAdm = edit;
  const hoje = new Date().toISOString().split('T')[0];
  const prazoDefinido = !!dataLimite;
  const prazoOk = prazoDefinido && hoje <= dataLimite;
  const meuPedido = uni.find((u) => u.userId === user.id);
  const bloqueado = meuPedido && meuPedido.status !== 'aberto' || (meuPedido && !meuPedido.status);
  const [form, setForm] = useState(
    meuPedido || { camisa: '', qtdCamisas: 1, calca: '', blusa: '' }
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
    setSaving(true);
    const pedido = {
      nome: user.nome,
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
              <div style={{ background: 'rgba(0,200,81,.06)', border: '1px solid rgba(0,200,81,.15)', borderRadius: 12, padding: '11px 14px', color: G.td, fontSize: 12, lineHeight: 1.6 }}>
                Todo servo recebe <strong style={{ color: G.green }}>1 camiseta inclusa</strong>. Itens extras têm custo.
              </div>

              {/* STATUS DO PEDIDO */}
              {meuPedido && (
                <div style={{ background: meuPedido.status === 'pendente' ? 'rgba(255,159,10,.08)' : meuPedido.status === 'aberto' ? 'rgba(0,200,81,.08)' : 'rgba(99,99,102,.1)', border: `1px solid ${meuPedido.status === 'pendente' ? 'rgba(255,159,10,.3)' : meuPedido.status === 'aberto' ? 'rgba(0,200,81,.2)' : '#2a2a2a'}`, borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ color: meuPedido.status === 'pendente' ? '#ff9f0a' : meuPedido.status === 'aberto' ? G.green : G.tm, fontWeight: 700, fontSize: 13 }}>
                    {meuPedido.status === 'pendente' ? 'Solicitacao de alteracao enviada — aguardando aprovacao' : meuPedido.status === 'aberto' ? 'Alteracao aprovada — edite e salve novamente' : 'Pedido registrado'}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <button onClick={() => !bloqueado && setForm({ ...form, qtdCamisas: Math.max(1, (form.qtdCamisas || 1) - 1) })}
                    style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>−</button>
                  <span style={{ color: G.t, fontSize: 24, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>
                    {form.qtdCamisas || 1}
                  </span>
                  <button onClick={() => !bloqueado && setForm({ ...form, qtdCamisas: Math.min(3, (form.qtdCamisas || 1) + 1) })}
                    style={{ ...BK({ padding: '6px 18px', borderRadius: 10, fontSize: 20, fontWeight: 700 }), cursor: bloqueado ? 'default' : 'pointer' }}>+</button>
                </div>
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
                <button onClick={salvarPedido} disabled={saving}
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
  const [savingData, setSavingData] = useState(false);

  const salvarData = async () => {
    if (!dataTemp) { t('Selecione uma data', 'w'); return; }
    setSavingData(true);
    await setDataLimite(dataTemp);
    setSavingData(false);
    t('Data limite salva!');
  };

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
        <input type="date" value={dataTemp}
          onChange={(e) => setDataTemp(e.target.value)}
          disabled={!!dataLimite && dataTemp === dataLimite}
          style={{ ...I, marginBottom: 10, opacity: (!!dataLimite && dataTemp === dataLimite) ? 0.5 : 1 }} />
        {!!dataLimite && dataTemp === dataLimite ? (
          <button onClick={() => setDataTemp('')}
            style={BK({ width: '100%', padding: 12, borderRadius: 12 })}>
            Alterar Data
          </button>
        ) : (
          <button onClick={salvarData} disabled={savingData}
            style={BG({ width: '100%', padding: 12, borderRadius: 12, opacity: savingData ? 0.7 : 1 })}>
            {savingData ? 'Salvando...' : 'Salvar Data'}
          </button>
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
                {u.calca && <Pill c={`Calca ${u.calca}`} bg="#1e1e1e" tc={G.td} />}
                {u.blusa && <Pill c={`Blusa ${u.blusa}`} bg="#1e1e1e" tc={G.td} />}
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
                  {u.perfil !== 'admin' && (
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
