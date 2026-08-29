# POLARIS — Development Workflow

## 1. Milestone Workflow
POLARIS follows a structured, milestone-driven development process designed to avoid scope creep and ensure stability at each phase. Work is never executed as an unbounded monolith.

```
Understand ──► Decide ──► Plan ──► Implement ──► Verify ──► Checkpoint ──► Next Milestone
```

- **Understand**: Clarify the specific problem, constraints, and dependencies before writing code.
- **Decide**: Establish architectural choices, domain boundaries, and interfaces.
- **Plan**: Break requirements down into bounded, testable tasks.
- **Implement**: Execute code changes adhering to module boundaries and design contracts.
- **Verify**: Run quality checks (type checking, linting, build, unit/integration verification).
- **Checkpoint**: Commit verified changes, record completion state, and update documentation.
- **Next Milestone**: Advance only after the current milestone meets all exit criteria.

---

## 2. Task Definition Template
Every task must be explicitly scoped and bounded before implementation begins:

```markdown
### Task: [Task Name / Identifier]

- **Objective**: Concise statement of what this task accomplishes.
- **Context**: Relevant background, affected domain modules, and related milestones.
- **Scope**:
  - In Scope: Explicit list of deliverables and code modifications.
  - Non-Scope: Explicit list of related items intentionally deferred or excluded.
- **Constraints**: Architecture rules, performance limits, security guidelines, or forbidden dependencies.
- **Verification**: Exact steps and commands used to validate correctness (e.g., tests, typecheck, lint).
- **Stop Condition**: Clear criteria that indicate the task is finished and ready for checkpointing.
```

---

## 3. Task Completion Report
Upon completing a task, record a standardized completion summary:

```markdown
### Task Completion Report: [Task Name / Identifier]

- **Files Created / Modified**:
  - `path/to/created_file.ts` (created)
  - `path/to/modified_file.ts` (updated)
- **Implementation Decisions**: Key design choices, trade-offs, or structural patterns introduced.
- **Verification Performed**: Verification commands run and their exact outcomes (e.g., typecheck clean, lint clean).
- **Warnings / Known Issues**: Any temporary limitations, edge cases, or pending upstream fixes.
- **What Remains for Next Task**: The immediate follow-up scope or next bounded step.
```

---

## 4. Quality Scripts
Standard quality and validation scripts defined in `package.json`:

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the local Next.js development server |
| `npm run build` | Runs Next.js production compilation and page generation |
| `npm run lint` | Executes ESLint against the codebase to enforce style and catch errors |
| `npm run typecheck` | Executes TypeScript compiler (`tsc --noEmit`) to verify type safety |

---

## 5. Commit Conventions
All commit messages must adhere to Conventional Commits format:

- `feat:` New feature or domain capability
- `fix:` Bug fix or error correction
- `chore:` Build process, tooling, configuration, or dependency updates
- `docs:` Documentation additions or updates
- `refactor:` Code restructuring without behavioral changes
- `test:` Adding or correcting tests

*Example:* `feat(inventory): add ledger transaction verification logic`

---

## 6. Engineering Principles
- **Clear Naming**: Use explicit, unambiguous domain terminology (e.g., `expeditionMember` over `member`).
- **Small Modules**: Keep files and modules focused and concise.
- **Single Responsibility**: Every function, module, and repository must have one clear reason to change.
- **Explicit Dependencies**: Avoid implicit globals, ambient mutations, or tight hidden couplings.
- **Type Safety**: Leverage TypeScript strict mode; avoid `any` or untyped casts.
- **Runtime Validation**: Runtime input validation will use a schema-validation approach at application boundaries. The specific validation library will be selected when the first API/domain boundary is implemented, based on actual requirements.
- **Predictable Errors**: Use structured domain errors (`src/core/errors/`) rather than unstructured exceptions.
- **Maintainable Code**: Optimize for readability and straightforward maintenance over clever abstractions.
- **Testable Business Logic**: Keep business and domain rules pure and independent from framework transport layers.
- **Minimal Unnecessary Abstraction**: Avoid speculative abstractions, generic wrappers, and premature optimizations.
- **Dependency Discipline**: Do not add external npm packages or third-party libraries without explicit rationale.

---

## 7. Migration Principles
- **Versioned Migrations**: All schema, table, index, and RLS policy modifications must be defined through sequential, versioned SQL migration files located in `supabase/migrations/`.
- **CLI Workflow**: New migrations are generated using `npx supabase migration new <migration_name>` and version-controlled.
- **No Undocumented Changes**: Manual or direct database alterations via database consoles are strictly prohibited without a corresponding migration script.
- **Separation of Scientific Data**: Never embed massive scientific datasets, reanalysis arrays, or large spatial rasters directly into SQL migration scripts.
- **Ingestion Workflows**: External scientific and reference data must be imported via dedicated, reproducible data ingestion scripts or background workflows.
