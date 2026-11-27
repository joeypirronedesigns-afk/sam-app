// Patch BC — SAM's built-in pattern library. Proven short-form story structures, written once into SAM.
// The script writer picks the one that fits each story; the creator never sets anything up.
// Examples are invented and generic — never another creator's words.
const PATTERNS = [
  { id: 'countdown', name: 'Countdown',
    when: 'the story has a deadline or time left ("29 days till Christmas")',
    how: 'open on the clock; every beat moves toward or against it',
    why: 'A clock makes people stay to see if you make it.',
    example: '12 days until the inspection. And the kitchen still has no floor.' },
  { id: 'milestone', name: 'Big Number Milestone',
    when: 'a long project with a day count or long timeframe',
    how: 'lead with the number and who it is for, then show how far it has come',
    why: 'A big number signals a real commitment, and people want to catch up on the journey.',
    example: '300 days ago I started rebuilding my grandmother\'s porch.' },
  { id: 'promise', name: 'Promise to Someone',
    when: 'the creator made a commitment to a person they love',
    how: 'name the person and the promise up front; the video is whether it is being kept',
    why: 'A promise to someone you love raises the stakes. Viewers want to see it kept.',
    example: 'I told my dad I\'d finish his workshop before his birthday.' },
  { id: 'contrarian', name: 'Contrarian',
    when: 'the creator does the opposite of what most people do',
    how: '"Most people X. Me? Y." then explain the reason',
    why: 'A contradiction makes the brain wait for the reason.',
    example: 'Most people rip out old paneling. I\'m keeping every board.' },
  { id: 'before_after', name: 'Before → After',
    when: 'there is a visible change to show',
    how: 'show or name the "before" fast, delay the reveal of the "after" to the payoff',
    why: 'People stay for the reveal of a transformation.',
    example: 'This bathroom had a pink tub and a hole in the floor. Watch.' },
  { id: 'mistake', name: 'Mistake & Fix',
    when: 'something went wrong, had to be redone, or cost them',
    how: 'admit the mistake first, then the fix and the lesson',
    why: 'Honesty stops the scroll, and people want to see how you fix it.',
    example: 'I poured this slab wrong. Here\'s what I had to do.' },
  { id: 'lesson', name: 'One Small Thing',
    when: 'a single decision or detail made a big difference (a tip that saved them)',
    how: 'tease the one thing, show the near-disaster it prevented, give it away at the payoff',
    why: 'One specific detail feels like insider knowledge worth saving.',
    example: 'One roll of tape saved me two days of cleanup.' },
  { id: 'first_time', name: 'First Time Doing It',
    when: 'the creator is trying something they have never done',
    how: 'say it is the first time, show the attempt, land on how it turned out',
    why: 'Watching someone try something new for the first time is built-in suspense.',
    example: 'I\'ve never hung a door in my life. Today I\'m hanging six.' },
  { id: 'answer', name: 'You Asked, Here\'s the Answer',
    when: 'the audience asked a question or the creator is explaining a why',
    how: '"Some of you asked … Let me explain." then the honest answer',
    why: 'It answers a question people already have, so it feels like a conversation.',
    example: 'A lot of you asked why I\'m doing this myself. Let me explain.' },
  { id: 'untold', name: 'The Part I Never Told You',
    when: 'there is backstory or something the audience does not know yet',
    how: 'promise a reveal, then tell the untold part simply',
    why: 'Hidden information creates curiosity people have to resolve.',
    example: 'There\'s a reason this house matters more than any job I\'ve done.' },
  { id: 'in_motion', name: 'Start in Motion',
    when: 'the creator is mid-task on camera today',
    how: 'open in the middle of the action ("Right now I\'m…"), explain while working',
    why: 'Dropping in mid-action leaves no warm-up for anyone to scroll past.',
    example: 'Right now I\'m trowelling the last wall before it sets.' },
  { id: 'cost', name: 'What It Cost',
    when: 'the creator gave a real cost in money, time, or effort',
    how: 'lead with the cost, then whether it was worth it',
    why: 'A real number lets people compare it to their own life.',
    example: 'This one wall took me three weekends.' }
];
const byId = Object.fromEntries(PATTERNS.map(p => [p.id, p]));

// Compact list for the script writer's prompt.
function patternPrompt() {
  return PATTERNS.map(p => `- ${p.id} — ${p.name}: use when ${p.when}. Shape: ${p.how}. (e.g. "${p.example}")`).join('\n');
}

module.exports = { PATTERNS, byId, patternPrompt };
