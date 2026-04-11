const whisper = require('whisper-node-addon');
console.log('=== whisper-node-addon basic load test ===');
console.log('Type:', typeof whisper);
console.log('Keys:', Object.keys(whisper));
console.log('Full export:', whisper);

// Check if it's a class, function, or object
if (typeof whisper === 'function') {
  console.log('Export is a function/class');
  console.log('Prototype methods:', Object.getOwnPropertyNames(whisper.prototype || {}));
}

// Try to list all named exports
for (const key of Object.keys(whisper)) {
  console.log(`  ${key}: ${typeof whisper[key]}`);
}

console.log('=== Load test complete ===');
