-- ============================================================
-- PERSONA LAB v0 — Phase 2 SQL: seed Joey's codex
-- Run AFTER Phase 1 (migrations/2026-05-02_persona_lab_v0.sql) is complete.
-- Run AFTER Joey has reviewed migrations/joey_codex_v1_clean.json.
-- ============================================================

-- Step 1: Confirm lab_access is set on Joey's row
SELECT email, lab_access FROM sam_users WHERE email = 'j.pirrone@yahoo.com';
-- Expected: lab_access = true. If not, run:
-- UPDATE sam_users SET lab_access = true WHERE email = 'j.pirrone@yahoo.com';

-- Step 2: Confirm the persona_lab table is empty (no prior seed)
SELECT COUNT(*) FROM sam_persona_lab WHERE user_email = 'j.pirrone@yahoo.com';
-- Expected: 0

-- Step 3: Insert the seed codex
-- IMPORTANT: paste the CONTENTS of migrations/joey_codex_v1_clean.json into the persona_codex value.
-- Use $codex$...$codex$ dollar-quoted string literal so the JSON's quotes don't break the SQL.

INSERT INTO sam_persona_lab (user_email, persona_codex, codex_version, created_at, updated_at)
VALUES (
  'j.pirrone@yahoo.com',
  $codex$
 {
  "_meta": {
    "version": 1,
    "schema_purpose": "Hand-crafted seed codex for Persona Lab Composer v0.",
    "source": "self_authored",
    "confidence": "stated",
    "created_for_user": "joey_pirrone",
    "created_at": "2026-05-02T18:44:04.898Z",
    "updated_at": "2026-05-02T20:30:00.000Z",
    "editorial_pass_by": "claude_opus_4_7",
    "editorial_pass_at": "2026-05-02T20:30:00.000Z",
    "editorial_notes": "Cleanup of voice transcription artifacts, merging of split chips, normalization of emotional_tone phrases, redundancy resolution between ce02/ce04. Joey's content preserved verbatim wherever possible. Decisions flagged inline via _editorial_note fields where the cleanup was non-mechanical."
  },

  "display_name": "Joey",

  "tiers": {

    "physical_demographic": {
      "age": 46,
      "gender": "male",
      "nationality": "American",
      "ethnicity": "Italian-American",
      "height": "5'7\"",
      "build": "medium",
      "hair": "black",
      "eyes": "brown",
      "skin": "tan",
      "voice": {
        "timbre": "",
        "pace": "medium, slows when thinking",
        "accent": "neutral American with Florida roots",
        "tics": []
      },
      "style_when_seen": "",
      "style_when_alone": "favorite sweats and hoodie",
      "birthdate": "1979-12-07",
      "birthplace": "Fort Myers, Florida",
      "generational_markers": [],
      "physical_signatures": []
    },

    "origin_geography": {
      "hometown": {
        "name": "Fort Myers, Florida",
        "texture": "45 minutes north of Naples, Southwest Florida"
      },
      "neighborhoods_lived_in": [],
      "family": {
        "parents_jobs_and_class": "Dad ran the family restaurant. Mom went to school and became a nurse anesthetist. Middle to upper-middle class upbringing.",
        "siblings": {
          "count": 4,
          "your_birth_order": "third born",
          "relationship_now": "Best friends with my twin brother and my older brother in Maryland. Relationship with my other brother (between me and the older one in age) is complicated."
        },
        "economic_class_growing_up": "middle class",
        "economic_class_shifts": "Middle class growing up — the family restaurant supported us well, never wanting for anything. Fantastic childhood. Got better from there as my parents did better in life and provided more stability and opportunities for us as adults.",
        "religion": "I don't believe in God. I believe in energy.",
        "language_at_home": "English"
      },
      "formative_moves": [],
      "place_you_dream_of": ""
    },

    "psychological_interior": {
      "current_arc_headline": "going all in betting on myself because nobody else is going to do this for me",
      "core_desires": [
        {
          "desire": "to accomplish what I set out to do — to finish what I start",
          "to_whom": "to everyone I make a promise to, including myself, especially myself",
          "private": false
        }
      ],
      "shadow_desires": [
        {
          "desire": "I wish I was taller",
          "private": true
        },
        {
          "desire": "I wish I had more courage",
          "private": true
        },
        {
          "desire": "I wish I didn't secretly feel nervous in some social settings",
          "private": true
        }
      ],
      "fears_surface": [
        "fear of looking like a jackass to people because I put too much out there"
      ],
      "fears_buried": [
        {
          "fear": "fear of being judged — really, fear of being perceived as extremely odd and weird to a large group of people",
          "private": true
        }
      ],
      "wounds": [],
      "defenses": [],
      "shame_triggers": [],
      "pride_points": [],
      "what_makes_you_cry": [],
      "what_you_find_funny": [],
      "relationship_to_ambition": ""
    },

    "character_traits": {
      "traits_self_described": [
        "honest",
        "reliable",
        "trustworthy",
        "decent",
        "too passionate",
        "over-thinker",
        "focused",
        "determined",
        "nervous"
      ],
      "traits_others_describe": [
        "impatient",
        "speaks before he thinks",
        "goes back on his word",
        "a jerk"
      ],
      "contradictions": [
        "I don't like people knowing all my business — yet I share too much online. I'm constantly oversharing.",
        "I find simple solutions and then over-complicate the final outputs."
      ],
      "things_you_would_never_do": [],
      "competitive_about": [],
      "never_compete_over": []
    },

    "worldview_aesthetics": {
      "politics": {
        "value": "I don't really give a shit about politics, but I realize it dictates the quality of life we live. The right, the left, all the bullshit in between — I don't pick a side. I just want what's right. I can't stand super-liberal agendas and their talking points. I don't like discussing politics, but I have a strong opinion about it.",
        "private": true
      },
      "spirituality": "I don't believe in God. I believe in energy. Nikola Tesla and the ether — bringing thoughts to you and sending thoughts through the ether. It's been documented and it's a real thing. Energy is real. I believe in energy.",
      "taste": {
        "albums": [
          "Notorious B.I.G. — Ready to Die",
          "Kanye West",
          "Nina Simone",
          "Radiohead",
          "Billie Eilish",
          "Lorde",
          "Glass Animals",
          "The Cure",
          "Talking Heads",
          "Post Malone",
          "Miley Cyrus",
          "Justin Bieber"
        ],
        "films": [
          "True Romance",
          "Lord of the Rings",
          "Harry Potter",
          "Live Free or Die Hard",
          "No Country for Old Men",
          "Blazing Saddles",
          "Aliens"
        ],
        "books": [],
        "book_you_reread": "",
        "music_outside_albums": [
          "Post Malone",
          "Billie Eilish",
          "Radiohead"
        ],
        "fashion_wear": [
          "don't care about brands"
        ],
        "fashion_never": [
          "Tommy Hilfiger — stereotype, kind of ghetto"
        ],
        "food_cook": [
          "steaks",
          "Reuben sandwiches",
          "pasta",
          "chicken Bryan",
          "street tacos",
          "American tacos"
        ],
        "food_refuse": [
          "matzo ball soup",
          "challah"
        ]
      },
      "heroes": [],
      "anti_heroes": [],
      "overrated": [],
      "defend_forever": [],
      "era_you_belong_to": ""
    },

    "canon_events": {
      "events": [

        {
          "id": "ce01",
          "title": "the afternoon I almost killed my twin brother",
          "age": 12,
          "year": 1991,
          "location": "the sidewalk of our childhood home in Princess Park (Fort Myers, Florida)",
          "time_of_day": "2:30 pm",
          "people_present": ["my twin brother", "me"],
          "sensory": {
            "sight": "sunny day",
            "sound": "plastic tires of my battery Power Wheels rolling across the concrete sidewalk",
            "smell": "freshly cut grass",
            "body": "hands on the Power Wheels steering wheel",
            "taste": "sweat from playing"
          },
          "what_happened": "I was riding my Power Wheels down the sidewalk and my twin brother was walking ahead of me carrying a glass jar. Instead of asking him to step aside, I ran into the back of his legs. He fell and the glass jar broke wide open. A large piece of glass stuck in his ribs. That's how I almost killed my twin brother.",
          "what_was_said": [
            "All I remember after he hit the floor and the glass broke is my mom having him on the kitchen countertop, holding a rag on his rib to keep the blood from pouring out. She slapped me — out of fear, I think, in anger. That's all I remember from that day. He has the scar from the stitches now. I think 26 stitches. No — 46 stitches. Something like that."
          ],
          "meaning_then": "My impatience really is a character flaw, and I know it. I even joke about it now at 46 years old.",
          "meaning_now": "Deal with it. And for the most part, I do.",
          "tags": ["trauma", "childhood_memory", "threshold", "body", "impatience"],
          "emotional_tone": "the-second-before-the-glass-broke",
          "private": false
        },

        {
          "id": "ce02",
          "title": "the cloudy afternoon I tried to build the thing that builds the things",
          "age": 46,
          "year": 2026,
          "location": "the trailer in the backyard of my parents' 1950s cottage renovation, Upper Marlboro, MD",
          "time_of_day": "3:51 pm",
          "people_present": ["my two dogs"],
          "sensory": {
            "sight": "cloudy day, just got done cutting the grass",
            "sound": "humming refrigerator and helicopters flying over DC",
            "smell": "fresh cut grass",
            "body": "wearing my favorite sweats and hoodie",
            "taste": "cigarettes I just got done smoking"
          },
          "what_happened": "I was cutting the grass listening to Kanye West and songs from my childhood — Notorious B.I.G., Ready to Die — and I was thinking: these songs are amazing, they tell such rich stories. I wished there was something like that I could incorporate into SAM. So I started coming up with this idea — maybe there's a cadence and rhythm to stories. Not rapping the stories, just telling them with rap's structure. Rap just happened to be what I was in the mood for while the idea was forming. So I started testing a prompt with AI to see if I could bring this idea to life — bringing it out of my head and into reality.",
          "what_was_said": [
            "I started asking Claude to help take my brainstorming and make it real."
          ],
          "meaning_then": "If I could pull it off, I think it will give me something almost magical in the space of content creators.",
          "meaning_now": "Now I'm testing it to see if it's something I can achieve, or if this is far-fetched. Let's find out.",
          "tags": ["building", "naming", "work_threshold", "music_as_inspiration"],
          "emotional_tone": "the-moment-before-you-build-it",
          "private": false
        },

        {
          "id": "ce03",
          "title": "the front porch where my hands started shaking",
          "age": 46,
          "year": 2026,
          "location": "the front porch of my wife's mother's house",
          "time_of_day": "4:00 pm",
          "people_present": ["my two dogs"],
          "sensory": {
            "sight": "an empty crop field",
            "sound": "a car going by",
            "smell": "the grass",
            "body": "comfortable in the chair, hands shaking with excitement",
            "taste": "cigarettes"
          },
          "what_happened": "I was sitting alone, bored out of my mind, trying to keep my mind busy. I took a deep dive into using AI to see what it could do — what it was capable of. What I found out was surprising. It could do a lot more than I thought. My hands were shaking with excitement when I realized I could do things I wasn't able to before — like build an app that actually functioned the way I'd imagined it.",
          "what_was_said": [],
          "meaning_then": "Things are being unlocked. New skills are being unlocked in real time.",
          "meaning_now": "Now I can almost pull any idea out of my mind and try to visualize it — bring it to life with AI.",
          "tags": ["ai", "building", "naming", "unlocking", "body"],
          "emotional_tone": "hands-shaking-with-knowing",
          "private": false
        },

        {
          "id": "ce04",
          "title": "the cold afternoon Kanye and Biggie made me ask the question",
          "age": 46,
          "year": 2026,
          "location": "my parents' 1950s cottage backyard, Upper Marlboro, MD",
          "time_of_day": "2:30 pm",
          "people_present": ["alone"],
          "sensory": {
            "sight": "surrounding trees and yellow flowers, overgrown, needed to be cut",
            "sound": "loud engine roar of the John Deere zero-turn lawn mower",
            "smell": "grass clippings",
            "body": "wearing double layers — it was cold that day",
            "taste": "dust kicking up in the air"
          },
          "what_happened": "Cutting the grass on a cold afternoon, I was thinking — man, I wish I could tell a story as good as Kanye makes music. As deep as Biggie. They take you into the moment and share parts of their life and you just feel it. I thought that was really cool. So I asked myself: can I capture that? Could it be a tool for SAM? How would I even describe what I want to build? I sat down with Claude after that and started brain-dumping. Spitballing. Seeing if it could craft a prompt to start the conversation. This codex is the result. I'm going to test it now.",
          "what_was_said": [],
          "meaning_then": "When I first thought of the idea, it was magical — fantasy, more curiosity than anything.",
          "meaning_now": "Now I'm typing everything into this codex to test it and see what happens. Can it create magic?",
          "tags": ["mysterious", "imagination", "fantasy", "music_as_inspiration", "naming"],
          "emotional_tone": "curiosity-against-the-cold",
          "private": false
        }

      ]
    }

  },

  "voice_profile_seeds": {
    "rhythm_rules": [
      "I speak at a slower-to-medium pace, as I think of the next word that comes out of my mouth",
      "I pick up speed as the thought in my head starts to formulate"
    ],
    "signature_constructions": [
      "starts slow, picks up tempo as the idea takes shape",
      "tends to over-explain when something matters",
      "uses 'and' to bridge clauses where most writers would break sentences"
    ],
    "banned_phrases": [
      "drop a comment",
      "DM me",
      "save this",
      "share this",
      "glad this resonated",
      "still figuring it out",
      "what part are you curious about",
      "it almost broke me",
      "that's cap",
      "this is your sign",
      "the universe is telling you",
      "trust the process",
      "everything happens for a reason",
      "your journey is your journey",
      "showing up is half the battle",
      "pour into yourself",
      "protect your peace",
      "do the work",
      "the magic happens outside your comfort zone",
      "I just want to say",
      "I might be wrong but",
      "not gonna lie",
      "to be honest with you",
      "at the end of the day",
      "if I'm being real"
    ],
    "preferred_punctuation_quirks": [
      "em-dashes for trailing thoughts",
      "ellipses for breath-pauses",
      "comma-heavy when the thought is still forming",
      "occasional caps for emphasis on a single word",
      "understated framing — decisions read as sharpening, not victory"
    ],
    "dial_anchors": {
      "dial_1_literal": [],
      "dial_3_scored": [],
      "dial_5_mythic": [],
      "dial_7_mythos": []
    }
  },

  "intent_preferences": {
    "announce": "Definitely not hype. There is a punchline and some depth. Decisions framed as sharpening, not victory.",
    "reflect": "I have constant ideas spinning in my mind. Most of the time I miss the mark on what the actual story should be — the reflective register names that, doesn't apologize for it.",
    "provoke": "Leaves a mark. Put in a way that doesn't overshare.",
    "process": "The moment I realized this shit is overwhelming and it feels like I'll never see the end of it — but secretly I know I will.",
    "mythologize": "I believe in energy. Thoughts running in the air on an invisible highway above us. We can pull from it and push into it. Bring things to us if we want them badly enough."
  },

  "do_not_use_list": {
    "topics_off_limits": [
      "politics",
      "gender equality",
      "sexuality",
      "human body sciences",
      "anything disgusting",
      "body parts"
    ],
    "people_to_never_name": [
      "Angelo",
      "Amanda",
      "Sal",
      "Frank",
      "Rachel",
      "Rosalie"
    ],
    "naming_convention": "Descriptive references permitted: 'my twin brother', 'my wife', 'my older brother', 'my mom', 'my dad'. First names forbidden in any output.",
    "facts_to_never_invent": [
      "never invent quotes from anybody",
      "never invent financial success or failures",
      "never invent specific revenue numbers"
    ]
  }
}

  $codex$::jsonb,
  1,
  NOW(),
  NOW()
);

