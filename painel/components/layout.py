"""Shell da aplicação: sidebar (estilo shadcn, filtrada por permissão) + topbar."""

import reflex as rx

from painel.auth.state import AuthState
from painel.components.theme import C, alpha


def _nav_link(label: str, icon: str, route: str, visible) -> rx.Component:
    active = AuthState.router.page.path == route
    return rx.cond(
        visible,
        rx.link(
            rx.hstack(
                rx.icon(icon, size=18, flex_shrink="0"),
                rx.text(label, size="2", weight="medium"),
                spacing="3",
                align="center",
                width="100%",
                padding_x="3",
                padding_y="2",
                border_radius="10px",
                color=rx.cond(active, C.fg, C.muted),
                background=rx.cond(active, C.elevated, "transparent"),
                box_shadow=rx.cond(active, f"inset 0 0 0 1px {C.border}", "none"),
                _hover={"background": rx.cond(active, C.elevated, C.card_hover), "color": C.fg},
                transition="all 0.15s ease",
            ),
            href=route,
            width="100%",
            text_decoration="none",
            _hover={"text_decoration": "none"},
        ),
        rx.fragment(),
    )


def _group_label(text: str) -> rx.Component:
    return rx.text(
        text,
        size="1",
        weight="bold",
        color=C.subtle,
        letter_spacing="0.06em",
        padding_x="3",
        padding_top="3",
        padding_bottom="1",
        style={"textTransform": "uppercase"},
    )


def _sidebar() -> rx.Component:
    return rx.vstack(
        # Marca — mesma altura do topbar (72px) p/ alinhar o divisor
        rx.hstack(
            rx.image(src="/logo.png", height="34px", width="auto"),
            rx.text("Painel de Entregas", size="3", weight="bold", no_of_lines=1),
            spacing="3",
            align="center",
            width="100%",
            height="72px",
            padding_x="4",
            flex_shrink="0",
            border_bottom=f"1px solid {C.border_soft}",
        ),
        # Navegação
        rx.vstack(
            _group_label("Plataforma"),
            _nav_link("Início", "layout-dashboard", "/home", True),
            _nav_link("SLA & DS Hoje", "calendar-clock", "/hoje", AuthState.can_hoje),
            _nav_link("Histórico", "history", "/historico", AuthState.can_historico),
            _nav_link("Motoristas", "truck", "/motoristas", AuthState.can_motoristas),
            _nav_link("SLA & DS", "chart-spline", "/sla-ds", AuthState.can_sla_ds),
            _nav_link("Liberação", "circle-check-big", "/liberacao", AuthState.can_liberacao),
            rx.cond(
                AuthState.can_admin,
                rx.fragment(
                    _group_label("Gestão"),
                    _nav_link("Administração", "shield", "/admin", AuthState.can_admin),
                ),
            ),
            spacing="1",
            width="100%",
            align="start",
            padding="3",
        ),
        rx.spacer(),
        # Usuário (card sólido)
        rx.box(
            rx.hstack(
                rx.avatar(fallback=AuthState.initials, size="2", radius="full",
                          variant="solid", color_scheme="indigo"),
                rx.vstack(
                    rx.text(AuthState.empresa, size="2", weight="medium", no_of_lines=1),
                    rx.text(AuthState.role_label, size="1", color=C.subtle, no_of_lines=1),
                    spacing="0",
                    align="start",
                    flex="1",
                    min_width="0",
                ),
                rx.tooltip(
                    rx.icon_button(
                        rx.icon("log-out", size=16),
                        on_click=AuthState.logout,
                        variant="ghost",
                        color_scheme="gray",
                        cursor="pointer",
                    ),
                    content="Sair",
                ),
                spacing="2",
                align="center",
                width="100%",
                padding="2",
                border_radius="12px",
                background=C.elevated,
                border=f"1px solid {C.border}",
            ),
            width="100%",
            padding="3",
        ),
        height="100vh",
        width="256px",
        flex_shrink="0",
        padding="0",
        spacing="0",
        background=C.sidebar,
        border_right=f"1px solid {C.border_soft}",
        position="sticky",
        top="0",
        align="start",
    )


def _topbar(title: str) -> rx.Component:
    return rx.hstack(
        rx.heading(title, size="5", weight="bold"),
        rx.spacer(),
        rx.color_mode.button(),
        align="center",
        width="100%",
        height="72px",
        padding_x="6",
        background=alpha(C.bg, 0.8),
        border_bottom=f"1px solid {C.border_soft}",
        position="sticky",
        top="0",
        z_index="10",
        style={"backdropFilter": "blur(8px)"},
    )


def layout(title: str, *content: rx.Component) -> rx.Component:
    return rx.hstack(
        _sidebar(),
        rx.box(
            _topbar(title),
            rx.box(*content, padding="6", width="100%", max_width="1400px", margin="0 auto"),
            flex="1",
            min_width="0",
            min_height="100vh",
            background=C.bg,
        ),
        spacing="0",
        align="start",
        width="100%",
        background=C.bg,
    )
