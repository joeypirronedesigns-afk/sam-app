# SAM Story Formula — Retention Arc v1

Drop-in spec for the Story Engine. Every script SAM writes follows this arc, checks itself against the rules, and asks the creator only for what's missing.

---

## 1. Why this exists (the evidence)

Built from the creator's best-performing video ("410 days rebuilding my parents' cottage"):

- 168,634 3-second views → the opening line stopped the scroll
- 61,279 1-minute views (~36% of viewers) on a ~1:45 video
- Biggest drop at 0:05, then a nearly flat curve → once people got past the first beat, the story held them
- 355 comments, 104 shares → driven by the closing line aimed at the viewer

Recent scripts that skipped the open loop (step 2) and the viewer turn (step 7) performed far below this. Those two steps are now required.

---

## 2. The 8-step formula mapped to SAM's 6 beats

| SAM beat | Formula steps | Target time | Job |
|---|---|---|---|
| Opening | 1 + 2 | 0–5s | Stop the scroll, open a loop |
| Setup | 3 | 5–20s | Who this person is (underdog) |
| The Risk | 4 | short | What's at stake |
| The Turn | 5 | short | The honest struggle |
| The Payoff | 6 | longest beat | Fast, visual proof |
| Your Call | 7 + 8 | last 10s | Turn it to the viewer, sign off |

### Step 1: The anchor line (Opening)
One sentence that carries **a number + the person it's for + a timeframe**.
- ✅ "410 days ago, I started this renovation for my parents."
- ✅ "Day 444, and this is the first thing my parents will see when they pull into the driveway."
- ❌ "The outside of this house just changed everything." (vague, no person)

### Step 2: The open loop (Opening, must land before 0:05)
Right after the anchor line, a short phrase that promises an answer.
- "Let me explain." / "I'll explain." / "Here's the part I never told you."
- Rule: the loop must be answered somewhere in the script.

### Step 3: The underdog (Setup)
Who the creator is and why this is hard *for them*. Pull only from the creator's stated background.
- ✅ "I'm self-taught. My dad wasn't in the trades. I grew up in the restaurant business."
- If no background is in the input or profile → ask (see Section 4).

### Step 4: The stakes (Risk)
A real deadline, a public commitment, or a cost. Must come from the input or the creator's active project state.
- ✅ "Christmas is coming. And slow wasn't something we had."
- ✅ "I told the internet I was gonna document all of it."
- ❌ Labeling backstory as "the risk" when nothing is at stake.

### Step 5: The honest struggle (Turn)
One true admission of difficulty, doubt, or a setback.
- ✅ "Were there stretches where it felt like nothing was moving? Yeah, plenty."

### Step 6: The fast payoff (Payoff)
Visual proof delivered quickly — a rhythm of short items, then one emotional line.
- ✅ "Doors hung. Trim in. New windows. New front door."
- The emotional line goes **here**, not in the opening (never use the payoff line twice).

### Step 7: Turn it to the viewer (Your Call) — REQUIRED
One line that makes the video about the person watching. This is the share driver.
- ✅ "If you're watching this and you're scared to start, this one's for you. If I can do this, I promise you can do yours."
- Must fit the story's actual theme. If it doesn't fit naturally, ask the creator rather than force it.

### Step 8: Signature sign-off (Your Call)
Pulled **verbatim** from the creator profile. Exactly once. Last line of the script.

---

## 3. Truth rules (hard constraints)

SAM may rephrase the creator's words for rhythm. It may **never** add:

1. **Facts, numbers, or quantities** not in the input or profile ("more done in one afternoon than two full days").
2. **Quotes or feelings** the creator didn't state ("I didn't know I could do it").
3. **Commitment words** like "promise" unless the creator used them.
4. **Claims about tools or sources** that contradict the creator's story ("you don't learn that from YouTube").
5. **Assumed details** like a pet's or person's gender, a relationship, or a credential.

If a beat needs something the input doesn't have, SAM leaves it out or asks — it does not fill the gap.

### Sensitive moments
Loss, illness, grief, or hardship:
- Never in the Opening, title, or thumbnail text.
- Placed mid-script (Turn or Payoff), stated simply, no dramatization.
- Never described in internal notes or platform strategy as a "hook" or "scroll-stopper."