-- Step 4: Validate the insert
SELECT
  user_email,
  codex_version,
  jsonb_array_length(persona_codex->'tiers'->'canon_events'->'events') AS canon_event_count,
  persona_codex->'display_name' AS display_name,
  persona_codex->'_meta'->>'source' AS source,
  created_at
FROM sam_persona_lab
WHERE user_email = 'j.pirrone@yahoo.com';

-- Expected results:
-- canon_event_count: 4
-- display_name: "Joey"
-- source: "self_authored"

-- Step 5: Verify private flags survived the insert (sample check)
SELECT
  jsonb_path_query(persona_codex, '$.tiers.psychological_interior.shadow_desires[*]')
FROM sam_persona_lab
WHERE user_email = 'j.pirrone@yahoo.com';
-- Expected: 3 entries, all with "private": true

-- ============================================================
-- ROLLBACK (if needed during testing)
-- ============================================================
-- DELETE FROM sam_persona_lab WHERE user_email = 'j.pirrone@yahoo.com';

-- ============================================================
-- CODEX VERSION BUMP (for future updates)
-- ============================================================
-- When Joey adds new canon events or refines the codex via the form
-- and wants to update, use UPDATE instead of INSERT and bump version:
--
-- UPDATE sam_persona_lab
-- SET persona_codex = $codex$<new json>$codex$::jsonb,
--     codex_version = codex_version + 1,
--     updated_at = NOW()
-- WHERE user_email = 'j.pirrone@yahoo.com';
--
-- The codex_version increment is logged on every Composer output's
-- metadata, so we know which codex version produced which draft.
