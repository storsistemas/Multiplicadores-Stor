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

function getSealSvg(type, completed) {
    const bg = completed ? '#1a2f0f' : '#1a0f0a';
    const border = completed ? '#c9a84c' : '#4a3a2a';
    const iconColor = completed ? '#c9a84c' : '#4a3a2a';
    const opacity = completed ? '1' : '0.5';

    const icons = {
        voluntariar:
            '<path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3 9.24 3 10.91 3.81 12 5.08 13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
        escolher_modulo:
            '<path d="M4 6h16v2H4zM4 10h16v2H4zM4 14h12v2H4z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
        iniciar_estudos:
            '<path d="M4 4h7v16H4zM13 4h7v16h-7z" fill="' + iconColor + '" opacity="' + opacity + '"/>' +
            '<path d="M6 8h3v2H6zM6 12h3v2H6zM15 8h3v2h-3zM15 12h3v2h-3z" fill="' + bg + '" opacity="' + opacity + '"/>',
        concluir_estudos:
            '<path d="M4 14l2-6 6 3 6-3 2 6H4z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
        iniciar_material:
            '<path d="M16 3c-2 2-4 6-3 9l-7 7 2 2 7-7c3 1 7-1 9-3l-8-8z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
        material_aprovado:
            '<path d="M12 2l8 4v6c0 4-3.5 7.5-8 9-4.5-1.5-8-5-8-9V6l8-4z" fill="' + iconColor + '" opacity="' + opacity + '"/>' +
            '<path d="M9 12l2 2 4-4" stroke="' + bg + '" stroke-width="2" fill="none" opacity="' + opacity + '"/>',
        ministrar_aula:
            '<path d="M8 4h8v2H8zM6 10h12v2H6zM10 12h4v8h-4z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
        feedback_positivo:
            '<path d="M12 2l2.5 7.5H22l-6 4.5 2.5 7.5L12 17l-6.5 4.5L8 14l-6-4.5h7.5L12 2z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
        reducao_chamados:
            '<path d="M12 4v10l-4-4 4 4 4-4-4 4zM5 18h14v2H5z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
        reducao_tma:
            '<path d="M6 2h12v4l-4 5 4 5v4H6v-4l4-5-4-5V2zm2 2v2l4 5-4 5v2h8v-2l-4-5 4-5V4H8z" fill="' + iconColor + '" opacity="' + opacity + '"/>',
    };

    const icon = icons[type] || icons.voluntariar;

    return '<svg class="seal-icon" viewBox="0 0 24 24" width="20" height="20">' +
        '<circle cx="12" cy="12" r="11" fill="' + bg + '" stroke="' + border + '" stroke-width="1.5"/>' +
        '<circle cx="12" cy="12" r="9" fill="none" stroke="' + border + '" stroke-width="0.5" opacity="0.3"/>' +
        icon +
        '</svg>';
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
