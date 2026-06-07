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

try:
    from reflex_base.plugins.sitemap import SitemapPlugin as _Sitemap
    _disable = [_Sitemap]
except ImportError:
    _disable = []

config = rx.Config(
    app_name="painel",
    db_url=os.environ.get("DATABASE_URL", "sqlite:///painel_dev.db"),
    api_url=os.environ.get("API_URL") or "http://localhost:8000",
    disable_plugins=_disable,
    show_built_with_reflex=False,
)
