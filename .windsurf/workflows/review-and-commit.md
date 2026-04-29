---
description: Review code changes and create commit following cyber-wiki standards
---

# Review & Commit Workflow

## Overview

This workflow reviews changed code for quality, security, and compliance, then creates a commit if all checks pass.

**Detailed review criteria are defined in:**

- `.windsurf/rules/cyberwiki-front.md` - Frontend architecture rules (FrontX)
- `docs/specs/` - Project specifications

## Phase 0: Automatic File Detection & Analysis

// turbo
The agent automatically detects all changed files and begins review immediately:

```bash
git status && git diff --name-only && git diff --stat
```

**Automatic Agent Actions (No User Input Required):**

1. **Detect all changed files** - Identify .ts, .tsx, .css, and other modified files
2. **Read full content** - Load complete content of each changed file
3. **Determine file types** - Categorize by extension and purpose
4. **Apply matching rules** - Automatically select applicable rules:
   - `.tsx` files → TypeScript rules + React component rules + FrontX architecture rules
   - `.ts` files → TypeScript rules + type safety rules
   - API services → Must extend `BaseApiService`, use `RestEndpointProtocol`
   - Events/Actions/Effects → Must follow Flux pattern (Action → Event → Effect → Slice)
   - Pages → Must be in `src/app/pages/`
   - Components → Must be in `src/app/components/`
   - All files → Import path rules, no `any`/`unknown`, no `eslint-disable`
5. **Scan all files** - Check each file against all applicable rules
6. **Collect findings** - Document all critical, high, and medium priority issues
7. **Begin Phase 1** - Automatically proceed to comprehensive code review

## Phase 1: Code Review of Changes

// turbo
Agent performs comprehensive code review by applying rules to each file:

### Automatic Rule Application

For each changed file, the agent:

1. **Reads the full file content**
2. **Identifies file type and purpose**
3. **Applies matching rule sets** from `cyberwiki-front.md` rules
4. **Checks for violations** against:
   - **File placement** - Pages in `src/app/pages/`, components in `src/app/components/`, API in `src/app/api/`, etc.
   - **Import paths** - Same package: relative; cross-branch: `@/` alias; cross-package: `@cyberfabric/*`
   - **Flux architecture** - Actions emit events via `eventBus.emit()`, effects listen with `eventBus.on()`, no direct dispatch from components
   - **Type safety** - `type` for objects/unions, `interface` for React props, no `any`/`unknown`, no `as unknown as` casts
   - **API services** - Extend `BaseApiService`, use `RestEndpointProtocol`, `withCredentials: true`
   - **No telemetry** - No tracking code
   - **No prop drilling** - Use events for state flow
   - **Lodash** - Use lodash equivalents where available
   - **Commit size** - Maximum 4000 LOC per commit

5. **Categorizes findings**:
   - 🚨 **Critical Issues** - Must fix before commit (wrong file placement, broken Flux pattern, type errors)
   - ⚠️ **High Priority Issues** - Should fix before commit (import path violations, missing types)
   - 💡 **Medium Priority Issues** - Nice to fix (code style, minor improvements)

### Agent Review Output

The agent provides:

```markdown
## Automatic Code Review Results

### File: [filename]
**Type:** [.ts/.tsx]
**Rules Applied:** [list of applicable rules]

#### Critical Issues Found: [count]
[Detailed findings with line numbers and fix suggestions]

#### High Priority Issues Found: [count]
[Detailed findings with line numbers and fix suggestions]

#### Medium Priority Issues Found: [count]
[Detailed findings with line numbers and fix suggestions]

#### Positive Findings
[Well-written code, good patterns, etc.]
```

**Action:**

- ✅ If no critical/high priority issues: Proceed to Phase 1.1
- ❌ If issues found: Agent suggests fixes, user implements, re-run workflow

### Step 2: Validate Code Quality

// turbo
Run automated checks:

```bash
npm run lint && npm run type-check
```

**Required Checks:**

- [ ] ESLint passes (no linting errors)
- [ ] TypeScript compiles (no type errors)
- [ ] No console.log or debugger statements in production code
- [ ] No hardcoded secrets or credentials

**Action:**

