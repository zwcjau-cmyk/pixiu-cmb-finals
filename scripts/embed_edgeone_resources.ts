const root = process.cwd()
const soul = await Bun.file(`${root}/pixiu-agent-web/soul.md`).text()
const scriptFiles = Array.from(
  new Bun.Glob('*.json').scanSync(`${root}/pixiu-agent-web/scripts`),
).sort()

const scripts: Record<string, string> = {}
for (const filename of scriptFiles) {
  scripts[filename] = await Bun.file(
    `${root}/pixiu-agent-web/scripts/${filename}`,
  ).text()
}

const python = [
  '"""Generated EdgeOne resource bundle. Do not edit by hand."""',
  '',
  `SOUL_MARKDOWN = ${JSON.stringify(soul)}`,
  '',
  'SCRIPT_JSON_FILES = {',
  ...Object.entries(scripts).map(
    ([filename, contents]) => `    ${JSON.stringify(filename)}: ${JSON.stringify(contents)},`,
  ),
  '}',
  '',
].join('\n')

await Promise.all([
  Bun.write(`${root}/cloud-functions/api/embedded_resources.py`, python),
  Bun.write(`${root}/pixiu-agent-web/cloud-functions/api/embedded_resources.py`, python),
])
