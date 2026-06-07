"""App Reflex — registro de páginas, tema e rotas protegidas.

Páginas operacionais reais entram nas fases seguintes (ver
PLANO-MIGRACAO-PYTHON.md). Esta fase entrega: login real (Supabase Auth),
sessão por usuário e shell com sidebar filtrada por permissão.
"""

import reflex as rx

import painel.models  # noqa: F401 — garante que Alembic detecta todos os models
from painel.auth.state import AuthState
from painel.components.theme import C, FONT, GOOGLE_FONTS
from painel.pages.dashboard import (
    admin_page,
    historico_page,
    hoje_page,
    home_page,
    liberacao_page,
    motoristas_page,
    sla_ds_page,
)
from painel.pages.login import login_page

app = rx.App(
    theme=rx.theme(
        appearance="dark",
        accent_color="indigo",
        gray_color="slate",
        radius="large",
        panel_background="solid",
    ),
    stylesheets=[GOOGLE_FONTS],
    style={
        "fontFamily": FONT,
        "backgroundColor": C.bg,
        "color": C.fg,
    },
)

# Pública
app.add_page(login_page, route="/login", title="Entrar • Painel", on_load=AuthState.redirect_if_authed)

# Protegidas (todas passam pelo gate AuthState.check_auth)
_protected = [
    (home_page, "/", "Início"),
    (home_page, "/home", "Início"),
    (hoje_page, "/hoje", "SLA & DS Hoje"),
    (historico_page, "/historico", "Histórico"),
    (motoristas_page, "/motoristas", "Motoristas"),
    (sla_ds_page, "/sla-ds", "SLA & DS"),
    (liberacao_page, "/liberacao", "Liberação"),
    (admin_page, "/admin", "Administração"),
]
for fn, route, title in _protected:
    app.add_page(fn, route=route, title=f"{title} • Painel", on_load=AuthState.check_auth)
