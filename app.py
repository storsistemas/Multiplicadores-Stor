from flask import Flask, render_template, redirect, url_for, request, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from datetime import date
from models import db, User, Activity

app = Flask(__name__)
app.config['SECRET_KEY'] = 'stor-multiplicadores-secret-key-change-in-production'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///stor.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Por favor, faça login para acessar esta página.'

PONTOS = {
    'voluntariar': 10,
    'escolher_modulo': 10,
    'iniciar_estudos': 10,
    'terminar_estudos': 10,
    'concluir_estudos': 30,
    'iniciar_material': 20,
    'terminar_material': 20,
    'ministrar_aula': 50,
}

ATIVIDADES_ORDER = [
    'voluntariar',
    'escolher_modulo',
    'iniciar_estudos',
    'terminar_estudos',
    'concluir_estudos',
    'iniciar_material',
    'terminar_material',
    'ministrar_aula',
]

ATIVIDADES_LABELS = {
    'voluntariar': 'Voluntariar-se para um Módulo',
    'escolher_modulo': 'Escolheu um Módulo/Sistema',
    'iniciar_estudos': 'Iniciar os Estudos',
    'terminar_estudos': 'Término dos Estudos',
    'concluir_estudos': 'Concluir os Estudos',
    'iniciar_material': 'Início da Criação do Material Didático',
    'terminar_material': 'Término da Criação do Material Didático',
    'ministrar_aula': 'Ministrar Treinamento',
}

ATIVIDADES_FLAGS = {
    'voluntariar': 'voluntariar',
    'escolher_modulo': 'escolher_modulo',
    'iniciar_estudos': 'iniciar_estudos',
    'terminar_estudos': 'terminar_estudos',
    'concluir_estudos': 'concluir_estudos',
    'iniciar_material': 'iniciar_material',
    'terminar_material': 'terminar_material',
    'ministrar_aula': 'ministrar_aula',
}

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

with app.app_context():
    db.create_all()

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')

        if not name or not email or not password:
            flash('Todos os campos são obrigatórios.', 'error')
            return render_template('register.html')

        if password != confirm:
            flash('As senhas não conferem.', 'error')
            return render_template('register.html')

        if User.query.filter_by(email=email).first():
            flash('Este e-mail já está cadastrado.', 'error')
            return render_template('register.html')

        user = User(name=name, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        for atype in ATIVIDADES_ORDER:
            activity = Activity(user_id=user.id, activity_type=atype, completed=False)
            db.session.add(activity)
        db.session.commit()

        flash('Conta criada com sucesso! Faça login.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            flash('E-mail ou senha inválidos.', 'error')
            return render_template('login.html')

        login_user(user)
        return redirect(url_for('dashboard'))

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def dashboard():
    activities = current_user.activities.all()
    activities_map = {a.activity_type: a for a in activities}
    ordered = [activities_map.get(t) for t in ATIVIDADES_ORDER]

    current_user.update_score()
    rank = current_user.get_rank()

    return render_template('dashboard.html',
                         atividades=ordered,
                         labels=ATIVIDADES_LABELS,
                         rank=rank,
                         today=date.today())

@app.route('/atividade/<int:activity_id>/toggle', methods=['POST'])
@login_required
def toggle_activity(activity_id):
    activity = db.session.get(Activity, activity_id)
    if not activity or activity.user_id != current_user.id:
        flash('Atividade não encontrada.', 'error')
        return redirect(url_for('dashboard'))

    if activity.activity_type == 'voluntariar':
        activity.completed = not activity.completed
    elif activity.activity_type == 'escolher_modulo':
        modulo = request.form.get('modulo', '').strip()
        if not activity.completed and not modulo:
            flash('Informe o nome do Módulo/Sistema.', 'error')
            return redirect(url_for('dashboard'))
        activity.modulo = modulo
        activity.completed = not activity.completed
    elif activity.activity_type in ('iniciar_estudos', 'iniciar_material'):
        data = request.form.get('data_inicio', '').strip()
        if not activity.completed and not data:
            flash('Informe a data de início.', 'error')
            return redirect(url_for('dashboard'))
        if data:
            activity.data_inicio = date.fromisoformat(data)
        activity.completed = not activity.completed
    elif activity.activity_type in ('terminar_estudos', 'terminar_material'):
        data = request.form.get('data_termino', '').strip()
        if not activity.completed and not data:
            flash('Informe a data de término.', 'error')
            return redirect(url_for('dashboard'))
        if data:
            activity.data_termino = date.fromisoformat(data)
        activity.completed = not activity.completed
    elif activity.activity_type == 'concluir_estudos':
        data = request.form.get('data_conclusao', '').strip()
        if not activity.completed and not data:
            flash('Informe a data de conclusão.', 'error')
            return redirect(url_for('dashboard'))
        if data:
            activity.data_termino = date.fromisoformat(data)
        activity.completed = not activity.completed
    elif activity.activity_type == 'ministrar_aula':
        data = request.form.get('data_aula', '').strip()
        if not activity.completed and not data:
            flash('Informe a data da aula.', 'error')
            return redirect(url_for('dashboard'))
        if data:
            activity.data_termino = date.fromisoformat(data)
        activity.completed = not activity.completed
    else:
        activity.completed = not activity.completed

    if activity.completed:
        activity.pontos = PONTOS.get(activity.activity_type, 0)
    else:
        activity.pontos = 0
        if activity.activity_type == 'escolher_modulo':
            activity.modulo = None

    db.session.commit()
    current_user.update_score()
    return redirect(url_for('dashboard'))

@app.route('/atividade/<int:activity_id>/link', methods=['POST'])
@login_required
def update_link(activity_id):
    activity = db.session.get(Activity, activity_id)
    if not activity or activity.user_id != current_user.id:
        flash('Atividade não encontrada.', 'error')
        return redirect(url_for('dashboard'))

    link = request.form.get('link', '').strip()
    if not link:
        flash('Informe o link do material.', 'error')
        return redirect(url_for('dashboard'))

    activity.link = link
    db.session.commit()
    flash('Link salvo com sucesso!', 'success')
    return redirect(url_for('dashboard'))

@app.route('/ranking')
@login_required
def ranking():
    users = User.query.order_by(User.total_score.desc()).all()
    return render_template('ranking.html', users=users, current_user=current_user)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
