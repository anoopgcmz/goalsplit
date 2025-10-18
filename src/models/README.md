# Data models

| Model | Fields (key attributes) |
| --- | --- |
| `User` | `_id`, `email` (unique, lowercase), optional `name`, timestamps |
| `OtpCode` | `email`, six-digit `code`, `expiresAt` (TTL), `consumed`, timestamps |
| `Goal` | `ownerId` (ref `User`), `title`, `targetAmount`, `currency`, `targetDate`, `expectedRate`, `compounding`, `contributionFrequency`, optional `existingSavings`, `isShared`, `members` (see `GoalMember`), timestamps |
| `Goal.members` | `userId` (ref `User`), `role`, optional `splitPercent`, optional `fixedAmount` |
| `Invite` | `goalId` (ref `Goal`), `email`, unique `token`, `expiresAt` (TTL), `createdBy` (ref `User`), optional `acceptedAt`, timestamps |
| `Contribution` | `goalId` (ref `Goal`), `userId` (ref `User`), `amount`, `period` (unique per goal/user/period), timestamps |
