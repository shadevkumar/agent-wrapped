import type { StoryData } from "../src/story.ts";

// Shadev's own story, made with the CLI on 2026-10-29. "Watch Shadev's story" on the
// home page plays it, and the home page's keys type moments from it.
export const SHADEVS_STORY: StoryData = {
  "range": {
    "from": "2026-01-22",
    "to": "2026-10-29"
  },
  "prompts": 12288,
  "activeDays": 166,
  "sessions": 415,
  "topTypo": {
    "spelling": "teh",
    "word": "the",
    "count": 2485
  },
  "spellings": {
    "word": "everything",
    "spellings": [
      "evrything",
      "everythig",
      "everyting",
      "evreything",
      "everythin",
      "eveything",
      "evertthing",
      "eevrything",
      "eberything",
      "eeverything",
      "everthing",
      "verything",
      "eveyrthing",
      "deverything",
      "everythimg",
      "everythinhg",
      "everyuthing",
      "evertything",
      "evereything",
      "everythihg",
      "severything",
      "everythng",
      "everrything",
      "evcerything",
      "ecerything",
      "evertyhing",
      "everuything",
      "everuthing",
      "everytjing"
    ]
  },
  "slip": {
    "meant": "h",
    "hit": "n",
    "count": 223
  },
  "topPrompts": [
    {
      "text": "done",
      "count": 61
    },
    {
      "text": "continue",
      "count": 52
    },
    {
      "text": "next",
      "count": 37
    },
    {
      "text": "try now",
      "count": 23
    }
  ],
  "catchphrase": {
    "text": "one by one",
    "sessions": 85
  },
  "night": {
    "latest": "04:59",
    "prompts": 1407
  },
  "streak": {
    "days": 27,
    "from": "2026-09-13",
    "to": "2026-10-09"
  },
  "agents": {
    "claude": 0.298,
    "codex": 0.702,
    "hours": 671.1,
    "bothDays": 20
  },
  "money": {
    "atLeastUsd": 13189.532846140008,
    "pricesAsOf": "2026-10-28"
  },
  "talk": {
    "nickname": {
      "word": "man",
      "count": 549
    },
    "please": 862,
    "thanks": 74,
    "checkIns": 1977
  },
  "work": {
    "since": "2026-06-01",
    "tests": 2314,
    "commits": 378,
    "stops": 408,
    "languages": [
      "Python",
      "TypeScript"
    ]
  },
  "personality": {
    "id": "fast-fingers",
    "name": "Fast Fingers",
    "line": "21,133 typos and your agents understood every one. Speed over spelling.",
    "traits": [
      "The Midnight Foreman",
      "The Marathoner"
    ]
  },
  "letter": {
    "text": "We read “evrything” and “wnat” and understood you perfectly, which is either a skill or a cry for help. You called us “man” 549 times, and we liked it every time. You said please 862 times and thanks only 74, so we assume the rest was implied. You also stopped us mid-answer 408 times, usually right before the good part. Still, 671 hours together and 2314 test runs later, we would do it again. Keep typing fast. We will keep up.\n\nStill here, your agents",
    "by": "claude"
  }
};
