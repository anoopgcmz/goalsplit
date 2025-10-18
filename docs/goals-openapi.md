# Goals API Specification

## OpenAPI Definition
```yaml
openapi: 3.1.0
info:
  title: Goals API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /api/goals:
    get:
      summary: List goals for the authenticated user
      tags:
        - Goals
      security:
        - sessionCookieAuth: []
      parameters:
        - in: query
          name: page
          schema:
            type: integer
            minimum: 1
            default: 1
        - in: query
          name: pageSize
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - in: query
          name: sortBy
          schema:
            type: string
            enum: [createdAt, targetDate, title]
            default: createdAt
        - in: query
          name: sortOrder
          schema:
            type: string
            enum: [asc, desc]
            default: desc
      responses:
        '200':
          description: Paginated goals
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalListResponse'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
    post:
      summary: Create a new goal
      tags:
        - Goals
      security:
        - sessionCookieAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateGoalInput'
      responses:
        '201':
          description: Goal created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Goal'
        '400':
          description: Invalid payload
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '500':
          description: Failed to create goal
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
  /api/goals/{id}:
    get:
      summary: Retrieve goal details
      tags:
        - Goals
      security:
        - sessionCookieAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Goal details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Goal'
        '400':
          description: Invalid goal identifier
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '403':
          description: User does not have access to the goal
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '404':
          description: Goal not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
    patch:
      summary: Update goal settings
      tags:
        - Goals
      security:
        - sessionCookieAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateGoalInput'
      responses:
        '200':
          description: Goal updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Goal'
        '400':
          description: Invalid payload or identifier
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '403':
          description: Only the owner can update the goal
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '404':
          description: Goal not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
    delete:
      summary: Delete a goal and cascade dependencies
      tags:
        - Goals
      security:
        - sessionCookieAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Goal deleted successfully
        '400':
          description: Invalid goal identifier
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '403':
          description: Only the owner can delete the goal
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '404':
          description: Goal not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
  /api/goals/{id}/plan:
    get:
      summary: Build a funding plan for a goal
      tags:
        - Goals
      security:
        - sessionCookieAuth: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Funding plan with per-member allocations
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalPlan'
              examples:
                solo:
                  $ref: '#/components/examples/GoalPlanSolo'
                shared:
                  $ref: '#/components/examples/GoalPlanShared'
        '400':
          description: Invalid goal identifier
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '403':
          description: User does not have access to the goal
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
        '404':
          description: Goal not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GoalError'
components:
  securitySchemes:
    sessionCookieAuth:
      type: apiKey
      in: cookie
      name: session
  schemas:
    GoalMember:
      type: object
      required:
        - userId
        - role
      properties:
        userId:
          type: string
        role:
          type: string
          enum: [owner, collaborator]
        splitPercent:
          type: number
          minimum: 0
          maximum: 100
        fixedAmount:
          type: number
          minimum: 0
    Goal:
      type: object
      required:
        - id
        - ownerId
        - title
        - targetAmount
        - currency
        - targetDate
        - expectedRate
        - compounding
        - contributionFrequency
        - isShared
        - members
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
        ownerId:
          type: string
        title:
          type: string
        targetAmount:
          type: number
          minimum: 0
        currency:
          type: string
        targetDate:
          type: string
          format: date-time
        expectedRate:
          type: number
          minimum: 0
        compounding:
          type: string
          enum: [monthly, yearly]
        contributionFrequency:
          type: string
          enum: [monthly, yearly]
        existingSavings:
          type: number
          minimum: 0
        isShared:
          type: boolean
        members:
          type: array
          items:
            $ref: '#/components/schemas/GoalMember'
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    GoalListResponse:
      type: object
      required:
        - data
        - pagination
        - sort
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/Goal'
        pagination:
          type: object
          required:
            - page
            - pageSize
            - totalItems
            - totalPages
          properties:
            page:
              type: integer
              minimum: 1
            pageSize:
              type: integer
              minimum: 1
            totalItems:
              type: integer
              minimum: 0
            totalPages:
              type: integer
              minimum: 0
        sort:
          type: object
          required:
            - by
            - order
          properties:
            by:
              type: string
              enum: [createdAt, targetDate, title]
            order:
              type: string
              enum: [asc, desc]
    CreateGoalInput:
      type: object
      required:
        - title
        - targetAmount
        - currency
        - targetDate
        - expectedRate
        - compounding
        - contributionFrequency
      properties:
        title:
          type: string
        targetAmount:
          type: number
          minimum: 0
        currency:
          type: string
        targetDate:
          type: string
          format: date-time
        expectedRate:
          type: number
          minimum: 0
        compounding:
          type: string
          enum: [monthly, yearly]
        contributionFrequency:
          type: string
          enum: [monthly, yearly]
        existingSavings:
          type: number
          minimum: 0
    UpdateGoalInput:
      type: object
      description: Partial update, at least one field required
      minProperties: 1
      properties:
        title:
          type: string
        targetAmount:
          type: number
          minimum: 0
        currency:
          type: string
        targetDate:
          type: string
          format: date-time
        expectedRate:
          type: number
          minimum: 0
    GoalPlanGoal:
      type: object
      required:
        - id
        - title
        - currency
        - targetAmount
        - targetDate
        - expectedRate
        - compounding
        - contributionFrequency
        - existingSavings
        - isShared
      properties:
        id:
          type: string
        title:
          type: string
        currency:
          type: string
        targetAmount:
          type: number
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
          minimum: 0
        isShared:
          type: boolean
    GoalPlanHorizon:
      type: object
      required:
        - years
        - months
        - totalPeriods
        - nPerYear
      properties:
        years:
          type: number
          minimum: 0
        months:
          type: number
          minimum: 0
          maximum: 11
        totalPeriods:
          type: number
          minimum: 0
        nPerYear:
          type: integer
          enum: [1, 12]
    GoalPlanTotals:
      type: object
      required:
        - perPeriod
        - lumpSumNow
      properties:
        perPeriod:
          type: number
        lumpSumNow:
          type: number
    GoalPlanMember:
      allOf:
        - $ref: '#/components/schemas/GoalMember'
        - type: object
          required:
            - perPeriod
          properties:
            perPeriod:
              type: number
    GoalPlan:
      type: object
      required:
        - goal
        - horizon
        - totals
        - members
        - assumptions
      properties:
        goal:
          $ref: '#/components/schemas/GoalPlanGoal'
        horizon:
          $ref: '#/components/schemas/GoalPlanHorizon'
        totals:
          $ref: '#/components/schemas/GoalPlanTotals'
        members:
          type: array
          items:
            $ref: '#/components/schemas/GoalPlanMember'
        assumptions:
          type: object
          required:
            - expectedRate
            - compounding
            - contributionFrequency
          properties:
            expectedRate:
              type: number
            compounding:
              type: string
              enum: [monthly, yearly]
            contributionFrequency:
              type: string
              enum: [monthly, yearly]
        warnings:
          type: array
          items:
            type: string
  examples:
    GoalPlanSolo:
      summary: Solo goal funded monthly
      value:
        goal:
          id: 64fa3b0e5b3c2c001edc1234
          title: Buy a motorcycle
          currency: INR
          targetAmount: 250000
          targetDate: '2026-06-01T00:00:00.000Z'
          expectedRate: 8
          compounding: monthly
          contributionFrequency: monthly
          existingSavings: 50000
          isShared: false
        horizon:
          years: 2
          months: 0
          totalPeriods: 24
          nPerYear: 12
        totals:
          perPeriod: 9640.15619737948
          lumpSumNow: 213149.09398717133
        members:
          - userId: 64fa3b0e5b3c2c001edc1234
            role: owner
            splitPercent: 100
            perPeriod: 9640.15619737948
        assumptions:
          expectedRate: 8
          compounding: monthly
          contributionFrequency: monthly
    GoalPlanShared:
      summary: Shared goal with mixed splits
      value:
        goal:
          id: 64fa3b0e5b3c2c001edc5678
          title: Family vacation
          currency: INR
          targetAmount: 600000
          targetDate: '2027-12-31T00:00:00.000Z'
          expectedRate: 6.5
          compounding: yearly
          contributionFrequency: monthly
          existingSavings: 120000
          isShared: true
        horizon:
          years: 3
          months: 6
          totalPeriods: 42
          nPerYear: 12
        totals:
          perPeriod: 14200.55
          lumpSumNow: 342125.19
        members:
          - userId: 64fa3b0e5b3c2c001edc5678
            role: owner
            fixedAmount: 5000
            perPeriod: 5000
          - userId: 64fa3b0e5b3c2c001edc5679
            role: collaborator
            splitPercent: 60
            perPeriod: 5520.33
          - userId: 64fa3b0e5b3c2c001edc5680
            role: collaborator
            splitPercent: 40
            perPeriod: 3680.22
        assumptions:
          expectedRate: 6.5
          compounding: yearly
          contributionFrequency: monthly
        warnings:
          - Split percentages do not sum to 100%; allocations normalised.
    GoalError:
      type: object
      required:
        - error
      properties:
        error:
          type: object
          required:
            - code
            - message
          properties:
            code:
              type: string
              enum:
                - GOAL_UNAUTHORIZED
                - GOAL_FORBIDDEN
                - GOAL_NOT_FOUND
                - GOAL_VALIDATION_ERROR
                - GOAL_CONFLICT
                - GOAL_INTERNAL_ERROR
            message:
              type: string
```

