// The problem: in the combined regex, alt1 `\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})` 
// at position 0 tries `\d{1,3}` = "17", then `(?:[.,]\d{3})*` matches ",999",
// then `(?:[.,]\d{2})` fails → alt1 FAILS.
//
// BUT before trying alt2, the regex engine backtracks within alt1:
// `(?:[.,]\d{3})*` is * (zero or more), so it tries matching 0 times.
// Then `(?:[.,]\d{2})` tries `,99` from ",999" → matches! → alt1 returns "17,99".
//
// This is why alt2 never gets tried — alt1 succeeds with backtracking!
//
// Fix: use possessive/atomic grouping, or restructure the regex so that
// the thousands separator group doesn't backtrack into the decimal group.
//
// Simplest fix: make the thousands group require a word boundary or 
// non-digit after it, OR rearrange the alternation to put thousands-only FIRST.

// Test: put thousands-only FIRST
const fixedRegex1 = /\d{1,3}(?:[.,]\d{3})+(?![.,]?\d)|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g;

const testCases = [
  "17,999.00",      
  "17,999. D0",    
  "17,999",        
  "2,999.83",      
  "17.999",        
  "17,99",         
  "08.06",         
  "12008tukl imafujiplus 220    17,999. d0",
  "some text 17,999 end",
  "1,234,567",
];

for (const tc of testCases) {
  console.log(`"${tc}" => ${JSON.stringify(tc.match(fixedRegex1))}`);
}
