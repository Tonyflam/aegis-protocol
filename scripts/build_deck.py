#!/usr/bin/env python3
"""Build the Aegis Protocol pitch deck PDF.

Output: /workspaces/rs/Aegis_Protocol_Pitch_Deck.pdf
Run:    python3 scripts/build_deck.py
"""

from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Style ──────────────────────────────────────────────────────────
PAGE_W, PAGE_H = landscape(A4)            # 297 × 210 mm
MARGIN = 22 * mm

BG        = HexColor("#0A0A0B")
INK       = HexColor("#F5F5F7")
INK_DIM   = HexColor("#9CA3AF")
ACCENT    = HexColor("#FACC15")           # warm gold = Aegis brand
LINE      = HexColor("#27272A")
CARD      = HexColor("#141416")

FONT_BOLD    = "Helvetica-Bold"
FONT_REG     = "Helvetica"
FONT_MONO    = "Courier-Bold"

OUTPUT = "/workspaces/rs/Aegis_Protocol_Pitch_Deck.pdf"


# ── Primitives ─────────────────────────────────────────────────────
def page_frame(c: canvas.Canvas, slide_no: int, total: int):
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Top bar
    c.setStrokeColor(LINE)
    c.setLineWidth(0.4)
    c.line(MARGIN, PAGE_H - 14 * mm, PAGE_W - MARGIN, PAGE_H - 14 * mm)

    # Brand mark (top-left)
    c.setFillColor(ACCENT)
    c.setFont(FONT_BOLD, 9)
    c.drawString(MARGIN, PAGE_H - 11 * mm, "AEGIS PROTOCOL")
    c.setFillColor(INK_DIM)
    c.setFont(FONT_REG, 8)
    c.drawString(MARGIN + 33 * mm, PAGE_H - 11 * mm, "  ·  BNB Chain Security Layer")

    # Slide number (top-right)
    c.setFillColor(INK_DIM)
    c.setFont(FONT_MONO, 8)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 11 * mm, f"{slide_no:02d} / {total:02d}")

    # Bottom bar
    c.setStrokeColor(LINE)
    c.line(MARGIN, 12 * mm, PAGE_W - MARGIN, 12 * mm)
    c.setFillColor(INK_DIM)
    c.setFont(FONT_REG, 7.5)
    c.drawString(MARGIN, 8 * mm, "aegisguardian.xyz")
    c.drawCentredString(PAGE_W / 2, 8 * mm, "EASY Residency / MVB Application — Confidential")
    c.drawRightString(PAGE_W - MARGIN, 8 * mm, "2026")


def title(c, text, y=PAGE_H - 32 * mm, size=26, color=INK):
    c.setFillColor(color)
    c.setFont(FONT_BOLD, size)
    c.drawString(MARGIN, y, text)


def eyebrow(c, text, y=PAGE_H - 22 * mm):
    c.setFillColor(ACCENT)
    c.setFont(FONT_BOLD, 8.5)
    c.drawString(MARGIN, y, text.upper())


def body(c, text, y, size=11, color=INK, leading=15, max_width=None, x=None):
    """Draw multiline text. `text` may include explicit '\n'."""
    if x is None:
        x = MARGIN
    if max_width is None:
        max_width = PAGE_W - 2 * MARGIN
    c.setFillColor(color)
    c.setFont(FONT_REG, size)

    # Manual word-wrap because we want full control over leading
    for paragraph in text.split("\n"):
        if paragraph.strip() == "":
            y -= leading * 0.6
            continue
        words = paragraph.split(" ")
        line = ""
        for w in words:
            test = (line + " " + w).strip()
            if c.stringWidth(test, FONT_REG, size) > max_width:
                c.drawString(x, y, line)
                y -= leading
                line = w
            else:
                line = test
        if line:
            c.drawString(x, y, line)
            y -= leading
    return y


