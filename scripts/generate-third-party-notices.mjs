import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(projectRoot, "package-lock.json");
const rootNoticePath = join(projectRoot, "THIRD_PARTY_LICENSES.txt");
const publicNoticePath = join(projectRoot, "public", "THIRD_PARTY_LICENSES.txt");
const builtNoticePath = join(projectRoot, "dist", "client", "THIRD_PARTY_LICENSES.txt");

const BUILD_ARTIFACT_CONTRIBUTORS = [
  {
    lockPath: "node_modules/vinext",
    evidence: "Vinext client shims and server runtime modules are named inputs and chunks in the built manifests",
  },
  {
    lockPath: "node_modules/@cloudflare/vite-plugin",
    evidence: "the server build manifest contains the generated virtual:cloudflare/worker-entry runtime",
  },
  {
    lockPath: "node_modules/@vitejs/plugin-rsc",
    evidence: "the build emits React Server Components virtual entries and asset manifests",
  },
  {
    lockPath: "node_modules/react-server-dom-webpack",
    evidence: "the RSC and SSR environments bundle the React Server Components transport runtime",
  },
  {
    lockPath: "node_modules/vite",
    evidence: "the client output contains Vite-generated preload and dependency-mapping runtime helpers",
  },
  {
    lockPath: "node_modules/rolldown",
    evidence: "the client and server outputs contain content-hashed rolldown-runtime chunks",
  },
];

const CLOUDFLARE_WORKERS_SDK_MIT_NOTICE = `Copyright (c) 2020 Cloudflare, Inc. <wrangler@cloudflare.com>

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.`;

const FALLBACK_LICENSE_SOURCES = new Map([
  [
    "@next/env",
    {
      lockPath: "node_modules/next",
      explanation: "published from the Next.js monorepo without a separate license file",
    },
  ],
  [
    "client-only",
    {
      lockPath: "node_modules/react",
      explanation: "published as a React marker package without a separate license file",
    },
  ],
  [
    "@vitejs/plugin-rsc",
    {
      lockPath: "node_modules/@vitejs/plugin-react",
      explanation: "published from the Vite React plugins monorepo without a separate license file",
    },
  ],
  [
    "@cloudflare/vite-plugin",
    {
      embeddedText: CLOUDFLARE_WORKERS_SDK_MIT_NOTICE,
      filename: "LICENSE-MIT",
      sourceId: "cloudflare/workers-sdk",
      explanation: "published from the Cloudflare Workers SDK monorepo without a separate license file",
    },
  ],
]);

const GEIST_OFL_NOTICE = `Copyright (c) 2023 Vercel, in collaboration with basement.studio

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION AND CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.`;

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function normalizeText(value) {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trimEnd() + "\n";
}

function packageNameFromLockPath(packagePath) {
  const marker = "node_modules/";
  const markerIndex = packagePath.lastIndexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Cannot derive a package name from lock path: ${packagePath}`);
  }
  return packagePath.slice(markerIndex + marker.length);
}

function resolveDependencyPath(packages, fromPath, dependencyName) {
  let searchPath = fromPath;

  while (true) {
    const candidate = searchPath
      ? `${searchPath}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (packages[candidate]) return candidate;

    if (!searchPath) break;
    const parentMarker = searchPath.lastIndexOf("/node_modules/");
    searchPath = parentMarker === -1 ? "" : searchPath.slice(0, parentMarker);
  }

  throw new Error(`Cannot resolve production dependency ${dependencyName} from ${fromPath || "project root"}`);
}

