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

const defaultLanguage = tenant.defaultLanguage;
const defaultLanguagePage = defaultLanguage === 'en' ? 'index.html' : `index-${defaultLanguage}.html`;
if (!defaultLanguage || !/^[a-z]{2}$/.test(defaultLanguage)) {
  throw new Error(`Missing official language page for ${tenant.slug}: ${defaultLanguagePage}.`);
}
await fs.access(path.join(projectRoot, defaultLanguagePage));

await fs.copyFile(
  path.join(projectRoot, defaultLanguagePage),
  path.join(outputDirectory, defaultLanguagePage),
);

await fs.cp(path.join(projectRoot, 'assets'), path.join(outputDirectory, 'assets'), {
  recursive: true,
});

for (const seoFile of ['robots.txt', 'sitemap.xml']) {
  await fs.copyFile(
    path.join(projectRoot, seoFile),
    path.join(outputDirectory, seoFile),
  );
}

const imageSourceEntries = await fs.readdir(projectRoot, { withFileTypes: true });
const rootImageNames = imageSourceEntries
  .filter((entry) => entry.isFile() && /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(entry.name))
  .map((entry) => entry.name);
const outputImageDirectory = path.join(outputDirectory, 'assets', 'images');
await fs.mkdir(outputImageDirectory, { recursive: true });
const existingImageNames = new Set(await fs.readdir(outputImageDirectory));
for (const imageName of rootImageNames) {
  if (!existingImageNames.has(imageName)) {
    await fs.copyFile(path.join(projectRoot, imageName), path.join(outputImageDirectory, imageName));
  }
}

console.log(`Built ${tenant.slug} (${defaultLanguage}) into ${outputDirectory}.`);

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

const defaultLanguage = tenant.defaultLanguage;
const defaultLanguagePage = defaultLanguage === 'en' ? 'index.html' : `index-${defaultLanguage}.html`;
if (!defaultLanguage || !/^[a-z]{2}$/.test(defaultLanguage)) {
  throw new Error(`Missing official language page for ${tenant.slug}: ${defaultLanguagePage}.`);
}
await fs.access(path.join(projectRoot, defaultLanguagePage));

await fs.copyFile(
  path.join(projectRoot, defaultLanguagePage),
  path.join(outputDirectory, defaultLanguagePage),
);

await fs.cp(path.join(projectRoot, 'assets'), path.join(outputDirectory, 'assets'), {
  recursive: true,
});

for (const seoFile of ['robots.txt', 'sitemap.xml']) {
  await fs.copyFile(
    path.join(projectRoot, seoFile),
    path.join(outputDirectory, seoFile),
  );
}

console.log(`Built ${tenant.slug} (${defaultLanguage}) into ${outputDirectory}.`);

