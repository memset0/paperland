import { Archive, BookOpen, Bot, BrainCircuit, ChartNoAxesCombined, CircleHelp, Code, Compass, FileText, FlaskConical, GitBranch, History, Layers, Library, Lightbulb, ListChecks, MessagesSquare, RefreshCw, Search, Sparkles, Target, Telescope, Trophy, Wrench } from '@lucide/vue'

const icons = { Archive, BookOpen, Bot, BrainCircuit, ChartNoAxesCombined, CircleHelp, Code, Compass, FileText, FlaskConical, GitBranch, History, Layers, Library, Lightbulb, ListChecks, MessagesSquare, RefreshCw, Search, Sparkles, Target, Telescope, Trophy, Wrench }
export function topicIcon(name?: string) {
  const key = name?.replace(/[-_]/g, '').toLowerCase()
  return Object.entries(icons).find(([n]) => n.toLowerCase() === key)?.[1] ?? FileText
}
