# TIZIM_02 agent boot protocol

Before changing anything, read this chain in order:

1. `docs/governance/CONSTITUTION.md` — non-negotiable system rules.
2. `docs/governance/CURRENT_STATE.md` — replaceable, measured repository state.
3. `docs/governance/AGENT_COMMS_PROTOCOL.md` — how agents talk to each other:
   mailbox, handoff, status vocabulary, and the multi-machine rule. Laptop and
   office PC share exactly one line — the git remote. Unpushed work is not a
   message. Every mailbox file names its agent AND its machine.
4. `ops/ACTIVE_TASKS.json` — task ownership, locks, dependencies and required reading.
5. `ops/mailbox/INBOX.md` — open items currently waiting on someone.
6. Only the relevant accepted contract/ADR under `docs/architecture/` or review under `docs/reviews/`.

Run `node ops/governance-check.cjs` before handoff. A task may edit only paths in
its `owns` list. Do not use `tizim02/MULOQOT.md` as current state: it is an
append-only historical journal. Do not apply production migrations or push
`main` without explicit human approval. Record changes in the task branch and
leave unrelated worktree changes untouched.
