from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    total_score = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=db.func.now())
    activities = db.relationship('Activity', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def update_score(self):
        self.total_score = sum(a.pontos for a in self.activities if a.completed)
        db.session.commit()

    def get_rank(self):
        users = User.query.order_by(User.total_score.desc()).all()
        for i, u in enumerate(users, 1):
            if u.id == self.id:
                return i
        return 0

class Activity(db.Model):
    __tablename__ = 'activities'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    activity_type = db.Column(db.String(50), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    data_inicio = db.Column(db.Date, nullable=True)
    data_termino = db.Column(db.Date, nullable=True)
    modulo = db.Column(db.String(200), nullable=True)
    link = db.Column(db.String(500), nullable=True)
    pontos = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=db.func.now())
