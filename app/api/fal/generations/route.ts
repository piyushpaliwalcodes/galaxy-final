import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        console.log("🔹 Fetching prompts...");
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ prompts: [] }, { status: 401 });
        }

        await dbConnect();

        const prompts = await Prompt.find({ userId }).sort({ updatedAt: -1 });

        return NextResponse.json({ prompts }, { status: 200 });
    } catch (error) {
        console.error("Error fetching prompts:", error);
        return NextResponse.json(
            { error: "Failed to fetch prompts" },
            { status: 500 }
        );
    }
}