def bullets(c, items, y, size=11, color=INK, leading=16, x=None, bullet_color=None):
    if x is None:
        x = MARGIN
    if bullet_color is None:
        bullet_color = ACCENT
    for item in items:
        # bullet glyph
        c.setFillColor(bullet_color)
        c.setFont(FONT_BOLD, size)
        c.drawString(x, y, "•")
        # body
        y2 = body(c, item, y, size=size, color=color, leading=leading,
                  max_width=PAGE_W - 2 * MARGIN - 6 * mm, x=x + 5 * mm)
        y = y2 - 2  # small extra gap
    return y


def stat_card(c, x, y, w, h, value, label, value_color=None):
    if value_color is None:
        value_color = ACCENT
    c.setFillColor(CARD)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=1)

    c.setFillColor(value_color)
    c.setFont(FONT_BOLD, 24)
    c.drawString(x + 6 * mm, y + h - 13 * mm, value)

    c.setFillColor(INK_DIM)
    c.setFont(FONT_REG, 9)
    c.drawString(x + 6 * mm, y + 6 * mm, label.upper())


# ── Slides ─────────────────────────────────────────────────────────

def slide_cover(c):
    eyebrow(c, "EASY Residency / MVB · BNB Chain")
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 56)
    c.drawString(MARGIN, PAGE_H / 2 + 8 * mm, "Aegis Protocol")

    c.setFillColor(INK_DIM)
    c.setFont(FONT_REG, 16)
    c.drawString(MARGIN, PAGE_H / 2 - 5 * mm,
                 "On-chain security & risk-aware yield for BNB Chain.")

    # Accent line
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2)
    c.line(MARGIN, PAGE_H / 2 - 14 * mm, MARGIN + 40 * mm, PAGE_H / 2 - 14 * mm)

    c.setFillColor(INK_DIM)
    c.setFont(FONT_REG, 10.5)
    c.drawString(MARGIN, 30 * mm, "Live on BSC Mainnet  ·  Listed on DappBay  ·  Built BNB-native")
    c.setFont(FONT_REG, 9.5)
    c.drawString(MARGIN, 24 * mm, "Founder: David Praise Francis-Omogbai")


def slide_problem(c):
    eyebrow(c, "01 · The Problem")
    title(c, "BNB Chain is the most-attacked retail surface in crypto.")

    y = PAGE_H - 50 * mm
    y = body(c,
             "The chain with the highest retail trade volume is also the chain "
             "with the highest exposure to honeypots, rugs, hidden mints, and "
             "silent LP removals. Existing tooling fails users in three ways:",
             y, color=INK_DIM, size=12, leading=17)

    y -= 4 * mm
    y = bullets(c, [
        "Static  —  a one-time risk score that doesn't notice when an owner re-enables a hidden mint a day after you bought.",
        "Shallow  —  one API in, one number out. No reasoning across liquidity, taxes, owner privileges, and holder concentration.",
        "Passive  —  lives in a dashboard the user will never open. By the time they look, the rug has happened.",
    ], y, size=11.5, leading=17)

    # Footer stat
    y_card = 22 * mm
    stat_card(c, MARGIN, y_card, 90 * mm, 22 * mm,
              "$2.8B+", "lost to BSC rugs & honeypots in 2024 (CertiK / De.Fi)")


def slide_solution(c):
    eyebrow(c, "02 · What Aegis Does")
    title(c, "The missing security layer for BNB Chain — live now.")

    y = PAGE_H - 50 * mm

    # 3-column layout
    col_w = (PAGE_W - 2 * MARGIN - 12 * mm) / 3
    cols = [
        ("Guardian Shield",
         "Real-time wallet monitoring.\n\nDiff-aware Telegram alerts: new threat / risk escalated / risk cleared.\n\nSilence means safe — that's the point."),
        ("AI Scanner",
         "Every BNB Chain token, analyzed by Llama-3.3-70B via Groq.\n\nStructured reasoning, cited evidence, logged on-chain via DecisionLogger."),
        ("Aegis Vault",
         "Yield that prices in risk.\n\nLive on BSC Mainnet. Rebalances away from deteriorating assets using the same signals Guardian detects."),
    ]

    for i, (head, copy) in enumerate(cols):
        x = MARGIN + i * (col_w + 6 * mm)
        c.setFillColor(CARD)
        c.setStrokeColor(LINE)
        c.roundRect(x, 28 * mm, col_w, 80 * mm, 3 * mm, fill=1, stroke=1)
        c.setFillColor(ACCENT)
        c.setFont(FONT_BOLD, 13.5)
        c.drawString(x + 6 * mm, 28 * mm + 70 * mm, head)
        body(c, copy, 28 * mm + 60 * mm, color=INK, size=10.5, leading=14,
             x=x + 6 * mm, max_width=col_w - 12 * mm)


