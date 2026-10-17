# Malleable Workspace

Working name for a radically malleable personal workspace with bare minimum
defaults. Even after customization, it should connect to other workspaces and
external tools/services, and allow those systems to connect to it.

## Status

Exploration only. No application code, approved architecture, or formal change
proposal exists yet. The deployment model and implementation stack remain open.

The local Git repository and OpenSpec configuration have been prepared manually.
The OpenSpec CLI has not been installed or run, and generated agent skills are
not present. The environment's configured network proxy was unreachable during
setup. GitHub repository creation is also pending: the CLI credential failed
authentication and the connected GitHub app exposes no repository creation tool.

## Complete setup when access is restored

From this directory, using Node.js 20.19.0 or later:

```sh
npm install
npm run openspec:init
npm run openspec -- --version
npm run openspec -- list --json
npm run openspec -- list --specs
```

This uses a project-local OpenSpec dependency. The pinned version comes from the
upstream OpenSpec package manifest inspected during setup; registry installation
has not yet been verified. Initialization generates Codex skills under
`.agents/skills/`. In Codex, invoke `$openspec-explore`; OpenSpec documentation
uses `/opsx:explore` for tools with that slash-command syntax.

After GitHub CLI authentication works, create a private repository and push:

```sh
gh repo create malleable-workspace --private --source=. --remote=origin --push
```

The working name and private visibility are proposed setup defaults. No GitHub
repository has been created and no remote has been configured.

## References

- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [Project configuration](https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md)
- [Tool integrations](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