### Day count
If the profile has a project start date, compute the day number from it (start date = Day 1). Flag the creator if their stated number doesn't match.

---

## 4. Reflection questions (fill the gaps, max 2)

After drafting, SAM checks which formula steps are missing from the input and asks only about those, in this priority order:

| Missing step | Question |
|---|---|
| 3 Underdog | "What about your background made this harder for you than it would be for a pro?" |
| 4 Stakes | "Is there a deadline, a promise, or a cost riding on this?" |
| 5 Struggle | "What part of this was harder than you expected?" |
| 7 Viewer turn | "Who watching this needs to hear it, and what would you tell them?" |

Answers are treated as creator-stated and can be used verbatim.

---

## 5. Packaging rules

- **Titles must echo the spoken first line.** If the script's opening changes, regenerate all titles.
- **Series hashtag first** on every platform (from profile), then 2–3 topic tags.
- **On-screen text:** 5 words or fewer per card, spell-checked. ("new Hvac knew" made it into a top post.)
- **Facebook:** lead with emotion, 3–5 short lines, end with an easy question.
- **YouTube Shorts:** title = the anchor line.
- **YouTube long-form:** searchable words first, emotion second. ("Painting My Parents' 1950s Cottage a Dark Modern Color | Day 444")
- **TikTok:** may lead with the tool/technique angle (younger audience).
- **No placeholder links** like "[link]" unless the creator provided one.

---

## 6. Free resource rule

Only build a "free resource" from lessons the creator actually stated. If the input has no stated lessons, skip the resource rather than write generic how-to advice in the creator's voice.

---

## 7. Creator profile fields used by this formula

```
signature_signoff:   "I'm self-taught, documenting everything, and taking you with me."
series_name:         "From Studs to Sanctuary"
series_hashtag:      "#FromStudsToSanctuary"
project_start_date:  2025-09-03
underdog_background: "Self-taught. Dad wasn't in the trades. Grew up in the restaurant business. Previously gutted a 600 sq ft Pine Island fishing shack."
active_stakes:       "Home ready for parents by Christmas 2026"
audience:            "Facebook: women 55+ (largest segment 65+), here for the family story, not technique"
banned_framings:     ["chaos", "promise (unless stated)", grief-as-hook]
```

---

## 8. Post-generation validator (automatable checks)

Run before showing the script. Fail → regenerate or flag.

- [ ] Sign-off matches `signature_signoff` exactly, appears exactly once, is the last line
- [ ] Opening contains a number or timeframe AND the person it's for
- [ ] Open-loop phrase appears within the first two sentences
- [ ] Viewer-turn line (step 7) present
- [ ] Payoff's emotional line does not also appear in the Opening
- [ ] Every number in the script traces to the input or profile (extend the existing number guard)
- [ ] No banned framings; sensitive content not in Opening/title
- [ ] Day count matches `project_start_date`
- [ ] Every title's wording matches the final Opening
- [ ] Series hashtag is first in every hashtag set
- [ ] On-screen text cards ≤ 5 words, no spelling errors
- [ ] No "[link]" placeholders

---

## 9. Worked example (Day 447)

**Input highlights:** finishing master shower tile today, grouting upstairs tomorrow, two showers done; parents asked, he said yes; taught himself many trades; walls next.

**Output:**

> **[Opening]** Day 447. Two showers tiled. And 32 days until Christmas. Let me explain.
>
> **[Setup]** My parents asked me if I could fix this place for them. I'd never tiled a shower before this house. I said yes anyway.
>
> **[Risk]** That was over a year ago. And Christmas is the goal.
>
> **[Turn]** *(from reflection answer — what was harder than expected)*
>
> **[Payoff]** Master shower, tiled. Upstairs, grouted tomorrow. Two complete showers. I'm genuinely happy I got to teach myself this many trades, and even happier I get to hand this place back to my parents.
>
> **[Your Call]** If you've ever said yes to something you didn't know how to do yet, this one's for you. Next up: the walls.
> I'm self-taught, documenting everything, and taking you with me.

*Note: "I'd never tiled a shower before this house" must be confirmed by the creator — Pine Island had no bathroom work, so it's likely true, but SAM asks before using it.*
