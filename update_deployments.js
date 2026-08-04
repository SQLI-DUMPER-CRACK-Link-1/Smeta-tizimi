const { execSync } = require('child_process');

try {
  console.log("Creating new version...");
  const out = execSync('clasp version "Update"').toString();
  const match = out.match(/Created version (\d+)/);
  if (!match) {
    console.log("Could not find version number in:", out);
    process.exit(1);
  }
  const version = match[1];
  console.log("Created version " + version);

  console.log("Fetching deployments...");
  const deps = execSync('clasp deployments').toString();
  const depIds = [];
  const lines = deps.split('\n');
  for (const line of lines) {
    const m = line.match(/- (AKfy\S+) /);
    if (m) depIds.push(m[1]);
  }

  console.log(`Found ${depIds.length} deployments. Updating all to version ${version}...`);
  for (const id of depIds) {
    try {
      console.log(`Updating deployment ${id}...`);
      execSync(`clasp deploy -i ${id} -V ${version} -d "Update to v${version}"`);
    } catch(e) {
      console.log(`Failed to update ${id}: ${e.message}`);
    }
  }
  console.log("All done!");
} catch(e) {
  console.error("Error:", e.message);
}
