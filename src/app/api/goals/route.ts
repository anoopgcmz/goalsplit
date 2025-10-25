import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import GoalModel from "@/models/goal";

import { CreateGoalInputSchema, GoalListResponseSchema } from "./schemas";
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  parseGoalListQuery,
  requireUserId,
  serializeGoal,
} from "./utils";

export async function GET(request: NextRequest) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }

    const userId = userIdOrResponse;
    await dbConnect();

    const query = parseGoalListQuery(request);

    const filter = {
      $or: [{ ownerId: userId }, { "members.userId": userId }],
    };

    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === "asc" ? 1 : -1,
    };

    const [goals, totalItems] = await Promise.all([
      GoalModel.find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean(),
      GoalModel.countDocuments(filter),
    ]);

    const data = goals.map((goal) => serializeGoal(goal));

    const payload = GoalListResponseSchema.parse({
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
      sort: {
        by: query.sortBy,
        order: query.sortOrder,
      },
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We had trouble loading your goals just now.",
      500,
      {
        hint: "Please refresh in a few moments while we reconnect.",
        error,
        context: { operation: "list" },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;
    await dbConnect();

    const body: unknown = await request.json();
    const parsedBody = CreateGoalInputSchema.parse(body);

    const goal = await GoalModel.create({
      ownerId: userId,
      title: parsedBody.title,
      targetAmount: parsedBody.targetAmount,
      currency: parsedBody.currency,
      targetDate: parsedBody.targetDate,
      expectedRate: parsedBody.expectedRate,
      compounding: parsedBody.compounding,
      contributionFrequency: parsedBody.contributionFrequency,
      existingSavings: parsedBody.existingSavings,
      isShared: false,
      members: [
        {
          userId,
          role: "owner",
          splitPercent: 100,
        },
      ],
    });

    return NextResponse.json(serializeGoal(goal), { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        "GOAL_VALIDATION_ERROR",
        "We could not read that request. Please check the data and try again.",
        400,
        {
          hint: "Ensure you are sending valid JSON.",
          logLevel: "warn",
        },
      );
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "GOAL_INTERNAL_ERROR",
      "We could not create that goal right now.",
      500,
      {
        hint: "Please try again in a moment.",
        error,
        context: { operation: "create" },
      },
    );
  }
}
