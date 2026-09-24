# Notion Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an org connect Notion with an integration token, pick a database and Markos destination, toggle columns green/red, and import only green data.

**Architecture:** New `notion-integrations` Nest module stores an encrypted token, fetches Notion databases/rows, matches or creates CRM fields, then reuses company/prospect/contact-list import services.

**Tech Stack:** NestJS layered module, TypeORM, `CredentialsCryptoService`, Notion REST `2022-06-28`, Next.js settings UI.

## Global Constraints

- Integration token only (no OAuth)
- Connect/disconnect is user-controlled; no live sync
- Disconnect deletes the connection only
- Green + matching name/type maps to an existing field
- Green + no match creates a custom field (companies/prospects)
- Contact lists map/skip only
- Re-import skips duplicates
- Required destination fields must stay green and mapped
- Layered architecture and quality gates must pass

---

### Task 1: Connection storage + token APIs
### Task 2: Notion API client + property flatten
### Task 3: Field match + schema create
### Task 4: Shared importMappedRows + Notion import + skip duplicates
### Task 5: Frontend Connectors page
### Task 6: Lint, validate, verify
