/**
 * Script de Seed — Cria/atualiza documentos na coleção /usuarios.
 *
 * Uso:
 *   1. Baixe a chave privada do Firebase:
 *      Console Firebase > Configurações do Projeto > Contas de Serviço >
 *      "Gerar nova chave privada" → salvar como serviceAccountKey.json
 *      na raiz do projeto (já está no .gitignore)
 *
 *   2. Instale as dependências:
 *      cd scripts && npm install
 *
 *   3. Execute:
 *      node scripts/seed-admin.js
 *
 *   Flags:
 *     --migrate   Copia dados da coleção "profiles" para "usuarios"
 *                 (para usuários que já existiam antes da migração)
 */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = path.join(__dirname, "..", "serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccount)),
});

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAIL = "brayan@storsistemas.com.br";
const shouldMigrate = process.argv.includes("--migrate");

async function seed() {
  try {
    // 1. Cria/atualiza o admin
    const user = await auth.getUserByEmail(ADMIN_EMAIL);
    const uid = user.uid;

    await db.collection("usuarios").doc(uid).set(
      {
        nome: user.displayName || "Administrador",
        email: ADMIN_EMAIL,
        role: "admin",
        status: "aprovado",
        total_score: 0,
        criado_em: admin.firestore.FieldValue.serverTimestamp(),
        aprovado_em: admin.firestore.FieldValue.serverTimestamp(),
        aprovado_por: "seed-script",
      },
      { merge: true }
    );

    console.log(`✅ Admin "${ADMIN_EMAIL}" (${uid}) — role: admin, status: aprovado`);

    // 2. Se --migrate, copia profiles → usuarios para todos os Auth users
    if (shouldMigrate) {
      console.log("\n🔄 Migrando profiles → usuarios...");
      const list = await auth.listUsers();
      const profilesSnap = await db.collection("profiles").get();
      const profiles = {};
      profilesSnap.docs.forEach((d) => {
        profiles[d.id] = d.data();
      });

      let count = 0;
      for (const u of list.users) {
        const docRef = db.collection("usuarios").doc(u.uid);
        const existing = await docRef.get();
        if (existing.exists) continue; // já migrado

        const p = profiles[u.uid];
        await docRef.set({
          nome: p?.name || u.displayName || u.email || "Usuário",
          email: u.email || "",
          role: u.email === ADMIN_EMAIL ? "admin" : "colaborador",
          status: "aprovado",
          total_score: p?.total_score || 0,
          criado_em: p?.created_at || admin.firestore.FieldValue.serverTimestamp(),
          aprovado_em: admin.firestore.FieldValue.serverTimestamp(),
          aprovado_por: "seed-migration",
        });
        count++;
      }
      console.log(`✅ ${count} usuários migrados de "profiles" para "usuarios"`);
    }

    console.log("\n✅ Seed concluído!");
    process.exit(0);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.error(
        `❌ Usuário "${ADMIN_EMAIL}" não encontrado no Authentication.\n` +
          "   Crie o usuário pelo formulário de cadastro antes de rodar o seed."
      );
    } else {
      console.error("❌ Erro:", err.message);
    }
    process.exit(1);
  }
}

seed();
