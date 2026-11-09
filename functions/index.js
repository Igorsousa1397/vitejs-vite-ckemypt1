const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const https = require('https');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const APP_URL = 'https://encontrocomdeus-fonte.vercel.app';
const WEBHOOK_URL = 'https://us-central1-servos-peniel.cloudfunctions.net/webhookPagamento';

// Gmail via OAuth2 (secrets GMAIL_*). Usado nas boas-vindas e na redefinição de senha.
const SECRETS_GMAIL = ['GMAIL_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
const transporterGmail = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_USER,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
});

// ── VALORES ──────────────────────────────────────────────────────────────────
// Fonte da verdade dos valores cobrados. O front (VALORES em src/App.jsx) só
// mostra os rótulos — o valor enviado ao Mercado Pago é sempre calculado aqui.
// O admin altera em Configurações (config/valores); carregarValores() aplica por
// cima dos padrões antes de cada cobrança (cache de 1 min).
const VALORES_PADRAO = {
  encontrista: 390,
  encontristaItajai: 200,
  servo: 250, // servo, staff e líderes
  cozinha: 150,
  infantil: 180, // servos que cuidam das crianças
};
const VALORES = { ...VALORES_PADRAO };
const UNI_PRECOS_PADRAO = { camisa: 43, camisaG: 47, blusa: 105, blusaG: 115, calca: 80, calcaG: 90 };
const UNI_PRECOS = { ...UNI_PRECOS_PADRAO };
let valoresLidosEm = 0;
const carregarValores = async () => {
  if (Date.now() - valoresLidosEm < 60000) return;
  try {
    const s = await db.doc('config/valores').get();
    const d = s.exists ? s.data() : {};
    Object.keys(VALORES_PADRAO).forEach((k) => { const v = Number(d[k]); VALORES[k] = Number.isFinite(v) && v >= 0 ? v : VALORES_PADRAO[k]; });
    Object.keys(UNI_PRECOS_PADRAO).forEach((k) => { const v = Number(d.uniforme?.[k]); UNI_PRECOS[k] = Number.isFinite(v) && v >= 0 ? v : UNI_PRECOS_PADRAO[k]; });
    valoresLidosEm = Date.now();
  } catch (e) {
    console.error('config/valores:', e.message);
  }
};
const PERFIS_ISENTOS = ['pastor', 'pastor_auxiliar', 'lider_geral'];
const PERFIS_ADMIN = ['admin', 'lider_geral'];

const comCredito = (v) => Math.round(v * 1.05 * 100) / 100;
// uniforme usa a conta antiga do front (repassa a taxa do MP)
const creditoUniforme = (v) => Math.ceil(v / 0.9501 * 100) / 100;
const centavos = (v) => Math.round(v * 100) / 100;
// Igrejas e células com valor reduzido (o mesmo de Itajaí). Manter igual em src/App.jsx.
// Peniel é a célula de Santa Catarina; o nome antigo fica para inscrições já feitas.
const IGREJAS_VALOR_REDUZIDO = ['Fonte Itajaí', 'Paraná'];
const CELULAS_VALOR_REDUZIDO = ['Peniel', 'Peniel - Santa Catarina'];
const isEncItajai = (e) => IGREJAS_VALOR_REDUZIDO.includes(e.igreja) || CELULAS_VALOR_REDUZIDO.includes(e.celula);

const valorEncontrista = (e) => {
  if (e.acordo && e.valorAcordado != null && !isNaN(e.valorAcordado)) return Number(e.valorAcordado);
  return isEncItajai(e) ? VALORES.encontristaItajai : VALORES.encontrista;
};
// cozinha e infantil têm valor próprio; os demais perfis pagam o valor de servo
const valorServo = (u) => ({ cozinha: VALORES.cozinha, infantil: VALORES.infantil })[u.perfil] ?? VALORES.servo;

const precoItemUniforme = (item, tam) => {
  if (!tam || !['camisa', 'blusa', 'calca'].includes(item)) return 0;
  const grande = ['G1', 'G2', 'G3', 'G4'].includes(tam);
  return UNI_PRECOS[grande ? `${item}G` : item] || 0;
};
const totalUniforme = (p) => {
  const calc =
    precoItemUniforme('camisa', p.camisa) * (p.qtdCamisas || 1) +
    precoItemUniforme('calca', p.calca) * (p.qtdCalcas || 1) +
    precoItemUniforme('blusa', p.blusa) * (p.qtdBlusas || 1);
  return calc > 0 ? calc : Number(p.valorTotal || 0);
};

// ── AUTH ─────────────────────────────────────────────────────────────────────
// Lê o ID token do header Authorization e devolve o doc do usuário em `users`.
async function usuarioLogado(req) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const dec = await admin.auth().verifyIdToken(m[1]);
    const snap = await db.collection('users').doc(dec.uid).get();
    if (!snap.exists || snap.data().ativo === false) return null;
    return { uid: dec.uid, ...snap.data() };
  } catch {
    return null;
  }
}

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const texto = (s, max = 200) => String(s ?? '').trim().slice(0, max);

