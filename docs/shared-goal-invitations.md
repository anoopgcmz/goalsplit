# Shared Goal Invitations

This document captures the shared goal invitation and acceptance workflow, including the API surface, user flows, and the copy required for user-facing touchpoints.

## OpenAPI Overview

```yaml
openapi: 3.1.0
info:
  title: Shared Goal Invitations
  version: '1.0.0'
paths:
  /api/goals/{goalId}/invite:
    post:
      summary: Create a collaboration invitation for a goal
      tags:
        - Goals
      parameters:
        - in: path
          name: goalId
          required: true
          schema:
            type: string
          description: Identifier of the goal whose owner is issuing the invite.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                  description: Email address that will receive the invitation.
                expiresInMinutes:
                  type: integer
                  minimum: 1
                  default: 10080
                  description: Minutes until the token expires (defaults to 7 days).
                defaultSplitPercent:
                  type: number
                  minimum: 0
                  maximum: 100
                  default: 50
                  description: Preferred split percent for the invited collaborator when percentage-based contributions are used.
                fixedAmount:
                  type: number
                  minimum: 0
                  nullable: true
                  description: Optional fixed contribution amount for the collaborator.
              required:
                - email
      responses:
        '201':
          description: Invitation successfully created.
          content:
            application/json:
              schema:
                type: object
                properties:
                  inviteUrl:
                    type: string
                    format: uri
        '4XX':
          description: Validation, authorization, or invite conflicts.
        '5XX':
          description: Unexpected server error.
  /api/shared/accept:
    post:
      summary: Accept an invitation and join a shared goal
      tags:
        - Shared Goals
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                token:
                  type: string
                  description: Invitation token supplied in the invite URL.
              required:
                - token
      responses:
        '200':
          description: Invitation accepted; caller joined the goal.
          content:
            application/json:
              schema:
                type: object
                properties:
                  goal:
                    type: object
                    description: Serialized goal reflecting the caller's access and updated splits.
                    properties:
                      id:
                        type: string
                      ownerId:
                        type: string
                      title:
                        type: string
                      targetAmount:
                        type: number
                      currency:
                        type: string
                      targetDate:
                        type: string
                        format: date-time
                      expectedRate:
                        type: number
                      compounding:
                        type: string
                        enum: [monthly, yearly]
                      contributionFrequency:
                        type: string
                        enum: [monthly, yearly]
                      existingSavings:
                        type: number
                        nullable: true
                      isShared:
                        type: boolean
                      members:
                        type: array
                        items:
                          type: object
                          properties:
                            userId:
                              type: string
                            role:
                              type: string
                              enum: [owner, collaborator]
                            splitPercent:
                              type: number
                              nullable: true
                            fixedAmount:
                              type: number
                              nullable: true
                      createdAt:
                        type: string
                        format: date-time
                      updatedAt:
                        type: string
                        format: date-time
        '4XX':
          description: Invalid token, expired invite, or mismatched user.
        '5XX':
          description: Unexpected server error.
```

## Acceptance Flow

```mermaid
flowchart TD
  A[Owner triggers POST /api/goals/{id}/invite] --> B[Validate ownership & payload]
  B -->|valid| C[Create token & invitation record]
  C --> D[Return invite URL to owner]
  D --> E[Owner shares invite URL]
  E --> F[Invitee opens URL & logs in]
  F --> G[Client submits POST /api/shared/accept]
  G --> H[API verifies token, expiry, and email]
  H --> I[Add collaborator to goal & rebalance splits]
  I --> J[Mark invite accepted & respond with goal]
  B -->|invalid| K[Return validation error]
  G -->|invalid token/email| L[Return 4XX error]
```

## Copy

### Invitation Email

- **Subject:** You have been invited to collaborate on a GoalSplit plan
- **Preview:** Accept the invite to start tracking progress together.
- **Body:**

  > Hi there,
  >
  > You've been invited to collaborate on a GoalSplit plan. Use the secure link below to accept the invitation and view the shared goal details.
  >
  > Accept invitation: {{ inviteUrl }}
  >
  > This link expires in {{ expiresIn }}. If you weren't expecting this message, you can safely ignore it.
  >
  > — The GoalSplit Team

### Acceptance Confirmation (UI copy)

- **Heading:** You're now collaborating on this goal
- **Body:** We've added you as a collaborator and adjusted the contribution split. You can review the plan details and update your preferences at any time.

