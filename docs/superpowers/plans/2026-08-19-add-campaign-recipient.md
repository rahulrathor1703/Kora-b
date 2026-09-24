# Add Person to Running Campaign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow adding a single person directly to a scheduled or sending email campaign (without a list), always starting at sequence step 1.

**Architecture:** Add `POST /email-campaigns/:id/recipients` in the existing recipients service layer. Create a recipient row with `currentStepOrder: 1` and increment `audienceCount`. The existing send pipeline picks up new recipients via `findReadyToSend`. Frontend adds a dialog on the campaign Contacts tab.

**Tech Stack:** NestJS, TypeORM, class-validator, Next.js, MUI, existing `useApiMutation` hooks.

## Global Constraints

- Backend quality gates: `npm run validate` (lint + audit + deps) and `npm run build` must pass.
- Frontend quality gates: `npm run validate` (lint + typecheck + audit + deps) and `npm run build` must pass.
- Layered architecture: controller → service → repository; no TypeORM in controllers/services beyond repository injection.
- New recipients always start at step 1 regardless of other recipients' progress.

---

### Task 1: Backend API

**Files:**
- Create: `src/email-campaigns/campaign-add-recipient.spec.ts`
- Modify: `src/email-campaigns/dto/email-campaign.dto.ts`
- Modify: `src/email-campaigns/email-campaign-recipients.repository.ts`
- Modify: `src/email-campaigns/email-campaigns.repository.ts`
- Modify: `src/email-campaigns/campaign-progress.service.ts`
- Modify: `src/email-campaigns/email-campaigns.controller.ts`

**Interfaces:**
- Produces: `EmailCampaignRecipientsService.addRecipient(campaignId, organizationId, dto) → CampaignRecipientResponse`
- Produces: `POST /email-campaigns/:id/recipients` with `AddEmailCampaignRecipientDto`

**Behavior:**
- Allowed campaign statuses: `scheduled`, `sending`
- Reject: `draft`, `sent`, `failed`
- Reject duplicate email in same campaign
- Reject email on org exclusion list
- Create recipient: `currentStepOrder: 1`, `status: 'pending'`, `contactDisposition: 'eligible'`, `nextSendAt: null`
- Increment `campaign.audienceCount` in a transaction
- Build merge fields: `email`, `first_name`, `last_name`, `full_name`, `company`

---

### Task 2: Frontend UI

**Files:**
- Modify: `src/lib/api/endpoints.ts`
- Modify: `src/lib/api/services/email-campaign.service.ts`
- Modify: `src/lib/email/campaigns/recipient-types.ts`
- Create: `src/hooks/useAddCampaignRecipient.ts`
- Create: `src/components/email/campaigns/detail/AddCampaignRecipientDialog.tsx`
- Modify: `src/components/email/campaigns/detail/tabs/ContactsTab.tsx`

**Behavior:**
- Show "Add person" button when campaign status is `scheduled` or `sending`
- Dialog fields: email (required), first name, last name, company (optional)
- On success: refetch recipients list and show success toast
- New person appears as pending on step 1

---

### Task 3: Verification

- Run `npm run validate && npm test -- campaign-add-recipient` in backend
- Run `npm run validate` in frontend
