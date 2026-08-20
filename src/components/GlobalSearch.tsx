import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, BookOpen, PenLine, Users, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { chatbots, categoryLabels } from "@/data/chatbots";
import { platformDocs } from "@/data/documentation";
import { blogPosts } from "@/data/blogPosts";
import { communityResources } from "@/data/communityResources";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  group: "platform" | "doc" | "blog" | "community";
  title: string;
  subtitle: string;
  icon: typeof Search;
  action: () => void;
}

const groupLabels: Record<SearchResult["group"], string> = {
  platform: "Platforms",
  doc: "Documentation",
  blog: "Blog",
  community: "Community",
};

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const list: SearchResult[] = [];
    for (const bot of chatbots) {
      list.push({ id: `bot-${bot.slug}`, group: "platform", title: bot.name, subtitle: `${categoryLabels[bot.category]} · ${bot.model || bot.type}`, icon: Sparkles, action: () => platformDocs[bot.slug] ? navigate(`/docs/${bot.slug}`) : navigate("/", { state: { q: bot.name } }) });
    }
    for (const doc of Object.values(platformDocs)) {
      list.push({ id: `doc-${doc.slug}`, group: "doc", title: `${doc.name} Guide`, subtitle: doc.overview.slice(0, 90), icon: BookOpen, action: () => navigate(`/docs/${doc.slug}`) });
    }
    for (const post of blogPosts) {
      list.push({ id: `blog-${post.id}`, group: "blog", title: post.title, subtitle: `${post.category} · ${post.readTime} · ${post.excerpt.slice(0, 80)}`, icon: PenLine, action: () => navigate(`/blog/${post.id}`) });
    }
    for (const resource of communityResources) {
      list.push({ id: `community-${resource.name}`, group: "community", title: resource.name, subtitle: resource.description.slice(0, 90), icon: resource.type === "discord" ? Users : FileText, action: () => window.open(resource.url, "_blank", "noopener,noreferrer") });
    }
    return list;
  }, [navigate]);

  const renderGroup = (group: SearchResult["group"]) => {
    const groupResults = results.filter((result) => result.group === group);
    const visible = expanded[group] ? groupResults : groupResults.slice(0, 5);
    return (
      <CommandGroup key={group} heading={groupLabels[group]}>
        {visible.map((result) => {
          const Icon = result.icon;
          return (
            <CommandItem key={result.id} value={`${group} ${result.title} ${result.subtitle}`} onSelect={() => { setOpen(false); result.action(); }}>
              <Icon className="mr-2 h-4 w-4 text-primary" />
              <div className="min-w-0">
                <span className="block truncate">{result.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
              </div>
            </CommandItem>
          );
        })}
        {groupResults.length > 5 && (
          <CommandItem onSelect={() => setExpanded((prev) => ({ ...prev, [group]: !prev[group] }))}>
            {expanded[group] ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            <span className="text-xs">{expanded[group] ? "Show fewer" : `Show all ${groupResults.length} ${groupLabels[group].toLowerCase()}`}</span>
          </CommandItem>
        )}
      </CommandGroup>
    );
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors" aria-label="Search the site">
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search platforms, docs, articles, communities..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {(["platform", "doc", "blog", "community"] as const).map(renderGroup)}
        </CommandList>
      </CommandDialog>
    </>
  );
};
