"""Estado de autenticação — sessão por conexão + gate de páginas.

O token fica em LocalStorage (sobrevive a refresh). Os dados de perfil
(role, escopo, permissões) são re-hidratados do banco a cada login/refresh.
"""

import reflex as rx
from sqlmodel import select

from painel.models.user import AppUser
from painel.shared.perms import LANDING_PAGE, PERMS, has_perm

from . import supabase_auth


class AuthState(rx.State):
    # Persistido no browser
    auth_token: str = rx.LocalStorage("")

    # Sessão (re-hidratada do banco)
    user_id: str = ""
    email: str = ""
    empresa: str = ""
    role: str = ""
    is_admin: bool = False
    base_scope: str = ""
    extra_perms: list[str] = []
    denied_perms: list[str] = []

    # UI
    error: str = ""
    loading: bool = False

    # ---- computed ---------------------------------------------------------
    @rx.var
    def is_authed(self) -> bool:
        return self.user_id != ""

    @rx.var
    def role_label(self) -> str:
        return self.role.replace("_", " ").title()

    @rx.var
    def initials(self) -> str:
        parts = (self.empresa or self.email).split()
        return "".join(p[0] for p in parts[:2]).upper() or "?"

    def _can(self, perm: str) -> bool:
        return has_perm(self.role, self.extra_perms, self.denied_perms, perm)

    @rx.var
    def can_hoje(self) -> bool:
        return self._can(PERMS.VIEW_HOJE)

    @rx.var
    def can_historico(self) -> bool:
        return self._can(PERMS.VIEW_HISTORICO)

    @rx.var
    def can_motoristas(self) -> bool:
        return self._can(PERMS.VIEW_MOTORISTAS)

    @rx.var
    def can_sla_ds(self) -> bool:
        return self._can(PERMS.VIEW_SLA_DS)

    @rx.var
    def can_liberacao(self) -> bool:
        return self._can(PERMS.VIEW_LIBERACAO)

    @rx.var
    def can_admin(self) -> bool:
        return self.is_admin or self._can(PERMS.MANAGE_USERS)

    # ---- helpers ----------------------------------------------------------
    def _load_app_user(self, uid: str) -> bool:
        with rx.session() as session:
            u = session.exec(select(AppUser).where(AppUser.id == uid)).first()
            if not u:
                return False
            self.user_id = u.id
            self.email = u.email
            self.empresa = u.empresa or ""
            self.role = u.role
            self.is_admin = u.is_admin
            self.base_scope = u.base_scope
            self.extra_perms = list(u.extra_perms or [])
            self.denied_perms = list(u.denied_perms or [])
            return True

    def _reset(self):
        self.user_id = ""
        self.email = ""
        self.empresa = ""
        self.role = ""
        self.is_admin = False
        self.base_scope = ""
        self.extra_perms = []
        self.denied_perms = []

    # ---- event handlers ---------------------------------------------------
    def login(self, form_data: dict):
        self.error = ""
        self.loading = True
        yield
        email = (form_data.get("email") or "").strip()
        password = form_data.get("password") or ""
        if not email or not password:
            self.error = "Preencha e-mail e senha."
            self.loading = False
            return
        try:
            data = supabase_auth.sign_in(email, password)
        except Exception:
            self.error = "E-mail ou senha inválidos."
            self.loading = False
            return
        token = data.get("access_token")
        user = data.get("user") or {}
        if not token or not user.get("id"):
            self.error = "Falha na autenticação."
            self.loading = False
            return
        if not self._load_app_user(user["id"]):
            self.error = "Usuário autenticado, mas sem perfil no sistema."
            self.loading = False
            return
        self.auth_token = token
        self.loading = False
        return rx.redirect(LANDING_PAGE.get(self.role, "/home"))

    def logout(self):
        if self.auth_token:
            supabase_auth.sign_out(self.auth_token)
        self.auth_token = ""
        self._reset()
        return rx.redirect("/login")

    def check_auth(self):
        """on_load das páginas protegidas: garante sessão válida."""
        if self.user_id:
            return
        if self.auth_token:
            user = supabase_auth.get_user(self.auth_token)
            if user and user.get("id") and self._load_app_user(user["id"]):
                return
            self.auth_token = ""  # token morto
        return rx.redirect("/login")

    def redirect_if_authed(self):
        """on_load da página de login: se já logado, manda pro destino."""
        if self.user_id:
            return rx.redirect(LANDING_PAGE.get(self.role, "/home"))
        if self.auth_token:
            user = supabase_auth.get_user(self.auth_token)
            if user and user.get("id") and self._load_app_user(user["id"]):
                return rx.redirect(LANDING_PAGE.get(self.role, "/home"))
