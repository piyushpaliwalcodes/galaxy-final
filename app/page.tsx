"use client";

import React, { useRef, useState } from "react";
import UploadcareUploader from "@/components/UploadcareUploader";
import axios from "axios";
import { useUser, UserButton, SignIn } from "@clerk/nextjs";
import useGenerations from "@/app/hooks/useGenerationPolling";

interface PromptData {
  prompt: string;
  referenceVideoUrl: string;
  _id: string;
  screenRatio: string;
}

const VideoUploadForm: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [promptData, setPromptData] = useState<PromptData>();
  const uploaderRef = useRef<any>(null);
  const [requestId, setRequestId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const { isSignedIn } = useUser();
  const { generations, generateNewRequest, refreshGenerations, isRefreshing } = useGenerations();

  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);

  const handleUpload = (url: string) => {
    setFileUrl(url);
  };

  const generateAiVideo = async (promptData: any) => {
    try {
      setIsGenerating(true);
      const response = await axios.post("/api/fal/submit", {
        promptId: promptData?._id,
        referenceVideoUrl: promptData?.referenceVideoUrl,
        userPrompt: promptData?.prompt,
      });

      if (response.status !== 200) {
        throw new Error(response.data.error || "AI video generation failed");
      }
      setRequestId(response.data.requestId);
      generateNewRequest(response.data.requestId, promptData.referenceVideoUrl);
    } catch (error: any) {
      console.error("AI video generation failed:", error.response?.data || error.message);
      alert("AI video generation failed!");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileUrl) {
      alert("Please upload a video first!");
      return;
    }
    if (!prompt) {
      alert("Please enter a prompt!");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("referenceVideoUrl", fileUrl);
      formData.append("prompt", prompt);

      const response = await axios.post("/api/upload-user-video", formData);

      if (response.status !== 200) {
        throw new Error(response.data.error || "Upload failed");
      }

      setPromptData({
        prompt: response.data.prompt.prompt,
        referenceVideoUrl: response.data.prompt.referenceVideoUrl,
        _id: response.data.prompt._id,
        screenRatio: response.data.screenRatio
      });

      setPrompt("");
      setFileUrl(null);

      await generateAiVideo({
        prompt: response.data.prompt.prompt,
        referenceVideoUrl: response.data.prompt.referenceVideoUrl,
        _id: response.data.prompt._id,
      })
    } catch (error: any) {
      console.error("Upload failed:", error.response?.data || error.message);
      alert("Upload failed!");
    }
    setIsUploading(false);
  };

  const openVideoModal = (video: any) => {
    setSelectedVideo(video);
    setShowModal(true);
  };

  const handleViewGeneratedVideos = () => {
    // First refresh the data
    refreshGenerations();
    // Then open the modal
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedVideo(null);
  };

  // Count completed generations
  const completedGenerations = generations?.filter((gen: any) => gen.status === "completed") || [];
  const hasCompletedGenerations = completedGenerations.length > 0;

  // Render the main app UI
  const appContent = (
    <div className="min-h-screen bg-white text-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <UserButton />
      </div>

      <div className="max-w-6xl mx-auto">
        <h1 className="text-center text-4xl font-bold mb-4">
          AI Video To Video Generator
        </h1>
        <p className="text-center text-gray-600 mb-10">
          Transform your videos using AI with a simple prompt
        </p>

        {/* Main Container: Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Card: Upload & Prompt */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-medium mb-4">Upload Video</h2>

            <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center mb-5">
              <UploadcareUploader onUpload={handleUpload} ref={uploaderRef} />
              {fileUrl && (
                <div className="mt-3 text-gray-700 font-medium">
                  <p>Video uploaded successfully!</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label
                htmlFor="prompt"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Enter prompt here...
              </label>
              <input
                id="prompt"
                type="text"
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-gray-400"
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-md transition duration-300 disabled:bg-gray-400 flex justify-center items-center"
              disabled={isUploading || !fileUrl || !prompt}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                  Generate Video
                </>
              )}
            </button>
          </div>

          {/* Right Card: Output */}
          <div className="border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-center">
            {isGenerating ? (
              <div className="w-full">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin mb-4 h-12 w-12 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <h3 className="text-xl font-medium mb-2">Generating Your Video</h3>
                  <p className="text-gray-500">This may take a few minutes...</p>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-medium mb-2">Ready to Create Your Video</h3>
                <p className="text-gray-500 mb-6">Videos once generated will be available in the generated videos section</p>

                <button
                  onClick={handleViewGeneratedVideos}
                  className="mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition duration-300 inline-flex items-center"
                >
                  {isRefreshing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                      </svg>
                      {hasCompletedGenerations ?
                        `View Generated Videos (${completedGenerations.length})` :
                        'View Generated Videos'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Generation History Section */}
        {generations && generations.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Example Video Transformations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generations.map((gen: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="p-4">
                    <h3 className="font-medium text-lg mb-2">Transformation #{index + 1}</h3>
                    <p className="text-sm text-gray-600 mb-3"><strong>Prompt:</strong> {gen.prompt}</p>

                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Reference:</span>
                      <a
                        href={gen.referenceVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-black underline text-sm font-medium"
                      >
                        View Source
                      </a>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Generated:</span>
                      {gen.status === "completed" && gen.generatedUrl ? (
                        <a
                          href={gen.generatedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-700 hover:text-black underline text-sm font-medium"
                        >
                          View Result
                        </a>
                      ) : (
                        <span className={`text-sm font-medium ${gen.status === "processing" ? "text-gray-600" : "text-gray-700"
                          }`}>
                          {gen.status === "processing" ? "Processing..." : "Failed"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <p className="text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${gen.status === "completed" ? "bg-gray-200 text-gray-800" :
                        gen.status === "processing" ? "bg-gray-100 text-gray-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                        {gen.status.charAt(0).toUpperCase() + gen.status.slice(1)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal for Viewing Generated Videos */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold">Generated Videos</h3>
              <div className="flex items-center">
                <button
                  onClick={refreshGenerations}
                  className="mr-4 text-gray-500 hover:text-gray-700 flex items-center"
                  disabled={isRefreshing}
                >
                  <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span className="ml-1">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {isRefreshing ? (
                <div className="text-center py-12">
                  <svg className="animate-spin mx-auto h-10 w-10 text-gray-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-500">Refreshing generations data...</p>
                </div>
              ) : completedGenerations.length > 0 ? (
                <div className="space-y-6">
                  {completedGenerations.map((gen: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="p-4">
                        <h4 className="font-medium text-lg mb-2">Video #{index + 1}</h4>
                        <p className="text-sm text-gray-600 mb-3"><strong>Prompt:</strong> {gen.prompt}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-sm font-medium mb-2">Reference Video:</p>
                            <div className="relative pt-[56.25%] bg-gray-100 rounded">
                              <video
                                src={gen.referenceVideoUrl}
                                controls
                                className="absolute inset-0 w-full h-full rounded"
                              />
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Generated Video:</p>
                            <div className="relative pt-[56.25%] bg-gray-100 rounded">
                              <video
                                src={gen.generatedUrl}
                                controls
                                className="absolute inset-0 w-full h-full rounded"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No completed videos yet</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeModal}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // If user is not signed in, show the blurred app with sign-in overlay
  if (!isSignedIn) {
    return (
      <div className="relative min-h-screen">
        {/* Blurred app background */}
        <div className="absolute inset-0 filter blur-sm brightness-75 overflow-hidden">
          {appContent}
        </div>

        {/* Sign-in overlay - now showing only the Clerk component */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <SignIn redirectUrl="/" />
        </div>
      </div>
    );
  }

  return appContent;
};

export default VideoUploadForm;