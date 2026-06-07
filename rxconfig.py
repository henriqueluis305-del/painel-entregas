"""Configuração do app Reflex.

Em desenvolvimento (sem DATABASE_URL definida) usa SQLite local — zero setup,
roda na hora. Em produção, defina DATABASE_URL apontando para o Supabase
(Session Pooler), ex.:

    postgresql+psycopg://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres
"""

import os

from dotenv import load_dotenv

import reflex as rx

load_dotenv()  # carrega .env em dev (em prod as envs vêm do Render)

config = rx.Config(
    app_name="painel",
    # SQLite local por padrão; Postgres do Supabase quando DATABASE_URL existir.
    db_url=os.environ.get("DATABASE_URL", "sqlite:///painel_dev.db"),
    # URL pública do backend. Em prod o Render injeta; em dev default abaixo.
    api_url=os.environ.get("API_URL") or "http://localhost:8000",
)
