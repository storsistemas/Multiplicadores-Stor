firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ merge: true });

const PONTOS = {
    voluntariar: 10,
    escolher_modulo: 10,
    iniciar_estudos: 10,
    terminar_estudos: 10,
    concluir_estudos: 30,
    iniciar_material: 20,
    terminar_material: 20,
    ministrar_aula: 50,
};

const ATIVIDADES = [
    { type: 'voluntariar', label: 'Voluntariar-se para um Módulo' },
    { type: 'escolher_modulo', label: 'Escolheu um Módulo/Sistema' },
    { type: 'iniciar_estudos', label: 'Iniciar os Estudos' },
    { type: 'terminar_estudos', label: 'Término dos Estudos' },
    { type: 'concluir_estudos', label: 'Concluir os Estudos' },
    { type: 'iniciar_material', label: 'Início da Criação do Material Didático' },
    { type: 'terminar_material', label: 'Término da Criação do Material Didático' },
    { type: 'ministrar_aula', label: 'Ministrar Treinamento' },
];

const GRUPOS = [
    { type: 'voluntariar', label: 'Voluntariar-se para um Módulo', steps: ['voluntariar'] },
    { type: 'escolher_modulo', label: 'Escolheu um Módulo/Sistema', steps: ['escolher_modulo'] },
    { type: 'fase_estudo', label: 'Fase de Estudo', steps: ['iniciar_estudos', 'terminar_estudos'] },
    { type: 'concluir_estudos', label: 'Concluir Fase de Estudo', steps: ['concluir_estudos'] },
    { type: 'criar_material', label: 'Criação de Material Didático', steps: ['iniciar_material', 'terminar_material'] },
    { type: 'ministrar_aula', label: 'Ministrar Treinamento', steps: ['ministrar_aula'] },
];

// ============ AUTH ============

async function register(name, email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('profiles').doc(cred.user.uid).set({
        name,
        total_score: 0,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const batch = db.batch();
    for (const a of ATIVIDADES) {
        const ref = db.collection('activities').doc();
        batch.set(ref, {
            user_id: cred.user.uid,
            activity_type: a.type,
            completed: false,
            data_inicio: null,
            data_termino: null,
            modulo: null,
            link: null,
            pontos: 0,
        });
    }
    await batch.commit();
    return cred;
}

async function login(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

function logout() {
    return auth.signOut();
}

// ============ PROFILE ============

async function getProfile(userId) {
    const doc = await db.collection('profiles').doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getRanking() {
    const snap = await db.collection('profiles')
        .orderBy('total_score', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============ ACTIVITIES ============

async function ensureActivities(userId) {
    const snap = await db.collection('activities')
        .where('user_id', '==', userId)
        .get();

    const existing = new Set(snap.docs.map(d => d.data().activity_type));

    const batch = db.batch();
    let added = 0;
    for (const a of ATIVIDADES) {
        if (!existing.has(a.type)) {
            const ref = db.collection('activities').doc();
            batch.set(ref, {
                user_id: userId,
                activity_type: a.type,
                completed: false,
                data_inicio: null,
                data_termino: null,
                modulo: null,
                link: null,
                pontos: 0,
            });
            added++;
        }
    }
    if (added > 0) await batch.commit();
    return added;
}

async function getActivities(userId) {
    await ensureActivities(userId);

    const snap = await db.collection('activities')
        .where('user_id', '==', userId)
        .get();

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return GRUPOS.map(g => ({
        ...g,
        steps: g.steps.map(t => data.find(d => d.activity_type === t)).filter(Boolean),
    })).filter(g => g.steps.length > 0);
}

async function toggleStep(activityId, completed, updates) {
    const data = { completed, pontos: completed ? updates.pontos : 0 };
    if (updates.data_inicio !== undefined) data.data_inicio = updates.data_inicio;
    if (updates.data_termino !== undefined) data.data_termino = updates.data_termino;
    if (updates.modulo !== undefined) data.modulo = updates.modulo;

    await db.collection('activities').doc(activityId).update(data);
}

async function updateLink(activityId, link) {
    await db.collection('activities').doc(activityId).update({ link });
}

async function recalcScore(userId) {
    const snap = await db.collection('activities')
        .where('user_id', '==', userId)
        .where('completed', '==', true)
        .get();
    const total = snap.docs.reduce((s, d) => s + (d.data().pontos || 0), 0);
    await db.collection('profiles').doc(userId).update({ total_score: total });
}

// ============ FORM HELPERS ============

function showError(msg) {
    const el = document.getElementById('flash');
    if (el) {
        el.innerHTML = `<div class="flash error">${msg}</div>`;
        setTimeout(() => el.innerHTML = '', 5000);
    }
}

function showSuccess(msg) {
    const el = document.getElementById('flash');
    if (el) {
        el.innerHTML = `<div class="flash success">${msg}</div>`;
        setTimeout(() => el.innerHTML = '', 5000);
    }
}

function requireAuth() {
    return new Promise((resolve) => {
        const user = auth.currentUser;
        if (user) { resolve(user); return; }
        const unsub = auth.onAuthStateChanged(u => {
            unsub();
            if (!u) { window.location.href = 'login.html'; resolve(null); }
            else { resolve(u); }
        });
    });
}
