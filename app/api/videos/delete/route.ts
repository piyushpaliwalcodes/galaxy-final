import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Prompt from "@/app/models/video.models";
import mongoose from "mongoose";

/**
 * DELETE endpoint to delete a video using ID from request body
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body to get the video ID
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      console.error("❌ Missing video ID in request body");
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    console.log(`🔹 Attempting to delete video with ID: ${id}`);

    // Connect to database
    console.log("🔹 Connecting to database for video deletion...");
    await dbConnect();
    console.log("🔹 Database connection successful");

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error(`❌ Invalid ID format: ${id}`);
      return NextResponse.json(
        { error: "Invalid ID format" },
        { status: 400 }
      );
    }

    // Find the video and check if it belongs to the current user
    const video = await Prompt.findById(id);
    
    if (!video) {
      console.error(`❌ Video not found with ID: ${id}`);
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (video.userId !== userId) {
      console.error(`❌ User ${userId} attempted to delete video ${id} owned by ${video.userId}`);
      return NextResponse.json(
        { error: "You don't have permission to delete this video" },
        { status: 403 }
      );
    }

    // Delete the video
    await Prompt.findByIdAndDelete(id);
    console.log(`✅ Successfully deleted video with ID: ${id}`);

    return NextResponse.json(
      { message: "Video deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error deleting video:", error);
    
    let errorMessage = "Failed to delete video";
    
    if (error instanceof Error) {
      console.error(`❌ Error details: ${error.name}: ${error.message}`);
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 