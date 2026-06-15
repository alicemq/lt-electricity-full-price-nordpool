---
title: Gitignore without untrack leaves snapshots tracked
tags: [ua0, git, hygiene, struggle]
date: 2026-06-14
source: adresses
---

# Gitignore without untrack leaves snapshots tracked

## Problem

Adding `.history/` to `.gitignore` stops new Local History snapshots from being picked up by `git add`, but files already committed stay tracked. In adresses, UA0 added `.history/` to `.gitignore` on 2026-06-07, yet `git ls-files .history` still listed 121 snapshot files. Agents and reviewers saw a "clean" ignore rule while the repo still shipped IDE recovery artifacts.

Extends [untrack-secrets-before-ua0](untrack-secrets-before-ua0.md): ignore rules alone are not enough when paths were ever committed.

## What we tried

`.gitignore` update only, assuming future commits would stop tracking `.history/`.

## What worked

1. Verify with `git ls-files .history` (or `git ls-files --cached .history/`). Any output means tracked files remain.
2. Untrack without deleting local files: `git rm -r --cached .history/`
3. Commit the removal in the UA0 hygiene PR alongside the `.gitignore` change.
4. Re-run `git ls-files .history` until empty before merging UA0.

Same pattern applies to `.env`, `.env.*`, and other paths added to `.gitignore` after they were committed.

## Rule for next project

UA0 checklist MUST include both `.gitignore` entry and `git rm --cached` for any path that was ever tracked. Treat "added to gitignore" as incomplete until `git ls-files` confirms zero cached matches.
