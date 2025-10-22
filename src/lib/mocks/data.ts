import type { AuthUser } from "@/app/api/auth/schemas";
import type { GoalResponse } from "@/app/api/goals/schemas";

export const mockUsers: AuthUser[] = [
  {
    id: "user-alex",
    email: "alex.martinez@example.com",
    name: "Alex Martinez",
  },
  {
    id: "user-jordan",
    email: "jordan.lee@example.com",
    name: "Jordan Lee",
  },
  {
    id: "user-sam",
    email: "samira.khan@example.com",
    name: "Samira Khan",
  },
  {
    id: "user-riley",
    email: "riley.chen@example.com",
    name: "Riley Chen",
  },
];

const now = new Date();
const iso = (date: Date) => date.toISOString();

export const mockGoals: GoalResponse[] = [
  {
    id: "goal-studio",
    ownerId: "user-alex",
    title: "Shared studio renovation and lighting upgrades",
    targetAmount: 18000,
    currency: "USD",
    targetDate: new Date(now.getFullYear() + 1, 1, 18).toISOString(),
    expectedRate: 5.2,
    compounding: "monthly",
    contributionFrequency: "monthly",
    existingSavings: 7560,
    isShared: true,
    members: [
      { userId: "user-alex", role: "owner", splitPercent: 60 },
      { userId: "user-jordan", role: "collaborator", splitPercent: 40 },
    ],
    createdAt: iso(new Date(now.getFullYear(), now.getMonth() - 4, 15)),
    updatedAt: iso(new Date(now.getFullYear(), now.getMonth() - 1, 2)),
  },
  {
    id: "goal-emergency",
    ownerId: "user-alex",
    title: "Emergency cash reserve",
    targetAmount: 12000,
    currency: "USD",
    targetDate: new Date(now.getFullYear(), now.getMonth() + 6, 5).toISOString(),
    expectedRate: 3.2,
    compounding: "monthly",
    contributionFrequency: "monthly",
    existingSavings: 8160,
    isShared: false,
    members: [
      { userId: "user-alex", role: "owner" },
    ],
    createdAt: iso(new Date(now.getFullYear(), now.getMonth() - 8, 22)),
    updatedAt: iso(new Date(now.getFullYear(), now.getMonth() - 1, 28)),
  },
  {
    id: "goal-family-trip",
    ownerId: "user-sam",
    title: "Family trip to visit grandparents",
    targetAmount: 5400,
    currency: "USD",
    targetDate: new Date(now.getFullYear(), now.getMonth() + 4, 12).toISOString(),
    expectedRate: 4.1,
    compounding: "monthly",
    contributionFrequency: "monthly",
    existingSavings: 1890,
    isShared: true,
    members: [
      { userId: "user-sam", role: "owner", splitPercent: 50 },
      { userId: "user-riley", role: "collaborator", splitPercent: 25 },
      { userId: "user-jordan", role: "collaborator", fixedAmount: 75 },
    ],
    createdAt: iso(new Date(now.getFullYear(), now.getMonth() - 6, 1)),
    updatedAt: iso(new Date(now.getFullYear(), now.getMonth() - 2, 18)),
  },
  {
    id: "goal-laptop",
    ownerId: "user-jordan",
    title: "Laptop replacement fund",
    targetAmount: 3200,
    currency: "USD",
    targetDate: new Date(now.getFullYear() + 1, 5, 30).toISOString(),
    expectedRate: 5.8,
    compounding: "monthly",
    contributionFrequency: "monthly",
    existingSavings: 1728,
    isShared: false,
    members: [
      { userId: "user-jordan", role: "owner" },
    ],
    createdAt: iso(new Date(now.getFullYear(), now.getMonth() - 10, 9)),
    updatedAt: iso(new Date(now.getFullYear(), now.getMonth() - 1, 12)),
  },
];
