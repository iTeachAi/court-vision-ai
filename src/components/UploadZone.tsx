import { useState, useCallback, useRef } from "react";
import { Upload, Film, Loader2, X } from "lucide-react";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
}

const UploadZone = ({ onFileSelected, loading }: UploadZoneProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    setPreview({ url: URL.createObjectURL(file), name: file.name });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleAnalyze = () => {
    if (!inputRef.current?.files?.[0] && !preview) return;
    // Re-read from input or reconstruct — we stored the objectURL but need the file
    const fileInput = inputRef.current;
    if (fileInput?.files?.[0]) {
      onFileSelected(fileInput.files[0]);
    }
  };

  // If we have a file selected via drop (not input), store it
  const dropFileRef = useRef<File | null>(null);

  const handleFileWithRef = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) return;
    dropFileRef.current = file;
    setPreview({ url: URL.createObjectURL(file), name: file.name });
  }, []);

  const handleDropWithRef = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files[0]) handleFileWithRef(e.dataTransfer.files[0]);
    },
    [handleFileWithRef]
  );

  const triggerAnalyze = () => {
    const file = dropFileRef.current || inputRef.current?.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <section className="min-h-screen flex items-center justify-center px-6 gradient-mesh">
      <div className="w-full max-w-2xl">
        {!preview ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDropWithRef}
            onClick={() => !loading && inputRef.current?.click()}
            className={`
              relative rounded-2xl p-16 text-center transition-all duration-500 cursor-pointer glass
              ${dragActive ? "neon-glow border-primary/40 scale-[1.02]" : "hover:border-primary/20"}
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileWithRef(f);
              }}
            />
            <div className="flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">Drop your game footage here</p>
                <p className="text-sm text-muted-foreground mt-2">MP4, MOV, AVI — up to 500MB</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden glass">
            {/* Video preview */}
            <div className="relative">
              <video src={preview.url} className="w-full aspect-video bg-background/80" controls={false} muted />
              {!loading && (
                <button
                  onClick={clearPreview}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Film className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm text-foreground font-medium truncate">{preview.name}</span>
              </div>

              <button
                onClick={triggerAnalyze}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all duration-300 hover:scale-105 neon-glow disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default UploadZone;
