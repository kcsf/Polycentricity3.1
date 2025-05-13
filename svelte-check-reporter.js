const fs = require('fs');

// Create a timestamp for the start of the run
const startTimestamp = Date.now();
const outputFile = 'svelte-check-report.json';

// Write the start line to the report file
fs.writeFileSync(outputFile, );

// Process each line from stdin
process.stdin.on('data', chunk => {
  const lines = chunk.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      try {
        // Parse the diagnostic as JSON
        const diagnostic = JSON.parse(line);
        
        // Add a timestamp and write to the report file
        fs.appendFileSync(outputFile, );
      } catch (error) {
        // If it's not valid JSON, just write the line as is
        fs.appendFileSync(outputFile, );
      }
    }
  }
});

process.stdin.on('end', () => {
  console.log();
});
