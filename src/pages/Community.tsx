import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Users, ExternalLink, Send, Copy, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { communityResources as resources, communityTypeLabels as typeLabels, type CommunityResource } from "@/data/communityResources";
import { supabase } from "@/integrations/supabase/client";

const SUBMIT_EMAIL = "submit@nsfw-ai-directory.example";
const SUBJECT = "Platform Submission";
interface CommunityCard { id: string; title: string; description: string; tags: string[]; content_rating: string; card_json: unknown; created_at: string; }

const Community = () => {
  const [subName, setSubName] = useState("");
  const [subUrl, setSubUrl] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [subNotes, setSubNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [galleryCards, setGalleryCards] = useState<CommunityCard[]>([]);
  const [galleryQuery, setGalleryQuery] = useState("");
  const [galleryRating, setGalleryRating] = useState<"all" | "SFW" | "NSFW">("all");

  useEffect(() => {
    if (typeof (supabase as unknown as { from?: unknown }).from !== "function") return;
    supabase.from("community_cards").select("id,title,description,tags,content_rating,card_json,created_at").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setGalleryCards((data || []) as CommunityCard[]), () => setGalleryCards([]));
  }, []);

  const grouped = {
    reddit: resources.filter((r) => r.type === "reddit"),
    discord: resources.filter((r) => r.type === "discord"),
    site: resources.filter((r) => r.type === "site"),
    forum: resources.filter((r) => r.type === "forum"),
    wiki: resources.filter((r) => r.type === "wiki"),
  };

  const mailtoHref = () => {
    const body = [
      "Platform name: " + subName,
      "URL: " + subUrl,
      "Category: " + (subCategory || "Not sure"),
      "",
      "Notes:",
      subNotes,
    ].join("\n");
    return `mailto:${SUBMIT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
  };

  const canSubmit = subName.trim() && subUrl.trim();

  const handleCopySummary = () => {
    const text = `Platform: ${subName}\nURL: ${subUrl}\nCategory: ${subCategory || "Not sure"}\nNotes: ${subNotes}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCard = (r: CommunityResource) => (
    <a
      key={r.name}
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium rounded border px-2 py-0.5 ${typeLabels[r.type].color}`}>
          {typeLabels[r.type].label}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{r.name}</h3>
      <p className="text-sm text-muted-foreground">{r.description}</p>
    </a>
  );

  const visibleCards = galleryCards.filter((card) => (galleryRating === "all" || card.content_rating === galleryRating) && `${card.title} ${card.description} ${(card.tags || []).join(" ")}`.toLowerCase().includes(galleryQuery.toLowerCase()));

  return (
    <Layout>
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-primary">Community</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-5xl glow-text mb-3">
            Community & Resources
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Reddit threads, Discord servers, character libraries, and community hubs for the NSFW AI chatbot ecosystem.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-10">
        {/* Reddit */}
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">Reddit Communities</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.reddit.map(renderCard)}
          </div>
        </section>

        {/* Discord */}
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">Discord Servers</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.discord.map(renderCard)}
          </div>
        </section>

        {/* Sites & Libraries */}
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">Character Libraries & Tools</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.site.map(renderCard)}
          </div>
        </section>

        {/* Forums */}
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">Forums & Boards</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.forum.map(renderCard)}
          </div>
        </section>

        {/* Documentation */}
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground mb-4">Official Documentation</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.wiki.map(renderCard)}
          </div>
        </section>

        {/* Community card showcase */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold text-foreground mb-2">Community Card Showcase</h2>
          <p className="text-sm text-muted-foreground mb-4">Browse cards shared through Supabase. Search and rating filters run against the public gallery; the builder never uploads a card without an explicit share action.</p>
          <div className="flex flex-wrap gap-2 mb-4"><div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={galleryQuery} onChange={(event) => setGalleryQuery(event.target.value)} placeholder="Search cards or tags" className="pl-9 bg-secondary" /></div>{(["all", "SFW", "NSFW"] as const).map((rating) => <button key={rating} onClick={() => setGalleryRating(rating)} className={`rounded-md border px-3 py-2 text-xs ${galleryRating === rating ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"}`}>{rating === "all" ? "All ratings" : rating}</button>)}</div>
          {visibleCards.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleCards.map((card) => <article key={card.id} className="rounded-lg border border-border bg-secondary/30 p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold text-foreground">{card.title}</h3><span className="text-xs text-muted-foreground">{card.content_rating}</span></div><p className="mt-1 text-sm text-muted-foreground line-clamp-3">{card.description}</p><div className="mt-2 flex flex-wrap gap-1">{(card.tags || []).map((tag) => <span key={tag} className="rounded bg-background px-2 py-0.5 text-[11px] text-muted-foreground">#{tag}</span>)}</div><a href="/tools" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Open in Card Builder →</a></article>)}</div> : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No shared cards yet. Create one in the Card Builder and share it when publishing is enabled.</p>}
        </section>

        {/* Submit a platform */}
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <h2 className="font-display text-xl font-semibold text-foreground mb-2">
            Submit a Platform
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
            Know a platform that's missing from the directory? Fill this out and it composes a submission email for us — or copy the summary and paste it into the community Discord.
          </p>
          <div className="space-y-4 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Platform name *</label>
                <Input
                  placeholder="Example AI"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">URL *</label>
                <Input
                  placeholder="https://example.ai"
                  value={subUrl}
                  onChange={(e) => setSubUrl(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Best-fit category</label>
              <Select value={subCategory} onValueChange={setSubCategory}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local Frontend</SelectItem>
                  <SelectItem value="hosted">Hosted RP Platform</SelectItem>
                  <SelectItem value="libraries">Character Library</SelectItem>
                  <SelectItem value="companion">Companion App</SelectItem>
                  <SelectItem value="providers">Model Provider</SelectItem>
                  <SelectItem value="hybrid">Image + Chat Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Notes (model, pricing, why it belongs)</label>
              <Textarea
                placeholder="What model does it run? Is there an API? What makes it worth listing?"
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                className="min-h-[100px] bg-secondary border-border text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild disabled={!canSubmit}>
                <a href={mailtoHref()}>
                  <Send className="h-4 w-4" />
                  Compose Submission Email
                </a>
              </Button>
              <Button variant="outline" onClick={handleCopySummary} disabled={!canSubmit}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Summary"}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default Community;
