const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', 'miniprogram_npm', '.git']);
const errors = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else check(full);
  }
}

function check(file) {
  const extension = path.extname(file);
  if (extension === '.json') {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(file + ': invalid JSON: ' + error.message);
    }
  }
  if (extension === '.js') {
    try {
      new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    } catch (error) {
      errors.push(file + ': invalid JavaScript: ' + error.message);
    }
  }
  if (extension === '.wxml') {
    const source = fs.readFileSync(file, 'utf8');
    const openViews = (source.match(/<view\b/g) || []).length;
    const closeViews = (source.match(/<\/view>/g) || []).length;
    if (openViews !== closeViews) {
      errors.push(file + ': unbalanced <view> tags (' + openViews + ' open, ' + closeViews + ' close)');
    }
  }
}

walk(root);

const appJsonPath = path.join(root, 'miniprogram', 'app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  for (const page of appJson.pages || []) {
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      const file = path.join(root, 'miniprogram', page + extension);
      if (!fs.existsSync(file)) errors.push(file + ': missing page file registered in app.json');
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
process.stdout.write('project static checks passed\n');
