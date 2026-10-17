# Malleable Workspace

Working name for a radically malleable personal workspace with bare minimum
defaults. Even after customization, it should connect to other workspaces and
external tools/services, and allow those systems to connect to it.

## Status

Exploration only. No application code, approved architecture, or formal change
proposal exists yet. The deployment model and implementation stack remain open.

OpenSpec 1.14.3 is installed as a project-local development dependency.
Initialization created six Codex skills in `.agents/skills/` and retained
`openspec/config.yaml`. Both change and specification inventories are empty.

GitHub creation is pending: the authenticated GitHub integration rejected
`createRepository` with `Resource not accessible by integration`. No remote is
configured. After repository-creation permission is available, run:

```sh
gh repo create malleable-workspace --private --source=. --remote=origin --push
```

## OpenSpec commands

```sh
npm ci
npm run openspec -- list --json
npm run openspec -- list --specs
```

In Codex, invoke `$openspec-explore` or select `openspec-explore` from Skills.
OpenSpec documentation uses `/opsx:explore` for tools with that slash-command
syntax. Reload the project if newly generated skills do not appear.

The exploration stays in conversation. Formal change artifacts and application
implementation have not been started.

## References

- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [Project configuration](https://github.com/Fission-AI/OpenSpec/blob/main/docs/customization.md)
- [Tool integrations](https://github.com/Fission-AI/OpenSpec/blob/main/docs/supported-tools.md)
