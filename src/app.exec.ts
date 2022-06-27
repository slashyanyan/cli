import { run, undent } from "utils"
import hydrate from "./prefab/hydrate.ts"
import resolve from "./prefab/resolve.ts"
import base_install from "./prefab/install.ts"
import { lvl1 as link } from "./prefab/link.ts"
import useShellEnv from "hooks/useShellEnv.ts"
import useCellar from "hooks/useCellar.ts"
import { PackageRequirement, Path } from "types"
import { VirtualEnv } from "hooks/useVirtualEnv.ts"
import useExecutableMarkdown from "hooks/useExecutableMarkdown.ts"

type Options = {
  args: string[]
  env: VirtualEnv | undefined
  pkgs: PackageRequirement[]
}

export default async function exec({ args, ...opts }: Options) {
  const cellar = useCellar()

  if (args.length < 1) throw "contract violation"

  await install(opts.pkgs)

  const filename = Path.cwd().join(args[0]).isFile()
  if (filename?.extname() == '.md') {
    const target = args[1]
    const sh = await useExecutableMarkdown({ filename }).findScript(target)
    const path = Path.mktemp().join('script').write({ text: undent`
      #!/bin/sh
      ${sh}
      ` }).chmod(0o500).string
    args = [path, ...args.slice(2)]
  }

  const env = (await useShellEnv(opts.pkgs)).combinedStrings
  if (opts.env) {
    env["SRCROOT"] = opts.env.srcroot.string
    if (opts.env.version) env["VERSION"] = opts.env.version.toString()
  }

  const cmd = [...args]
  await run({ cmd, env })  //TODO implement `execvp`

/////////////////////////////////////////////////////////////
  async function install(dry: PackageRequirement[]) {
    const wet = await hydrate(dry)  ; console.debug({wet})
    const gas = await resolve(wet)  ; console.debug({gas})
    for (const pkg of gas) {
      if (await cellar.isInstalled(pkg)) continue
      console.info({ installing: pkg })
      const installation = await base_install(pkg)
      await link(installation)
    }
  }
}
