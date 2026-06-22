firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
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

async function getActivities(userId) {
    const snap = await db.collection('activities')
        .where('user_id', '==', userId)
        .orderBy('created_at')
        .get();

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return ATIVIDADES
        .map(a => data.find(d => d.activity_type === a.type))
        .filter(Boolean);
}

async function toggleActivity(activity, formData) {
    const updates = { completed: !activity.completed };
    updates.pontos = updates.completed ? (PONTOS[activity.activity_type] || 0) : 0;

    if (activity.activity_type === 'escolher_modulo') {
        const modulo = formData.get('modulo');
        if (!activity.completed && !modulo) throw new Error('Informe o nome do Módulo/Sistema');
        updates.modulo = activity.completed ? null : modulo;
    }

    if (['iniciar_estudos', 'iniciar_material'].includes(activity.activity_type)) {
        const data = formData.get('data_inicio');
        if (!activity.completed && !data) throw new Error('Informe a data de início');
        updates.data_inicio = data || null;
    }

    if (['terminar_estudos', 'terminar_material'].includes(activity.activity_type)) {
        const data = formData.get('data_termino');
        if (!activity.completed && !data) throw new Error('Informe a data de término');
        updates.data_termino = data || null;
    }

    if (activity.activity_type === 'concluir_estudos') {
        const data = formData.get('data_conclusao');
        if (!activity.completed && !data) throw new Error('Informe a data de conclusão');
        updates.data_termino = data || null;
    }

    if (activity.activity_type === 'ministrar_aula') {
        const data = formData.get('data_aula');
        if (!activity.completed && !data) throw new Error('Informe a data da aula');
        updates.data_termino = data || null;
    }

    await db.collection('activities').doc(activity.id).update(updates);
    await recalcScore(activity.user_id);
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
        setTimeout(() => el.innerHTML = '', 4000);
    }
}

function showSuccess(msg) {
    const el = document.getElementById('flash');
    if (el) {
        el.innerHTML = `<div class="flash success">${msg}</div>`;
        setTimeout(() => el.innerHTML = '', 4000);
    }
}

function requireAuth() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged(user => {
            if (!user) {
                window.location.href = 'login.html';
                resolve(null);
            } else {
                resolve(user);
            }
        });
    });
}
