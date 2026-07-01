"""Main application window."""
from __future__ import annotations

from pathlib import Path

from PIL import Image
from PySide6.QtCore import QObject, Qt, QThread, Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QScrollArea,
    QSplitter,
    QStatusBar,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from ..config import Config
from ..core.ai_client import GenerationResult, generate_both
from ..core.exporter import export_all, export_banner
from ..core.renderer import render
from ..core.template import (
    Template,
    list_templates,
    load_template,
    substitute_variables,
)
from .preview_panel import PreviewLabel, pil_to_qpixmap


class _AIWorker(QObject):
    finished = Signal(object, object)  # (openai_result, gemini_result)

    def __init__(self, prompt: str, width: int, height: int) -> None:
        super().__init__()
        self._prompt = prompt
        self._w = width
        self._h = height

    def run(self) -> None:
        openai_res, gemini_res = generate_both(self._prompt, self._w, self._h)
        self.finished.emit(openai_res, gemini_res)


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Banner Creator — OpenAI × Gemini")
        self.resize(1400, 900)

        self._templates: dict[str, Path] = {p.stem: p for p in list_templates()}
        self._current_template: Template | None = None
        self._var_inputs: dict[str, QLineEdit] = {}
        self._background: Image.Image | None = None
        self._candidate_openai: Image.Image | None = None
        self._candidate_gemini: Image.Image | None = None
        self._ai_thread: QThread | None = None

        self._build_ui()
        if self._templates:
            self.template_combo.setCurrentIndex(0)
            self._on_template_changed(self.template_combo.currentText())

    # ------- UI construction -------
    def _build_ui(self) -> None:
        central = QSplitter(Qt.Orientation.Horizontal)
        central.addWidget(self._build_left_pane())
        central.addWidget(self._build_center_pane())
        central.addWidget(self._build_right_pane())
        central.setStretchFactor(0, 0)
        central.setStretchFactor(1, 1)
        central.setStretchFactor(2, 0)
        central.setSizes([360, 700, 340])
        self.setCentralWidget(central)
        self.setStatusBar(QStatusBar())
        self._update_status()

    def _build_left_pane(self) -> QWidget:
        wrap = QWidget()
        layout = QVBoxLayout(wrap)

        # template selector
        tpl_group = QGroupBox("テンプレート")
        tpl_layout = QVBoxLayout(tpl_group)
        self.template_combo = QComboBox()
        for name in self._templates:
            self.template_combo.addItem(name)
        self.template_combo.currentTextChanged.connect(self._on_template_changed)
        tpl_layout.addWidget(self.template_combo)
        layout.addWidget(tpl_group)

        # variables form
        self.var_group = QGroupBox("変数")
        self.var_form = QFormLayout(self.var_group)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.var_group)
        layout.addWidget(scroll, 1)

        # actions
        self.render_btn = QPushButton("再描画")
        self.render_btn.clicked.connect(self._render_preview)
        layout.addWidget(self.render_btn)

        self.generate_btn = QPushButton("AI背景を両方同時生成")
        self.generate_btn.clicked.connect(self._on_generate_clicked)
        layout.addWidget(self.generate_btn)

        load_bg_btn = QPushButton("背景画像を読み込み...")
        load_bg_btn.clicked.connect(self._load_background_from_file)
        layout.addWidget(load_bg_btn)

        clear_bg_btn = QPushButton("背景をクリア")
        clear_bg_btn.clicked.connect(self._clear_background)
        layout.addWidget(clear_bg_btn)

        return wrap

    def _build_center_pane(self) -> QWidget:
        wrap = QWidget()
        layout = QVBoxLayout(wrap)
        layout.addWidget(QLabel("プレビュー"))
        self.preview = PreviewLabel()
        layout.addWidget(self.preview, 1)

        actions = QHBoxLayout()
        self.export_one_btn = QPushButton("このサイズで保存")
        self.export_one_btn.clicked.connect(self._export_current)
        actions.addWidget(self.export_one_btn)
        self.export_all_btn = QPushButton("全テンプレートで一括書き出し")
        self.export_all_btn.clicked.connect(self._export_all_sizes)
        actions.addWidget(self.export_all_btn)
        layout.addLayout(actions)
        return wrap

    def _build_right_pane(self) -> QWidget:
        wrap = QWidget()
        layout = QVBoxLayout(wrap)
        layout.addWidget(QLabel("AI背景候補"))

        oa_group = QGroupBox("OpenAI (gpt-image-1)")
        oa_layout = QVBoxLayout(oa_group)
        self.openai_preview = PreviewLabel()
        self.openai_preview.setMinimumHeight(220)
        oa_layout.addWidget(self.openai_preview)
        self.use_openai_btn = QPushButton("これを使う")
        self.use_openai_btn.clicked.connect(lambda: self._use_candidate("openai"))
        self.use_openai_btn.setEnabled(False)
        oa_layout.addWidget(self.use_openai_btn)
        layout.addWidget(oa_group)

        gm_group = QGroupBox("Gemini (Nano Banana)")
        gm_layout = QVBoxLayout(gm_group)
        self.gemini_preview = PreviewLabel()
        self.gemini_preview.setMinimumHeight(220)
        gm_layout.addWidget(self.gemini_preview)
        self.use_gemini_btn = QPushButton("これを使う")
        self.use_gemini_btn.clicked.connect(lambda: self._use_candidate("gemini"))
        self.use_gemini_btn.setEnabled(False)
        gm_layout.addWidget(self.use_gemini_btn)
        layout.addWidget(gm_group)

        layout.addWidget(QLabel("AI生成ログ"))
        self.log = QTextEdit()
        self.log.setReadOnly(True)
        self.log.setMaximumHeight(140)
        layout.addWidget(self.log)
        return wrap

    # ------- template handling -------
    def _on_template_changed(self, name: str) -> None:
        path = self._templates.get(name)
        if not path:
            return
        self._current_template = load_template(path)
        self._rebuild_variable_form()
        self._render_preview()

    def _rebuild_variable_form(self) -> None:
        # clear current
        while self.var_form.rowCount():
            self.var_form.removeRow(0)
        self._var_inputs.clear()
        if not self._current_template:
            return
        for var in self._current_template.variables:
            edit = QLineEdit()
            edit.textChanged.connect(self._render_preview)
            self.var_form.addRow(var, edit)
            self._var_inputs[var] = edit

    def _current_values(self) -> dict[str, str]:
        return {k: v.text() for k, v in self._var_inputs.items()}

    # ------- rendering -------
    def _render_preview(self) -> None:
        if not self._current_template:
            return
        try:
            bound = substitute_variables(self._current_template, self._current_values())
            img = render(bound, background_image=self._background)
            self.preview.set_pil_image(img)
        except Exception as exc:  # noqa: BLE001
            self.statusBar().showMessage(f"描画エラー: {exc}", 5000)

    # ------- AI -------
    def _on_generate_clicked(self) -> None:
        if not self._current_template:
            return
        if not Config.openai_available() and not Config.vertex_available():
            QMessageBox.warning(
                self,
                "APIキー未設定",
                "OpenAI と Vertex AI のどちらも設定されていません。.env を確認してください。",
            )
            return
        bound = substitute_variables(self._current_template, self._current_values())
        prompt = (bound.background.prompt or "").strip()
        if not prompt:
            QMessageBox.warning(self, "プロンプトが空", "テンプレートに background.prompt を設定してください。")
            return
        self.log.append(f"▶ 生成開始: {prompt[:120]}")
        self.generate_btn.setEnabled(False)
        self.statusBar().showMessage("AIで背景を生成中...")

        self._ai_thread = QThread()
        worker = _AIWorker(prompt, self._current_template.size.width, self._current_template.size.height)
        worker.moveToThread(self._ai_thread)
        self._ai_thread.started.connect(worker.run)
        worker.finished.connect(self._on_ai_finished)
        worker.finished.connect(self._ai_thread.quit)
        worker.finished.connect(worker.deleteLater)
        self._ai_thread.finished.connect(self._ai_thread.deleteLater)
        # keep worker alive until thread ends
        self._ai_worker = worker
        self._ai_thread.start()

    def _on_ai_finished(self, openai_res: GenerationResult, gemini_res: GenerationResult) -> None:
        self.generate_btn.setEnabled(True)
        self.statusBar().showMessage("生成完了", 3000)

        if openai_res.error:
            self.log.append(f"✗ OpenAI: {openai_res.error}")
            self.openai_preview.set_pil_image(None)
            self._candidate_openai = None
            self.use_openai_btn.setEnabled(False)
        else:
            self._candidate_openai = openai_res.image
            self.openai_preview.set_pil_image(openai_res.image)
            self.use_openai_btn.setEnabled(True)
            self.log.append("✓ OpenAI 生成成功")

        if gemini_res.error:
            self.log.append(f"✗ Gemini: {gemini_res.error}")
            self.gemini_preview.set_pil_image(None)
            self._candidate_gemini = None
            self.use_gemini_btn.setEnabled(False)
        else:
            self._candidate_gemini = gemini_res.image
            self.gemini_preview.set_pil_image(gemini_res.image)
            self.use_gemini_btn.setEnabled(True)
            self.log.append("✓ Gemini 生成成功")

    def _use_candidate(self, provider: str) -> None:
        img = self._candidate_openai if provider == "openai" else self._candidate_gemini
        if img is None:
            return
        self._background = img
        self.log.append(f"→ {provider} の画像をバナーに適用")
        self._render_preview()

    # ------- background utilities -------
    def _load_background_from_file(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "背景画像を選択", "", "Images (*.png *.jpg *.jpeg *.webp)"
        )
        if not path:
            return
        self._background = Image.open(path).convert("RGBA")
        self._render_preview()
        self.log.append(f"→ ローカル画像を適用: {Path(path).name}")

    def _clear_background(self) -> None:
        self._background = None
        self._render_preview()

    # ------- export -------
    def _export_current(self) -> None:
        if not self._current_template:
            return
        try:
            path = export_banner(self._current_template, self._current_values(), self._background)
            self.statusBar().showMessage(f"保存: {path}", 5000)
        except Exception as exc:  # noqa: BLE001
            QMessageBox.critical(self, "保存失敗", str(exc))

    def _export_all_sizes(self) -> None:
        paths = list(self._templates.values())
        if not paths:
            return
        try:
            results = export_all(paths, self._current_values(), self._background)
            self.statusBar().showMessage(f"{len(results)} ファイルを書き出しました", 5000)
            QMessageBox.information(
                self, "完了", "保存先:\n" + "\n".join(str(p) for p in results)
            )
        except Exception as exc:  # noqa: BLE001
            QMessageBox.critical(self, "保存失敗", str(exc))

    # ------- misc -------
    def _update_status(self) -> None:
        parts = []
        parts.append("OpenAI: " + ("✓" if Config.openai_available() else "未設定"))
        parts.append("Vertex AI: " + ("✓" if Config.vertex_available() else "未設定"))
        self.statusBar().showMessage(" | ".join(parts))
