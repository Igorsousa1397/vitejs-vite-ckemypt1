const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const https = require('https');

admin.initializeApp();

// ── NOTIFICAR AVISO ──────────────────────────────────────────────────────────
exports.notificarAviso = onDocumentCreated('avisos/{avisoId}', async (event) => {
  const aviso = event.data.data();
  const tokensSnap = await admin.firestore().collection('tokens').get();
  const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
  if (!tokens.length) return null;
  const message = {
    notification: {
      title: `${aviso.autor || 'Admin'} — Novo aviso`,
      body: aviso.txt,
    },
    tokens,
  };
  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`${response.successCount} notificações enviadas`);
  return null;
});

// ── CRIAR PAGAMENTO MERCADO PAGO ─────────────────────────────────────────────
exports.criarPagamento = onRequest({ cors: true, secrets: ['MP_ACCESS_TOKEN'] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { encontristaId, nome, email, tipo } = req.body;
  const valor = tipo === 'credito' ? 378.00 : tipo === 'servo_pix' ? 220.00 : tipo === 'servo_credito' ? 231.00 : 360.00;  
  if (!encontristaId) return res.status(400).send('encontristaId obrigatório');

  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  const body = JSON.stringify({
    items: [{
      title: 'Inscrição — Encontro com Deus 2026',
      description: 'Dias 26, 27 e 28 de junho · Itaquaquecetuba',
      quantity: 1,
      unit_price: valor,
      currency_id: 'BRL',
    }],
    payer: {
      name: nome || 'Encontrista',
      email: email || 'encontrocomdeus@email.com',
    },
    external_reference: encontristaId,
    back_urls: {
      success: `https://servos-peniel.vercel.app?pago=true&id=${encontristaId}`,
      failure: `https://servos-peniel.vercel.app?pago=false&id=${encontristaId}`,
      pending: `https://servos-peniel.vercel.app?pago=pending&id=${encontristaId}`,
    },
    auto_return: 'all',
    payment_methods: {
      excluded_payment_types: tipo === 'credito'
        ? [
            { id: 'ticket' },
            { id: 'digital_currency' },
            { id: 'digital_wallet' }
          ]
        : [
            { id: 'credit_card' },
            { id: 'digital_currency' },
            { id: 'digital_wallet' }
          ],
      excluded_payment_methods: [
        { id: 'caixa_virtual' },
        { id: 'debvisa' },
        { id: 'debmaster' }
      ],
      installments: tipo === 'credito' ? 12 : 1,
    },
    notification_url: 'https://us-central1-servos-peniel.cloudfunctions.net/webhookPagamento',
  });

  const options = {
    hostname: 'api.mercadopago.com',
    path: '/checkout/preferences',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const mpReq = https.request(options, (mpRes) => {
    let data = '';
    mpRes.on('data', chunk => data += chunk);
    mpRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        console.log('MP Response:', JSON.stringify(parsed));
        if (parsed.init_point) {
          res.json({ init_point: parsed.init_point, id: parsed.id });
        } else {
          res.status(500).json({ error: 'init_point não retornado', details: parsed });
        }
      } catch (e) {
        res.status(500).json({ error: 'Erro ao parsear resposta', raw: data });
      }
    });
  });

  mpReq.on('error', (e) => {
    console.error('Erro MP:', e.message);
    res.status(500).json({ error: e.message });
  });
  mpReq.write(body);
  mpReq.end();
});

// ── WEBHOOK PAGAMENTO ────────────────────────────────────────────────────────
exports.webhookPagamento = onRequest({ cors: true, secrets: ['MP_ACCESS_TOKEN'] }, async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const paymentId = data.id;
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

    const options = {
      hostname: 'api.mercadopago.com',
      path: `/v1/payments/${paymentId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
    };

    https.get(options, (mpRes) => {
      let responseData = '';
      mpRes.on('data', chunk => responseData += chunk);
      mpRes.on('end', async () => {
        try {
          const payment = JSON.parse(responseData);
          if (payment.status === 'approved') {
            const encontristaId = payment.external_reference;
            await admin.firestore()
              .collection('encontristas')
              .doc(encontristaId)
              .update({ pago: true, pagamentoId: paymentId });
            console.log(`Encontrista ${encontristaId} marcado como pago!`);
          }
          res.sendStatus(200);
        } catch (e) {
          console.error('Erro webhook:', e.message);
          res.sendStatus(500);
        }
      });
    }).on('error', () => res.sendStatus(500));
  } else {
    res.sendStatus(200);
  }
});

exports.notificarMinisterio = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { titulo, horario } = req.body;
  
  const tokensSnap = await admin.firestore().collection('tokens').get();
  const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
  if (!tokens.length) return res.json({ enviadas: 0 });

  const message = {
    notification: {
      title: titulo,
      body: horario ? `Começa às ${horario}` : 'Toque para ver detalhes.',
    },
    tokens,
  };
  
  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`${response.successCount} notificações enviadas`);
  res.json({ enviadas: response.successCount });
});

// ── CRIAR SERVO ──────────────────────────────────────────────────────────────
exports.criarServo = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { email, nome, perfil, funcoes } = req.body.data || req.body;
  if (!email || !nome) return res.status(400).json({ error: 'email e nome obrigatórios' });

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password: 'Temp@2026!',
    });

    await admin.auth().generatePasswordResetLink(email);

    await admin.firestore().collection('users').doc(userRecord.uid).set({
      nome,
      email,
      perfil: perfil || 'servo',
      funcoes: funcoes || [],
      ativo: true,
      pago: false,
      primeiro: true,
    });

    res.json({ result: { uid: userRecord.uid } });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      res.status(400).json({ error: 'Email já cadastrado' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── CRIAR LÍDER TEMPLO ────────────────────────────────────────────────────────
exports.criarLiderTemplo = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const userRecord = await admin.auth().createUser({
      email: 'lidertemplo@servospeniel.com',
      password: 'LiderTemplo@2026',
    });

    await admin.firestore().collection('users').doc(userRecord.uid).set({
      nome: 'Líder Templo',
      email: 'lidertemplo@servospeniel.com',
      perfil: 'lider_templo',
      ativo: true,
      pago: true,
      funcoes: [],
      primeiro: false,
    });

    res.json({ status: 'ok', uid: userRecord.uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

exports.criarLiderMidia = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const userRecord = await admin.auth().createUser({
      email: 'lidermidia@servospeniel.com',
      password: 'LiderMidia@2026',
    });
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      nome: 'Líder Mídia',
      email: 'lidermidia@servospeniel.com',
      perfil: 'lider_midia',
      ativo: true,
      pago: true,
      funcoes: [],
      primeiro: false,
    });
    res.json({ status: 'ok', uid: userRecord.uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// v8