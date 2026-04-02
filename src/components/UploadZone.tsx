import { useState, useCallback, useRef } from "react";
import { Upload, Film, Loader2, CheckCircle2 } from "lucide-react";

type UploadStatus = "idle" | "uploading" | "analyzing" | "complete" | "error";

interface UploadZoneProps {
  onAnalysisComplete: (data: AnalysisResult, videoUrl: string) => void;
}

export interface TimelineEvent {
  time: number;
  event: string;
  decision: "good" | "bad" | "neutral";
  defender_distance: number;
  feedback: string;
}

export interface AnalysisResult {
  timeline: TimelineEvent[];
  total_events: number;
  duration: number;
}

const MOCK_RESULT: AnalysisResult = {
  timeline: [
    { time: 1.5, event: "drive", decision: "bad", defender_distance: 42.3, feedback: "You attacked into pressure and gave up advantage. The defender was closing in at 42.3 inches." },
    { time: 3.8, event: "retreat", decision: "good", defender_distance: 68.1, feedback: "Smart pullback — you recognized the double team early and reset the play." },
    { time: 6.2, event: "drive", decision: "good", defender_distance: 91.5, feedback: "Great read. Defender was 91.5 inches away — open lane, aggressive finish." },
    { time: 8.9, event: "stall", decision: "neutral", defender_distance: 55.0, feedback: "Hesitation at the elbow. Neither good nor bad, but you lost momentum." },
    { time: 11.1, event: "drive", decision: "bad", defender_distance: 38.7, feedback: "Forced drive into traffic. Should have kicked out to the open wing." },
  ],
  total_events: 5,
  duration: 12.5,
};

const UploadZone = ({ onAnalysisComplete }: UploadZoneProps) => {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const simulateProcess = useCallback(
    (file: File) => {
      setFileName(file.name);
      setStatus("uploading");
      setProgress(0);

      const videoUrl = URL.createObjectURL(file);

      // Simulate upload
      const uploadInterval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(uploadInterval);
            setStatus("analyzing");
            setProgress(0);

            // Simulate analysis
            const analyzeInterval = setInterval(() => {
              setProgress((ap) => {
                if (ap >= 100) {
                  clearInterval(analyzeInterval);
                  setStatus("complete");
                  setTimeout(() => {
                    onAnalysisComplete(MOCK_RESULT, videoUrl);
                  }, 800);
                  return 100;
                }
                return ap + 2;
              });
            }, 60);

            return 100;
          }
          return p + 4;
        });
      }, 40);
    },
    [onAnalysisComplete]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("video/")) {
        simulateProcess(file);
      }
    },
    [simulateProcess]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const statusConfig = {
    idle: { icon: Upload, text: "Drop your game footage here", sub: "MP4, MOV, AVI — up to 500MB" },
    uploading: { icon: Loader2, text: "Uploading...", sub: fileName },
    analyzing: { icon: Film, text: "Analyzing gameplay...", sub: "AI is breaking down every frame" },
    complete: { icon: CheckCircle2, text: "Analysis complete", sub: "Loading results..." },
    error: { icon: Upload, text: "Something went wrong", sub: "Try again" },
  };

  const { icon: Icon, text, sub } = statusConfig[status];

  return (
    <section className="min-h-screen flex items-center justify-center px-6 gradient-mesh">
      <div className="w-full max-w-2xl">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => status === "idle" && inputRef.current?.click()}
          className={`
            relative rounded-2xl p-16 text-center transition-all duration-500 cursor-pointer
            glass
            ${dragActive ? "neon-glow border-primary/40 scale-[1.02]" : "hover:border-primary/20"}
            ${status !== "idle" ? "pointer-events-none" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          <div className="flex flex-col items-center gap-6">
            <div className={`
              w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300
              ${status === "complete" ? "bg-primary/20" : "bg-secondary"}
              ${status === "analyzing" || status === "uploading" ? "animate-pulse-glow" : ""}
            `}>
              <Icon className={`w-8 h-8 ${status === "complete" ? "text-primary" : "text-muted-foreground"} ${status === "uploading" || status === "analyzing" ? "animate-spin" : ""}`} />
            </div>

            <div>
              <p className="text-xl font-semibold text-foreground">{text}</p>
              <p className="text-sm text-muted-foreground mt-2">{sub}</p>
            </div>

            {(status === "uploading" || status === "analyzing") && (
              <div className="w-full max-w-xs">
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UploadZone;
