/**
 * Script de Seed — Cria o usuário administrador inicial no Firestore.
 *
 * Uso:
 *   1. Baixe a chave privada do Firebase:
 *      Console Firebase > Configurações do Projeto > Contas de Serviço >
 *      "Gerar nova chave privada" → salvar como serviceAccountKey.json
 *      na raiz do projeto (já está no .gitignore)
 *
 *   2. Instale as dependências:
 *      npm install firebase-admin
 *
 *   3. Execute:
 *      node scripts/seed-admin.js
 *
 *   Isso criará/atualizará o documento do admin em /usuarios/{uid}
 *   com role: "admin" e status: "aprovado".
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

async function seed() {
  try {
    // Busca o usuário pelo e-mail no Authentication
    const user = await auth.getUserByEmail(ADMIN_EMAIL);
    const uid = user.uid;

    // Cria ou atualiza o documento em /usuarios/{uid}
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

    console.log(`✅ Admin "${ADMIN_EMAIL}" (${uid}) criado/atualizado com sucesso!`);
    console.log("   → role: admin, status: aprovado");
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
