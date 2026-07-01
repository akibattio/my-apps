"""Preview pane for the composed banner."""
from __future__ import annotations

from PIL import Image
from PySide6.QtCore import Qt
from PySide6.QtGui import QImage, QPixmap
from PySide6.QtWidgets import QLabel, QSizePolicy


def pil_to_qpixmap(img: Image.Image) -> QPixmap:
    rgba = img.convert("RGBA")
    data = rgba.tobytes("raw", "RGBA")
    qimg = QImage(data, rgba.width, rgba.height, QImage.Format.Format_RGBA8888).copy()
    return QPixmap.fromImage(qimg)


class PreviewLabel(QLabel):
    def __init__(self) -> None:
        super().__init__()
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setMinimumSize(320, 320)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        self.setStyleSheet("background-color: #1a1a1a; color: #888; border: 1px solid #333;")
        self.setText("プレビューはここに表示されます")
        self._pixmap: QPixmap | None = None

    def set_pil_image(self, img: Image.Image | None) -> None:
        if img is None:
            self._pixmap = None
            self.setText("プレビューはここに表示されます")
            return
        self._pixmap = pil_to_qpixmap(img)
        self._rescale()

    def resizeEvent(self, event) -> None:  # noqa: N802
        super().resizeEvent(event)
        self._rescale()

    def _rescale(self) -> None:
        if self._pixmap is None:
            return
        scaled = self._pixmap.scaled(
            self.size(),
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )
        self.setPixmap(scaled)
