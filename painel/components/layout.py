"""Shell da aplicação: sidebar (filtrada por permissão) + topbar + conteúdo."""

import reflex as rx

from painel.auth.state import AuthState


def _link(label: str, icon: str, route: str, visible) -> rx.Component:
    active = AuthState.router.page.path == route
    return rx.cond(
        visible,
        rx.link(
            rx.hstack(
                rx.icon(icon, size=18),
                rx.text(label, size="3", weight="medium"),
                spacing="3",
                align="center",
                width="100%",
                padding_x="3",
                padding_y="2",
                border_radius="large",
                color=rx.cond(active, rx.color("iris", 11), rx.color("gray", 11)),
                background=rx.cond(active, rx.color("iris", 4), "transparent"),
                _hover={"background": rx.color("iris", 3), "color": rx.color("iris", 11)},
                transition="all 0.15s ease",
            ),
            href=route,
            width="100%",
            text_decoration="none",
            _hover={"text_decoration": "none"},
        ),
        rx.fragment(),
    )


def _sidebar() -> rx.Component:
    return rx.vstack(
        # Marca
        rx.hstack(
            rx.image(src="/logo.png", height="32px", width="auto"),
            rx.text("Painel de Entregas", weight="bold", size="3"),
            spacing="3",
            align="center",
            padding_x="2",
            padding_y="4",
        ),
        rx.divider(),
        # Navegação
        rx.vstack(
            _link("Início", "house", "/home", True),
            _link("SLA & DS Hoje", "calendar-clock", "/hoje", AuthState.can_hoje),
            _link("Histórico", "history", "/historico", AuthState.can_historico),
            _link("Motoristas", "truck", "/motoristas", AuthState.can_motoristas),
            _link("SLA & DS", "chart-line", "/sla-ds", AuthState.can_sla_ds),
            _link("Liberação", "circle-check-big", "/liberacao", AuthState.can_liberacao),
            _link("Administração", "shield", "/admin", AuthState.can_admin),
            spacing="1",
            width="100%",
        ),
        rx.spacer(),
        rx.divider(),
        # Usuário + logout
        rx.hstack(
            rx.avatar(fallback=AuthState.initials, size="2", color_scheme="iris"),
            rx.vstack(
                rx.text(AuthState.empresa, size="2", weight="medium", no_of_lines=1),
                rx.text(AuthState.role_label, size="1", color_scheme="gray", no_of_lines=1),
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
                ),
                content="Sair",
            ),
            spacing="2",
            align="center",
            width="100%",
            padding="2",
        ),
        height="100vh",
        width="260px",
        padding="3",
        spacing="2",
        background=rx.color("gray", 2),
        border_right=f"1px solid {rx.color('gray', 4)}",
        position="sticky",
        top="0",
    )


def _topbar(title: str) -> rx.Component:
    return rx.hstack(
        rx.heading(title, size="5", weight="bold"),
        rx.spacer(),
        rx.color_mode.button(),
        align="center",
        width="100%",
        height="64px",
        padding_x="6",
        border_bottom=f"1px solid {rx.color('gray', 4)}",
    )


def layout(title: str, *content: rx.Component) -> rx.Component:
    """Envolve o conteúdo de uma página protegida no shell padrão."""
    return rx.hstack(
        _sidebar(),
        rx.box(
            _topbar(title),
            rx.box(*content, padding="6", width="100%"),
            flex="1",
            min_height="100vh",
            background=rx.color("gray", 1),
        ),
        spacing="0",
        align="start",
        width="100%",
    )