function productionReachability(lock) {
  const packages = lock.packages;
  const rootPackage = packages?.[""];
  if (!packages || !rootPackage) {
    throw new Error("package-lock.json must contain a lockfile v2/v3 packages map and root package entry");
  }

  const queue = Object.keys(rootPackage.dependencies ?? {})
    .sort(compareText)
    .map((dependencyName) => ({
      lockPath: resolveDependencyPath(packages, "", dependencyName),
      required: true,
    }));
  const visitedModes = new Set();
  const reachability = new Map();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const modeKey = `${current.lockPath}\0${current.required ? "required" : "optional"}`;
    if (visitedModes.has(modeKey)) continue;
    visitedModes.add(modeKey);

    reachability.set(current.lockPath, (reachability.get(current.lockPath) ?? false) || current.required);
    const packageEntry = packages[current.lockPath];
    if (!packageEntry) throw new Error(`Missing lock entry for ${current.lockPath}`);

    const dependencyModes = new Map();
    for (const dependencyName of Object.keys(packageEntry.dependencies ?? {})) {
      dependencyModes.set(dependencyName, current.required);
    }
    for (const dependencyName of Object.keys(packageEntry.optionalDependencies ?? {})) {
      if (!dependencyModes.has(dependencyName)) dependencyModes.set(dependencyName, false);
    }
    for (const dependencyName of Object.keys(packageEntry.peerDependencies ?? {})) {
      if (packageEntry.peerDependenciesMeta?.[dependencyName]?.optional) continue;
      if (!dependencyModes.has(dependencyName)) dependencyModes.set(dependencyName, current.required);
    }

    for (const [dependencyName, required] of [...dependencyModes].sort(([left], [right]) => compareText(left, right))) {
      queue.push({
        lockPath: resolveDependencyPath(packages, current.lockPath, dependencyName),
        required,
      });
    }
  }

  return reachability;
}

function buildInventory(lock, reachability) {
  const identities = new Map();

  for (const [packagePath, required] of [...reachability].sort(([left], [right]) => compareText(left, right))) {
    const packageEntry = lock.packages[packagePath];
    const packageName = packageNameFromLockPath(packagePath);
    if (!packageEntry.version) throw new Error(`Production lock entry ${packagePath} has no version`);
    if (!packageEntry.license) throw new Error(`Production lock entry ${packagePath} has no license expression`);

    const id = `${packageName}@${packageEntry.version}`;
    const identity = identities.get(id) ?? {
      id,
      name: packageName,
      version: packageEntry.version,
      license: String(packageEntry.license),
      required: false,
      paths: new Set(),
      requiredPaths: new Set(),
      resolved: new Set(),
      integrity: new Set(),
    };

    if (identity.license !== String(packageEntry.license)) {
      throw new Error(`Conflicting license expressions for ${id}`);
    }
    identity.required ||= required;
    identity.paths.add(packagePath);
    if (required) identity.requiredPaths.add(packagePath);
    if (packageEntry.resolved) identity.resolved.add(packageEntry.resolved);
    if (packageEntry.integrity) identity.integrity.add(packageEntry.integrity);
    identities.set(id, identity);
  }

  return [...identities.values()].sort((left, right) => compareText(left.id, right.id));
}

function buildArtifactContributorInventory(lock) {
  return BUILD_ARTIFACT_CONTRIBUTORS.map(({ lockPath: contributorPath, evidence }) => {
    const packageEntry = lock.packages?.[contributorPath];
    if (!packageEntry?.version) throw new Error(`Missing build-artifact contributor ${contributorPath}`);
    if (!packageEntry.license) {
      throw new Error(`Build-artifact contributor ${contributorPath} has no license expression`);
    }
    const packageName = packageNameFromLockPath(contributorPath);
    return {
      id: `${packageName}@${packageEntry.version}`,
      name: packageName,
      version: packageEntry.version,
      license: String(packageEntry.license),
      required: true,
      paths: new Set([contributorPath]),
      requiredPaths: new Set([contributorPath]),
      resolved: new Set(packageEntry.resolved ? [packageEntry.resolved] : []),
      integrity: new Set(packageEntry.integrity ? [packageEntry.integrity] : []),
      artifactEvidence: evidence,
    };
  }).sort((left, right) => compareText(left.id, right.id));
}

