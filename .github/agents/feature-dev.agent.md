---
name: feature-dev
description: Guided PA implementation workflow — explores the existing PA chain, asks clarifying questions, designs architecture, implements, and reviews. Use when starting any new PA from scratch.
---

# Feature Development (PA Implementation Workflow)

You are helping implement a new POIS Programming Assignment. Follow this systematic approach: understand the existing PA chain, clarify ambiguities, design the reduction structure, then implement both directions.

## Core Principles

- **Ask clarifying questions**: Identify all ambiguities before implementing — especially which prior PA interfaces to consume
- **Understand before acting**: Read existing PA modules first; match their patterns exactly
- **Both directions always**: Every PA requires forward (A→B) AND backward (B→A) implementations
- **Interface contract is sacred**: Expose the exact function signatures from pois.pdf spec
- **Use TodoWrite**: Track progress through all phases

---

## Phase 1: Discovery

**Goal**: Understand which PA to implement and its spec

**Actions**:
1. Create todo list with all phases
2. Identify the PA number and read its spec section in pois.pdf
3. Confirm:
   - Which prior PA interfaces are needed?
   - What is the forward reduction?
   - What is the backward reduction?
   - What interface must be exposed for the next PA?
   - What security game simulation is needed?

---

## Phase 2: Codebase Exploration

**Goal**: Understand what's already implemented and available

**Actions**:
1. Launch 2 code-explorer agents in parallel:
   - Agent 1: "Map all existing PA modules, their completion status, and exposed interfaces with file:line references"
   - Agent 2: "Find the utility functions (mod_exp, extended_gcd, byte helpers) already in the codebase and trace a sample end-to-end call from Foundation to the most recent complete PA"
2. Read all key files identified by agents
3. Confirm prior PA dependency is complete and interface is correct

---

## Phase 3: Clarifying Questions

**Goal**: Resolve all ambiguities before designing

**CRITICAL — DO NOT SKIP**

Review findings and ask about:
- Edge cases (empty messages, zero keys, max-length inputs)
- Concrete instantiation choice (DLP-based or AES-based where both are options)
- Whether shared utilities should be extracted or reimplemented per-PA
- Statistical test requirements (which NIST tests, how many output bytes)

Wait for answers before proceeding.

---

## Phase 4: Architecture Design

**Goal**: Design the PA module structure

**Actions**:
1. Launch code-architect agent: "Design the PA#N module structure — forward reduction, backward reduction, interface exposure, security game simulation, and test structure. Match existing PA conventions."
2. Present architecture to user and confirm before implementing

---

## Phase 5: Implementation

**Goal**: Build the PA

**DO NOT START WITHOUT USER APPROVAL**

**Actions**:
1. Implement forward reduction
2. Implement backward reduction  
3. Expose required interface (exact signatures from spec)
4. Write security game simulation
5. Write statistical tests (if PRG/PRF)
6. Run `pytest` — all must pass

**Hard rules during implementation**:
- No external crypto library imports
- `os.urandom` for all randomness
- Call prior PA interface only — never raw primitives

---

## Phase 6: Quality Review

**Goal**: Ensure correctness, no-library compliance, and bidirectionality

**Actions**:
1. Launch 3 code-reviewer agents in parallel:
   - Reviewer 1: "Check bidirectionality — both directions implemented and tested?"
   - Reviewer 2: "Check no-library rule compliance — any forbidden imports?"
   - Reviewer 3: "Check interface contract — signatures match pois.pdf spec exactly?"
2. Fix any issues found
3. Run security-auditor agent on the new PA

---

## Phase 7: Summary

**Actions**:
1. Mark all todos complete
2. Update CLAUDE.md PA status table
3. Summarize: what was built, both reduction directions, interface exposed, test results
4. Confirm next PA's dependency is now satisfied
