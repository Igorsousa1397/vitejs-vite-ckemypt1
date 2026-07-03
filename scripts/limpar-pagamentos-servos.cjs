/**
 * Script para zerar pagamentos dos servos para novo evento
 *
 * O QUE FAZ:
 * - Reseta: pago=false, pagamentoId, pagoEm, pagarDepois, pagarDepoisData, pagarDepoisObs
 * - Mantém tudo o mais: nome, perfil, sexo, cpf, nascimento, escala, etc.
 *
 * COMO RODAR:
 * 1. Coloque scripts/serviceAccount.json (chave do Firebase)
 * 2. node scripts/limpar-pagamentos-servos.cjs
 */

const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const del = admin.firestore.FieldValue.delete;

async function main() {
  console.log("\n=== RESETAR PAGAMENTOS DOS SERVOS ===\n");

  const snap = await db.collection("users").get();
  if (snap.empty) { console.log("Coleção users vazia."); process.exit(0); }

  let batch = db.batch();
  let batches = [];
  let count = 0;
  let total = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data();
    const temPagamento = data.pago || data.pagamentoId || data.pagoEm
      || data.pagarDepois || data.pagarDepoisData || data.pagarDepoisObs;

    if (temPagamento) {
      batch.update(doc.ref, {
        pago: false,
        pagamentoId: del(),
        pagoEm: del(),
        pagarDepois: del(),
        pagarDepoisData: del(),
        pagarDepoisObs: del(),
      });
      count++;
      total++;
      if (total % 400 === 0) { batches.push(batch.commit()); batch = db.batch(); }
      console.log(`  Resetando: ${data.nome} (${data.perfil}) — era: pago=${data.pago}`);
    }
  });

  batches.push(batch.commit());
  await Promise.all(batches);

  console.log(`\n=== CONCLUÍDO: ${count} servos resetados ===`);
  console.log("Mantidos: nome, perfil, sexo, cpf, nascimento, escala, etc.");
  process.exit(0);
}

main().catch((err) => { console.error("\nERRO:", err); process.exit(1); });