async function packageLicenseDocuments(packagePath, expectedName, expectedVersion) {
  const directory = join(projectRoot, ...packagePath.split("/"));
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  if (manifest.name !== expectedName || manifest.version !== expectedVersion) {
    throw new Error(
      `Installed package mismatch at ${packagePath}: expected ${expectedName}@${expectedVersion}, ` +
        `found ${manifest.name}@${manifest.version}`,
    );
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const filenames = entries
    .filter(
      (entry) =>
        entry.isFile() && /^(?:licen[cs]e|copying|notice|copyright)(?:[._-].*)?$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort(compareText);

  const documents = [];
  for (const filename of filenames) {
    documents.push({
      filename,
      text: normalizeText(await readFile(join(directory, filename), "utf8")),
    });
  }
  return documents;
}

async function collectLicenseDocuments(lock, inventory) {
  const documentsByHash = new Map();

  for (const identity of inventory.filter((entry) => entry.required)) {
    const requiredPaths = [...identity.requiredPaths].sort(compareText);
    let documents = [];
    let sourceIdentity = identity;
    let fallbackExplanation = "";
    let fallbackSource = "";
    let usedFallback = false;

    for (const packagePath of requiredPaths) {
      documents = await packageLicenseDocuments(packagePath, identity.name, identity.version);
      if (documents.length) break;
    }

    if (!documents.length) {
      const fallback = FALLBACK_LICENSE_SOURCES.get(identity.name);
      if (!fallback) {
        throw new Error(
          `${identity.id} has no root license/notice file; add a reviewed fallback before regenerating notices`,
        );
      }
      fallbackExplanation = fallback.explanation;
      usedFallback = true;
      if (fallback.embeddedText) {
        documents = [{ filename: fallback.filename, text: normalizeText(fallback.embeddedText) }];
        fallbackSource = `${fallback.sourceId}/${fallback.filename}`;
      } else {
        const fallbackEntry = lock.packages[fallback.lockPath];
        if (!fallbackEntry?.version) throw new Error(`Missing fallback lock entry ${fallback.lockPath}`);
        sourceIdentity = {
          id: `${packageNameFromLockPath(fallback.lockPath)}@${fallbackEntry.version}`,
          name: packageNameFromLockPath(fallback.lockPath),
          version: fallbackEntry.version,
        };
        documents = await packageLicenseDocuments(
          fallback.lockPath,
          sourceIdentity.name,
          sourceIdentity.version,
        );
      }
    }

    if (!documents.length) throw new Error(`No license/notice documents found for ${identity.id}`);
    for (const document of documents) {
      const hash = createHash("sha256").update(document.text).digest("hex");
      const group = documentsByHash.get(hash) ?? { hash, text: document.text, sources: new Set() };
      const source =
        !usedFallback
          ? `${identity.id} (${document.filename})`
          : `${identity.id} (${fallbackExplanation}; uses ${
              fallbackSource || `${sourceIdentity.id}/${document.filename}`
            })`;
      group.sources.add(source);
      documentsByHash.set(hash, group);
    }
  }

  return [...documentsByHash.values()].sort((left, right) => {
    const leftSources = [...left.sources].sort(compareText).join("\0");
    const rightSources = [...right.sources].sort(compareText).join("\0");
    return compareText(leftSources, rightSources) || compareText(left.hash, right.hash);
  });
}

function renderInventoryEntry(identity) {
  const lines = [
    `- ${identity.id}`,
    `  Inclusion: ${
      identity.artifactEvidence
        ? "explicit build-artifact contributor"
        : identity.required
          ? "required production graph"
          : "platform-conditional optional production graph"
    }`,
    `  Declared license: ${identity.license}`,
    `  Lock path(s): ${[...identity.paths].sort(compareText).join(", ")}`,
  ];
  if (identity.artifactEvidence) lines.push(`  Build evidence: ${identity.artifactEvidence}`);
  if (identity.resolved.size) lines.push(`  Resolved: ${[...identity.resolved].sort(compareText).join(", ")}`);
  if (identity.integrity.size) lines.push(`  Integrity: ${[...identity.integrity].sort(compareText).join(", ")}`);
  return lines.join("\n");
}

async function renderNotice() {
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const reachability = productionReachability(lock);
  const inventory = buildInventory(lock, reachability);
  const artifactContributors = buildArtifactContributorInventory(lock);
  const licenseDocuments = await collectLicenseDocuments(lock, [...inventory, ...artifactContributors]);
  const requiredCount = inventory.filter((entry) => entry.required).length;
  const optionalCount = inventory.length - requiredCount;

  const licenseSections = licenseDocuments
    .map(
      (document, index) =>
        `LICENSE DOCUMENT ${index + 1}\n` +
        `${"-".repeat(18 + String(index + 1).length)}\n` +
        `Applies to:\n${[...document.sources]
          .sort(compareText)
          .map((source) => `- ${source}`)
          .join("\n")}\n\n` +
        document.text.trimEnd(),
    )
    .join("\n\n");

  return normalizeText(`FLYLAB THIRD-PARTY LICENSES
================================

This file is generated by scripts/generate-third-party-notices.mjs.
Do not edit it by hand. Run "npm run licenses:generate" after a production
dependency or bundled-font change.

Scope
-----
Project: ${lock.name ?? lock.packages[""]?.name ?? "flylab"}@${lock.version ?? lock.packages[""]?.version ?? "unknown"}
Lockfile version: ${lock.lockfileVersion}
Production package identities: ${inventory.length} (${requiredCount} required, ${optionalCount} platform-conditional optional)
Explicit build-artifact contributors: ${artifactContributors.length}

The inventory is the complete direct and transitive production graph resolved
from package-lock.json. It deliberately includes every platform-specific
optional package recorded in the lockfile, so the generated inventory is the
same on macOS, Linux, and Windows. Full upstream license/notice documents below
are collected from the required cross-platform packages. Optional packages are
identified by package, version, integrity, and declared SPDX license expression;
their platform distributions remain subject to those declared terms.

The separate build-artifact contributor inventory is a reviewed list of packages
declared as development tools in package.json whose code or generated runtime
helpers are nevertheless present in FlyLab's deployable client/server output.
It intentionally excludes development-only linters, test tools, and source
transformers whose own code is not shipped.

The Geist and Geist Mono web fonts emitted by next/font are covered separately
at the end by their complete SIL Open Font License 1.1 notice and copyright.

PRODUCTION PACKAGE INVENTORY
============================

${inventory.map(renderInventoryEntry).join("\n\n")}

BUILD-ARTIFACT CONTRIBUTOR INVENTORY
====================================

${artifactContributors.map(renderInventoryEntry).join("\n\n")}

PACKAGE LICENSE AND NOTICE DOCUMENTS
====================================

${licenseSections}

GEIST AND GEIST MONO FONT NOTICE
================================

Source: https://github.com/vercel/geist-font/blob/main/LICENSE.txt

${GEIST_OFL_NOTICE}
`);
}

async function assertExactFile(path, expected, description) {
  let actual;
  try {
    actual = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${description} is missing at ${path}`);
    }
    throw error;
  }
  if (actual !== expected) {
    throw new Error(`${description} is stale at ${path}; run "npm run licenses:generate"`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--check", "--check-build"]);
  if (args.length > 1 || args.some((argument) => !allowed.has(argument))) {
    throw new Error("Usage: node scripts/generate-third-party-notices.mjs [--check | --check-build]");
  }

  const expected = await renderNotice();
  if (args[0] === "--check" || args[0] === "--check-build") {
    await assertExactFile(rootNoticePath, expected, "Root third-party license notice");
    await assertExactFile(publicNoticePath, expected, "Public third-party license notice");
    if (args[0] === "--check-build") {
      await assertExactFile(builtNoticePath, expected, "Built public third-party license notice");
    }
    console.log(
      args[0] === "--check-build"
        ? "Third-party license notices are current and the public copy survived the build."
        : "Third-party license notices are current and identical.",
    );
    return;
  }

  await writeFile(rootNoticePath, expected, "utf8");
  await writeFile(publicNoticePath, expected, "utf8");
  console.log("Generated identical root and public third-party license notices.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
