import { NavBar } from "@/components/landing/NavBar";
import { Hero } from "@/components/landing/Hero";
import { DataSources } from "@/components/landing/DataSources";
import { LiveFeed } from "@/components/landing/LiveFeed";
import { LiveTicker } from "@/components/landing/LiveTicker";
import { DemoStages } from "@/components/landing/DemoStages";
import { RiskGallery } from "@/components/landing/RiskGallery";
import { Quote } from "@/components/landing/Quote";
import { ImpactCounter } from "@/components/landing/ImpactCounter";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <Hero />
        <DataSources />
        <LiveTicker />
        <LiveFeed />
        <DemoStages />
        <RiskGallery />
        <Quote />
        <ImpactCounter />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