def slide_traction(c):
    eyebrow(c, "03 · Traction")
    title(c, "Two weeks from launch. Already shipping signal.")

    # Stat grid
    cards = [
        ("379", "token scans run"),
        ("40", "active users"),
        ("160", "$UNIQ holders"),
        ("LIVE", "DappBay listed"),
    ]
    card_w = (PAGE_W - 2 * MARGIN - 9 * mm) / 4
    card_h = 30 * mm
    y = PAGE_H - 88 * mm
    for i, (val, label) in enumerate(cards):
        stat_card(c, MARGIN + i * (card_w + 3 * mm), y, card_w, card_h, val, label)

    y -= 12 * mm
    body(c, "Bootstrapped — no outside capital. Every metric earned organically.",
         y, color=INK_DIM, size=11, leading=15)
    y -= 18 * mm
    bullets(c, [
        "Listed on DappBay (BNB Chain's curated directory) within two weeks of mainnet launch.",
        "$UNIQ token has 160 holders post-hackathon, driving tier-gated monitoring demand.",
        "Vault contract live at 0x9f60...0C06  ·  DecisionLogger at 0x51Be...3Da86.",
    ], y, size=11, leading=16)


def slide_how_it_works(c):
    eyebrow(c, "04 · How It Works")
    title(c, "From wallet connect to Telegram alert — under 60 seconds.")

    y = PAGE_H - 52 * mm
    steps = [
        ("1", "Connect", "User connects their BNB Chain wallet at aegisguardian.xyz."),
        ("2", "Scan", "Aegis pulls holdings via the wallet API and runs 25 risk rules across every token (honeypot, taxes, owner privileges, LP locks, holder concentration)."),
        ("3", "Reason", "Gold tier triggers Groq Llama-3.3-70B for evidence-cited reasoning. Output is logged on-chain via DecisionLogger."),
        ("4", "Monitor", "Vercel cron scans every subscribed wallet every 5 minutes — 24/7, even when the page is closed."),
        ("5", "Alert", "Diff engine classifies each scan: new / escalated / resolved. Only state changes ship a Telegram message."),
    ]
    for n, head, copy in steps:
        c.setFillColor(ACCENT)
        c.setFont(FONT_BOLD, 13)
        c.drawString(MARGIN, y, n)
        c.setFillColor(INK)
        c.setFont(FONT_BOLD, 12)
        c.drawString(MARGIN + 8 * mm, y, head)
        c.setFillColor(INK_DIM)
        c.setFont(FONT_REG, 10.5)
        body(c, copy, y, x=MARGIN + 35 * mm, size=10.5, leading=14,
             color=INK_DIM, max_width=PAGE_W - MARGIN - 35 * mm - MARGIN)
        y -= 18 * mm


def slide_moat(c):
    eyebrow(c, "05 · Defensible Moat")
    title(c, "Why Aegis wins where others don't.")
    y = PAGE_H - 52 * mm
    bullets(c, [
        "Diff-aware alerts — an original primitive. Competitors re-send the same alert; we stay silent until state changes. Trust compounds with every silent scan.",
        "On-chain AI receipts — every Llama-3.3-70B decision is logged via the DecisionLogger contract. Verifiable, not vibes.",
        "Closed loop — security signals don't stop at the alert. They feed the Vault's rebalance logic. No competitor ships both sides.",
        "Telegram-native distribution — we meet retail where they already trade. Dashboard-first competitors lose the moment.",
        "$UNIQ alignment — tier-gated monitoring creates real, recurring demand for the token. Holders fund the protocol; protocol protects holders.",
        "BNB-native focus — deep liquidity, deep data, deep relationships. Everyone else treats BSC as a side-chain afterthought.",
    ], y, size=11, leading=17)


