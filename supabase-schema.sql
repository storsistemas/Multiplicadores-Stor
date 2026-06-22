-- Executar no SQL Editor do Supabase (https://supabase.com/dashboard)

-- 1. TABELA DE PERFIS
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE ATIVIDADES
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    data_inicio DATE,
    data_termino DATE,
    modulo TEXT,
    link TEXT,
    pontos INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRIAR ATIVIDADES PADRÃO APÓS CADA REGISTRO
CREATE OR REPLACE FUNCTION create_default_activities()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activities (user_id, activity_type) VALUES
        (NEW.id, 'voluntariar'),
        (NEW.id, 'escolher_modulo'),
        (NEW.id, 'iniciar_estudos'),
        (NEW.id, 'terminar_estudos'),
        (NEW.id, 'concluir_estudos'),
        (NEW.id, 'iniciar_material'),
        (NEW.id, 'terminar_material'),
        (NEW.id, 'ministrar_aula');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_activities();

-- 4. ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Perfis: qualquer um pode ler (ranking), só o dono pode editar
CREATE POLICY "Perfis visiveis para todos"
    ON profiles FOR SELECT
    USING (TRUE);

CREATE POLICY "Usuario pode criar seu perfil"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuario pode atualizar seu perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Atividades: só o dono vê e edita
CREATE POLICY "Usuario ve suas atividades"
    ON activities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuario cria suas atividades"
    ON activities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario atualiza suas atividades"
    ON activities FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuario deleta suas atividades"
    ON activities FOR DELETE
    USING (auth.uid() = user_id);
