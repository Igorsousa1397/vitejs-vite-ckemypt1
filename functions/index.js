const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const https = require('https');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const APP_URL = 'https://encontrocomdeus-fonte.vercel.app';
const WEBHOOK_URL = 'https://us-central1-servos-peniel.cloudfunctions.net/webhookPagamento';

// ── VALORES ──────────────────────────────────────────────────────────────────
// Fonte da verdade dos valores cobrados. O front (VALORES em src/App.jsx) só
// mostra os rótulos — o valor enviado ao Mercado Pago é sempre calculado aqui.
const VALORES = {
  encontrista: 390,
  encontristaItajai: 200,
  servo: 250, // servo, staff e líderes
  cozinha: 150,
};
const PERFIS_ISENTOS = ['pastor', 'pastor_auxiliar', 'lider_geral'];
const PERFIS_ADMIN = ['admin', 'lider_geral'];

const comCredito = (v) => Math.round(v * 1.05 * 100) / 100;
// uniforme usa a conta antiga do front (repassa a taxa do MP)
const creditoUniforme = (v) => Math.ceil(v / 0.9501 * 100) / 100;
const centavos = (v) => Math.round(v * 100) / 100;
// Igrejas com valor reduzido (o mesmo de Itajaí). Manter igual em src/App.jsx.
const IGREJAS_VALOR_REDUZIDO = ['Fonte Itajaí', 'Paraná'];
const isEncItajai = (e) => IGREJAS_VALOR_REDUZIDO.includes(e.igreja) || e.celula === 'Peniel - Santa Catarina';

const valorEncontrista = (e) => {
  if (e.acordo && e.valorAcordado != null && !isNaN(e.valorAcordado)) return Number(e.valorAcordado);
  return isEncItajai(e) ? VALORES.encontristaItajai : VALORES.encontrista;
};
const valorServo = (u) => (u.perfil === 'cozinha' ? VALORES.cozinha : VALORES.servo);

const precoItemUniforme = (item, tam) => {
  if (!tam) return 0;
  const grande = ['G1', 'G2', 'G3', 'G4'].includes(tam);
  if (item === 'camisa') return grande ? 47 : 43;
  if (item === 'blusa') return grande ? 115 : 105;
  if (item === 'calca') return grande ? 90 : 80;
  return 0;
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

// Campos de um encontrista que podem ser devolvidos sem login (fluxos públicos)
const encontristaPublico = (id, e, incluirCpf) => ({
  id,
  nome: e.nome || '',
  sexo: e.sexo || '',
  igreja: e.igreja || '',
  celula: e.celula || '',
  autorizaImagem: e.autorizaImagem || '',
  pago: !!e.pago,
  termoAssinado: !!e.termoAssinado,
  desistiu: !!e.desistiu,
  rg: e.rg || '',
  endereco: e.endereco || '',
  ...(incluirCpf ? { cpf: e.cpf || '' } : {}),
});

async function buscarEncontrista(busca) {
  const limpo = soDigitos(busca);
  if (!limpo) return null;
  const porCpf = await db.collection('encontristas').where('cpf', '==', limpo).limit(1).get();
  if (!porCpf.empty) return { doc: porCpf.docs[0], porCpf: true };
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
      descricao = 'Encontro com Deus · Itaquaquecetuba';
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
      descricao = 'Encontro com Deus · Itaquaquecetuba';
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
const CAMPOS_INSCRICAO = [
  'igreja', 'nome', 'nascimento', 'sexo', 'whatsapp', 'celula', 'camiseta', 'autorizaImagem',
  'emergenciaNome', 'emergenciaTel', 'temMedicamento', 'medicamento', 'temDoenca', 'doenca',
];

exports.inscrever = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const form = req.body?.form || {};

  try {
    const cfg = await db.doc('config/inscricoes').get();
    if (cfg.exists && cfg.data().bloqueadas) return res.status(403).json({ error: 'As inscrições estão encerradas.' });

    const cpf = soDigitos(form.cpf);
    if (cpf.length !== 11) return res.status(400).json({ error: 'CPF inválido.' });
    const nome = texto(form.nome, 120);
    const whatsapp = soDigitos(form.whatsapp);
    if (!nome || whatsapp.length < 10) return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });

    const nascimento = new Date(form.nascimento);
    if (isNaN(nascimento)) return res.status(400).json({ error: 'Data de nascimento inválida.' });
    const hoje = new Date();
    const idade = hoje.getFullYear() - nascimento.getFullYear() -
      (hoje < new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate()) ? 1 : 0);
    if (idade < 14) return res.status(400).json({ error: 'É necessário ter pelo menos 14 anos para se inscrever.' });

    const existente = await buscarEncontrista(cpf);
    if (existente) return res.json({ duplicado: encontristaPublico(existente.doc.id, existente.doc.data(), true) });

    const todos = await db.collection('encontristas').get();
    if (todos.docs.some((d) => soDigitos(d.data().whatsapp) === whatsapp)) {
      return res.status(400).json({ error: 'Este WhatsApp já está cadastrado!' });
    }

    const dados = {};
    CAMPOS_INSCRICAO.forEach((k) => { dados[k] = texto(form[k], 300); });
    const igrejaFinal = dados.igreja === 'Outra' ? texto(form.igrejaCustom, 120) || 'Outra' : dados.igreja;
    const docRef = await db.collection('encontristas').add({
      ...dados,
      nome,
      igreja: igrejaFinal,
      cpf,
      emergencia: `${dados.emergenciaNome} — ${dados.emergenciaTel}`,
      pago: false,
      termoAssinado: false,
      criadoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });

    if (dados.temMedicamento === 'Sim' || dados.temDoenca === 'Sim') {
      await db.collection('saude').add({
        encontristaId: docRef.id,
        nome,
        quarto: '',
        cond: [
          dados.temMedicamento === 'Sim' ? `Medicamento: ${dados.medicamento}` : null,
          dados.temDoenca === 'Sim' ? `Doença: ${dados.doenca}` : null,
        ].filter(Boolean).join(' | '),
        obs: '',
        criadoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      });
    }

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
    return res.json({ encontrista: encontristaPublico(r.doc.id, r.doc.data(), r.porCpf) });
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
    return res.json({ nome: e.nome || '', pago: !!e.pago });
  } catch (e) {
    console.error('Erro statusInscricao:', e.message);
    return res.status(500).json({ error: 'Erro ao consultar.' });
  }
});