def slide_market(c):
    eyebrow(c, "06 · Market")
    title(c, "$1.5B+ ARR ceiling on BNB Chain retail alone.")
    y = PAGE_H - 52 * mm
    bullets(c, [
        "TAM — ~25M monthly active BNB Chain wallets. 10% paying ~$10/mo equivalent in $UNIQ = ~$3B/year.",
        "SAM — ~$5B BSC DeFi TVL. Risk-priced vault capturing 1% with 10% perf fee = $4-7.5M/yr from yield alone.",
        "B2B — DEXes, aggregators, and wallets need a pre-trade risk overlay. Per-scan API pricing scales with on-chain volume (>$50M daily on BSC DEXes).",
        "Adjacent — every EVM chain has the same problem. Aegis ports horizontally (Ethereum, Base, Arbitrum, Polygon) once BNB Chain is owned.",
        "Compliance — institutional risk monitoring is a multi-billion-dollar software category (Chainalysis, TRM Labs). Aegis is the consumer-grade entry point.",
    ], y, size=11, leading=17)


def slide_business(c):
    eyebrow(c, "07 · Business Model")
    title(c, "Token-gated tiers today. B2B API & vault fees tomorrow.")

    y = PAGE_H - 50 * mm

    tiers = [
        ("Free",    "0",            "Wallet scans + token scans + basic alerts."),
        ("Bronze",  "10,000",       "Priority cron + holder & LP tracking."),
        ("Silver",  "100,000",      "Multi-wallet portfolios + dev wallet surveillance + webhooks."),
        ("Gold",    "1,000,000",    "Full AI reasoning + DecisionLogger receipts + vault auto-rebalance + private API."),
    ]
    col_w = (PAGE_W - 2 * MARGIN - 9 * mm) / 4
    for i, (name, uniq, copy) in enumerate(tiers):
        x = MARGIN + i * (col_w + 3 * mm)
        c.setFillColor(CARD)
        c.setStrokeColor(LINE if name != "Gold" else ACCENT)
        c.setLineWidth(0.8 if name == "Gold" else 0.4)
        c.roundRect(x, 30 * mm, col_w, 80 * mm, 3 * mm, fill=1, stroke=1)

        c.setFillColor(ACCENT if name == "Gold" else INK)
        c.setFont(FONT_BOLD, 13)
        c.drawString(x + 6 * mm, 30 * mm + 70 * mm, name)
        c.setFillColor(INK_DIM)
        c.setFont(FONT_MONO, 9)
        c.drawString(x + 6 * mm, 30 * mm + 63 * mm, f"{uniq} $UNIQ")
        body(c, copy, 30 * mm + 54 * mm, size=9.5, leading=13,
             color=INK, x=x + 6 * mm, max_width=col_w - 12 * mm)

    body(c, "Phase 2  ·  B2B risk-API licensing to DEXes & wallets  ·  10% Vault performance fee  ·  White-label Guardian.",
         24 * mm, size=10, color=INK_DIM, leading=14)


def slide_competition(c):
    eyebrow(c, "08 · Competition")
    title(c, "Crowded category. Empty position.")
    y = PAGE_H - 50 * mm

    # Two columns
    col_w = (PAGE_W - 2 * MARGIN - 8 * mm) / 2

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 12)
    c.drawString(MARGIN, y, "Who's in the space")
    c.drawString(MARGIN + col_w + 8 * mm, y, "Why none of them win")
    y -= 8 * mm

    left = [
        "GoPlusLabs — strong API, no product, no monitoring, no alerts.",
        "De.Fi (Shield) — broad EVM coverage but shallow on BSC.",
        "Honeypot.is / TokenSniffer — single-scan only.",
        "RugDoc — manual reviews, doesn't scale.",
        "Wallet Guard / Pocket Universe — phishing focus, not on-chain risk.",
    ]
    right = [
        "None ship diff-aware alerts — they spam or stay quiet.",
        "None log AI reasoning on-chain (no DecisionLogger analog).",
        "None close the loop into a vault — Aegis productizes the signal.",
        "None are BNB-native — BSC is everyone else's afterthought.",
        "None bundle Telegram distribution with the analysis.",
    ]
    y2 = y
    for item in left:
        y2 = body(c, "·  " + item, y2, size=10.5, color=INK_DIM, leading=15,
                  max_width=col_w, x=MARGIN)
    y2 = y
    for item in right:
        y2 = body(c, "·  " + item, y2, size=10.5, color=INK_DIM, leading=15,
                  max_width=col_w, x=MARGIN + col_w + 8 * mm)


