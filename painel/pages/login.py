import reflex as rx

from painel.auth.state import AuthState


def login_page() -> rx.Component:
    return rx.center(
        rx.card(
            rx.vstack(
                rx.image(src="/logo.png", height="48px", width="auto"),
                rx.vstack(
                    rx.heading("Painel de Entregas", size="6"),
                    rx.text("Entre com suas credenciais", color_scheme="gray", size="2"),
                    spacing="1",
                    align="center",
                ),
                rx.form(
                    rx.vstack(
                        rx.input(
                            rx.input.slot(rx.icon("mail", size=16)),
                            name="email",
                            placeholder="E-mail",
                            type="email",
                            size="3",
                            width="100%",
                            required=True,
                        ),
                        rx.input(
                            rx.input.slot(rx.icon("lock", size=16)),
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
            width="380px",
            max_width="90vw",
            padding="6",
        ),
        height="100vh",
        background=rx.color("gray", 1),
    )
