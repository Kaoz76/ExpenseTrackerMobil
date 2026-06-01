const prices = [75.95, 189.00, -47.25, 255.95, 85.89, 125.50, 91.90];
const target = 774.19;

function getCombinations(array, size, start, initialStuff, output) {
    if (initialStuff.length >= size) {
        output.push(initialStuff);
    } else {
        for (let i = start; i < array.length; ++i) {
            getCombinations(array, size, i + 1, initialStuff.concat(array[i]), output);
        }
    }
}

const combos = [];
getCombinations(prices, 6, 0, [], combos);

for (const combo of combos) {
    const sum = combo.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - target) < 0.01) {
        console.log("FOUND COMBO:", combo);
    }
}
console.log("Done checking 6 items.");

const combos7 = [];
getCombinations(prices, 7, 0, [], combos7);
for (const combo of combos7) {
    const sum = combo.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - target) < 0.01) {
        console.log("FOUND COMBO 7:", combo);
    }
}
console.log("Done checking 7 items.");
