"""App Reflex — ponto de entrada.

Por enquanto é só uma landing de validação (Fase 0): serve para confirmar que
a stack roda localmente e faz deploy no Render. As páginas reais (login,
monitoramento, histórico, admin...) entram nas fases seguintes — ver
PLANO-MIGRACAO-PYTHON.md.
"""

import reflex as rx


def feature(icon: str, titulo: str, desc: str) -> rx.Component:
    return rx.card(
        rx.hstack(
            rx.icon(icon, size=22),
            rx.vstack(
                rx.text(titulo, weight="bold"),
                rx.text(desc, size="2", color_scheme="gray"),
                spacing="1",
                align="start",
            ),
            spacing="3",
            align="center",
        ),
        width="100%",
    )


def index() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.badge("Migração para Python • em construção", variant="surface"),
            rx.heading("Painel de Entregas", size="9"),
            rx.text(
                "Nova stack: Reflex + Supabase. Esta tela confirma que o "
                "ambiente roda localmente.",
                color_scheme="gray",
                text_align="center",
            ),
            rx.vstack(
                feature("database", "Banco", "SQLite em dev, Supabase Postgres em produção"),
                feature("shield-check", "Auth", "Supabase Auth (JWT validado no servidor)"),
                feature("rocket", "Deploy", "Render (web service gratuito, container Docker)"),
                spacing="3",
                width="100%",
            ),
            rx.text("Status do banco: ", rx.code(rx.cond(True, "OK", "—")), size="2"),
            spacing="5",
            align="center",
            max_width="480px",
            padding="6",
        ),
        height="100vh",
    )


app = rx.App(
    theme=rx.theme(
        appearance="dark",
        accent_color="iris",
        radius="large",
        font_family="DM Sans, sans-serif",
    ),
)
app.add_page(index, route="/", title="Painel de Entregas")
