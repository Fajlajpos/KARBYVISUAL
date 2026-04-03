const fs = require('fs');
const path = require('path');

// The base64 provided in the prompt is truncated in my view often, 
// so I will ask the user to provide the marble image if it's not in the workspace.
// However, I see a 'marble.b64' in the file list. Let's see if it's there.

const b64Path = path.join(__dirname, 'marble.b64');
if (fs.existsSync(b64Path)) {
    const data = fs.readFileSync(b64Path, 'utf8');
    // If it's a real base64, save it.
    if (data.length > 100) {
        const base64Data = data.replace(/^data:image\/jpeg;base64,/, "");
        fs.writeFileSync(path.join(__dirname, 'public', 'assets', 'marble.jpg'), base64Data, 'base64');
        console.log('Marble extracted from b64 file.');
    } else {
        console.log('marble.b64 is empty or too short.');
    }
} else {
    console.log('marble.b64 not found.');
}
