# ACA RFC Process

Proposals for changes to the Agent Civilization Architecture specification.

## How to Submit

1. Copy `0000-template.md` to `rfcs/NNNN-short-title.md`
2. Fill in the template
3. Open a Pull Request
4. Discussion happens on the PR and optionally in [GitHub Discussions](https://github.com/MakiDevelop/agent-civilization-architecture/discussions)

## RFC Lifecycle

```
draft → under_review → accepted | rejected | withdrawn
```

- **draft**: Author is still editing; feedback welcome but not expected
- **under_review**: Author considers it ready; maintainers and community review
- **accepted**: Merged into the spec at next version
- **rejected**: Closed with rationale recorded
- **withdrawn**: Author closed it

## What Needs an RFC

- New layer or sub-layer in the architecture
- Changes to existing layer interfaces
- New conformance test requirements
- Changes to governance primitives (Layer 4-6)
- Removal or modification of protocol invariants (e.g., Anti-Ouroboros)

## What Does NOT Need an RFC

- Typo fixes, clarifications, or editorial changes to existing spec text
- New conformance tests that test existing spec requirements
- New reference implementation features that don't change the spec
- Documentation improvements
