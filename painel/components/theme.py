"""Design system — tokens e helpers.

Estética: dark neutro estilo shadcn/ui + paleta multicolorida vibrante.
Accent primário índigo/violeta. Cada KPI/série de dado tem sua própria cor.
Tudo centralizado aqui para máxima customização (mudar a marca = mudar aqui).
"""

import reflex as rx

FONT = "Inter, ui-sans-serif, system-ui, sans-serif"
GOOGLE_FONTS = (
    "https://fonts.googleapis.com/css2?"
    "family=Inter:wght@400;500;600;700;800&display=swap"
)


class C:
    # superfícies (do mais fundo ao mais alto)
    bg          = "#0a0a0c"
    sidebar     = "#0c0c0f"
    card        = "#141417"
    card_hover  = "#1a1a1e"
    elevated    = "#1c1c21"

    # bordas
    border      = "#26262b"
    border_soft = "#1c1c21"

    # texto
    fg          = "#fafafa"
    muted       = "#a1a1aa"
    subtle      = "#71717a"

    # accent primário
    primary       = "#6366f1"
    primary_hover = "#7c7ff5"

    # paleta multicolor (KPIs, gráficos, categorias, badges)
    indigo  = "#6366f1"
    violet  = "#8b5cf6"
    sky     = "#0ea5e9"
    cyan    = "#06b6d4"
    pink    = "#ec4899"
    amber   = "#f59e0b"
    orange  = "#f97316"
    emerald = "#10b981"
    rose    = "#f43f5e"
    teal    = "#14b8a6"

    # semânticos
    pos = "#10b981"   # delta positivo
    neg = "#f43f5e"   # delta negativo


def alpha(hex_color: str, a: float) -> str:
    """Converte #rrggbb + alpha em rgba()."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r}, {g}, {b}, {a})"


def card(*children, **props) -> rx.Component:
    """Card padrão (shadcn): superfície + borda sutil + cantos arredondados."""
    style = dict(
        background=C.card,
        border=f"1px solid {C.border_soft}",
        border_radius="14px",
        padding="20px",
        width="100%",
    )
    style.update(props)
    return rx.box(*children, **style)


def section_title(text: str) -> rx.Component:
    return rx.text(
        text,
        size="1",
        weight="bold",
        letter_spacing="0.06em",
        text_transform="uppercase",
        color=C.subtle,
        padding_x="3",
        margin_top="2",
        margin_bottom="1",
    )


def trend_badge(value: str, positive: bool = True) -> rx.Component:
    color = C.pos if positive else C.neg
    return rx.hstack(
        rx.icon("trending-up" if positive else "trending-down", size=13),
        rx.text(value, size="1", weight="bold"),
        spacing="1",
        align="center",
        color=color,
        background=alpha(color, 0.12),
        padding_x="2",
        padding_y="1",
        border_radius="999px",
    )
