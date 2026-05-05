const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

exports.notificarAviso = onDocumentCreated('avisos/{avisoId}', async (event) => {
  const aviso = event.data.data();

  const tokensSnap = await admin.firestore().collection('tokens').get();
  const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);

  if (!tokens.length) return null;

  const message = {
    notification: {
      title: 'servos. — Novo aviso',
      body: aviso.txt,
    },
    tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`${response.successCount} notificações enviadas`);
  return null;
});