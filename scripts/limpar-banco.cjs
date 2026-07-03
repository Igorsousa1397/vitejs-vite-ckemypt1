/**
 * Script de limpeza do banco para novo evento
 * Rodar: node scripts/limpar-banco.cjs
 */

const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const ENCONTRISTA_MANTER = "Shayene Beserra Bueno Munaro";

async function deletarColecao(colecao) {
  const snap = await db.collection(colecao).get();
  if (snap.empty) { console.log(`  [${colecao}] vazia, pulando.`); return 0; }
  let batch = db.batch();
  let batches = [];
  let count = 0;
  snap.docs.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
    if (count % 400 === 0) { batches.push(batch.commit()); batch = db.batch(); }
  });
  batches.push(batch.commit());
  await Promise.all(batches);
  console.log(`  [${colecao}] ${count} documentos excluídos.`);
  return count;
}

async function limparEscalas() {
  const snap = await db.collection("users").get();
  let batch = db.batch();
  let batches = [];
  let count = 0;
  snap.docs.forEach((doc) => {
    if (doc.data().escala) {
      batch.update(doc.ref, { escala: admin.firestore.FieldValue.delete() });
      count++;
      if (count % 400 === 0) { batches.push(batch.commit()); batch = db.batch(); }
    }
  });
  batches.push(batch.commit());
  await Promise.all(batches);
  console.log(`  [users] escala removida de ${count} servos.`);
}

async function limparEncontristas() {
  const nomeLimpo = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const snap = await db.collection("encontristas").get();
  if (snap.empty) { console.log("  [encontristas] vazia, pulando."); return; }
  let batch = db.batch();
  let batches = [];
  let manter = 0, excluir = 0, total = 0;
  snap.docs.forEach((doc) => {
    const nome = doc.data().nome || "";
    if (nomeLimpo(nome) === nomeLimpo(ENCONTRISTA_MANTER)) {
      manter++;
      console.log(`  Mantendo: ${nome} (id: ${doc.id})`);
    } else {
      batch.delete(doc.ref);
      excluir++; total++;
      if (total % 400 === 0) { batches.push(batch.commit()); batch = db.batch(); }
    }
  });
  batches.push(batch.commit());
  await Promise.all(batches);
  console.log(`  [encontristas] ${excluir} excluídos, ${manter} mantidos.`);
}

async function main() {
  console.log("\n=== LIMPEZA DO BANCO PARA NOVO EVENTO ===\n");
  console.log("1. Limpando encontristas...");
  await limparEncontristas();
  console.log("\n2. Limpando ocorrências...");
  await deletarColecao("ocorrencias");
  console.log("\n3. Limpando avisos...");
  await deletarColecao("avisos");
  console.log("\n4. Limpando termos assinados...");
  await deletarColecao("termos");
  console.log("\n5. Limpando quartos (homens)...");
  await deletarColecao("quartos_h");
  console.log("\n6. Limpando quartos (mulheres)...");
  await deletarColecao("quartos_m");
  console.log("\n7. Limpando escalas dos servos...");
  await limparEscalas();
  console.log("\n=== CONCLUÍDO ===");
  console.log("Mantidos: cartas, cadastros dos servos, config, tokens");
  process.exit(0);
}

main().catch((err) => { console.error("\nERRO:", err); process.exit(1); });
// placeholder
