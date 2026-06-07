import reflex as rx

from painel.auth.state import AuthState
from painel.components.theme import C, alpha


def login_page() -> rx.Component:
    return rx.center(
        rx.box(
            rx.vstack(
                rx.image(src="/logo.png", height="52px", width="auto"),
                rx.vstack(
                    rx.heading("Painel de Entregas", size="6", weight="bold"),
                    rx.text("Entre com suas credenciais", color=C.muted, size="2"),
                    spacing="1",
                    align="center",
                ),
                rx.form(
                    rx.vstack(
                        rx.input(
                            rx.input.slot(rx.icon("mail", size=16, color=C.subtle)),
                            name="email",
                            placeholder="seu@email.com",
                            type="email",
                            size="3",
                            width="100%",
                            required=True,
                        ),
                        rx.input(
                            rx.input.slot(rx.icon("lock", size=16, color=C.subtle)),
                            name="password",
                            placeholder="Senha",
                            type="password",
                            size="3",
                            width="100%",
                            required=True,
                        ),
                        rx.cond(
                            AuthState.error != "",
                            rx.callout(
                                AuthState.error,
                                icon="triangle_alert",
                                color_scheme="red",
                                size="1",
                                width="100%",
                            ),
                        ),
                        rx.button(
                            "Entrar",
                            type="submit",
                            size="3",
                            width="100%",
                            loading=AuthState.loading,
                            cursor="pointer",
                        ),
                        spacing="3",
                        width="100%",
                    ),
                    on_submit=AuthState.login,
                    width="100%",
                ),
                spacing="5",
                align="center",
                width="100%",
            ),
            width="400px",
            max_width="92vw",
            padding="40px",
            background=C.card,
            border=f"1px solid {C.border_soft}",
            border_radius="18px",
            box_shadow=f"0 24px 60px {alpha('#000000', 0.5)}",
        ),
        height="100vh",
        width="100%",
        background=(
            f"radial-gradient(ellipse 80% 60% at 50% -10%, {alpha(C.primary, 0.18)}, "
            f"{C.bg} 60%)"
        ),
    )
