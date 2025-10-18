# Contributions API Specification

## OpenAPI Definition
```yaml
openapi: 3.1.0
info:
  title: Contributions API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /api/contributions:
    get:
      summary: List contribution entries for the authenticated user
      description: |
        Returns the contribution entries recorded for the current user. Results
        can be filtered by goal and/or constrained to a specific contribution
        period (month).
      tags:
        - Contributions
      security:
        - sessionCookieAuth: []
      parameters:
        - in: query
          name: goalId
          schema:
            type: string
            description: Goal identifier to filter by
        - in: query
          name: period
          schema:
            type: string
            format: date
            description: |
              Period to filter by. The API normalizes the supplied value to the
              first day of the month in UTC. Example `2024-06-01`.
      responses:
        '200':
          description: Contribution entries for the authenticated user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ContributionListResponse'
        '400':
          description: Invalid query parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ContributionError'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ContributionError'
        '500':
          description: Unable to load contributions
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ContributionError'
    post:
      summary: Upsert a contribution entry for the authenticated user
      description: |
        Creates or updates the user's contribution amount for a given goal and
        contribution period. The combination of user, goal, and normalized
        period is unique — submitting a new amount for the same period updates
        the existing record.
      tags:
        - Contributions
      security:
        - sessionCookieAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpsertContributionInput'
      responses:
        '200':
          description: Contribution entry created or updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Contribution'
        '400':
          description: Invalid payload
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ContributionError'
        '401':
          description: Missing or invalid session
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ContributionError'
        '500':
          description: Unable to save the contribution entry
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ContributionError'
components:
  securitySchemes:
    sessionCookieAuth:
      type: apiKey
      in: cookie
      name: session
  schemas:
    Contribution:
      type: object
      required: [id, goalId, userId, amount, period, createdAt, updatedAt]
      properties:
        id:
          type: string
        goalId:
          type: string
        userId:
          type: string
        amount:
          type: number
          minimum: 0
        period:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    ContributionListResponse:
      type: object
      required: [data]
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/Contribution'
    UpsertContributionInput:
      type: object
      required: [goalId, amount, period]
      properties:
        goalId:
          type: string
          description: Goal identifier to associate the contribution with
        amount:
          type: number
          minimum: 0
          description: Contribution amount for the selected period
        period:
          type: string
          format: date
          description: |
            Any ISO-8601 date within the desired month (e.g. `2024-06-15`). The
            API normalizes the value to the first day of that month in UTC.
    ContributionError:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code:
              type: string
              enum:
                - CONTRIBUTION_UNAUTHORIZED
                - CONTRIBUTION_FORBIDDEN
                - CONTRIBUTION_NOT_FOUND
                - CONTRIBUTION_VALIDATION_ERROR
                - CONTRIBUTION_INTERNAL_ERROR
            message:
              type: string
```
