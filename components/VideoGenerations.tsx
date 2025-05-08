import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader, XCircle, Info } from "lucide-react";
import React from "react";

interface VideoGeneration {
    referenceVideoUrl: string;
    generatedUrl?: string;
    prompt: string;
    status: "processing" | "completed" | "failed";
}

const VideoGenerations = ({generations} : any) => {
    // const [generations, setGenerations] = useState<VideoGeneration[]>([]);
    const [downloading, setDownloading] = useState<{ [key: number]: boolean }>({});
    const [showMetadata, setShowMetadata] = useState<{ [key: number]: boolean }>({});
    console.log("Generations in Video ", generations);

    // useEffect(() => {
    //     const fetchGenerations = async () => {
    //         try {
    //             const response = await fetch("/api/fal/generations");
    //             const data = await response.json();
    //             setGenerations(data.prompts);
    //         } catch (error) {
    //             console.error("Error fetching generations:", error);
    //         }
    //     };

    //     fetchGenerations();
    // }, []);

    if (generations?.length === 0) return null;

    const handleDownload = async (url: string, filename: string, index: number) => {
        try {
            setDownloading((prev) => ({ ...prev, [index]: true }));
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Error downloading video:", error);
        } finally {
            setDownloading((prev) => ({ ...prev, [index]: false }));
        }
    };

    console.log("Show Metadata", showMetadata);

    return (
        <div className="space-y-5 max-w-6xl mt-4 mx-auto">
            <Card className="p-4 border rounded-lg shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold">Generation History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                    {(generations as any[]).map((gen, index) => (
      <React.Fragment key={gen.referenceVideoUrl || index}>
                        <div className="grid grid-cols-2 gap-4 " key={index}>
                            <div>
                                <p className="text-sm font-medium">Reference Video</p>
                                <video className="w-full rounded-lg" controls src={gen.referenceVideoUrl} />
                            </div>
                            <div>
                                <p className="text-sm font-medium flex items-center gap-2">
                                    Generated Video
                                    {gen.status === "processing" && <Loader className="animate-spin text-blue-500" size={18} />}
                                    {gen.status === "failed" && <XCircle className="text-red-500" size={18} />}
                                </p>
                                {gen.status === "completed" && gen.generatedUrl ? (
                                    <div className="relative">
                                        <video className="w-full rounded-lg" controls src={gen.generatedUrl} />
                                        <Button
                                            className="absolute top-2 right-2 bg-white/80 hover:bg-white p-1 rounded-md h-10 w-10 border border-input"
                                            onClick={() => handleDownload(gen.generatedUrl as any, `generated-video-${index}.mp4`, index)}
                                            disabled={downloading[index]}
                                        >
                                            {downloading[index] ? <Loader className="animate-spin" size={18} /> : <Download size={18} />}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className=" h-[90%] w-full flex items-center justify-center bg-gray-100 rounded-lg">
                                        {gen.status === "processing" ? "Processing..." : "Generation Failed"}
                                    </div>
                                )}
                            </div>
                            
                        </div>
                        <div className="mt-4">
                        <Button 
                            onClick={() => {
                                console.log("Show Metadata", index);
                                setShowMetadata((prev) => ({ ...prev, [index]: !prev[index] }))
                            }}
                            className="border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                        >
                            <Info size={18} className="mr-2" /> Show Metadata
                        </Button>
                        {showMetadata[index] && (
                            <div className="mt-3 p-4 border rounded-md bg-gray-50 text-sm shadow-md w-full">
                            <p className="font-semibold text-gray-700">Metadata</p>
                            <div className="mt-2 grid gap-2 text-gray-600">
                                <p className="break-all"><strong>Reference URL:</strong> {gen.referenceVideoUrl}</p>
                                {gen.generatedUrl && <p className="break-all"><strong>Generated URL:</strong> {gen.generatedUrl}</p>}
                                <p><strong>Prompt:</strong> {gen.prompt}</p>
                                {/* {gen.size && <p><strong>Size:</strong> {gen.size}</p>}
                                {gen.length && <p><strong>Length:</strong> {gen.length}</p>} */}
                            </div>
                            </div>
                        )}
                    </div>
                    </ React.Fragment>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};

export default VideoGenerations;