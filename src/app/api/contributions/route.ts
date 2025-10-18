import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Types, type FilterQuery } from "mongoose";
import { ZodError } from "zod";

import { dbConnect } from "@/lib/mongo";
import ContributionModel from "@/models/contribution";
import type { Contribution } from "@/models/contribution";

import {
  ContributionListResponseSchema,
  UpsertContributionInputSchema,
  normalizePeriod,
} from "./schemas";
import {
  createErrorResponse,
  handleZodError,
  isNextResponse,
  parseContributionListQuery,
  requireUserId,
  serializeContribution,
} from "./utils";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }

    const userId = userIdOrResponse;
    const query = parseContributionListQuery(request);

    const filter: FilterQuery<Contribution> = {
      userId,
    };

    if (query.goalId) {
      filter.goalId = new Types.ObjectId(query.goalId);
    }

    if (query.period) {
      filter.period = query.period;
    }

    const contributions = await ContributionModel.find(filter)
      .sort({ period: -1 })
      .lean();

    const data = contributions.map((contribution) => serializeContribution(contribution));

    const payload = ContributionListResponseSchema.parse({ data });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "CONTRIBUTION_INTERNAL_ERROR",
      "We had trouble loading your contributions just now.",
      500,
      {
        hint: "Please refresh in a moment while we reconnect.",
        error,
        context: { operation: "list" },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const userIdOrResponse = requireUserId(request);
    if (isNextResponse(userIdOrResponse)) {
      return userIdOrResponse;
    }
    const userId = userIdOrResponse;

    const body: unknown = await request.json();
    const parsedBody = UpsertContributionInputSchema.parse(body);

    const goalId = new Types.ObjectId(parsedBody.goalId);
    const period = normalizePeriod(parsedBody.period);

    const contribution = await ContributionModel.findOneAndUpdate(
      { userId, goalId, period },
      {
        $set: {
          amount: parsedBody.amount,
          period,
        },
        $setOnInsert: {
          userId,
          goalId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    if (!contribution) {
      return createErrorResponse(
        "CONTRIBUTION_INTERNAL_ERROR",
        "We could not save that contribution right now.",
        500,
        {
          hint: "Please try again shortly.",
          context: { operation: "upsert" },
        },
      );
    }

    return NextResponse.json(serializeContribution(contribution));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        "CONTRIBUTION_VALIDATION_ERROR",
        "We could not read that request. Please check the data and try again.",
        400,
        {
          hint: "Make sure you are sending valid JSON.",
          logLevel: "warn",
        },
      );
    }

    if (error instanceof ZodError) {
      return handleZodError(error);
    }

    return createErrorResponse(
      "CONTRIBUTION_INTERNAL_ERROR",
      "We could not save that contribution right now.",
      500,
      {
        hint: "Please try again shortly.",
        error,
        context: { operation: "upsert" },
      },
    );
  }
}