const TERMO_TEXTO = `O(a) signatário(a) manifesta concordância com o registro, utilização e divulgação de sua imagem em mídias sociais da Igreja Apostólica Fonte (CNPJ 52.268.825/0001-95), localizada à Rua Catiguá nº 130, Ipês (Polvilho), Cajamar/SP, CEP 07750-000.

A autorização é referente a imagens e vídeos do evento "Encontro com Deus", nos dias 20, 21 e 22 de novembro de 2026.

Também concorda com as regras do evento, destacando que não é permitido nenhum tipo de registro e/ou gravação pelos inscritos — apenas pela organização.

Por fim, declara que toda participação foi voluntária, em conformidade com a legislação vigente, não infringindo o art. 208 do Código Penal.`;

const urlStorageValida = (u) => typeof u === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\//.test(u);

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

    // fotos: o front manda caminhos (`...Path`); uma URL do Storage já pronta também vale
    const foto = (url, caminho) => (urlStorageValida(url) ? Promise.resolve(url) : urlDaFoto(ref.id, caminho));
    let fotoDocumento, fotoDocumentoVerso, fotoRosto;
    try {
      fotoDocumento = await foto(b.fotoDocumento, b.fotoDocumentoPath);
      fotoDocumentoVerso = await foto(b.fotoDocumentoVerso, b.fotoDocumentoVersoPath);
      fotoRosto = await foto(b.fotoRosto, b.fotoRostoPath);
    } catch (err) {
      return res.status(400).json({ error: `Foto do termo: ${err.message}` });
    }
    if (!fotoDocumento || !fotoRosto) return res.status(400).json({ error: 'Envie a foto do documento e a selfie.' });

    const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
    const upd = {
      endereco: texto(endereco, 300),
      termoAssinado: true,
      termoAssinadoEm: agora,
      fotoDocumento,
      fotoDocumentoVerso: fotoDocumentoVerso || null,
      fotoRosto,
    };
    if (texto(rg)) upd.rg = texto(rg, 30);
    await ref.set(upd, { merge: true });

    const termo = {
      encontristaId: ref.id,
      nome: e.nome || '',
      cpf: e.cpf || '',
      rg: upd.rg || e.rg || '',
      endereco: upd.endereco,
      sexo: e.sexo || '',
      igreja: e.igreja || '',
      autorizaImagem: e.autorizaImagem || '',
      assinadoEm: agora,
      termoTexto: TERMO_TEXTO,
      fotoDocumento,
      fotoDocumentoVerso: upd.fotoDocumentoVerso,
      fotoRosto,
    };
    const termoRef = await db.collection('termos').add(termo);
    return res.json({ ok: true, termo: { id: termoRef.id, ...termo } });
  } catch (e) {
    console.error('Erro assinarTermo:', e.message);
    return res.status(500).json({ error: 'Erro ao salvar o termo.' });
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
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        },
      });
      await transporter.sendMail({
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
