# Importa todos os models para que o Alembic (reflex db) os detecte.
# A ordem segue as dependências de FK.
from .operacao import Operacao, Base  # noqa: F401
from .user import AppUser, UserBase  # noqa: F401
from .driver import Driver  # noqa: F401
from .upload import Upload, Package  # noqa: F401
from .snapshot import Snapshot, SnapshotDriver  # noqa: F401
from .sla_ds import SlaDsRecord  # noqa: F401
from .liberacao import Liberacao  # noqa: F401
from .cep import CepCache  # noqa: F401
