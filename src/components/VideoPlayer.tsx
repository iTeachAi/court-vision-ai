import { forwardRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { TimelineEvent } from "@/lib/api";

const eventDot: Record<string, string> = {
  drive: "bg-primary",
  retreat: "bg-destructive",
  stall: "bg-warning",
};

interface VideoPlayerProps {
  videoUrl: string;
  currentTime: number;
  duration: number;
  activeEvent: TimelineEvent | null;
  onTimeUpdate: (time: number) => void;
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ videoUrl, currentTime, duration, activeEvent, onTimeUpdate }, ref) => {
    const [playing, setPlaying] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);

    const videoEl = () => (ref as React.RefObject<HTMLVideoElement>)?.current;

    const togglePlay = () => {
      const v = videoEl();
      if (!v) return;
      if (playing) v.pause();
      else v.play();
      setPlaying(!playing);
    };

    const restart = () => {
      const v = videoEl();
      if (!v) return;
      v.currentTime = 0;
      v.play();
      setPlaying(true);
    };

    if (!videoUrl) {
      return (
        <div className="relative rounded-2xl overflow-hidden glass flex items-center justify-center aspect-video bg-background/80">
          <p className="text-muted-foreground text-sm">No video available</p>
        </div>
      );
    }

    return (
      <div className="relative rounded-2xl overflow-hidden glass">
        <video
          ref={ref}
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full aspect-video bg-background/80"
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            setVideoError("Could not load the processed video.");
          }}
          onLoadedData={() => setVideoError(null)}
        />

        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <p className="text-sm text-destructive font-medium">{videoError}</p>
          </div>
        )}

        {activeEvent && (
          <div className="absolute top-4 left-4 glass-strong rounded-xl px-4 py-2 flex items-center gap-2 animate-scale-in">
            <span className={`w-2 h-2 rounded-full ${eventDot[activeEvent.event] || "bg-muted-foreground"}`} />
            <span className="text-sm font-medium text-foreground capitalize">{activeEvent.event}</span>
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors">
              {playing ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
            </button>
            <button onClick={restart} className="w-10 h-10 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm text-muted-foreground ml-2 font-mono">
              {currentTime.toFixed(1)}s / {duration}s
            </span>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
