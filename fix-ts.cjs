const fs = require('fs');
const filePath = 'src/data/mockAttractions.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// There is a syntax error near line 5567.
// It seems `wait(300)` from previous script messed up the JSON stringification or it was interrupted.
// Let's just restore the file completely from a clean generation script.

// Wait, the previous `fetch_wiki_slow.cjs` ran, but it was interrupted by the user's next message or timeout!
// It probably wrote partial content.

// Let's find out where the valid JSON ends.
let lastValidIndex = content.lastIndexOf('}');
if (lastValidIndex > 0) {
    let newContent = content.substring(0, lastValidIndex + 1) + '\n];\n';
    fs.writeFileSync(filePath, newContent);
    console.log("Fixed syntax by truncating broken JSON and closing the array.");
}
