import mongoose, { Document } from "mongoose";

// Define interface for the Prompt document
export interface IPrompt extends Document {
  userId: string;
  prompt: string;
  referenceVideoUrl: string;
  generatedUrl?: string;
  requestId?: string;
  status: "processing" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const promptSchema = new mongoose.Schema({
    userId: {
        type: String, 
        required: true, 
        unique: false
    }, 
    prompt: {
        type: String, 
        required: true, 
        unique: false
    },
    referenceVideoUrl: {
        type: String, 
        required: true, 
        unique: true, 
    }, 
    generatedUrl: {
        type: String, 
        required: false, 
        unique: false,
    }, 
    requestId: {
        type: String, 
        required: false
    }, 
    status: {
        type: String,
        enum: ["processing", "completed", "failed"],
        required: true,
        default: "processing", 
    }
}, {timestamps: true});

const Prompt = mongoose.models.prompts || mongoose.model<IPrompt>("prompts", promptSchema);

export default Prompt;