def slide_founder(c):
    eyebrow(c, "09 · Founder")
    title(c, "Solo technical founder. Hackathon-tested.")

    y = PAGE_H - 50 * mm
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 15)
    c.drawString(MARGIN, y, "David Praise Francis-Omogbai")
    y -= 7 * mm
    c.setFillColor(ACCENT)
    c.setFont(FONT_BOLD, 10)
    c.drawString(MARGIN, y, "Founder & CEO  ·  Full-time")
    y -= 12 * mm

    body(c,
         "Builder-first founder finishing a BSc in Computer Science (2026). "
         "Ships product end-to-end: smart contracts, indexer, AI reasoning "
         "pipeline, real-time Telegram alert system, and the dashboard — solo.",
         y, size=11.5, color=INK, leading=16)
    y -= 30 * mm

    bullets(c, [
        "Multiple hackathon wins — solo, no team. Track record of shipping production-ready dApps under deadline pressure.",
        "Portfolio of dApps published on DoraHacks  ·  dorahacks.io/hacker/i_am_dflame",
        "AI-fluent builder — uses LLMs as the force-multiplier that compresses a team of 4 into one founder.",
        "Hiring next: technical co-founder (Solidity / audit) + Head of Growth (BNB Chain ecosystem).",
    ], y, size=11, leading=17)


def slide_ask(c):
    eyebrow(c, "10 · The Ask")
    title(c, "Why EASY Residency, and what we'll do with it.")

    y = PAGE_H - 50 * mm
    bullets(c, [
        "BNB Chain GTM  —  DappBay featured placement, Binance Square content, intros to PancakeSwap / Venus / ListaDAO / Binance Web3 Wallet for native risk-API integration.",
        "YZi Labs capital + 10-week residency  —  hire technical co-founder + Head of Growth, run first paid acquisition cohort, ship the B2B risk-API to two DEX partners.",
        "Mentorship  —  operators who've scaled BNB Chain consumer products past 100k users. Specifically: token-gated SaaS pricing, KOL rev-share, MiCA classification for $UNIQ.",
    ], y, size=11.5, leading=18)

    # Closing line
    y_close = 36 * mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.2)
    c.line(MARGIN, y_close + 16 * mm, MARGIN + 40 * mm, y_close + 16 * mm)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 14)
    c.drawString(MARGIN, y_close + 6 * mm,
                 "Built on BNB Chain. Built for users who'd rather not get rugged.")
    c.setFillColor(INK_DIM)
    c.setFont(FONT_REG, 10)
    c.drawString(MARGIN, y_close,
                 "aegisguardian.xyz  ·  dappbay.bnbchain.org/detail/aegis-protocol")


# ── Build ──────────────────────────────────────────────────────────
def build():
    c = canvas.Canvas(OUTPUT, pagesize=landscape(A4))
    c.setTitle("Aegis Protocol — EASY Residency / MVB Pitch Deck")
    c.setAuthor("David Praise Francis-Omogbai")
    c.setSubject("Aegis Protocol pitch deck")

    slides = [
        slide_cover,
        slide_problem,
        slide_solution,
        slide_traction,
        slide_how_it_works,
        slide_moat,
        slide_market,
        slide_business,
        slide_competition,
        slide_founder,
        slide_ask,
    ]
    total = len(slides)
    for i, fn in enumerate(slides, start=1):
        page_frame(c, i, total)
        fn(c)
        c.showPage()
    c.save()
    print(f"OK  ·  {total} slides  ·  {OUTPUT}")


if __name__ == "__main__":
    build()
