const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const https = require('https');
const nodemailer = require('nodemailer');

admin.initializeApp();

// ── CRIAR PAGAMENTO MERCADO PAGO ─────────────────────────────────────────────
exports.criarPagamento = onRequest({ cors: true, secrets: ['MP_ACCESS_TOKEN'] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { encontristaId, nome, email, tipo } = req.body;
  const isCredito = tipo === 'credito' || tipo === 'servo_credito' || (tipo && tipo.includes('credito'));
  const valor = req.body.valor || (
    tipo === 'credito' ? 378.00 :
    tipo === 'servo_pix' ? 200.00 :
    tipo === 'servo_credito' ? 210.00 : 360.00
  );

  if (!encontristaId) return res.status(400).send('encontristaId obrigatório');
  const encSnap = await admin.firestore().collection('encontristas').doc(encontristaId).get();
  const userSnap = await admin.firestore().collection('users').doc(encontristaId).get();
  if (!encSnap.exists && !userSnap.exists) {
    return res.status(404).json({ error: 'ID não encontrado' });
  }

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
    external_reference: (tipo && tipo.includes('uniforme')) ? `${tipo}||${encontristaId}` : encontristaId,
    back_urls: {
      success: `https://encontrocomdeus-fonte.vercel.app?pago=true&id=${encontristaId}`,
      failure: `https://encontrocomdeus-fonte.vercel.app?pago=false&id=${encontristaId}`,
      pending: `https://encontrocomdeus-fonte.vercel.app?pago=pending&id=${encontristaId}`,
    },
    auto_return: 'all',
    payment_methods: {
      excluded_payment_types: isCredito
        ? [{ id: 'ticket' }, { id: 'digital_currency' }, { id: 'digital_wallet' }]
        : [{ id: 'credit_card' }, { id: 'digital_currency' }, { id: 'digital_wallet' }],
      excluded_payment_methods: [
        { id: 'caixa_virtual' },
        { id: 'debvisa' },
        { id: 'debmaster' }
      ],
      installments: isCredito ? 12 : 1,
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
        console.log('tipo:', tipo, 'valor:', valor);
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
            const referenceId = payment.external_reference;

            if (referenceId && referenceId.includes('||')) {
              const [tipo, userId] = referenceId.split('||');
              const uniRef = admin.firestore().collection('uniformes').doc(userId);
              if (tipo.includes('uniforme_integral')) {
                await uniRef.set({ pagoIntegral: true, pagoSinal: true }, { merge: true });
              } else if (tipo.includes('uniforme_sinal')) {
                await uniRef.set({ pagoSinal: true }, { merge: true });
              }
            } else {
              const encRef = admin.firestore().collection('encontristas').doc(referenceId);
              const encSnap = await encRef.get();
              if (encSnap.exists) {
                await encRef.update({ pago: true, pagamentoId: paymentId });
              } else {
                const userRef = admin.firestore().collection('users').doc(referenceId);
                const userSnap = await userRef.get();
                if (userSnap.exists) {
                  await userRef.update({ pago: true, pagamentoId: paymentId });
                }
              }
            }
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

// ── NOTIFICAR MINISTÉRIO ─────────────────────────────────────────────────────
exports.notificarMinisterio = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { titulo, horario } = req.body;

    const tokensSnap = await admin.firestore().collection('tokens').get();
    // 1 token por documento (ID do doc = userId), sem duplicatas
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
  } catch (err) {
    console.error('Erro notificarMinisterio:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CRIAR SERVO ──────────────────────────────────────────────────────────────
exports.criarServo = onRequest({ cors: true, secrets: ['GMAIL_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { email, nome, perfil, funcoes } = req.body.data || req.body;
  if (!email || !nome) return res.status(400).json({ error: 'email e nome obrigatórios' });

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password: 'Temp@2026!',
    });

    await admin.firestore().collection('users').doc(userRecord.uid).set({
      nome,
      email,
      perfil: perfil || 'servo',
      funcoes: funcoes || [],
      ativo: true,
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
              Sua senha temporária é: <strong style="color:#00a843;">Temp@2026!</strong><br/>
              Acesse o portal e crie sua senha:
            </p>
            <a href="https://encontrocomdeus-fonte.vercel.app"
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

// ── NOTIFICAR NOVA INSCRIÇÃO ─────────────────────────────────────────────────
exports.notificarNovaInscricao = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { nome } = req.body;

  const usersSnap = await admin.firestore().collection('users').get();
  const adminPastorIds = new Set(
    usersSnap.docs
      .filter(d => ['admin', 'pastor'].includes(d.data().perfil))
      .map(d => d.id)
  );

  const tokensSnap = await admin.firestore().collection('tokens').get();
  // filtra por admins/pastores usando o ID do documento (= userId)
  const tokens = tokensSnap.docs
    .filter(d => adminPastorIds.has(d.id))
    .map(d => d.data().token)
    .filter(Boolean);

  if (!tokens.length) return res.json({ enviadas: 0 });

  const message = {
    notification: {
      title: '🙏 Nova inscrição!',
      body: `${nome} acabou de se inscrever no Encontro com Deus.`,
    },
    tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  res.json({ enviadas: response.successCount });
});