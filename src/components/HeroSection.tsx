import { Upload } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

interface HeroSectionProps {
  onGetStarted: () => void;
}

const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt=""
          className="w-full h-full object-cover opacity-30"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Gradient mesh overlay */}
      <div className="absolute inset-0 gradient-mesh" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 opacity-0 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-sm font-medium text-muted-foreground">
            AI-Powered Analysis
          </span>
        </div>

        <h1
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          <span className="text-foreground">AI Basketball</span>
          <br />
          <span className="text-primary neon-text">Coach</span>
        </h1>

        <p
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          Turn game footage into real coaching intelligence. Upload your video
          and get instant, frame-by-frame tactical breakdown.
        </p>

        <button
          onClick={onGetStarted}
          className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg transition-all duration-300 hover:scale-105 neon-glow hover:shadow-[0_0_40px_hsla(142,72%,50%,0.3)] opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.45s" }}
        >
          <Upload className="w-5 h-5 transition-transform group-hover:-translate-y-0.5" />
          Upload Video
        </button>

        {/* Stats row */}
        <div
          className="flex items-center justify-center gap-8 md:gap-16 mt-20 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.6s" }}
        >
          {[
            { value: "< 30s", label: "Analysis Time" },
            { value: "98%", label: "Accuracy" },
            { value: "Frame", label: "Level Detail" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
