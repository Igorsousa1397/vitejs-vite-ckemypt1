/**
 * Restaura a agenda padrão no Firestore
 * Rodar: node scripts/restaurar-agenda.cjs
 */

const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const MINS_INIT = [
  { id: 1, dia: "Quinta", nome: "Pré-Encontro", hora: "20:00", sent: false },
  { id: 2, dia: "Quinta", nome: "Envio", hora: "23:30", sent: false },
  { id: 3, dia: "Sexta", nome: "Encontro com o Mundo, Encontro com Deus", hora: "23:00", sent: false },
  { id: 4, dia: "Sábado", nome: "Ministração Peniel", hora: "08:30", sent: false },
  { id: 5, dia: "Sábado", nome: "Ministração Cura", hora: "10:30", sent: false },
  { id: 6, dia: "Sábado", nome: "Ministração Escamas", hora: "15:30", sent: false },
  { id: 7, dia: "Sábado", nome: "Ministração Libertação", hora: "17:00", sent: false },
  { id: 8, dia: "Sábado", nome: "Ministração Amor de Deus", hora: "21:30", sent: false },
  { id: 9, dia: "Domingo", nome: "Ministração Sonhos", hora: "08:30", sent: false },
  { id: 10, dia: "Domingo", nome: "Unção de Multiplicação", hora: "09:30", sent: false },
  { id: 11, dia: "Domingo", nome: "Batismo com Espírito Santo", hora: "10:30", sent: false },
  { id: 12, dia: "Domingo", nome: "Oração Estilo de Vida", hora: "15:00", sent: false },
  { id: 13, dia: "Domingo", nome: "Recados Pós Encontro", hora: "16:00", sent: false },
];

async function main() {
  await db.collection("config").doc("agenda").set({ lista: MINS_INIT });
  console.log(`Agenda restaurada com ${MINS_INIT.length} itens.`);
  process.exit(0);
}

main().catch((err) => { console.error("ERRO:", err); process.exit(1); });
