"""Home = dashboard estilo shadcn (template). Dados reais entram nas Fases 3-7.

Placeholders das páginas ainda não construídas usam o mesmo shell.
"""

import reflex as rx

from painel.auth.state import AuthState
from painel.components.layout import layout
from painel.components.theme import C, alpha, card, trend_badge

# --- dados de amostra (substituídos por dados reais nas próximas fases) ------
_SERIE = [
    {"dia": "Seg", "sla": 91, "ds": 86},
    {"dia": "Ter", "sla": 93, "ds": 88},
    {"dia": "Qua", "sla": 90, "ds": 84},
    {"dia": "Qui", "sla": 95, "ds": 90},
    {"dia": "Sex", "sla": 94, "ds": 89},
    {"dia": "Sáb", "sla": 96, "ds": 92},
    {"dia": "Dom", "sla": 92, "ds": 87},
]

_TABELA = [
    ("XPT-ADR-02", "07/06/2026", "94,2%", "89,7%", "ok"),
    ("XPT-SQR-01", "07/06/2026", "91,8%", "85,1%", "ok"),
    ("XPT-LRS-01", "07/06/2026", "88,4%", "82,0%", "alerta"),
    ("XPT-CTN-01", "07/06/2026", "96,1%", "93,3%", "ok"),
    ("XPT-NVC-01", "07/06/2026", "79,5%", "74,2%", "critico"),
]


def _kpi(icon: str, label: str, value: str, color: str, delta: str, positive: bool) -> rx.Component:
    return card(
        rx.vstack(
            rx.hstack(
                rx.box(
                    rx.icon(icon, size=20, color=color),
                    padding="10px",
                    background=alpha(color, 0.12),
                    border_radius="12px",
                ),
                rx.spacer(),
                trend_badge(delta, positive),
                width="100%",
                align="center",
            ),
            rx.vstack(
                rx.heading(value, size="7", weight="bold"),
                rx.text(label, size="2", color=C.muted),
                spacing="1",
                align="start",
            ),
            spacing="4",
            align="start",
            width="100%",
        ),
        padding="20px",
    )


def _chart() -> rx.Component:
    return card(
        rx.vstack(
            rx.hstack(
                rx.vstack(
                    rx.heading("Desempenho semanal", size="4"),
                    rx.text("SLA e DS dos últimos 7 dias", size="2", color=C.muted),
                    spacing="1",
                    align="start",
                ),
                rx.spacer(),
                rx.hstack(
                    rx.hstack(rx.box(width="10px", height="10px", border_radius="3px",
                                     background=C.indigo), rx.text("SLA", size="1", color=C.muted),
                              spacing="2", align="center"),
                    rx.hstack(rx.box(width="10px", height="10px", border_radius="3px",
                                     background=C.pink), rx.text("DS", size="1", color=C.muted),
                              spacing="2", align="center"),
                    spacing="4",
                ),
                width="100%",
                align="center",
            ),
            rx.recharts.area_chart(
                rx.recharts.area(data_key="sla", stroke=C.indigo, fill=C.indigo,
                                 fill_opacity=0.18, stroke_width=2, type_="natural"),
                rx.recharts.area(data_key="ds", stroke=C.pink, fill=C.pink,
                                 fill_opacity=0.18, stroke_width=2, type_="natural"),
                rx.recharts.x_axis(data_key="dia", axis_line=False, tick_line=False,
                                   custom_attrs={"fontSize": "12px"}),
                rx.recharts.y_axis(domain=[60, 100], axis_line=False, tick_line=False,
                                   custom_attrs={"fontSize": "12px"}),
                rx.recharts.cartesian_grid(stroke_dasharray="3 3", vertical=False,
                                           stroke=C.border_soft),
                rx.recharts.graphing_tooltip(),
                data=_SERIE,
                height=300,
                width="100%",
            ),
            spacing="4",
            width="100%",
        ),
    )


def _status_badge(status: str) -> rx.Component:
    cor = rx.match(
        status,
        ("ok", C.emerald),
        ("alerta", C.amber),
        ("critico", C.rose),
        C.muted,
    )
    texto = rx.match(
        status,
        ("ok", "No alvo"),
        ("alerta", "Atenção"),
        ("critico", "Crítico"),
        status,
    )
    return rx.badge(texto, color=cor, background=alpha("#ffffff", 0.0),
                    style={"backgroundColor": "transparent", "border": f"1px solid {cor}40",
                           "color": cor}, variant="surface")


def _row(base: str, data: str, sla: str, ds: str, status: str) -> rx.Component:
    return rx.table.row(
        rx.table.cell(rx.text(base, weight="medium")),
        rx.table.cell(rx.text(data, color=C.muted)),
        rx.table.cell(rx.text(sla)),
        rx.table.cell(rx.text(ds)),
        rx.table.cell(_status_badge(status)),
        style={"_hover": {"background": C.card_hover}},
    )


def _tabela() -> rx.Component:
    return card(
        rx.vstack(
            rx.heading("Últimos registros", size="4"),
            rx.text("Snapshots mais recentes por base", size="2", color=C.muted),
            rx.table.root(
                rx.table.header(
                    rx.table.row(
                        rx.table.column_header_cell("Base"),
                        rx.table.column_header_cell("Data"),
                        rx.table.column_header_cell("SLA"),
                        rx.table.column_header_cell("DS"),
                        rx.table.column_header_cell("Status"),
                    ),
                ),
                rx.table.body(
                    *[_row(*r) for r in _TABELA],
                ),
                variant="ghost",
                size="2",
                width="100%",
            ),
            spacing="3",
            width="100%",
            align="start",
        ),
    )


def home_page() -> rx.Component:
    return layout(
        "Início",
        rx.vstack(
            rx.vstack(
                rx.heading(
                    rx.text.span("Bem-vindo, "),
                    rx.text.span(AuthState.empresa, color=C.primary),
                    size="6",
                ),
                rx.text("Visão geral da operação.", color=C.muted, size="2"),
                spacing="1",
                align="start",
                margin_bottom="2",
            ),
            rx.box(
                _kpi("gauge", "SLA Médio", "94,2%", C.indigo, "+2,1%", True),
                _kpi("truck", "DS Médio", "89,7%", C.sky, "+1,4%", True),
                _kpi("package", "Pacotes hoje", "1.284", C.violet, "+8,0%", True),
                _kpi("triangle-alert", "Ocorrências", "32", C.amber, "-5,0%", False),
                display="grid",
                grid_template_columns="repeat(auto-fit, minmax(220px, 1fr))",
                gap="16px",
                width="100%",
            ),
            _chart(),
            _tabela(),
            spacing="5",
            width="100%",
        ),
    )


def _placeholder(title: str, descricao: str) -> rx.Component:
    return layout(
        title,
        rx.center(
            card(
                rx.vstack(
                    rx.box(
                        rx.icon("hammer", size=28, color=C.primary),
                        padding="16px",
                        background=alpha(C.primary, 0.12),
                        border_radius="16px",
                    ),
                    rx.heading(title, size="6"),
                    rx.text(descricao, color=C.muted, text_align="center"),
                    rx.badge("Em construção", color_scheme="amber", variant="surface"),
                    spacing="3",
                    align="center",
                ),
                max_width="440px",
                padding="40px",
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
