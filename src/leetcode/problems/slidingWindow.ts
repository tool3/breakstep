import type { LeetProblem } from '../types';

const uniqueDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', lengthOfLongestSubstring(s));
console.log('example 2 ->', lengthOfLongestSubstring('bbbbb'));
console.log('example 3 ->', lengthOfLongestSubstring('pwwkew'));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', length_of_longest_substring(s))
print('example 2 ->', length_of_longest_substring('bbbbb'))
print('example 3 ->', length_of_longest_substring('pwwkew'))
`,
};

export const longestUniqueSubstring: LeetProblem = {
  slug: 'longest-substring-without-repeating-characters',
  number: 3,
  title: 'Longest Substring Without Repeating Characters',
  difficulty: 'Medium',
  topics: ['hash-table', 'string', 'sliding-window'],
  prompt:
    'Given a string, return the length of the longest run of consecutive characters that contains no repeats. The run must be a substring — contiguous — not a subsequence.',
  constraints: ['0 ≤ s.length ≤ 5·10⁴', 's consists of English letters, digits, symbols and spaces'],
  examples: [
    { input: 's = "abcabcbb"', output: '3', note: '"abc"' },
    { input: 's = "bbbbb"', output: '1', note: '"b"' },
    { input: 's = "pwwkew"', output: '3', note: '"wke" — "pwke" is a subsequence, not a substring' },
  ],
  techniques: [
    {
      pattern: 'sliding-window',
      rank: 1,
      why: 'The window is exactly the answer being built: extend on the right, and when a repeat appears, jump the left edge past the previous copy. Neither edge ever moves backwards, so the whole string is scanned once.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
    {
      pattern: 'two-pointers',
      rank: 2,
      why: 'The same two indices, described without the window vocabulary — useful if you find "left and right pointer" easier to reason about than "window".',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [{ name: 's', label: 'Input string', type: 'string', default: 'abcabcbb' }],
  typescript: {
    starter: `const s = 'abcabcbb';

function lengthOfLongestSubstring(s: string): number {
  // Grow the window on the right; pull the left edge past any repeat.
  // TODO
  return 0;
}
${uniqueDriver.typescript}`,
    solution: `const s = 'abcabcbb';

function lengthOfLongestSubstring(s: string): number {
  const lastSeen = new Map<string, number>();
  let start = 0;
  let best = 0;

  for (let end = 0; end < s.length; end++) {
    const ch = s[end];
    const previous = lastSeen.get(ch);

    // Only jump forwards: a repeat left behind by an earlier jump is stale.
    if (previous !== undefined && previous >= start) start = previous + 1;

    lastSeen.set(ch, end);
    const width = end - start + 1;
    if (width > best) best = width;
  }

  return best;
}
${uniqueDriver.typescript}`,
  },
  python: {
    starter: `s = 'abcabcbb'


def length_of_longest_substring(s):
    """Grow the window on the right; pull the left edge past any repeat."""
    # TODO
    return 0
${uniqueDriver.python}`,
    solution: `s = 'abcabcbb'


def length_of_longest_substring(s):
    last_seen = {}
    start = 0
    best = 0

    for end, ch in enumerate(s):
        previous = last_seen.get(ch)

        # Only jump forwards: a repeat left behind by an earlier jump is stale.
        if previous is not None and previous >= start:
            start = previous + 1

        last_seen[ch] = end
        width = end - start + 1
        if width > best:
            best = width

    return best
${uniqueDriver.python}`,
  },
  expectedOutput: ['example 1 -> 3', 'example 2 -> 1', 'example 3 -> 3'],
};

const stockDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', maxProfit(prices));
console.log('example 2 ->', maxProfit([7, 6, 4, 3, 1]));
console.log('example 3 ->', maxProfit([2, 4, 1]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', max_profit(prices))
print('example 2 ->', max_profit([7, 6, 4, 3, 1]))
print('example 3 ->', max_profit([2, 4, 1]))
`,
};

