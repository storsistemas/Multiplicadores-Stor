firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.settings({ merge: true });

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

const ADMIN_ATIVIDADES = ['feedback_positivo', 'reducao_chamados', 'reducao_tma', 'material_aprovado'];

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
    const isAdminUser = email === ADMIN_EMAIL;
    await db.collection('usuarios').doc(cred.user.uid).set({
        nome: name,
        email: email,
        role: isAdminUser ? 'admin' : 'colaborador',
        status: 'pendente',
        total_score: 0,
        criado_em: firebase.firestore.FieldValue.serverTimestamp(),
        aprovado_em: null,
        aprovado_por: null,
    });
    const batch = db.batch();
    for (const a of ATIVIDADES) {
        const ref = db.collection('modulos_sistema').doc('atividades').collection('lista').doc();
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

let _adminCache = null;

async function isAdmin(user) {
    if (!user) return false;
    if (_adminCache !== null) return _adminCache;
    try {
        const doc = await db.collection('usuarios').doc(user.uid).get();
        _adminCache = doc.exists && doc.data().role === 'admin';
    } catch {
        _adminCache = false;
    }
    return _adminCache;
}

function clearAdminCache() {
    _adminCache = null;
}

// ============ SEAL ICONS ============

function getSealIcon(type, completed) {
    const mask = completed ? '' : ' style="filter:grayscale(1);opacity:0.5"';
    return '<img src="img/seal-' + type + '.png" alt="" class="seal-icon" width="22" height="22"' + mask + '>';
}

// ============ USUARIO ============

async function getProfile(userId) {
    const doc = await db.collection('usuarios').doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getRanking() {
    const snap = await db.collection('usuarios')
        .orderBy('total_score', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============ ACTIVITIES ============

function activitiesRef() {
    return db.collection('modulos_sistema').doc('atividades').collection('lista');
}

async function ensureActivities(userId) {
    const snap = await activitiesRef()
        .where('user_id', '==', userId)
        .get();

    const existing = new Set(snap.docs.map(d => d.data().activity_type));

    const batch = db.batch();
    let added = 0;
    for (const a of ATIVIDADES) {
        if (!existing.has(a.type)) {
            const ref = activitiesRef().doc();
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

    const snap = await activitiesRef()
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

    await activitiesRef().doc(activityId).update(data);
}

async function updateLink(activityId, link) {
    await activitiesRef().doc(activityId).update({
        links: firebase.firestore.FieldValue.arrayUnion(link)
    });
}

async function getMaterialLinks() {
    const snap = await activitiesRef()
        .where('activity_type', '==', 'iniciar_material')
        .get();
    const usuarios = {};
    const result = [];
    for (const doc of snap.docs) {
        const data = doc.data();
        const links = data.links || (data.link ? [data.link] : []);
        if (links.length === 0) continue;
        let userName = 'Desconhecido';
        if (!usuarios[data.user_id]) {
            const p = await getProfile(data.user_id);
            usuarios[data.user_id] = p ? p.nome : 'Desconhecido';
        }
        userName = usuarios[data.user_id];
        for (const url of links) {
            result.push({ userId: data.user_id, userName, url, activityId: doc.id });
        }
    }
    return result;
}

async function recalcScore(userId) {
    const snap = await activitiesRef()
        .where('user_id', '==', userId)
        .where('completed', '==', true)
        .get();
    const total = snap.docs.reduce((s, d) => s + (d.data().pontos || 0), 0);
    await db.collection('usuarios').doc(userId).update({ total_score: total });
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

async function updateProfileName(userId, newName) {
    await db.collection('usuarios').doc(userId).update({ nome: newName });
}

async function adminAddXP(userId, xpAmount) {
    const profile = await getProfile(userId);
    if (!profile) throw new Error('Perfil não encontrado');
    const newTotal = (profile.total_score || 0) + xpAmount;
    await db.collection('usuarios').doc(userId).update({ total_score: newTotal });
}

async function adminAssignActivity(userId, activityType, xpAmount) {
    const snap = await activitiesRef()
        .where('user_id', '==', userId)
        .where('activity_type', '==', activityType)
        .get();

    if (snap.docs.length > 0) {
        const doc = snap.docs[0];
        await doc.ref.update({ completed: true, pontos: xpAmount });
    } else {
        await activitiesRef().add({
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

// ============ APPROVAL ============

async function requireApproved() {
    const user = await requireAuth();
    if (!user) return false;
    const admin = await isAdmin(user);
    if (admin) return true;
    const profile = await getProfile(user.uid);
    if (!profile || profile.status !== 'aprovado') {
        window.location.href = 'aguardando.html';
        return false;
    }
    return true;
}

async function getPendingUsers() {
    const snap = await db.collection('usuarios')
        .where('status', '==', 'pendente')
        .get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    users.sort((a, b) => {
        const ta = a.criado_em ? a.criado_em.seconds : 0;
        const tb = b.criado_em ? b.criado_em.seconds : 0;
        return ta - tb;
    });
    return users;
}

async function approveUser(userId) {
    const user = auth.currentUser;
    await db.collection('usuarios').doc(userId).update({
        status: 'aprovado',
        aprovado_em: firebase.firestore.FieldValue.serverTimestamp(),
        aprovado_por: user ? user.email || user.uid : 'admin',
    });
}

async function reprovarUser(userId) {
    await db.collection('usuarios').doc(userId).update({
        status: 'reprovado',
    });
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
