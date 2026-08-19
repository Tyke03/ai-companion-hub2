import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Search, Scale, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  chatbots, categoryLabels, categoryColors, categoryDescriptions, contentLevelLabels,
  type Category, type Chatbot,
} from "@/data/chatbots";
import { ChatbotCard } from "@/components/ChatbotCard";
import { Layout } from "@/components/Layout";
import { useDebounce } from "@/hooks/useDebounce";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const categories: Category[] = ["local", "hosted", "libraries", "companion", "providers", "hybrid"];
const MAX_COMPARE = 6;

const apiAccessLabel: Record<string, string> = {
  none: "None",
  open: "Open key",
  subscription: "Paid plan",
};

const Index = () => {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 250);

  // Support global search navigation: /  with state { q }
  useEffect(() => {
    const q = (location.state as { q?: string } | null)?.q;
    if (q) {
      setSearch(q);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const toggleCompare = (slug: string) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < MAX_COMPARE) next.add(slug);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return chatbots.filter((bot) => {
      const matchSearch =
        !q ||
        bot.name.toLowerCase().includes(q) ||
        bot.description.toLowerCase().includes(q) ||
        bot.type.toLowerCase().includes(q) ||
        bot.nsfwPolicy.toLowerCase().includes(q) ||
        bot.category.toLowerCase().includes(q) ||
        (bot.model || "").toLowerCase().includes(q) ||
        (bot.pricing || "").toLowerCase().includes(q) ||
        (bot.contextWindow || "").toLowerCase().includes(q) ||
        (bot.memory || "").toLowerCase().includes(q) ||
        (bot.knownIssues || "").toLowerCase().includes(q);
      const matchCategory =
        activeCategory === "all" || bot.category === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [debouncedSearch, activeCategory]);

  const compareBots = useMemo(
    () => chatbots.filter((b) => compareSet.has(b.slug)),
    [compareSet],
  );

  const comparisonRows: { label: string; value: (b: Chatbot) => ReactNode }[] = [
    { label: "Category", value: (b) => categoryLabels[b.category] },
    { label: "Content level", value: (b) => `Level ${b.contentLevel} — ${contentLevelLabels[b.contentLevel]}` },
    { label: "Model", value: (b) => b.model || "—" },
    { label: "Context window", value: (b) => b.contextWindow || "—" },
    { label: "Pricing", value: (b) => b.pricing || "—" },
    { label: "API access", value: (b) => (b.apiAccess ? apiAccessLabel[b.apiAccess] : "—") },
    { label: "Memory", value: (b) => b.memory || "—" },
    { label: "Explicit chat", value: (b) => (b.hasExplicitChat ? "Yes" : "No") },
    { label: "Image gen", value: (b) => (b.hasImageGen ? "Yes" : "No") },
    { label: "Voice", value: (b) => (b.hasVoice ? "Yes" : "No") },
    { label: "Card format", value: (b) => b.cardFormat || "—" },
    { label: "Known issues", value: (b) => b.knownIssues || "—" },
    { label: "Last verified", value: (b) => b.lastVerified },
    { label: "Access type", value: (b) => b.type },
  ];

  return (
    <Layout>
      <Helmet>
        <title>NSFW AI Chatbot Directory — 50+ Platforms Compared</title>
        <meta
          name="description"
          content="Browse and compare 50+ NSFW AI chatbot platforms including SillyTavern, Janitor AI, Character.AI, CrushOn, and more. Filtered by category, access type, and content level."
        />
      </Helmet>

      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-5xl glow-text mb-3">
            NSFW AI Chatbot Directory
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Discover {chatbots.length}+ AI chatbot platforms — from local privacy-first
            tools to web-based companions. Curated, categorized, and uncensored.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="sticky top-[57px] z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search platforms, models, pricing..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({chatbots.length})
            </button>
            {categories.map((cat) => {
              const count = chatbots.filter((b) => b.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  title={categoryDescriptions[cat]}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? `${categoryColors[cat]}`
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {categoryLabels[cat]} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="container mx-auto px-4 py-8">
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              No platforms match your search.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((bot) => (
              <ChatbotCard
                key={bot.name}
                bot={bot}
                compareSelected={compareSet.has(bot.slug)}
                onCompareToggle={toggleCompare}
              />
            ))}
          </div>
        )}
        <p className="mt-8 text-xs text-muted-foreground/70">
          Content levels (1–5) are based on platform claims and community reports, not first-party
          audits — policies change, so always verify before relying on them. Each card shows a
          last-verified date.
        </p>
      </main>

      {/* Compare bar */}
      {compareBots.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card/95 px-4 py-2.5 shadow-2xl backdrop-blur">
            <span className="text-sm text-muted-foreground">
              {compareBots.length} selected
              {compareBots.length >= MAX_COMPARE && " (max)"}
            </span>
            <div className="flex -space-x-2">
              {compareBots.slice(0, 5).map((b) => (
                <span
                  key={b.slug}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-foreground"
                  title={b.name}
                >
                  {b.name.slice(0, 2).toUpperCase()}
                </span>
              ))}
            </div>
            <Button size="sm" onClick={() => setCompareOpen(true)} disabled={compareBots.length < 2}>
              <Scale className="h-4 w-4" />
              Compare ({compareBots.length})
            </Button>
            <button
              onClick={() => setCompareSet(new Set())}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear comparison"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Compare drawer */}
      <Sheet open={compareOpen} onOpenChange={setCompareOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Compare Platforms</SheetTitle>
            <SheetDescription>
              Side-by-side attributes for {compareBots.length} selected platforms.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 bg-background px-3 py-2 text-left font-medium text-muted-foreground w-32">Attribute</th>
                  {compareBots.map((b) => (
                    <th key={b.slug} className="px-3 py-2 text-left font-display font-semibold text-foreground">
                      <div className="flex items-center justify-between gap-2">
                        {b.name}
                        <button
                          onClick={() => toggleCompare(b.slug)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={`Remove ${b.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-border/60">
                    <td className="sticky left-0 bg-background px-3 py-2 text-xs font-medium text-muted-foreground align-top">{row.label}</td>
                    {compareBots.map((b) => (
                      <td key={b.slug} className="px-3 py-2 text-xs text-foreground/90 align-top">
                        {row.value(b)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setCompareSet(new Set())}>
              <X className="h-4 w-4" />
              Clear all
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Layout>
  );
};

export default Index;
