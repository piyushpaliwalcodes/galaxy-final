import Prompt from "@/app/models/video.models";
import dbConnect from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
    try {
        console.log("🔹 Fetching prompts...");
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ prompts: [], dbStatus: "Not connected - Authentication required" }, { status: 401 });
        }

        await dbConnect();
        
        // Get database connection status
        let dbStatus = "Not connected";
        if (mongoose.connections.length > 0) {
            const connectionState = mongoose.connections[0].readyState;
            switch (connectionState) {
                case mongoose.ConnectionStates.connected:
                    dbStatus = "Connected";
                    break;
                case mongoose.ConnectionStates.connecting:
                    dbStatus = "Connecting";
                    break;
                case mongoose.ConnectionStates.disconnected:
                    dbStatus = "Disconnected";
                    break;
                case mongoose.ConnectionStates.disconnecting:
                    dbStatus = "Disconnecting";
                    break;
                default:
                    dbStatus = "Unknown";
            }
        }

        const prompts = await Prompt.find({ userId }).sort({ updatedAt: -1 });

        return NextResponse.json({ prompts, dbStatus }, { status: 200 });
    } catch (error) {
        console.error("Error fetching prompts:", error);
        return NextResponse.json(
            { error: "Failed to fetch prompts", dbStatus: "Error connecting to database" },
            { status: 500 }
        );
    }
} 