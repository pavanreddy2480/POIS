---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces for PA#0 Minicrypt Clique Web Explorer — React/TypeScript with high design quality. Use when building or styling the web app.
license: Complete terms in LICENSE.txt
---

This skill guides creation of the PA#0 **Minicrypt Clique Web Explorer** — a distinctive, production-grade React/TypeScript app that visualizes cryptographic reductions. Avoid generic AI aesthetics. The app must be visually memorable AND technically correct.

The interface has a fixed three-tier layout defined in the spec:
1. **Top bar** — Foundation toggle (AES-128 PRP / DLP g^x mod p)
2. **Two-column main area** — Column 1 (Build panel: Foundation → Source Primitive A) and Column 2 (Reduce panel: Source Primitive A → Target Primitive B)
3. **Bottom panel** — Collapsible reduction proof summary

## Design Thinking for PA#0

Before coding, commit to an aesthetic direction that fits the **cryptographic/mathematical** context:
- **Purpose**: Visualize reduction chains in the Minicrypt Clique — a tool for learning formal cryptography
- **Tone options**: Brutalist/terminal (monospace, dark, green-on-black like a crypto paper), mathematical/editorial (clean whitespace, LaTeX-style typography), circuit-board aesthetic (trace lines, nodes), or refined academic (book-like, warm paper tones)
- **Differentiation**: Show actual hex data flowing through the reduction steps — real numbers, not placeholders. The step-through display with intermediate values is the heart of the app.

**CRITICAL**: The aesthetic must serve the educational purpose. Users are CS students reading formal crypto proofs — the design should feel rigorous and precise, not playful or corporate.

## Frontend Aesthetics Guidelines

- **Typography**: Monospace for hex values and function names (JetBrains Mono, Fira Code, IBM Plex Mono). Serif or distinctive sans for labels (not Inter/Roboto). Mathematical notation rendered clearly.
- **Color**: Strong contrast for the data flow (hex values must be readable). Color-code the two reduction legs (Column 1 vs Column 2) distinctly. The foundation toggle should be visually prominent.
- **Motion**: Animate hex values updating on input change (staggered fade-in per step). Highlight the active path in the GGM tree when query bits change. Smooth collapse/expand for the proof summary panel.
- **Spatial**: Two-column layout is fixed — respect it. Within columns, show each sub-reduction step as a distinct card with clear input→function→output flow.
- **Step display format**: Each step shows: `[function name] → [input hex] → [output hex]` with the theorem name annotating the arrow.

## Technical Constraints

- **Framework**: React 18 + TypeScript + Vite
- **State**: Live data flow — all panels update on any input change without page reload
- **Under-the-Hood Rule**: Column 2 must receive Source Primitive A as a black-box function object from Column 1 — never call AES/DLP directly from Column 2
- **Stub support**: Unimplemented PAs show "Not implemented yet (due: PA#N)" with greyed-out step in the chain — app must remain fully runnable with any subset of PAs
- **Routing table**: `reduce(A, B, foundation)` handles multi-hop paths automatically
- **Bidirectional mode**: Toggle "Forward (A→B) / Backward (B→A)" that swaps columns

## Component Tree

```
App
├── FoundationToggle (AES-128 | DLP)
├── MainArea
│   ├── BuildPanel (Column 1: Foundation → Source A)
│   │   ├── PrimitiveSelector (dropdown)
│   │   ├── KeyInput (hex)
│   │   └── StepDisplay[] (each sub-reduction step with hex values)
│   └── ReducePanel (Column 2: Source A → Target B)
│       ├── PrimitiveSelector (dropdown)
│       ├── QueryInput
│       └── StepDisplay[] (reduction steps A→B)
└── ProofSummary (collapsible)
    └── ReductionChain (theorem names + security claims)
```

NEVER use generic AI aesthetics (purple gradients, Inter font, cookie-cutter card layouts). The app should feel like it was designed by someone who loves both cryptography and typography.
