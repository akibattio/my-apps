"""Entry point for the desktop GUI."""
from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from .config import Config
from .gui.main_window import MainWindow


def main() -> int:
    Config.ensure_dirs()
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
