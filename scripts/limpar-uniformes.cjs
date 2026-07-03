/**
 * Script para limpar todos os pedidos de uniformes
 * Mantém a config (dataLimite) — só remove os pedidos
 * Rodar: node scripts/limpar-uniformes.cjs
 */

const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  console.log("\n=== LIMPEZA DE PEDIDOS DE UNIFORMES ===\n");

  const snap = await db.collection("uniformes").get();
  if (snap.empty) { console.log("Coleção uniformes vazia."); process.exit(0); }

  let batch = db.batch();
  let batches = [];
  let count = 0;

  snap.docs.forEach((doc) => {
    console.log(`  Removendo: ${doc.data().nome || doc.id}`);
    batch.delete(doc.ref);
    count++;
    if (count % 400 === 0) { batches.push(batch.commit()); batch = db.batch(); }
  });

  batches.push(batch.commit());
  await Promise.all(batches);

  console.log(`\n=== CONCLUÍDO: ${count} pedidos removidos ===`);
  console.log("Config (dataLimite) mantida.");
  process.exit(0);
}

main().catch((err) => { console.error("\nERRO:", err); process.exit(1); });