// CPF de verdade: 11 dígitos, não repetidos, com os dois verificadores batendo.
// Barra inscrição de teste ("111.111.111-11", número inventado) antes de virar doc.
function cpfValido(cpf) {
  const d = soDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
// Nome de teste óbvio ou sem sobrenome: não entra em produção.
const PALAVRAS_TESTE = /^(test|teste|testando|testar|asdf?|aaa+|xxx+|abc|qwe|fulano|ciclano|beltrano)$/i;
function nomePareceTeste(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return true;
  return partes.some((pt) => PALAVRAS_TESTE.test(pt.replace(/[^\p{L}]/gu, '')));
}

// Uso de imagem, contato de emergência e saúde passaram da inscrição para o termo.
// Inscrições do fluxo antigo já trazem tudo respondido; as novas só depois do termo.
const temComplementares = (e) => !!(
  texto(e.autorizaImagem) && texto(e.emergenciaNome) && texto(e.emergenciaTel) &&
  texto(e.temMedicamento) && texto(e.temDoenca)
);

// Grava a ficha de saúde quando a pessoa declara medicamento ou doença crônica.
async function gravarFichaSaude(encontristaId, nome, d) {
  if (d.temMedicamento !== 'Sim' && d.temDoenca !== 'Sim') return;
  await db.collection('saude').add({
    encontristaId,
    nome,
    quarto: '',
    cond: [
      d.temMedicamento === 'Sim' ? `Medicamento: ${d.medicamento}` : null,
      d.temDoenca === 'Sim' ? `Doença: ${d.doenca}` : null,
    ].filter(Boolean).join(' | '),
    obs: '',
    criadoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  });
}

// CPF, RG e endereço do encontrista ficam em encontristas/{id}/privado/dados:
// o doc principal é lido por todo servo ativo, a subcoleção só pela liderança
// e por quem tem as telas Encontristas/Check-in.
// Fase 2 (31/10/2026): os três não são mais gravados no doc principal e foram
// apagados de lá. A leitura ainda cai para o doc principal quando a subcoleção
// não tem o campo — só por segurança, não deve mais acontecer.
const GRAVA_LEGADO = false;
const privadoRef = (id) => db.collection('encontristas').doc(id).collection('privado').doc('dados');
async function lerPrivado(id, e = {}) {
  const s = await privadoRef(id).get();
  const p = s.exists ? s.data() : {};
  return { cpf: p.cpf || e.cpf || '', rg: p.rg || e.rg || '', endereco: p.endereco || e.endereco || '' };
}

// Campos de um encontrista que podem ser devolvidos sem login (fluxos públicos).
// `priv` (de lerPrivado) só é passado quando a busca foi pelo CPF.
const encontristaPublico = (id, e, priv = null) => ({
  id,
  nome: e.nome || '',
  sexo: e.sexo || '',
  igreja: e.igreja || '',
  celula: e.celula || '',
  autorizaImagem: e.autorizaImagem || '',
  pago: !!e.pago,
  termoAssinado: !!e.termoAssinado,
  // booleano, não os valores: este retorno é público (busca por CPF/WhatsApp)
  complementares: temComplementares(e),
  desistiu: !!e.desistiu,
  // CPF, RG e endereço só voltam quando a busca foi pelo CPF.
  // Pelo WhatsApp (número fácil de saber) ficam de fora.
  ...(priv ? { cpf: priv.cpf, rg: priv.rg, endereco: priv.endereco } : {}),
});

async function buscarEncontrista(busca) {
  const limpo = soDigitos(busca);
  if (!limpo) return null;
  // CPF: varre a subcoleção privado inteira (são poucas dezenas de docs) em vez
  // de filtrar — filtro em collectionGroup exigiria índice, e sem índice a
  // busca pública cairia.
  const privs = await db.collectionGroup('privado').get();
  const hit = privs.docs.find((d) => d.id === 'dados' && soDigitos(d.data().cpf) === limpo);
  if (hit) {
    const doc = await hit.ref.parent.parent.get();
    if (doc.exists) return { doc, porCpf: true };
  }
  // doc ainda não migrado (CPF no principal) e busca por WhatsApp
  const todos = await db.collection('encontristas').get();
  const found = todos.docs.find((d) => {
    const data = d.data();
    return soDigitos(data.cpf) === limpo || soDigitos(data.whatsapp) === limpo;
  });
  return found ? { doc: found, porCpf: soDigitos(found.data().cpf) === limpo } : null;
}

function mpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Resposta inválida do Mercado Pago')); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Envia push para uma lista de { uid, token }. O mesmo celular pode estar salvo
// em mais de um usuário (admin e pastor no mesmo aparelho, por exemplo), então
// o envio é por token único. Tokens que o FCM devolve como mortos são apagados
// para a coleção não acumular lixo.
//
// Vai só `notification` (+ ícone e link em webpush): o SDK no service worker
// exibe a notificação sozinho. O SW não pode chamar showNotification também,
// senão cada aviso chega duas vezes.
// Um doc por usuário em tokens/{uid}; cada aparelho em que ele ativou as
// notificações fica em `lista` (`token` guarda o último, formato antigo).
const aparelhosDoDoc = (d) => {
  const x = d.data() || {};
  const tokens = Array.isArray(x.lista) ? x.lista : [x.token]; // doc antigo: só `token`
  return [...new Set(tokens.filter(Boolean))].map((token) => ({ uid: d.id, token }));
};

async function enviarPush(destinos, titulo, corpo) {
  const porToken = new Map();
  destinos.forEach(({ uid, token }) => {
    if (!token) return;
    if (!porToken.has(token)) porToken.set(token, []);
    porToken.get(token).push(uid);
  });
  const tokens = [...porToken.keys()];
  if (!tokens.length) {
    console.log(`push "${titulo}": nenhum aparelho cadastrado entre ${destinos.length} destinos`);
    return 0;
  }

  const resp = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: titulo, body: corpo },
    webpush: {
      notification: { icon: `${APP_URL}/icon-192.png`, badge: `${APP_URL}/icon-192.png`, vibrate: [200, 100, 200] },
      fcmOptions: { link: APP_URL }, // toque abre/foca o app (o SDK cuida)
    },
  });

  const mortos = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
  const apagar = [];
  resp.responses.forEach((r, i) => {
    if (!r.success && mortos.includes(r.error?.code)) {
      // tira só esse aparelho; os outros do mesmo usuário continuam
      porToken.get(tokens[i]).forEach((uid) => apagar.push(
        db.collection('tokens').doc(uid).update({
          lista: admin.firestore.FieldValue.arrayRemove(tokens[i]),
          token: admin.firestore.FieldValue.delete(), // legado; com `lista` não é mais lido
        }),
      ));
    }
  });
  if (apagar.length) await Promise.allSettled(apagar);
  const falhas = resp.responses.filter((r) => !r.success).map((r) => r.error?.code);
  // por usuário: quantos aparelhos cada um tem cadastrados (ajuda a ver quem não recebe)
  const porUid = {};
  destinos.forEach(({ uid, token }) => { if (token) porUid[uid] = (porUid[uid] || 0) + 1; });
  const para = Object.entries(porUid).map(([uid, n]) => `${uid}(${n})`).join(" ");
  console.log(`push "${titulo}": ${tokens.length} aparelhos, ${resp.successCount} ok — para: ${para}${falhas.length ? `, falhas: ${falhas.join(", ")}` : ""}`);
  return resp.successCount;
}

async function notificarAdminsNovaInscricao(encontristaId, nome) {
  // Idempotência: se já notificamos esse encontrista, não envia de novo
  const dedupeRef = db.collection('_notif_dedupe').doc(encontristaId);
  if ((await dedupeRef.get()).exists) return 0;
  await dedupeRef.set({ ts: Date.now(), nome });

  const usersSnap = await db.collection('users').get();
  const adminPastorIds = new Set(
    usersSnap.docs.filter((d) => ['admin', 'pastor'].includes(d.data().perfil)).map((d) => d.id),
  );
  const tokensSnap = await db.collection('tokens').get();
  const destinos = tokensSnap.docs
    .filter((d) => adminPastorIds.has(d.id))
    .flatMap(aparelhosDoDoc);
  return enviarPush(destinos, '🙏 Nova inscrição!', `${nome} acabou de se inscrever no Encontro com Deus.`);
}

