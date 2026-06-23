firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ merge: true });

// Valores ocultos do usuário
const PONTOS = {
    voluntariar: 100,
    escolher_modulo: 100,
    iniciar_estudos: 50,
    concluir_estudos: 100,
    iniciar_material: 50,
    material_aprovado: 250,
    ministrar_aula: 150,
};

const ATIVIDADES = [
    { type: 'voluntariar', label: 'Voluntariar-se para o Projeto' },
    { type: 'escolher_modulo', label: 'Escolheu um Módulo/Sistema' },
    { type: 'iniciar_estudos', label: 'Iniciar Fase de Estudo' },
    { type: 'concluir_estudos', label: 'Concluir Fase de Estudo' },
    { type: 'iniciar_material', label: 'Iniciando a Criação do Material Didático' },
    { type: 'material_aprovado', label: 'Material Aprovado (Revisão)' },
    { type: 'ministrar_aula', label: 'Ministrar Treinamento' },
    { type: 'feedback_positivo', label: 'Feedback Positivo (Treinamento)' },
    { type: 'reducao_chamados', label: 'Redução de Chamados no Módulo' },
    { type: 'reducao_tma', label: 'Redução de TMA no Módulo' },
];

const ADMIN_ATIVIDADES = ['feedback_positivo', 'reducao_chamados', 'reducao_tma'];

const GRUPOS = [
    { type: 'voluntariar', label: 'Voluntariar-se para o Projeto', steps: ['voluntariar'] },
    { type: 'escolher_modulo', label: 'Escolheu um Módulo/Sistema', steps: ['escolher_modulo'] },
    { type: 'iniciar_estudos', label: 'Iniciar Fase de Estudo', steps: ['iniciar_estudos'] },
    { type: 'concluir_estudos', label: 'Concluir Fase de Estudo', steps: ['concluir_estudos'] },
    { type: 'iniciar_material', label: 'Iniciando a Criação do Material Didático', steps: ['iniciar_material'] },
    { type: 'material_aprovado', label: 'Material Aprovado (Revisão)', steps: ['material_aprovado'] },
    { type: 'ministrar_aula', label: 'Ministrar Treinamento', steps: ['ministrar_aula'] },
    { type: 'feedback_positivo', label: 'Feedback Positivo (Treinamento)', steps: ['feedback_positivo'] },
    { type: 'reducao_chamados', label: 'Redução de Chamados no Módulo', steps: ['reducao_chamados'] },
    { type: 'reducao_tma', label: 'Redução de TMA no Módulo', steps: ['reducao_tma'] },
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

// ============ SEAL ICONS ============

function getSealIcon(type, completed) {
    const mask = completed ? '' : ' style="filter:grayscale(1);opacity:0.5"';
    return '<img src="img/seal-' + type + '.png" alt="" class="seal-icon" width="22" height="22"' + mask + '>';
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
    await db.collection('activities').doc(activityId).update({
        links: firebase.firestore.FieldValue.arrayUnion(link)
    });
}

async function getMaterialLinks() {
    const snap = await db.collection('activities')
        .where('activity_type', '==', 'iniciar_material')
        .get();
    const profiles = {};
    const result = [];
    for (const doc of snap.docs) {
        const data = doc.data();
        const links = data.links || (data.link ? [data.link] : []);
        if (links.length === 0) continue;
        let userName = 'Desconhecido';
        if (!profiles[data.user_id]) {
            const p = await getProfile(data.user_id);
            profiles[data.user_id] = p ? p.name : 'Desconhecido';
        }
        userName = profiles[data.user_id];
        for (const url of links) {
            result.push({ userId: data.user_id, userName, url, activityId: doc.id });
        }
    }
    return result;
}

async function recalcScore(userId) {
    const snap = await db.collection('activities')
        .where('user_id', '==', userId)
        .where('completed', '==', true)
        .get();
    const total = snap.docs.reduce((s, d) => s + (d.data().pontos || 0), 0);
    await db.collection('profiles').doc(userId).update({ total_score: total });
}

// ============ RANK SYSTEM ============

const RANKS = [
    { xp: 0, title: 'Iniciante', icon: '&#x1F6E1;' },
    { xp: 250, title: 'Aprendiz', icon: '&#x1F4D6;' },
    { xp: 400, title: 'Artesão', icon: '&#x1F58C;' },
    { xp: 650, title: 'Alquimista', icon: '&#x1F9EA;' },
    { xp: 1200, title: 'Mestre de Batalha', icon: '&#x1F5E1;' },
    { xp: 1600, title: 'Grão-Mestre', icon: '&#x1F451;' },
];

function getRank(totalXp) {
    let rank = RANKS[0];
    for (const r of RANKS) {
        if (totalXp >= r.xp) rank = r;
    }
    return rank;
}

function getNextRank(totalXp) {
    for (const r of RANKS) {
        if (totalXp < r.xp) return r;
    }
    return null;
}

// ============ ADMIN ============

function isAdmin(user) {
    return user && user.email === ADMIN_EMAIL;
}

async function updateProfileName(userId, newName) {
    await db.collection('profiles').doc(userId).update({ name: newName });
}

async function adminAddXP(userId, xpAmount) {
    const profile = await getProfile(userId);
    if (!profile) throw new Error('Perfil não encontrado');
    const newTotal = (profile.total_score || 0) + xpAmount;
    await db.collection('profiles').doc(userId).update({ total_score: newTotal });
}

async function adminAssignActivity(userId, activityType, xpAmount) {
    const snap = await db.collection('activities')
        .where('user_id', '==', userId)
        .where('activity_type', '==', activityType)
        .get();

    if (snap.docs.length > 0) {
        const doc = snap.docs[0];
        await doc.ref.update({ completed: true, pontos: xpAmount });
    } else {
        await db.collection('activities').add({
            user_id: userId,
            activity_type: activityType,
            completed: true,
            data_inicio: null,
            data_termino: null,
            modulo: null,
            link: null,
            pontos: xpAmount,
        });
    }
    await recalcScore(userId);
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
