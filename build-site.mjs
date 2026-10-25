import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const tenantsModule = path.join(projectRoot, 'data', 'tenants.js');
const tenantModuleUrl = pathToFileURL(tenantsModule);
tenantModuleUrl.searchParams.set('t', String(Date.now()));
const { tenants } = await import(tenantModuleUrl.href);

if (tenants.length !== 1 || !tenants[0]?.slug) {
  throw new Error(`Expected one tenant in ${tenantsModule}.`);
}

const tenant = tenants[0];
const outputDirectory = path.resolve(projectRoot, 'dist');
if (path.dirname(outputDirectory) !== projectRoot) {
  throw new Error('The deployment output directory must be inside the site project.');
}

await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.mkdir(outputDirectory, { recursive: true });

for (const languagePage of ['index.html', 'index-fr.html', 'index-de.html']) {
  const source = path.join(projectRoot, languagePage);
  await fs.access(source);
  await fs.copyFile(source, path.join(outputDirectory, languagePage));
}

await fs.cp(path.join(projectRoot, 'assets'), path.join(outputDirectory, 'assets'), {
  recursive: true,
});

const seoOutput = path.join(outputDirectory, 'generated', 'seo');
await fs.mkdir(seoOutput, { recursive: true });
for (const [sourceSuffix, destinationSuffix] of [
  ['robots.txt', 'robots.txt'],
  ['sitemap.xml', 'sitemap.xml'],
]) {
  await fs.copyFile(
    path.join(projectRoot, 'generated', 'seo', `${tenant.slug}-${sourceSuffix}`),
    path.join(seoOutput, `${tenant.slug}-${destinationSuffix}`),
  );
}

console.log(`Built ${tenant.slug} into ${outputDirectory}.`);
