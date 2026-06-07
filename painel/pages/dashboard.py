"""Página inicial + placeholders das páginas ainda não construídas (Fase 6+)."""

import reflex as rx

from painel.auth.state import AuthState
from painel.components.layout import layout


def _stat(icon: str, label: str, value: str) -> rx.Component:
    return rx.card(
        rx.hstack(
            rx.box(
                rx.icon(icon, size=22, color=rx.color("iris", 11)),
                padding="3",
                background=rx.color("iris", 3),
                border_radius="large",
            ),
            rx.vstack(
                rx.text(label, size="2", color_scheme="gray"),
                rx.heading(value, size="6"),
                spacing="0",
                align="start",
            ),
            spacing="3",
            align="center",
        ),
        flex="1",
    )


def home_page() -> rx.Component:
    return layout(
        "Início",
        rx.vstack(
            rx.heading(
                rx.text.span("Bem-vindo, "),
                rx.text.span(AuthState.empresa, color=rx.color("iris", 11)),
                size="7",
            ),
            rx.text(
                "Painel migrado para Python. As páginas operacionais entram nas próximas fases.",
                color_scheme="gray",
            ),
            rx.hstack(
                _stat("building-2", "Seu cargo", AuthState.role_label),
                _stat("scan-eye", "Escopo", AuthState.base_scope),
                _stat("circle-check-big", "Status", "Ativo"),
                spacing="4",
                width="100%",
                margin_top="4",
            ),
            spacing="3",
            width="100%",
        ),
    )


def _placeholder(title: str, descricao: str) -> rx.Component:
    return layout(
        title,
        rx.center(
            rx.vstack(
                rx.icon("hammer", size=40, color=rx.color("gray", 8)),
                rx.heading(title, size="6"),
                rx.text(descricao, color_scheme="gray", text_align="center"),
                rx.badge("Em construção", color_scheme="amber", variant="surface"),
                spacing="3",
                align="center",
            ),
            min_height="60vh",
            width="100%",
        ),
    )


def hoje_page() -> rx.Component:
    return _placeholder("SLA & DS Hoje", "Importação de CSV/XLSX e cálculo ao vivo (Fase 3).")


def historico_page() -> rx.Component:
    return _placeholder("Histórico", "Timeline de snapshots por base (Fase 6).")


def motoristas_page() -> rx.Component:
    return _placeholder("Motoristas", "Desempenho por motorista (Fase 6).")


def sla_ds_page() -> rx.Component:
    return _placeholder("SLA & DS", "Histórico agregado e comparativos (Fase 7).")


def liberacao_page() -> rx.Component:
    return _placeholder("Liberação", "Liberação de pagamento OK/NOK (Fase 7).")


def admin_page() -> rx.Component:
    return _placeholder("Administração", "Usuários, bases e permissões (Fase 8).")