// ── CRIAR PAGAMENTO MERCADO PAGO ─────────────────────────────────────────────
// O valor nunca vem do cliente: é calculado a partir do tipo e do documento no
// Firestore, e vai gravado no external_reference para o webhook conferir.
exports.criarPagamento = onRequest({ cors: true, secrets: ['MP_ACCESS_TOKEN'] }, async (req, res) => {
  await carregarValores();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { encontristaId, email } = req.body;
  const tipo = String(req.body.tipo || 'pix');
  if (!encontristaId) return res.status(400).json({ error: 'encontristaId obrigatório' });

  const isCredito = tipo.includes('credito');
  let valor, nome, titulo, descricao, external;

  try {
    if (tipo === 'pix' || tipo === 'credito') {
      const snap = await db.collection('encontristas').doc(encontristaId).get();
      if (!snap.exists) return res.status(404).json({ error: 'ID não encontrado' });
      const e = snap.data();
      if (e.pago) return res.status(400).json({ error: 'Inscrição já paga' });
      const base = valorEncontrista(e);
      valor = isCredito ? comCredito(base) : base;
      nome = e.nome;
      titulo = 'Inscrição — Encontro com Deus';
      descricao = 'Encontro com Deus · Mauá';
      external = `enc||${encontristaId}||${valor}`;
    } else if (tipo === 'servo_pix' || tipo === 'servo_credito') {
      const u = await usuarioLogado(req);
      if (!u) return res.status(401).json({ error: 'Faça login novamente' });
      let alvo = u;
      if (u.uid !== encontristaId) {
        if (!PERFIS_ADMIN.includes(u.perfil)) return res.status(403).json({ error: 'Sem permissão' });
        const snap = await db.collection('users').doc(encontristaId).get();
        if (!snap.exists) return res.status(404).json({ error: 'ID não encontrado' });
        alvo = snap.data();
      }
      if (PERFIS_ISENTOS.includes(alvo.perfil) || alvo.pago === true || alvo.pago === 'abonado') {
        return res.status(400).json({ error: 'Este servo não tem pagamento pendente' });
      }
      const base = valorServo(alvo);
      valor = isCredito ? comCredito(base) : base;
      nome = alvo.nome;
      titulo = 'Taxa de Servo — Encontro com Deus';
      descricao = 'Encontro com Deus · Mauá';
      external = `servo||${encontristaId}||${valor}`;
    } else if (tipo.startsWith('uniforme_')) {
      const u = await usuarioLogado(req);
      if (!u) return res.status(401).json({ error: 'Faça login novamente' });
      if (u.uid !== encontristaId) return res.status(403).json({ error: 'Sem permissão' });
      const snap = await db.collection('uniformes').doc(u.uid).get();
      if (!snap.exists || snap.data().naoQuerUniforme) return res.status(404).json({ error: 'Pedido de uniforme não encontrado' });
      const pedido = snap.data();
      const total = totalUniforme(pedido);
      if (!(total > 0)) return res.status(400).json({ error: 'Pedido sem valor' });
      if (pedido.pagoIntegral) return res.status(400).json({ error: 'Uniforme já pago' });
      let parte, base;
      if (tipo.includes('sinal')) {
        if (pedido.pagoSinal) return res.status(400).json({ error: 'Sinal já pago' });
        parte = 'sinal';
        base = total * 0.5;
      } else if (pedido.pagoSinal) {
        parte = 'restante';
        base = total * 0.5;
      } else {
        parte = 'integral';
        base = total;
      }
      base = centavos(base);
      valor = isCredito ? creditoUniforme(base) : base;
      nome = u.nome;
      titulo = `Uniforme Servo — ${parte === 'sinal' ? 'Sinal 50%' : parte === 'restante' ? 'Restante 50%' : 'Pagamento Integral'}`;
      descricao = 'Encontro com Deus · Uniforme';
      external = `uniforme_${parte}||${encontristaId}||${valor}`;
    } else {
      return res.status(400).json({ error: 'tipo inválido' });
    }
  } catch (e) {
    console.error('Erro ao calcular pagamento:', e.message);
    return res.status(500).json({ error: 'Erro ao calcular pagamento' });
  }

  const body = JSON.stringify({
    items: [{ title: titulo, description: descricao, quantity: 1, unit_price: valor, currency_id: 'BRL' }],
    payer: { name: nome || 'Encontrista', email: texto(email, 120) || 'encontrocomdeus@email.com' },
    external_reference: external,
    back_urls: {
      success: `${APP_URL}?pago=true&id=${encontristaId}`,
      failure: `${APP_URL}?pago=false&id=${encontristaId}`,
      pending: `${APP_URL}?pago=pending&id=${encontristaId}`,
    },
    auto_return: 'all',
    payment_methods: {
      excluded_payment_types: isCredito
        ? [{ id: 'ticket' }, { id: 'digital_currency' }, { id: 'digital_wallet' }]
        : [{ id: 'credit_card' }, { id: 'digital_currency' }, { id: 'digital_wallet' }],
      excluded_payment_methods: [{ id: 'caixa_virtual' }, { id: 'debvisa' }, { id: 'debmaster' }],
      installments: isCredito ? 12 : 1,
    },
    notification_url: WEBHOOK_URL,
  });

  try {
    const parsed = await mpRequest({
      hostname: 'api.mercadopago.com',
      path: '/checkout/preferences',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, body);
    console.log('tipo:', tipo, 'valor:', valor, 'ref:', external);
    if (parsed.init_point) return res.json({ init_point: parsed.init_point, id: parsed.id });
    console.error('MP sem init_point:', JSON.stringify(parsed));
    return res.status(500).json({ error: 'init_point não retornado' });
  } catch (e) {
    console.error('Erro MP:', e.message);
    return res.status(500).json({ error: 'Erro ao falar com o Mercado Pago' });
  }
});

// ── WEBHOOK PAGAMENTO ────────────────────────────────────────────────────────
// Só confia no que o próprio Mercado Pago devolve ao consultar o pagamento, e
// confere o valor pago contra o esperado antes de marcar como pago.
exports.webhookPagamento = onRequest({ cors: true, secrets: ['MP_ACCESS_TOKEN'] }, async (req, res) => {
  await carregarValores();
  const { type, data } = req.body || {};
  if (type !== 'payment' || !data?.id) return res.sendStatus(200);
  const paymentId = String(data.id);

  try {
    const payment = await mpRequest({
      hostname: 'api.mercadopago.com',
      path: `/v1/payments/${encodeURIComponent(paymentId)}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (payment.status !== 'approved') return res.sendStatus(200);

    const pago = Number(payment.transaction_amount || 0);
    const partes = String(payment.external_reference || '').split('||');
    let tipo, id, esperado = null;
    if (partes.length >= 3) {
      [tipo, id] = partes;
      esperado = Number(partes[2]);
    } else if (partes.length === 2) {
      // formato antigo do uniforme: "<tipo>||<userId>"
      [tipo, id] = partes;
      tipo = tipo.includes('uniforme_sinal') ? 'uniforme_sinal' : 'uniforme_integral';
    } else {
      // formato antigo: só o id (encontrista ou servo)
      id = partes[0];
      tipo = (await db.collection('encontristas').doc(id).get()).exists ? 'enc' : 'servo';
    }
    if (!id) return res.sendStatus(200);

    // Preferências antigas não carregam o valor: calcula o mínimo pelo documento.
    if (esperado == null) {
      if (tipo === 'enc') {
        const s = await db.collection('encontristas').doc(id).get();
        esperado = s.exists ? valorEncontrista(s.data()) : null;
      } else if (tipo === 'servo') {
        const s = await db.collection('users').doc(id).get();
        esperado = s.exists ? valorServo(s.data()) : null;
      } else {
        const s = await db.collection('uniformes').doc(id).get();
        const total = s.exists ? totalUniforme(s.data()) : 0;
        esperado = tipo === 'uniforme_integral' && !s.data()?.pagoSinal ? total : total * 0.5;
      }
    }

    const logRef = db.collection('pagamentos').doc(paymentId);
    if (esperado == null || pago + 0.01 < esperado) {
      console.warn(`Pagamento ${paymentId} rejeitado: pago ${pago}, esperado ${esperado}, ref ${payment.external_reference}`);
      await logRef.set({ tipo, id, pago, esperado, status: 'valor_divergente', ref: payment.external_reference || '', em: new Date().toISOString() });
      return res.sendStatus(200);
    }

    const agora = new Date().toISOString();
    if (tipo === 'enc') {
      await db.collection('encontristas').doc(id).set({ pago: true, pagamentoId: paymentId, pagoEm: agora, pagoValor: pago }, { merge: true });
    } else if (tipo === 'servo') {
      await db.collection('users').doc(id).set({ pago: true, pagamentoId: paymentId, pagoEm: agora, pagoValor: pago }, { merge: true });
    } else if (tipo === 'uniforme_sinal') {
      await db.collection('uniformes').doc(id).set({ pagoSinal: true, pagamentoSinalId: paymentId }, { merge: true });
    } else {
      await db.collection('uniformes').doc(id).set({ pagoIntegral: true, pagoSinal: true, pagamentoIntegralId: paymentId }, { merge: true });
    }
    await logRef.set({ tipo, id, pago, esperado, status: 'aprovado', ref: payment.external_reference || '', em: agora });
    return res.sendStatus(200);
  } catch (e) {
    console.error('Erro webhook:', e.message);
    return res.sendStatus(500);
  }
});

// ── INSCRIÇÃO PÚBLICA ────────────────────────────────────────────────────────
// Os fluxos sem login (inscrever, consultar, assinar termo, QR) passam por aqui
// para a coleção `encontristas` não precisar de leitura/escrita pública.
// Inscrição rápida: só o que identifica e aloca a pessoa.
const CAMPOS_INSCRICAO = [
  'igreja', 'nome', 'nascimento', 'sexo', 'whatsapp', 'celula', 'camiseta',
];
// Respondidos no termo, depois do pagamento.
const CAMPOS_COMPLEMENTARES = [
  'autorizaImagem', 'emergenciaNome', 'emergenciaTel',
  'temMedicamento', 'medicamento', 'temDoenca', 'doenca',
];

exports.inscrever = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const form = req.body?.form || {};

  try {
    const cfg = await db.doc('config/inscricoes').get();
    if (cfg.exists && cfg.data().bloqueadas) return res.status(403).json({ error: 'As inscrições estão encerradas.' });

    const cpf = soDigitos(form.cpf);
    if (!cpfValido(cpf)) return res.status(400).json({ error: 'CPF inválido. Confira os números digitados.' });
    const nome = texto(form.nome, 120);
    const whatsapp = soDigitos(form.whatsapp);
    if (!nome || whatsapp.length < 10) return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
    if (nomePareceTeste(nome)) return res.status(400).json({ error: 'Informe o nome completo (nome e sobrenome).' });
    if (/^(\d)\1+$/.test(whatsapp)) return res.status(400).json({ error: 'WhatsApp inválido.' });

    const nascimento = new Date(form.nascimento);
    if (isNaN(nascimento)) return res.status(400).json({ error: 'Data de nascimento inválida.' });
    const hoje = new Date();
    const idade = hoje.getFullYear() - nascimento.getFullYear() -
      (hoje < new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate()) ? 1 : 0);
    if (idade < 14) return res.status(400).json({ error: 'É necessário ter pelo menos 14 anos para se inscrever.' });

    const existente = await buscarEncontrista(cpf);
    if (existente) {
      const e = existente.doc.data();
      return res.json({ duplicado: encontristaPublico(existente.doc.id, e, await lerPrivado(existente.doc.id, e)) });
    }

    const todos = await db.collection('encontristas').get();
    if (todos.docs.some((d) => soDigitos(d.data().whatsapp) === whatsapp)) {
      return res.status(400).json({ error: 'Este WhatsApp já está cadastrado!' });
    }

    const dados = {};
    CAMPOS_INSCRICAO.forEach((k) => { dados[k] = texto(form[k], 300); });
    const igrejaFinal = dados.igreja === 'Outra' ? texto(form.igrejaCustom, 120) || 'Outra' : dados.igreja;
    // doc principal + privado no mesmo batch: nunca fica inscrição sem CPF
    const docRef = db.collection('encontristas').doc();
    const batch = db.batch();
    batch.set(docRef, {
      ...dados,
      nome,
      igreja: igrejaFinal,
      ...(GRAVA_LEGADO ? { cpf } : {}),
      pago: false,
      termoAssinado: false,
      criadoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });
    batch.set(privadoRef(docRef.id), { cpf });
    await batch.commit();

    try { await notificarAdminsNovaInscricao(docRef.id, nome); } catch (e) { console.error('Erro notificação:', e.message); }

    return res.json({ id: docRef.id });
  } catch (e) {
    console.error('Erro inscrever:', e.message);
    return res.status(500).json({ error: 'Erro ao salvar inscrição.' });
  }
});

// Consulta por CPF ou WhatsApp. Devolve só o necessário para o fluxo público;
// o CPF só volta quando foi ele a chave da busca.
exports.buscarInscricao = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const r = await buscarEncontrista(req.body?.busca);
    if (!r) return res.status(404).json({ error: 'Inscrição não encontrada.' });
    const e = r.doc.data();
    const priv = r.porCpf ? await lerPrivado(r.doc.id, e) : null;
    return res.json({ encontrista: encontristaPublico(r.doc.id, e, priv) });
  } catch (e) {
    console.error('Erro buscarInscricao:', e.message);
    return res.status(500).json({ error: 'Erro ao buscar inscrição.' });
  }
});

// Tela de QR / "já paguei": só nome e status de pagamento.
exports.statusInscricao = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const id = texto(req.body?.id, 64);
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  try {
    const snap = await db.collection('encontristas').doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Inscrição não encontrada.' });
    const e = snap.data();
    // só o que a tela do QR precisa para montar o termo. Não devolve endereço
    // nem RG: este endpoint é consultável com o id que viaja dentro do QR Code.
    return res.json({
      id: snap.id,
      nome: e.nome || '',
      sexo: e.sexo || '',
      igreja: e.igreja || '',
      celula: e.celula || '',
      autorizaImagem: e.autorizaImagem || '',
      pago: !!e.pago,
      termoAssinado: !!e.termoAssinado,
      complementares: temComplementares(e),
    });
  } catch (e) {
    console.error('Erro statusInscricao:', e.message);
    return res.status(500).json({ error: 'Erro ao consultar.' });
  }
});

// Datas do encontro (config/encontro). Manter igual ao ENCONTRO_PADRAO de src/App.jsx.
const ENCONTRO_PADRAO = { inicio: '2026-11-20', fim: '2026-11-22' };
const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const listaPt = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);
function fmtDiasEncontro(enc) {
  const ini = new Date(`${enc.inicio}T12:00:00Z`);
  const fim = new Date(`${enc.fim}T12:00:00Z`);
  const grupos = [];
  for (let d = new Date(ini); d <= fim && grupos.length < 3; d.setUTCDate(d.getUTCDate() + 1)) {
    const m = d.getUTCMonth();
    if (!grupos.length || grupos[grupos.length - 1].m !== m) grupos.push({ m, dias: [] });
    grupos[grupos.length - 1].dias.push(d.getUTCDate());
  }
  const partes = grupos.map((g) => `${listaPt(g.dias.map(String))} de ${MESES_PT[g.m]}`);
  const txt = partes.length > 1 && grupos[grupos.length - 1].dias.length > 1 ? partes.join(', ') : partes.join(' e ');
  return `${txt} de ${fim.getUTCFullYear()}`;
}
async function lerEncontro() {
  const s = await db.collection('config').doc('encontro').get().catch(() => null);
  const d = s && s.exists ? s.data() : {};
  return d.inicio && d.fim ? { inicio: d.inicio, fim: d.fim } : ENCONTRO_PADRAO;
}

const termoTexto = (dias) => `O(a) signatário(a) manifesta concordância com o registro, utilização e divulgação de sua imagem em mídias sociais da Igreja Apostólica Fonte (CNPJ 52.268.825/0001-95), localizada à Rua Catiguá nº 130, Ipês (Polvilho), Cajamar/SP, CEP 07750-000.

A autorização é referente a imagens e vídeos do evento "Encontro com Deus", nos dias ${dias}.

Também concorda com as regras do evento, destacando que não é permitido nenhum tipo de registro e/ou gravação pelos inscritos — apenas pela organização.

Por fim, declara que toda participação foi voluntária, em conformidade com a legislação vigente, não infringindo o art. 208 do Código Penal.`;

const BUCKET = 'servos-peniel.firebasestorage.app';
const FOTOS_TERMO = ['documento_frente', 'documento_verso', 'documento', 'selfie'];

// O encontrista sobe a foto direto no Storage (sem login) e manda só o caminho.
// A leitura das fotos é restrita à liderança, então quem monta a URL com token
// é a function, pelo Admin SDK — getDownloadURL no cliente dava "unauthorized".
// Só aceita caminhos dentro da pasta da própria inscrição.
async function urlDaFoto(id, caminho) {
  if (!caminho) return null;
  if (!FOTOS_TERMO.some((n) => caminho === `termos/${id}/${n}`)) throw new Error('caminho inválido');
  const file = admin.storage().bucket(BUCKET).file(caminho);
  const [existe] = await file.exists();
  if (!existe) throw new Error('arquivo não encontrado');
  const [meta] = await file.getMetadata();
  let token = String((meta.metadata && meta.metadata.firebaseStorageDownloadTokens) || '').split(',')[0];
  if (!token) {
    token = crypto.randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  }
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
}

exports.assinarTermo = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const b = req.body || {};
  const { id, rg, endereco } = b;
  if (!id || !texto(endereco)) return res.status(400).json({ error: 'Dados do termo incompletos.' });
  try {
    const ref = db.collection('encontristas').doc(texto(id, 64));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Inscrição não encontrada.' });
    const e = snap.data();
    if (e.termoAssinado) return res.status(400).json({ error: 'Termo já assinado.' });

    // Complementares: o termo passou a ser a última etapa e é onde eles são
    // respondidos. Quem se inscreveu pelo fluxo antigo já respondeu na primeira
    // tela — o front não reexibe as perguntas e o que está gravado continua valendo.
    const jaTinhaComplementares = temComplementares(e);
    const comp = {};
    if (!jaTinhaComplementares) {
      CAMPOS_COMPLEMENTARES.forEach((k) => { comp[k] = texto(b[k], 300); });
      if (!comp.autorizaImagem || !comp.emergenciaNome || !comp.emergenciaTel ||
          !comp.temMedicamento || !comp.temDoenca) {
        return res.status(400).json({ error: 'Responda o uso de imagem, o contato de emergência e as perguntas de saúde.' });
      }
      if (comp.temMedicamento === 'Sim' && !comp.medicamento) {
        return res.status(400).json({ error: 'Informe qual medicamento você toma.' });
      }
      if (comp.temDoenca === 'Sim' && !comp.doenca) {
        return res.status(400).json({ error: 'Informe qual doença crônica você tem.' });
      }
      comp.emergencia = `${comp.emergenciaNome} — ${comp.emergenciaTel}`;
    }

    // fotos: o front manda só os caminhos (`...Path`), e urlDaFoto exige que
    // estejam na pasta desta inscrição. URL pronta não é aceita: deixaria
    // apontar o termo para um arquivo fora do nosso bucket.
    let fotoDocumento, fotoDocumentoVerso, fotoRosto;
    try {
      fotoDocumento = await urlDaFoto(ref.id, b.fotoDocumentoPath);
      fotoDocumentoVerso = await urlDaFoto(ref.id, b.fotoDocumentoVersoPath);
      fotoRosto = await urlDaFoto(ref.id, b.fotoRostoPath);
    } catch (err) {
      return res.status(400).json({ error: `Foto do termo: ${err.message}` });
    }
    if (!fotoDocumento || !fotoRosto) return res.status(400).json({ error: 'Envie a foto do documento e a selfie.' });

    const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
    // As URLs das fotos ficam só em `termos`, que é restrito à liderança.
    // `encontristas` é lido por qualquer servo ativo — não pode carregar
    // links de documento e selfie.
    const priv = await lerPrivado(ref.id, e);
    const privUpd = { endereco: texto(endereco, 300) };
    if (texto(rg)) privUpd.rg = texto(rg, 30);
    // registro antigo: aproveita para levar o CPF para o privado
    if (priv.cpf) privUpd.cpf = soDigitos(priv.cpf);
    const upd = {
      ...comp,
      ...(GRAVA_LEGADO ? privUpd : {}),
      termoAssinado: true,
      termoAssinadoEm: agora,
    };
    const batch = db.batch();
    batch.set(ref, upd, { merge: true });
    batch.set(privadoRef(ref.id), privUpd, { merge: true });
    await batch.commit();

    if (!jaTinhaComplementares) {
      try { await gravarFichaSaude(ref.id, e.nome || '', comp); }
      catch (err) { console.error('Erro ficha de saúde:', err.message); }
    }

    const termo = {
      encontristaId: ref.id,
      nome: e.nome || '',
      cpf: priv.cpf,
      rg: privUpd.rg || priv.rg,
      endereco: privUpd.endereco,
      sexo: e.sexo || '',
      igreja: e.igreja || '',
      autorizaImagem: comp.autorizaImagem || e.autorizaImagem || '',
      assinadoEm: agora,
      termoTexto: termoTexto(fmtDiasEncontro(await lerEncontro())),
      fotoDocumento,
      fotoDocumentoVerso: fotoDocumentoVerso || null,
      fotoRosto,
    };
    const termoRef = await db.collection('termos').add(termo);
    return res.json({ ok: true, termo: { id: termoRef.id, ...termo } });
  } catch (e) {
    console.error('Erro assinarTermo:', e.message);
    return res.status(500).json({ error: 'Erro ao salvar o termo.' });
  }
});

// ── NOVO PEDIDO DE UNIFORME ──────────────────────────────────────────────────
// Quem já pagou o pedido inteiro pode pedir de novo. O pedido pago vai para
// `pedidosAnteriores` (nada é apagado) e o novo pedido entra no lugar, zerado
// de pagamento. Passa por aqui porque as regras não deixam o servo mexer em
// pagoSinal/pagoIntegral pelo cliente.
const TAMANHOS_UNIFORME = ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4'];
const tamanho = (v) => (TAMANHOS_UNIFORME.includes(v) ? v : '');
const qtdPeca = (tam, v) => (tam ? Math.min(3, Math.max(1, Number(v) || 1)) : 0);

exports.novoPedidoUniforme = onRequest({ cors: true }, async (req, res) => {
  await carregarValores();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const u = await usuarioLogado(req);
  if (!u) return res.status(401).json({ error: 'Faça login novamente' });

  try {
    const camisa = tamanho(req.body.camisa);
    const calca = tamanho(req.body.calca);
    const blusa = tamanho(req.body.blusa);
    if (!camisa && !calca && !blusa) return res.status(400).json({ error: 'Escolha pelo menos uma peça' });

    const nomeCamiseta = texto(req.body.nomeCamiseta, 60);
    if (camisa && !nomeCamiseta) return res.status(400).json({ error: 'Preencha o nome na camiseta' });

    const ref = db.collection('uniformes').doc(u.uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Pedido de uniforme não encontrado' });

    const p = snap.data();
    if (p.naoQuerUniforme) return res.status(400).json({ error: 'Você não tem pedido para guardar' });
    if (!p.pagoIntegral) return res.status(400).json({ error: 'Só dá para fazer um novo pedido depois que o atual estiver pago por completo' });

    const anteriores = Array.isArray(p.pedidosAnteriores) ? p.pedidosAnteriores : [];
    if (anteriores.length >= 10) return res.status(400).json({ error: 'Limite de pedidos atingido' });

    const arquivado = {
      nomeCamiseta: p.nomeCamiseta || '',
      camisa: p.camisa || '',
      qtdCamisas: p.qtdCamisas || 0,
      calca: p.calca || '',
      qtdCalcas: p.qtdCalcas || 0,
      blusa: p.blusa || '',
      qtdBlusas: p.qtdBlusas || 0,
      valorTotal: totalUniforme(p),
      pagoSinal: true,
      pagoIntegral: true,
      pagamentoSinalId: p.pagamentoSinalId || '',
      pagamentoIntegralId: p.pagamentoIntegralId || '',
      data: p.data || '',
    };

    const pedido = {
      nome: p.nome || u.nome || '',
      perfil: p.perfil || u.perfil || '',
      nomeCamiseta,
      camisa,
      qtdCamisas: qtdPeca(camisa, req.body.qtdCamisas),
      calca,
      qtdCalcas: qtdPeca(calca, req.body.qtdCalcas),
      blusa,
      qtdBlusas: qtdPeca(blusa, req.body.qtdBlusas),
      pagoSinal: false,
      pagoIntegral: false,
      pagamentoSinalId: '',
      pagamentoIntegralId: '',
      status: 'bloqueado',
      data: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      pedidosAnteriores: [...anteriores, arquivado],
      // camiseta emprestada do staff não é comprada nem arquivada: continua valendo
      camisaEmprestada: p.camisaEmprestada || (p.modalidade === 'emprestimo' ? p.tamanho || '' : ''),
    };
    pedido.valorTotal = totalUniforme(pedido);
    if (!(pedido.valorTotal > 0)) return res.status(400).json({ error: 'Pedido sem valor' });

    await ref.set(pedido);
    return res.json({ ok: true, valorTotal: pedido.valorTotal, pedidosAnteriores: anteriores.length + 1 });
  } catch (err) {
    console.error('Erro novoPedidoUniforme:', err.message);
    return res.status(500).json({ error: 'Erro ao abrir um novo pedido.' });
  }
});

// ── NOTIFICAR MINISTÉRIO ─────────────────────────────────────────────────────
exports.notificarMinisterio = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const u = await usuarioLogado(req);
  if (!u) return res.status(401).json({ error: 'Faça login novamente' });

  try {
    const titulo = texto(req.body.titulo, 160);
    const horario = texto(req.body.horario, 40);
    const publico = req.body.publico; // 'todos' | 'homens' | 'mulheres'
    if (!titulo) return res.status(400).json({ error: 'titulo obrigatório' });

    const tokensSnap = await db.collection('tokens').get();
    // 1 documento por usuário (ID do doc = userId); enviarPush deduplica por aparelho
    let destinos = tokensSnap.docs.flatMap(aparelhosDoDoc);

    if (publico === 'homens' || publico === 'mulheres') {
      const sexoAlvo = publico === 'homens' ? 'Masculino' : 'Feminino';
      const usersSnap = await db.collection('users').get();
      const sexoPorId = {};
      usersSnap.docs.forEach((d) => { sexoPorId[d.id] = d.data().sexo; });
      destinos = destinos.filter((p) => sexoPorId[p.uid] === sexoAlvo);
    }

    if (!destinos.length) return res.json({ enviadas: 0 });

    const enviadas = await enviarPush(destinos, titulo, horario ? `Começa às ${horario}` : 'Toque para ver detalhes.');
    console.log(`${enviadas} notificações enviadas por ${u.uid} (${u.perfil}) — público: ${publico || 'todos'}`);
    res.json({ enviadas });
  } catch (err) {
    console.error('Erro notificarMinisterio:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── LEMBRETES AUTOMÁTICOS DA AGENDA ─────────────────────────────────────────
// Roda a cada minuto. Para cada item de config/agenda manda um push 15 minutos
// antes ("começa em 15 minutos") e outro no horário ("está começando agora"),
// para todos os aparelhos cadastrados. O dia da agenda ("Quinta", "Sábado"…) vira
// data a partir de config/encontro; o horário é de Brasília (sem horário de verão).
// Cada envio grava uma marca em _agenda_notif com create(): se a execução
// repetir ou atrasar, o mesmo lembrete não sai duas vezes.
// Desligado com config/agenda.autoNotificar = false.
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIA_MS = 86400000;
// procura o dia com esse nome entre a véspera do início e o fim do encontro
const dataDoDiaAgenda = (enc, dia) => {
  const fim = new Date(`${enc.fim}T12:00:00Z`).getTime();
  for (let t = new Date(`${enc.inicio}T12:00:00Z`).getTime() - DIA_MS; t <= fim; t += DIA_MS) {
    const d = new Date(t);
    if (DIAS_SEMANA[d.getUTCDay()] === dia) return d.toISOString().slice(0, 10);
  }
  return null;
};
// janelas de envio: toleram uma execução atrasada sem mandar lembrete fora de hora
const LEMBRETES_AGENDA = [
  { tipo: '15min', de: -15, ate: -10, msg: (m) => [`⏰ ${m.nome}`, `Começa em 15 minutos, às ${m.hora}.`] },
  { tipo: 'agora', de: 0, ate: 5, msg: (m) => [`🙏 ${m.nome}`, 'Está começando agora!'] },
];
const lembretesDevidos = (lista, enc, agora) => {
  const devidos = [];
  for (const m of lista) {
    if (!m || !m.nome || !/^\d{2}:\d{2}$/.test(m.hora || '')) continue;
    const data = dataDoDiaAgenda(enc, m.dia);
    if (!data) continue;
    const inicio = new Date(`${data}T${m.hora}:00-03:00`).getTime();
    for (const l of LEMBRETES_AGENDA) {
      if (agora >= inicio + l.de * 60000 && agora < inicio + l.ate * 60000) devidos.push({ m, data, l });
    }
  }
  return devidos;
};

exports.lembretesAgenda = onSchedule({ schedule: 'every 1 minutes', timeZone: 'America/Sao_Paulo', retryCount: 0 }, async () => {
  const agora = Date.now();
  const enc = await lerEncontro();
  // fora dos dias do encontro não lê mais nada
  const janelaIni = new Date(`${enc.inicio}T00:00:00-03:00`).getTime() - 2 * DIA_MS;
  const janelaFim = new Date(`${enc.fim}T23:59:59-03:00`).getTime() + DIA_MS;
  if (agora < janelaIni || agora > janelaFim) return;

  const agendaRef = db.collection('config').doc('agenda');
  const cfg = (await agendaRef.get()).data() || {};
  if (cfg.autoNotificar === false) return;
  const devidos = lembretesDevidos(Array.isArray(cfg.lista) ? cfg.lista : [], enc, agora);
  if (!devidos.length) return;

  let destinos = null;
  for (const { m, data, l } of devidos) {
    const marca = db.collection('_agenda_notif').doc(`${data}_${m.hora.replace(':', '')}_${m.id}_${l.tipo}`);
    try {
      await marca.create({ nome: m.nome, dia: m.dia, hora: m.hora, tipo: l.tipo, em: new Date().toISOString() });
    } catch (err) {
      if (err.code === 6) continue; // ALREADY_EXISTS: já foi enviado
      throw err;
    }
    if (!destinos) destinos = (await db.collection('tokens').get()).docs.flatMap(aparelhosDoDoc);
    const [titulo, corpo] = l.msg(m);
    const enviadas = destinos.length ? await enviarPush(destinos, titulo, corpo) : 0;
    await marca.update({ enviadas });
    if (l.tipo === 'agora') {
      // marca como enviado na agenda, como o botão manual faz
      await db.runTransaction(async (tx) => {
        const atual = (await tx.get(agendaRef)).data() || {};
        const lista = Array.isArray(atual.lista) ? atual.lista : [];
        if (!lista.some((x) => x.id === m.id && !x.sent)) return;
        tx.update(agendaRef, { lista: lista.map((x) => (x.id === m.id ? { ...x, sent: true } : x)) });
      });
    }
    console.log(`lembrete agenda ${l.tipo} "${m.nome}" (${m.dia} ${m.hora}): ${enviadas} aparelhos`);
  }
});

// ── CRIAR SERVO ──────────────────────────────────────────────────────────────
exports.criarServo = onRequest({ cors: true, secrets: ['GMAIL_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const u = await usuarioLogado(req);
  if (!u) return res.status(401).json({ error: 'Faça login novamente' });
  if (!PERFIS_ADMIN.includes(u.perfil)) return res.status(403).json({ error: 'Sem permissão' });

  const { email, nome, perfil, funcoes } = req.body.data || req.body;
  if (!email || !nome) return res.status(400).json({ error: 'email e nome obrigatórios' });
  if (perfil === 'admin' && u.perfil !== 'admin') return res.status(403).json({ error: 'Só admin cria admin' });

  // senha temporária única por servo; o primeiro acesso obriga a trocar
  const senhaTemp = `Ecd-${crypto.randomBytes(6).toString('base64url')}`;

  try {
    const userRecord = await admin.auth().createUser({ email, password: senhaTemp });

    await db.collection('users').doc(userRecord.uid).set({
      nome,
      email,
      perfil: perfil || 'servo',
      funcoes: Array.isArray(funcoes) ? funcoes : [],
      ativo: true,
      aprovado: true, // criado pelo admin: já entra liberado
      pago: false,
      primeiro: true,
    });

    try {
      await transporterGmail().sendMail({
        from: `"Encontro com Deus" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Bem-vindo ao Portal do Encontro com Deus!',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border-radius:16px;">
            <h2 style="color:#000;text-align:center;">Olá, ${nome}!</h2>
            <p style="color:#333;text-align:center;line-height:1.6;">
              Você foi cadastrado como servo no Portal do Encontro com Deus.<br/>
              Sua senha temporária é: <strong style="color:#00a843;">${senhaTemp}</strong><br/>
              Acesse o portal e crie sua senha:
            </p>
            <a href="${APP_URL}"
              target="_blank"
              rel="noopener noreferrer"
              style="display:block;background:#00c851;color:#000;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;margin:24px 0;">
              Acessar o Portal
            </a>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('Erro email boas-vindas:', mailErr.message);
    }

    res.json({ result: { uid: userRecord.uid } });
  } catch (err) {
    console.error('Erro criarServo:', err.code, err.message);
    if (err.code === 'auth/email-already-exists') {
      res.status(400).json({ error: 'Email já cadastrado' });
    } else if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── AUTO-CADASTRO DE SERVO ───────────────────────────────────────────────────
// O servo se cadastra sozinho (dados + senha própria) e fica bloqueado até o
// admin aprovar: `aprovado: false` faz as rules negarem tudo e o app mostrar a
// tela de espera. Perfil é sempre 'servo' — nada do formulário define acesso.
exports.cadastrarServo = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const b = req.body || {};
  const nome = texto(b.nome, 120).replace(/\s+/g, ' ');
  const email = texto(b.email, 160).toLowerCase();
  const cpf = soDigitos(b.cpf);
  const nascimento = String(b.nascimento || '');
  const sexo = String(b.sexo || '');
  const senha = String(b.senha || '');

  if (nome.split(' ').length < 2) return res.status(400).json({ error: 'Informe seu nome completo.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (cpf.length !== 11) return res.status(400).json({ error: 'CPF inválido — precisa ter 11 dígitos.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return res.status(400).json({ error: 'Informe a data de nascimento.' });
  if (!['Masculino', 'Feminino'].includes(sexo)) return res.status(400).json({ error: 'Selecione o sexo.' });
  if (senha.length < 6) return res.status(400).json({ error: 'A senha precisa ter ao menos 6 caracteres.' });

  try {
    // chave "Cadastro de servos" da tela Configurações (config/inscricoes)
    const cfg = await db.doc('config/inscricoes').get();
    if (cfg.exists && cfg.data().cadastroServoBloqueado) return res.status(403).json({ error: 'O cadastro de novos servos está fechado. Fale com a liderança.' });
    const dup = await db.collection('users').where('cpf', '==', cpf).limit(1).get();
    if (!dup.empty) return res.status(400).json({ error: 'Já existe um servo com este CPF. Use "Esqueci minha senha" ou fale com a liderança.' });

    let userRecord;
    try {
      userRecord = await admin.auth().createUser({ email, password: senha, displayName: nome });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') return res.status(400).json({ error: 'Já existe uma conta com este e-mail.' });
      if (err.code === 'auth/invalid-password') return res.status(400).json({ error: 'Senha inválida — use ao menos 6 caracteres.' });
      throw err;
    }

    try {
      await db.collection('users').doc(userRecord.uid).set({
        nome,
        email,
        cpf,
        nascimento,
        sexo,
        perfil: 'servo',
        funcoes: [],
        ativo: true,
        aprovado: false,
        autoCadastro: true,
        pago: false,
        primeiro: false, // a senha já é do próprio servo
        criadoEm: new Date().toISOString(),
      });
    } catch (err) {
      // sem o perfil a conta ficaria órfã (e o e-mail preso): desfaz
      await admin.auth().deleteUser(userRecord.uid).catch(() => {});
      throw err;
    }

    // avisa quem pode aprovar
    try {
      const usersSnap = await db.collection('users').get();
      const aprovadores = new Set(usersSnap.docs.filter((d) => PERFIS_ADMIN.includes(d.data().perfil)).map((d) => d.id));
      const tokensSnap = await db.collection('tokens').get();
      const destinos = tokensSnap.docs.filter((d) => aprovadores.has(d.id)).flatMap(aparelhosDoDoc);
      await enviarPush(destinos, '🙋 Novo servo aguardando aprovação', `${nome} se cadastrou. Aprove em Servos.`);
    } catch (e) { console.error('Erro push cadastro servo:', e.message); }

    return res.json({ ok: true });
  } catch (e) {
    console.error('Erro cadastrarServo:', e.code, e.message);
    return res.status(500).json({ error: 'Não foi possível concluir o cadastro. Tente novamente.' });
  }
});

// Recusa um auto-cadastro: apaga a conta inteira. Só admin, e só para quem
// ainda não foi aprovado (servo aprovado se desativa, não se apaga).
exports.recusarServo = onRequest({ cors: true, invoker: 'public' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const u = await usuarioLogado(req);
  if (!u) return res.status(401).json({ error: 'Faça login novamente' });
  if (!PERFIS_ADMIN.includes(u.perfil)) return res.status(403).json({ error: 'Sem permissão' });

  const id = texto(req.body?.id, 128);
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  try {
    const ref = db.collection('users').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Cadastro não encontrado.' });
    if (snap.data().aprovado !== false) return res.status(400).json({ error: 'Este servo já foi aprovado — desative-o em vez de remover.' });

    await admin.auth().deleteUser(id).catch((err) => { if (err.code !== 'auth/user-not-found') throw err; });
    await ref.delete();
    await db.collection('tokens').doc(id).delete().catch(() => {});
    return res.json({ ok: true });
  } catch (e) {
    console.error('Erro recusarServo:', e.message);
    return res.status(500).json({ error: 'Não foi possível remover.' });
  }
});

// "Esqueci minha senha": gera o link no Firebase e envia pelo Gmail OAuth2, no
// lugar do SMTP com senha de app que o Firebase usava (falhava sem avisar).
// Responde sempre igual, cadastrado ou não, para não revelar quem tem conta.
// Um envio por e-mail a cada 60s; contas inativas não recebem.
const ESPERA_RESET_MS = 60 * 1000;
exports.redefinirSenha = onRequest({ cors: true, invoker: 'public', secrets: SECRETS_GMAIL }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const email = texto(req.body?.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um email válido.' });

  const travaRef = db.collection('_reset_senha').doc(crypto.createHash('sha256').update(email).digest('hex'));
  try {
    const podeEnviar = await db.runTransaction(async (tx) => {
      const t = await tx.get(travaRef);
      const agora = Date.now();
      if (t.exists && agora - (t.data().ultimo || 0) < ESPERA_RESET_MS) return false;
      tx.set(travaRef, { ultimo: agora });
      return true;
    });
    if (!podeEnviar) return res.status(429).json({ error: 'Aguarde um minuto antes de pedir outro email.' });

    let usuario;
    try {
      usuario = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err.code === 'auth/user-not-found') return res.json({ ok: true });
      throw err;
    }
    const perfil = await db.collection('users').doc(usuario.uid).get();
    if (perfil.exists && perfil.data().ativo === false) return res.json({ ok: true });

    // o Firebase devolve o link já escapado para HTML (&amp;): o texto puro precisa de &
    const link = (await admin.auth().generatePasswordResetLink(email, { url: APP_URL })).replace(/&amp;/g, '&');
    const linkHtml = link.replace(/&/g, '&amp;');
    const nome = perfil.exists ? String(perfil.data().nome || '').split(' ')[0] : '';
    await transporterGmail().sendMail({
      from: `"Encontro com Deus" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Redefinir sua senha — Encontro com Deus',
      text: `Olá${nome ? `, ${nome}` : ''}! Para criar uma nova senha, abra este link: ${link}\n\nO link vale por 1 hora. Se você não pediu, ignore este email.`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border-radius:16px;">
          <h2 style="color:#000;text-align:center;">Olá${nome ? `, ${nome}` : ''}!</h2>
          <p style="color:#333;text-align:center;line-height:1.6;">
            Recebemos um pedido para redefinir a senha do seu acesso ao Portal do Encontro com Deus.<br/>
            Toque no botão abaixo para criar uma nova senha.
          </p>
          <a href="${linkHtml}" target="_blank" rel="noopener noreferrer"
            style="display:block;background:#00c851;color:#000;text-align:center;padding:16px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;margin:24px 0;">
            Criar nova senha
          </a>
          <p style="color:#888;text-align:center;font-size:12px;line-height:1.6;">
            O link vale por 1 hora. Se você não pediu, pode ignorar este email: sua senha continua a mesma.
          </p>
        </div>
      `,
    });
    return res.json({ ok: true });
  } catch (e) {
    // sem o e-mail no log: só o código do erro
    console.error('Erro redefinirSenha:', e.code || '', e.message);
    await travaRef.delete().catch(() => {});
    return res.status(500).json({ error: 'Não foi possível enviar agora. Tente novamente em instantes.' });
  }
});

// Exclui um servo inativo: conta de login, cadastro e token de push. Só admin,
// só quem já está inativo (o ativo se inativa primeiro) e nunca a própria conta.
// O pedido de uniforme e o log de pagamentos ficam como histórico.
exports.excluirServo = onRequest({ cors: true, invoker: 'public' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const u = await usuarioLogado(req);
  if (!u) return res.status(401).json({ error: 'Faça login novamente' });
  if (!PERFIS_ADMIN.includes(u.perfil)) return res.status(403).json({ error: 'Sem permissão' });

  const id = texto(req.body?.id, 128);
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  if (id === u.uid) return res.status(400).json({ error: 'Você não pode excluir a própria conta.' });
  try {
    const ref = db.collection('users').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Servo não encontrado.' });
    const alvo = snap.data();
    if (alvo.ativo !== false) return res.status(400).json({ error: 'Inative o servo antes de excluir.' });
    if (alvo.perfil === 'admin') return res.status(400).json({ error: 'Conta de administrador não pode ser excluída.' });

    await admin.auth().deleteUser(id).catch((err) => { if (err.code !== 'auth/user-not-found') throw err; });
    await ref.delete();
    await db.collection('tokens').doc(id).delete().catch(() => {});
    return res.json({ ok: true });
  } catch (e) {
    console.error('Erro excluirServo:', e.message);
    return res.status(500).json({ error: 'Não foi possível excluir.' });
  }
});

// Exclusão de inscrição (admin). Pensada para limpar teste e cadastro errado:
// apaga o doc, o /privado, termo, ficha de saúde, fotos do termo e tira a
// pessoa do quarto. Quem pagou pelo Mercado Pago não sai por aqui — o log de
// pagamento precisa continuar apontando para alguém.
exports.excluirEncontrista = onRequest({ cors: true, invoker: 'public' }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const u = await usuarioLogado(req);
  if (!u) return res.status(401).json({ error: 'Faça login novamente' });
  if (!PERFIS_ADMIN.includes(u.perfil)) return res.status(403).json({ error: 'Sem permissão' });

  const id = texto(req.body?.id, 128);
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  try {
    const ref = db.collection('encontristas').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Inscrição não encontrada.' });
    const e = snap.data();
    if (e.pagamentoId) return res.status(400).json({ error: 'Essa inscrição foi paga pelo Mercado Pago e não pode ser excluída.' });
    // só pendente sai: pago, pagar depois e desistiu têm histórico que a liderança usa
    if (e.pago || e.pagarDepois || e.desistiu) return res.status(400).json({ error: 'Só inscrições pendentes podem ser excluídas.' });

    const apagarPorCampo = async (col) => {
      const q = await db.collection(col).where('encontristaId', '==', id).get();
      await Promise.all(q.docs.map((d) => d.ref.delete()));
      return q.size;
    };
    const [termos, saude] = await Promise.all([apagarPorCampo('termos'), apagarPorCampo('saude')]);

    // quartos guardam o nome, não o id
    const nome = String(e.nome || '').trim();
    if (nome) {
      for (const col of ['quartos_h', 'quartos_m']) {
        const qs = await db.collection(col).where('enc', 'array-contains', nome).get();
        await Promise.all(qs.docs.map((d) => d.ref.update({ enc: admin.firestore.FieldValue.arrayRemove(nome) })));
      }
    }

    await admin.storage().bucket(BUCKET).deleteFiles({ prefix: `termos/${id}/` }).catch((err) => console.error('fotos termo:', err.message));
    await db.collection('_notif_dedupe').doc(id).delete().catch(() => {});
    await db.recursiveDelete(ref);

    console.log(`excluirEncontrista: ${id} por ${u.uid} (termos=${termos}, saude=${saude})`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Erro excluirEncontrista:', e.message);
    return res.status(500).json({ error: 'Não foi possível excluir.' });
  }
});
