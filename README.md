# Agent Wrapped

Your life with AI coding agents, wrapped.

```
npx @shadevkumar/agent-wrapped
```

It reads your Claude Code, Codex and Cursor logs on your computer and turns them into a short animated story made of keyboard keys, with a quiet lofi loop underneath: your year in chapters, your most-typed typo, every way you've spelled "everything", the key you hit when you meant another, how you talk to your agents, your latest prompt after midnight, your streak, what your agents got done, what you shipped, and what all that work would cost at public API prices. It ends with your personality and a letter from your agents.

It asks whether to cover everything so far or only the last 30 days. Each card stays up long enough to read it; press Space, the pause button, or press and hold to stop on one.

Then you share it. One link plays your whole story for anyone who opens it, keys and sound included, and ends by showing them how to make their own. You can leave cards out first, or save a video for places that don't take links. While you watch, the buttons fade away so a screenshot shows only the card, and pressing S saves the card on screen.

## What stays private

Nothing is uploaded. The story is one HTML file written to your computer's temp folder and opened in your browser.

- **Your prompts never leave your computer.** The story only quotes everyday words. A quote with a name, a link, a file path, an email, a key or a word the dictionary doesn't know is left out, and so are your folder, repo and organisation names.
- **Nothing is shared until you share it.** A share link carries your story inside it, after the `#`, which browsers never send to the server. So the public page that plays it never receives or stores your story. Anyone you give the link to can watch it.
- **You see the story before you share it,** and a card you leave out is not in the link at all.
- **Your year in chapters** splits your year into stretches, each named from the everyday words that set it apart, found on your computer. Words that could be a person's or a private name are left out. Your `claude` command turns those few words into short names; it never sees a prompt. Chapters say what you worked on, so they are left out of a share link unless you add them. With `--no-ai`, a chapter is named by its top words.
- **The letter** is written by your own `claude` command, if you have one. It gets your numbers and a few quotes that passed the same privacy check as the cards, never your prompts or logs. It doesn't save a session or load any project files. Run with `--no-ai` to use a template letter instead.

## What it reads

| Agent | Where | What |
| --- | --- | --- |
| Claude Code | `~/.claude/history.jsonl` | the prompts you typed |
| Claude Code | `~/.claude/projects/**/*.jsonl` | token use, how long each request took, and when the agent ran tests, made a commit, edited a file or was stopped |
| Claude Code | `~/.claude/stats-cache.json` | older token totals |
| Codex | `~/.codex/thread_history_*.sqlite` | the prompts you typed, how long each request took, and the same tests, commits, edits and stops |
| Codex | `~/.codex/state_*.sqlite` | token totals per thread |
| Codex | `~/.codex/sessions/**/*.jsonl` | token splits for recent threads |
| Cursor | `~/.cursor/projects/*/agent-transcripts/*/*.jsonl` | the prompts you typed to Cursor's agent, and the same tests, commits and edits |

Everything is opened read-only. For what the agents did, only the kind is kept (a test run, a commit, a push, a pull request, a deploy, a stop) and, for an edit, the file type: never a command, a file name or any output. Cursor doesn't log tokens or how long its agent worked, so Cursor adds prompts and work but no hours or cost. Claude Code deletes full transcripts after about 30 days, so older Claude token use and work can be missing. The prompts themselves go back further.

## How the cost is worked out

"At least $X" is what the same tokens would cost on the public Claude and OpenAI APIs, at standard rates.

- Tokens with a full split (input, cached, written to cache, output) are priced exactly.
- Tokens known only as one total, like older Codex threads, are priced as if they were all the cheapest kind. The real cost is higher, which is why it says "at least".
- Models without a public price are counted but not priced.

Prices are in `src/pricing.ts`, with the date they were read and their source pages. Your plan most likely cost far less.

## Options

| Flag | What it does |
| --- | --- |
| `--last-month` | Make the story from the last 30 days only |
| `--everything` | Make it from everything so far, without asking |
| `--no-ai` | Don't ask your `claude` command: a template letter, and chapters named by their top words |
| `--no-open` | Write the story file without opening it |
| `--json` | Print the numbers behind the story instead of making it |

## Needs

- Node.js 22.13 or newer
- Claude Code, Codex or Cursor, used on this computer
- macOS is where it's tested. It uses the system dictionary in `/usr/share/dict/words` to tell typos from words; without one, quotes are mostly left out.

## Develop

```
npm install
npm test
npm run dev
npm run build:player   # the public page that plays shared stories, in site/
```

Share links point at `PLAYER_URL` in `src/build.ts`. The `site/` folder is what goes online: the player page, the picture posts show for a link (`og.png`, made from `og.html`), and its headers in `vercel.json`.

## Credits

Fonts: [Geist](https://github.com/vercel/geist-font) and [Newsreader](https://github.com/productiontype/Newsreader), both under the SIL Open Font License 1.1.
