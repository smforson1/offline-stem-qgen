// scripts/fix-gradle.js
// Fixes react-native-sqlite-storage using deprecated jcenter() which was shut down.
// Gradle 9 (used by EAS) completely removed jcenter() support.
const fs = require('fs');
const path = require('path');

const filesToFix = [
  'node_modules/react-native-sqlite-storage/platforms/android/build.gradle',
  'node_modules/react-native-sqlite-storage/platforms/android-native/build.gradle',
];

let anyFixed = false;

for (const relPath of filesToFix) {
  const fullPath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found, skipping: ${relPath}`);
    continue;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('jcenter()')) {
    content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed jcenter() → mavenCentral() in ${relPath}`);
    anyFixed = true;
  } else {
    console.log(`ℹ️  No jcenter() found in ${relPath} (already clean)`);
  }
}

if (!anyFixed) {
  console.log('ℹ️  All gradle files are already clean.');
}
