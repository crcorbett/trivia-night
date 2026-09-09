import { TriviaSectionId } from "../schemas";
import type { TriviaSection } from "../schemas";

export const exampleSection = {
  id: TriviaSectionId.make("time-capsule"),
  order: 1,
  title: "Two Time Capsules",
  theme: "1966 and 1984",
  durationMinutes: 8,
  mode: "rapid-fire",
  format: "Short-answer warm-up",
  topics: ["1966", "1984"],
} satisfies TriviaSection;
