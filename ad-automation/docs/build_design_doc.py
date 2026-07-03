#!/usr/bin/env python3
"""Google Ads API Basic Access 申請用の設計書PDFを生成する。
内容は英語（審査担当が読む前提・フォント問題回避）。CLAUDE.md/README を要約したもの。"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem
)

OUT = "google-ads-api-design.pdf"

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("H1x", parent=styles["Heading1"], fontSize=15,
                          spaceBefore=14, spaceAfter=6, textColor=colors.HexColor("#1a3c6e")))
styles.add(ParagraphStyle("H2x", parent=styles["Heading2"], fontSize=12,
                          spaceBefore=10, spaceAfter=4, textColor=colors.HexColor("#264f8a")))
styles.add(ParagraphStyle("Bodyx", parent=styles["BodyText"], fontSize=10, leading=15))
styles.add(ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8.5,
                          leading=12, textColor=colors.HexColor("#555555")))

story = []
B = lambda t: Paragraph(t, styles["Bodyx"])


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, styles["Bodyx"]), leftIndent=6) for t in items],
        bulletType="bullet", start="circle", leftIndent=14,
    )


# ── Title ─────────────────────────────────────────────
story += [
    Paragraph("Google Ads API — Tool Design Document", styles["Title"]),
    Paragraph("Softcommunications Inc. (Softcom)  &nbsp;|&nbsp;  Internal advertising-operations tool",
              styles["Small"]),
    Paragraph("Manager account (MCC) associated with developer token: 640-292-1549  &nbsp;|&nbsp;  "
              "API contact: ppc2@sc-scc.com  &nbsp;|&nbsp;  Website: https://www.sofcom.co.jp/",
              styles["Small"]),
    Spacer(1, 8),
]

# 1. Overview
story += [
    Paragraph("1. Overview and Purpose", styles["H1x"]),
    B("Softcommunications Inc. is a Japan-based digital marketing agency (SEM / paid advertising "
      "operations). We manage Google Ads accounts for our own company and for our clients under our "
      "manager (MCC) accounts. This tool is an <b>internal, semi-automated operations assistant</b>. "
      "It uses the Google Ads API to retrieve performance data, generate reports and analysis, and "
      "produce optimization <i>suggestions</i>. It does <b>not</b> make unattended automated changes: "
      "every budget/bid/on-off change is reviewed and approved by a human before it is applied."),
    B("The primary goal is to reduce key-person dependency: encode our operational judgment into a "
      "shared rulebook so that reporting and analysis are consistent regardless of which staff member "
      "runs them. Initial usage is <b>read-only reporting and analysis</b>."),
]

# 2. Users & Access
story += [
    Paragraph("2. Users and Access", styles["H1x"]),
    bullets([
        "<b>Audience:</b> Internal users only (employees, including outsourced contractors under NDA). "
        "Not distributed to the general public or offered as a third-party SaaS.",
        "<b>Accounts:</b> Softcom's own Google Ads account first (test/evaluation phase), then client "
        "accounts managed under our MCC, added one at a time.",
        "<b>Developer token:</b> Issued on and used only within our MCC (640-292-1549).",
    ]),
]

# 3. Architecture
story += [
    Paragraph("3. System Architecture and Data Flow", styles["H1x"]),
    B("The tool runs a daily loop. All write operations are gated behind human approval:"),
]
flow = [
    ["Step", "Action", "API access"],
    ["1. Fetch", "Retrieve last-7-day metrics (campaign / ad group / keyword)", "Read"],
    ["2. Analyze", "Compare metrics against thresholds in the rulebook (CPA/ROAS, wasted spend, etc.)", "None"],
    ["3. Draft", "Generate change proposals; new entities are drafted as PAUSED", "None"],
    ["4. Approve", "Human reviews the queue and approves or rejects each proposal", "None"],
    ["5. Apply", "Only approved changes are written back; before/after values are logged", "Write (future)"],
]
t = Table(flow, colWidths=[26*mm, 108*mm, 26*mm])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#264f8a")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbbbbb")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef2f8")]),
    ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story += [t, Spacer(1, 4),
          Paragraph("Fetching is via the Google Ads API. Analysis and proposal drafting happen in our "
                    "own environment. Writes are out of scope for the initial (read-only) phase.",
                    styles["Small"])]

# 4. API usage
story += [
    Paragraph("4. Google Ads API Usage", styles["H1x"]),
    bullets([
        "<b>Reporting (primary):</b> GoogleAdsService.SearchStream / Search with GAQL queries against "
        "campaign, ad_group, ad_group_ad, keyword_view and related resources to read spend, "
        "conversions, conversion value, impressions, clicks, and derived CPA/ROAS/CTR.",
        "<b>Metadata:</b> customer and campaign resources to resolve names, status, and budgets.",
        "<b>Mutations (future, approval-gated):</b> CampaignBudgetService and CampaignService / "
        "AdGroupService for budget, bid, and status changes — applied only after human approval, "
        "with per-change rate guards (e.g. max +30% budget increase per change).",
    ]),
]

# 5. Approval & guards
story += [
    Paragraph("5. Human-in-the-loop Approval and Change Guards", styles["H1x"]),
    bullets([
        "No auto-approval. The tool produces drafts only; a person approves before any write.",
        "New entities are created as PAUSED and explicitly enabled by an approver.",
        "Budget changes beyond +/-20% require manager approval; full stops require manager approval; "
        "large clients require two-step approval.",
        "Every applied change logs who, when, what, and the before/after values.",
    ]),
]

# 6. Security & compliance
story += [
    Paragraph("6. Security and Compliance", styles["H1x"]),
    bullets([
        "Secrets (developer token, OAuth client secret, refresh token) are stored only as environment "
        "variables / secret manager entries, never in source code, documents, or chat.",
        "Per-client credential separation; operations are traceable by operator identity.",
        "OAuth 2.0 (desktop) for authentication; least-privilege access.",
        "Advertising content follows Google Ads policies and, for medical/cosmetic clients, Japan's "
        "medical advertising guidelines; ambiguous expressions are escalated to a human reviewer.",
    ]),
]

# 7. Data handling
story += [
    Paragraph("7. Data Handling", styles["H1x"]),
    B("Retrieved performance data is used solely for internal reporting, analysis, and proposal "
      "generation. Data is not resold or provided to third parties. Client data is kept separated per "
      "client and handled under our confidentiality obligations."),
]

# 8. Roadmap
story += [
    Paragraph("8. Roadmap", styles["H1x"]),
    bullets([
        "Phase 0: Read-only reporting/analysis on Softcom's own account (evaluation).",
        "Phase 1: Extend read-only coverage to managed client accounts; daily reporting.",
        "Phase 2: Approval-gated writes (budget/bid/status) with full change logging.",
    ]),
    Spacer(1, 10),
    Paragraph("This tool is designed to be a responsible, human-supervised use of the Google Ads API, "
              "prioritizing read access and requiring explicit human approval for any change.",
              styles["Small"]),
]

SimpleDocTemplate(OUT, pagesize=A4, topMargin=18*mm, bottomMargin=16*mm,
                  leftMargin=18*mm, rightMargin=18*mm,
                  title="Google Ads API Tool Design Document - Softcommunications",
                  author="Softcommunications Inc.").build(story)
print(f"wrote {OUT}")