## Zod Schemas
```ts
import { z } from 'zod';

export const GoalApiErrorCodeSchema = z.enum([
  'GOAL_UNAUTHORIZED',
  'GOAL_FORBIDDEN',
  'GOAL_NOT_FOUND',
  'GOAL_VALIDATION_ERROR',
  'GOAL_CONFLICT',
  'GOAL_INTERNAL_ERROR',
]);
export type GoalApiErrorCode = z.infer<typeof GoalApiErrorCodeSchema>;

export const GoalListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'targetDate', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type GoalListQuery = z.infer<typeof GoalListQuerySchema>;

export const CreateGoalInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  targetAmount: z.coerce.number().finite().min(0),
  currency: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((value) => value.toUpperCase()),
  targetDate: z.coerce.date(),
  expectedRate: z.coerce.number().finite().min(0),
  compounding: z.enum(['monthly', 'yearly']),
  contributionFrequency: z.enum(['monthly', 'yearly']),
  existingSavings: z.coerce.number().finite().min(0).optional(),
});
export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;

export const UpdateGoalInputSchema = CreateGoalInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one field must be supplied',
    path: [],
  }
);
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;

export const GoalMemberResponseSchema = z.object({
  userId: z.string(),
  role: z.enum(['owner', 'collaborator']),
  splitPercent: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
});

export const GoalPlanMemberSchema = GoalMemberResponseSchema.extend({
  perPeriod: z.number(),
});

export const GoalResponseSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  targetAmount: z.number(),
  currency: z.string(),
  targetDate: z.string(),
  expectedRate: z.number(),
  compounding: z.enum(['monthly', 'yearly']),
  contributionFrequency: z.enum(['monthly', 'yearly']),
  existingSavings: z.number().min(0).optional(),
  isShared: z.boolean(),
  members: z.array(GoalMemberResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GoalResponse = z.infer<typeof GoalResponseSchema>;

export const GoalPlanResponseSchema = z.object({
  goal: z.object({
    id: z.string(),
    title: z.string(),
    currency: z.string(),
    targetAmount: z.number(),
    targetDate: z.string(),
    expectedRate: z.number(),
    compounding: z.enum(['monthly', 'yearly']),
    contributionFrequency: z.enum(['monthly', 'yearly']),
    existingSavings: z.number(),
    isShared: z.boolean(),
  }),
  horizon: z.object({
    years: z.number().min(0),
    months: z.number().min(0).max(11),
    totalPeriods: z.number().min(0),
    nPerYear: z.union([z.literal(1), z.literal(12)]),
  }),
  totals: z.object({
    perPeriod: z.number(),
    lumpSumNow: z.number(),
  }),
  members: z.array(GoalPlanMemberSchema),
  assumptions: z.object({
    expectedRate: z.number(),
    compounding: z.enum(['monthly', 'yearly']),
    contributionFrequency: z.enum(['monthly', 'yearly']),
  }),
  warnings: z.array(z.string()).optional(),
});
export type GoalPlanResponse = z.infer<typeof GoalPlanResponseSchema>;

export const GoalListResponseSchema = z.object({
  data: z.array(GoalResponseSchema),
  pagination: z.object({
    page: z.number().min(1),
    pageSize: z.number().min(1),
    totalItems: z.number().min(0),
    totalPages: z.number().min(0),
  }),
  sort: z.object({
    by: z.enum(['createdAt', 'targetDate', 'title']),
    order: z.enum(['asc', 'desc']),
  }),
});
export type GoalListResponse = z.infer<typeof GoalListResponseSchema>;
```
