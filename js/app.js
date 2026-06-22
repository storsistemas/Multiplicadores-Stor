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

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ AUTH ============

async function register(name, email, password) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password,
    });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        name,
    });
    if (profileError) throw profileError;

    return authData;
}

async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email, password,
    });
    if (error) throw error;
    return data;
}

async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

// ============ PROFILE ============

async function getProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) throw error;
    return data;
}

async function getRanking() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('total_score', { ascending: false });
    if (error) throw error;
    return data;
}

// ============ ACTIVITIES ============

async function getActivities(userId) {
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at');
    if (error) throw error;

    const ordered = ATIVIDADES.map(a => data.find(d => d.activity_type === a.type));
    return ordered.filter(Boolean);
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

    const { error } = await supabase
        .from('activities')
        .update(updates)
        .eq('id', activity.id);
    if (error) throw error;

    await recalcScore(activity.user_id);
}

async function updateLink(activityId, userId, link) {
    const { error } = await supabase
        .from('activities')
        .update({ link })
        .eq('id', activityId);
    if (error) throw error;
}

async function recalcScore(userId) {
    const { data: acts, error } = await supabase
        .from('activities')
        .select('pontos')
        .eq('user_id', userId)
        .eq('completed', true);
    if (error) throw error;

    const total = acts.reduce((s, a) => s + a.pontos, 0);
    await supabase.from('profiles').update({ total_score: total }).eq('id', userId);
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

async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}