- ✅ If all checks pass: Proceed to Step 3
- ❌ If checks fail: Fix issues and re-run

### Step 3: Validate Commit Size

// turbo
Check total lines of code:

```bash
git diff --stat | tail -1
```

**Rules:**

- Maximum: **4000 LOC** per commit
- Count: additions + deletions

**Action:**

- ✅ If ≤ 4000 LOC: Proceed to Phase 1.1
- ❌ If > 4000 LOC: Split into smaller commits

## Phase 1.1: FrontX Architecture Verification

// turbo
Verify that changes comply with FrontX architecture:

### Pre-Diff Checklist

- [ ] Import paths follow import rules (`@/` for cross-branch, relative for same package)
- [ ] Pages/features created under `src/app/`, NOT `src/mfe_packages/`
- [ ] Event-driven architecture (actions emit → effects handle)
- [ ] API types defined in `src/app/api/wikiTypes.ts`
- [ ] No `eslint-disable` comments
- [ ] No `any` or `unknown` in type definitions
- [ ] No barrel exports unless aggregating 3+ exports

**Verify file placement:**

```bash
git diff --name-only | grep -E "^src/" | head -30
```

**Check that:**

- New pages are in `src/app/pages/`
- New components are in `src/app/components/`
- New API services are in `src/app/api/`
- New actions are in `src/app/actions/`
- New effects are in `src/app/effects/`
- New events are in `src/app/events/`
- MFE files are ONLY in `src/mfe_packages/` when explicitly creating an MFE

## Phase 2: Prepare Commit Message

Create a proper commit message following standards:

**Format:**

```text
[TYPE] Brief description (50 chars max)

Detailed explanation (optional)
- Bullet point 1
- Bullet point 2
```

**Commit Types:** feat, fix, refactor, test, docs, style, chore, perf

**Examples:**

```text
[feat] Add SpaceConfigurationPage with CRUD table

Implements admin view for managing spaces.
- Add SpaceConfigurationPage with search, edit, delete
- Add EditSpaceModal with fork configuration
- Update App.tsx routing and Menu navigation
```

```text
[fix] Fix favorite toggle on DashboardPage

Correct eventBus subscription cleanup in useEffect.
- Use unsubscribe() from eventBus.on() return value
- Remove incorrect eventBus.off() calls
```

**Validation:**

- [ ] Starts with `[TYPE]`
- [ ] Description is clear and concise
- [ ] Body lists significant changes

## Phase 3: Stage Changes

// turbo
Stage all reviewed and approved changes:

```bash
git add [files]
```

**Verify:**

```bash
git status && git diff --cached --stat
```

- [ ] All intended files are staged
- [ ] No accidental files included
- [ ] Changes are logically grouped
- [ ] No `node_modules/` or generated files staged

## Phase 4: Create Commit

### Decision Point: All Checks Passed?

**If YES (All checks passed):**

- ✅ Code review complete with no critical/high priority issues
- ✅ Linting and type checking pass
- ✅ FrontX architecture rules verified
- ✅ Commit size ≤ 4000 LOC
- ✅ Commit message prepared

**Then:** Proceed to automatic commit creation

**If NO (Issues found):**

- ❌ Critical or high priority issues detected
- ❌ Linting or type errors
- ❌ Architecture violations
- ❌ Commit size exceeds limit

**Then:** Fix issues and re-run review

### Create Commit

// turbo
Create the commit:

```bash
git commit -m "[TYPE] Description"
```

**Critical Rules:**

- ⛔ **NEVER use `--no-verify`** - Pre-commit hooks MUST run (if configured)
- ⛔ **NEVER use `-n` flag** - This also bypasses hooks
- ✅ Always let pre-commit hooks run

### Handle Hook Failures

If pre-commit hooks fail:

1. **Read the error message** - Understand what failed
2. **Fix the issues:**
   - ESLint errors: `npm run lint -- --fix`
   - TypeScript errors: Fix manually or use `npm run type-check`
3. **Stage fixed files:** `git add [fixed-files]`
4. **Retry commit:** `git commit -m "[TYPE] Description"`

### Verify Commit Created

// turbo
Verify the commit was created correctly:

```bash
git log --oneline -n 1 && git show HEAD --stat
```

**Check:**