export const bestTimeToBuyAndSellStock: LeetProblem = {
  slug: 'best-time-to-buy-and-sell-stock',
  number: 121,
  title: 'Best Time to Buy and Sell Stock',
  difficulty: 'Easy',
  topics: ['array', 'dynamic-programming'],
  prompt:
    'prices[i] is the price of a stock on day i. Choose one day to buy and a later day to sell, and return the largest profit available. If no pair of days turns a profit, return 0.',
  constraints: ['1 ≤ prices.length ≤ 10⁵', '0 ≤ prices[i] ≤ 10⁴'],
  examples: [
    { input: 'prices = [7,1,5,3,6,4]', output: '5', note: 'buy at 1, sell at 6' },
    { input: 'prices = [7,6,4,3,1]', output: '0', note: 'prices only fall' },
    { input: 'prices = [2,4,1]', output: '2', note: 'buy at 2, sell at 4' },
  ],
  techniques: [
    {
      pattern: 'sliding-window',
      rank: 1,
      why: 'The window is buy-day to sell-day. Whenever a cheaper price appears there is no reason to keep the old buy day, so the left edge jumps there and the window never needs to be re-examined.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
    {
      pattern: 'two-pointers',
      rank: 2,
      why: 'Read as a buy pointer and a sell pointer, the sell pointer always advancing and the buy pointer only ever moving to a new minimum.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [{ name: 'prices', label: 'Daily prices', type: 'numberArray', default: [7, 1, 5, 3, 6, 4] }],
  typescript: {
    starter: `const prices = [7, 1, 5, 3, 6, 4];

function maxProfit(prices: number[]): number {
  // Track the cheapest day so far and the best profit against it.
  // TODO
  return 0;
}
${stockDriver.typescript}`,
    solution: `const prices = [7, 1, 5, 3, 6, 4];

function maxProfit(prices: number[]): number {
  let cheapest = Infinity;
  let best = 0;

  for (const price of prices) {
    // A cheaper day makes every later sale better, so buy here instead.
    if (price < cheapest) cheapest = price;
    else if (price - cheapest > best) best = price - cheapest;
  }

  return best;
}
${stockDriver.typescript}`,
  },
  python: {
    starter: `prices = [7, 1, 5, 3, 6, 4]


def max_profit(prices):
    """Track the cheapest day so far and the best profit against it."""
    # TODO
    return 0
${stockDriver.python}`,
    solution: `prices = [7, 1, 5, 3, 6, 4]


def max_profit(prices):
    cheapest = float('inf')
    best = 0

    for price in prices:
        # A cheaper day makes every later sale better, so buy here instead.
        if price < cheapest:
            cheapest = price
        elif price - cheapest > best:
            best = price - cheapest

    return best
${stockDriver.python}`,
  },
  expectedOutput: ['example 1 -> 5', 'example 2 -> 0', 'example 3 -> 2'],
};

const replacementDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', characterReplacement(s, k));
console.log('example 2 ->', characterReplacement('AABABBA', 1));
console.log('example 3 ->', characterReplacement('ABBB', 2));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', character_replacement(s, k))
print('example 2 ->', character_replacement('AABABBA', 1))
print('example 3 ->', character_replacement('ABBB', 2))
`,
};

export const longestRepeatingReplacement: LeetProblem = {
  slug: 'longest-repeating-character-replacement',
  number: 424,
  title: 'Longest Repeating Character Replacement',
  difficulty: 'Medium',
  topics: ['hash-table', 'string', 'sliding-window'],
  prompt:
    'You may change at most k characters of the string to any other uppercase letter. Return the length of the longest run of a single repeated letter you can produce.',
  constraints: ['1 ≤ s.length ≤ 10⁵', 's consists of uppercase English letters', '0 ≤ k ≤ s.length'],
  examples: [
    { input: 's = "ABAB", k = 2', output: '4', note: 'turn both As into Bs' },
    { input: 's = "AABABBA", k = 1', output: '4', note: '"AABA" → "AAAA"' },
    { input: 's = "ABBB", k = 2', output: '4' },
  ],
  techniques: [
    {
      pattern: 'sliding-window',
      rank: 1,
      why: 'A window is legal when (width − count of its most common letter) ≤ k: that difference is exactly how many characters you would have to change. Grow on the right, and shrink by one whenever the window goes illegal.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 's', label: 'Input string', type: 'string', default: 'ABAB' },
    { name: 'k', label: 'Replacements allowed', type: 'number', default: 2, min: 0, max: 20 },
  ],
  typescript: {
    starter: `const s = 'ABAB';
const k = 2;

function characterReplacement(s: string, k: number): number {
  // A window is legal while width - mostCommonCount <= k.
  // TODO
  return 0;
}
${replacementDriver.typescript}`,
    solution: `const s = 'ABAB';
const k = 2;

function characterReplacement(s: string, k: number): number {
  const counts = new Map<string, number>();
  let start = 0;
  let mostCommon = 0;
  let best = 0;

  for (let end = 0; end < s.length; end++) {
    const ch = s[end];
    const next = (counts.get(ch) ?? 0) + 1;
    counts.set(ch, next);
    if (next > mostCommon) mostCommon = next;

    // Too many characters would need changing — give back one from the left.
    if (end - start + 1 - mostCommon > k) {
      const left = s[start];
      counts.set(left, (counts.get(left) ?? 0) - 1);
      start++;
    }

    best = Math.max(best, end - start + 1);
  }

  return best;
}
${replacementDriver.typescript}`,
  },
  python: {
    starter: `s = 'ABAB'
k = 2


def character_replacement(s, k):
    """A window is legal while width - most_common <= k."""
    # TODO
    return 0
${replacementDriver.python}`,
    solution: `s = 'ABAB'
k = 2


def character_replacement(s, k):
    counts = {}
    start = 0
    most_common = 0
    best = 0

    for end, ch in enumerate(s):
        counts[ch] = counts.get(ch, 0) + 1
        if counts[ch] > most_common:
            most_common = counts[ch]

        # Too many characters would need changing - give back one on the left.
        if end - start + 1 - most_common > k:
            counts[s[start]] -= 1
            start += 1

        best = max(best, end - start + 1)

    return best
${replacementDriver.python}`,
  },
  expectedOutput: ['example 1 -> 4', 'example 2 -> 4', 'example 3 -> 4'],
};

const minSubarrayDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', minSubArrayLen(target, nums));
console.log('example 2 ->', minSubArrayLen(4, [1, 4, 4]));
console.log('example 3 ->', minSubArrayLen(11, [1, 1, 1, 1, 1, 1, 1, 1]));
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', min_sub_array_len(target, nums))
print('example 2 ->', min_sub_array_len(4, [1, 4, 4]))
print('example 3 ->', min_sub_array_len(11, [1, 1, 1, 1, 1, 1, 1, 1]))
`,
};

export const minimumSizeSubarraySum: LeetProblem = {
  slug: 'minimum-size-subarray-sum',
  number: 209,
  title: 'Minimum Size Subarray Sum',
  difficulty: 'Medium',
  topics: ['array', 'binary-search', 'sliding-window', 'prefix-sum'],
  prompt:
    'Given an array of positive integers and a target, return the length of the shortest contiguous subarray whose sum is at least the target. Return 0 if no such subarray exists.',
  constraints: ['1 ≤ target ≤ 10⁹', '1 ≤ nums.length ≤ 10⁵', '1 ≤ nums[i] ≤ 10⁴'],
  examples: [
    { input: 'target = 7, nums = [2,3,1,2,4,3]', output: '2', note: '[4,3]' },
    { input: 'target = 4, nums = [1,4,4]', output: '1' },
    { input: 'target = 11, nums = [1,1,1,1,1,1,1,1]', output: '0' },
  ],
  techniques: [
    {
      pattern: 'sliding-window',
      rank: 1,
      why: 'All the values are positive, so extending the window can only raise the sum and shrinking it can only lower it. That monotonicity is what lets a single window find the shortest answer: grow until it qualifies, then shrink while it still does.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
    {
      pattern: 'binary-search',
      rank: 2,
      why: 'On the prefix-sum array, the shortest window ending at each index can be found by binary search. It is O(n log n) rather than O(n), but it survives the follow-up where the array is fixed and the target changes.',
      complexity: { time: 'O(n log n)', space: 'O(n)' },
    },
  ],
  params: [
    { name: 'target', label: 'Target sum', type: 'number', default: 7, min: 1, max: 1000 },
    { name: 'nums', label: 'Positive numbers', type: 'numberArray', default: [2, 3, 1, 2, 4, 3] },
  ],
  typescript: {
    starter: `const target = 7;
const nums = [2, 3, 1, 2, 4, 3];

function minSubArrayLen(target: number, nums: number[]): number {
  // Grow the window until it qualifies, then shrink it while it still does.
  // TODO
  return 0;
}
${minSubarrayDriver.typescript}`,
    solution: `const target = 7;
const nums = [2, 3, 1, 2, 4, 3];

function minSubArrayLen(target: number, nums: number[]): number {
  let start = 0;
  let sum = 0;
  let best = Infinity;

  for (let end = 0; end < nums.length; end++) {
    sum += nums[end];

    // Every value is positive, so once the window qualifies, shrinking is the
    // only way it can get shorter — and it stops qualifying the moment it must.
    while (sum >= target) {
      best = Math.min(best, end - start + 1);
      sum -= nums[start];
      start++;
    }
  }

  return best === Infinity ? 0 : best;
}
${minSubarrayDriver.typescript}`,
  },
  python: {
    starter: `target = 7
nums = [2, 3, 1, 2, 4, 3]


def min_sub_array_len(target, nums):
    """Grow the window until it qualifies, then shrink while it still does."""
    # TODO
    return 0
${minSubarrayDriver.python}`,
    solution: `target = 7
nums = [2, 3, 1, 2, 4, 3]


def min_sub_array_len(target, nums):
    start = 0
    total = 0
    best = float('inf')

    for end, value in enumerate(nums):
        total += value

        # Every value is positive, so once the window qualifies, shrinking is
        # the only way it gets shorter - and it stops qualifying when it must.
        while total >= target:
            best = min(best, end - start + 1)
            total -= nums[start]
            start += 1

    return 0 if best == float('inf') else best
${minSubarrayDriver.python}`,
  },
  expectedOutput: ['example 1 -> 2', 'example 2 -> 1', 'example 3 -> 0'],
};

const permInStringDriver = {
  typescript: `
// --- examples ---------------------------------------------------------------
console.log('example 1 ->', checkInclusion(s1, s2) ? 'true' : 'false');
console.log('example 2 ->', checkInclusion('ab', 'eidboaoo') ? 'true' : 'false');
console.log('example 3 ->', checkInclusion('adc', 'dcda') ? 'true' : 'false');
`,
  python: `
# --- examples ---------------------------------------------------------------
print('example 1 ->', 'true' if check_inclusion(s1, s2) else 'false')
print('example 2 ->', 'true' if check_inclusion('ab', 'eidboaoo') else 'false')
print('example 3 ->', 'true' if check_inclusion('adc', 'dcda') else 'false')
`,
};

export const permutationInString: LeetProblem = {
  slug: 'permutation-in-string',
  number: 567,
  title: 'Permutation in String',
  difficulty: 'Medium',
  topics: ['hash-table', 'two-pointers', 'string', 'sliding-window'],
  prompt:
    'Decide whether the second string contains any permutation of the first as a substring — that is, whether some window of s2 uses exactly the same letters, with the same counts, as s1.',
  constraints: ['1 ≤ s1.length, s2.length ≤ 10⁴', 'Both consist of lowercase English letters'],
  examples: [
    { input: 's1 = "ab", s2 = "eidbaooo"', output: 'true', note: 's2 contains "ba"' },
    { input: 's1 = "ab", s2 = "eidboaoo"', output: 'false' },
    { input: 's1 = "adc", s2 = "dcda"', output: 'true', note: '"dca"' },
  ],
  techniques: [
    {
      pattern: 'sliding-window',
      rank: 1,
      why: 'A permutation has a fixed length, so the window never changes size — it just slides, adding one letter and dropping another. Keeping a count of how many letters currently match turns each slide into O(1) work instead of a fresh comparison.',
      complexity: { time: 'O(n)', space: 'O(1)' },
    },
  ],
  params: [
    { name: 's1', label: 'Pattern', type: 'string', default: 'ab' },
    { name: 's2', label: 'Text', type: 'string', default: 'eidbaooo' },
  ],
  typescript: {
    starter: `const s1 = 'ab';
const s2 = 'eidbaooo';

function checkInclusion(s1: string, s2: string): boolean {
  // A fixed-width window: add one letter, drop one, compare the counts.
  // TODO
  return false;
}
${permInStringDriver.typescript}`,
    solution: `const s1 = 'ab';
const s2 = 'eidbaooo';

function checkInclusion(s1: string, s2: string): boolean {
  if (s1.length > s2.length) return false;

  const A = 'a'.charCodeAt(0);
  const need = new Array<number>(26).fill(0);
  const have = new Array<number>(26).fill(0);

  for (let i = 0; i < s1.length; i++) {
    need[s1.charCodeAt(i) - A]++;
    have[s2.charCodeAt(i) - A]++;
  }

  // How many of the 26 letters currently have exactly the right count.
  let matches = 0;
  for (let i = 0; i < 26; i++) if (need[i] === have[i]) matches++;

  for (let end = s1.length; end < s2.length; end++) {
    if (matches === 26) return true;

    const gained = s2.charCodeAt(end) - A;
    have[gained]++;
    if (have[gained] === need[gained]) matches++;
    else if (have[gained] === need[gained] + 1) matches--;

    const lost = s2.charCodeAt(end - s1.length) - A;
    have[lost]--;
    if (have[lost] === need[lost]) matches++;
    else if (have[lost] === need[lost] - 1) matches--;
  }

  return matches === 26;
}
${permInStringDriver.typescript}`,
  },
  python: {
    starter: `s1 = 'ab'
s2 = 'eidbaooo'


def check_inclusion(s1, s2):
    """A fixed-width window: add one letter, drop one, compare the counts."""
    # TODO
    return False
${permInStringDriver.python}`,
    solution: `s1 = 'ab'
s2 = 'eidbaooo'


def check_inclusion(s1, s2):
    if len(s1) > len(s2):
        return False

    a = ord('a')
    need = [0] * 26
    have = [0] * 26

    for i in range(len(s1)):
        need[ord(s1[i]) - a] += 1
        have[ord(s2[i]) - a] += 1

    # How many of the 26 letters currently have exactly the right count.
    matches = sum(1 for i in range(26) if need[i] == have[i])

    for end in range(len(s1), len(s2)):
        if matches == 26:
            return True

        gained = ord(s2[end]) - a
        have[gained] += 1
        if have[gained] == need[gained]:
            matches += 1
        elif have[gained] == need[gained] + 1:
            matches -= 1

        lost = ord(s2[end - len(s1)]) - a
        have[lost] -= 1
        if have[lost] == need[lost]:
            matches += 1
        elif have[lost] == need[lost] - 1:
            matches -= 1

    return matches == 26
${permInStringDriver.python}`,
  },
  expectedOutput: ['example 1 -> true', 'example 2 -> false', 'example 3 -> true'],
};

export const SLIDING_WINDOW_PROBLEMS = [
  longestUniqueSubstring,
  bestTimeToBuyAndSellStock,
  longestRepeatingReplacement,
  minimumSizeSubarraySum,
  permutationInString,
];
