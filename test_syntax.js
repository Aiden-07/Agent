const fs = require('fs');
try {
  const code = fs.readFileSync('/Users/aiden/Desktop/BF/V-Agent/Agent_应用/js/model-config.js', 'utf8');
  new Function(code);
  console.log('Syntax OK');
} catch (e) {
  console.error('Syntax Error:', e);
}