- [ ] Commit message is correct
- [ ] All intended changes are included
- [ ] No accidental files included
- [ ] Commit size is reasonable

## Review Summary Template

```markdown
## Commit Review Summary

### Commit Info
- **Hash:** [commit-hash]
- **Message:** [commit-message]
- **Size:** [X LOC]
- **Files Changed:** [count]

### Validation Results
- [ ] Commit size valid (≤ 4000 LOC)
- [ ] Pre-commit hooks passed
- [ ] No linting errors
- [ ] TypeScript compiles
- [ ] FrontX architecture verified
- [ ] Commit message valid

### Critical Issues: [count]
[List or "None found ✅"]

### High Priority Issues: [count]
[List or "None found ✅"]

### Medium Priority Issues: [count]
[List or "None found ✅"]

### Positive Highlights
[Call out good practices, well-written code, etc.]

### Recommendation
- [ ] **Approve** - Ready to merge
- [ ] **Approve with suggestions** - Can merge after addressing low/medium issues
- [ ] **Request changes** - Must address issues before merge
```

## Common Issues & Fixes

### Wrong File Placement

**Problem:** Page created in `src/mfe_packages/` instead of `src/app/pages/`

Move the file to the correct location and update imports.

### Direct Dispatch from Component

**Problem:** Component dispatches to Redux slice directly

```tsx
// ❌ Wrong
dispatch(setSpaces(data));

// ✅ Correct — use action → event → effect flow
import { loadSpaces } from '@/app/actions/wikiActions';
loadSpaces();
```

### Import Path Violations

**Problem:** Wrong import path style

```tsx
// ❌ Wrong — relative path across branches
import { Space } from '../../api/wikiTypes';

// ✅ Correct — use @/ alias
import { Space } from '@/app/api';
```

### eventBus.off Does Not Exist

**Problem:** Trying to unsubscribe with `eventBus.off()`

```tsx
// ❌ Wrong — EventBus has no .off() method
eventBus.off('wiki/space/created', handler);

// ✅ Correct — use unsubscribe from .on() return value
const sub = eventBus.on('wiki/space/created', handler);
sub.unsubscribe();
```

### Commit Size Exceeds Limit

**Problem:** Commit is > 4000 LOC

```bash
# Reset commit but keep changes
git reset --soft HEAD~1
# Split into smaller commits
git add [subset-of-files]
git commit -m "[TYPE] Part 1: Description"
git add [remaining-files]
git commit -m "[TYPE] Part 2: Description"
```

### Wrong Commit Message

**Problem:** Typo in commit message

```bash
git commit --amend -m "[TYPE] Corrected description"
```

## Key Rules Summary

1. ⛔ **NEVER `--no-verify`** - Pre-commit hooks MUST run
2. 📏 **Max 4000 LOC** - Break large changes into smaller commits
3. 📝 **Clear messages** - Use `[TYPE] Description` format
4. 🔍 **No secrets** - Check for hardcoded credentials
5. 🏗️ **FrontX architecture** - Action → Event → Effect → Slice
6. 📁 **File placement** - Pages in `src/app/pages/`, never in `src/mfe_packages/`
7. 🔗 **Import paths** - `@/` for cross-branch, relative for same package
8. 🚫 **No `any`** - Use proper types
9. 🚫 **No `eslint-disable`** - Fix the underlying issue
10. 🚫 **No prop drilling** - Use event-driven state flow
11. 📦 **lodash over native** - Use lodash equivalents where available

## Useful Commands

```bash
# View commit details
git show HEAD
git log -1 --format=%B

# Check LOC
git diff HEAD~1 HEAD --stat

# View changes
git diff HEAD~1 HEAD
git diff HEAD~1 HEAD -- [file]

# Amend commit
git commit --amend --no-edit
git commit --amend -m "New message"

# Reset commit
git reset --soft HEAD~1

# Lint
npm run lint
npm run lint -- --fix

# Type check
npm run type-check

# Architecture check
npm run arch:check
```

## References

- **Frontend Rules:** `.windsurf/rules/cyberwiki-front.md`
- **API Types:** `src/app/api/wikiTypes.ts`
- **Architecture:** Event-driven Flux (FrontX/HAI3)
