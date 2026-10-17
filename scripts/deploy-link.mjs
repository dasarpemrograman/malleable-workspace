const input = process.argv[2];
if (!input)
  throw new Error("Provide the actual public GitHub/GitLab repository URL.");
const u = new URL(input);
if (
  u.protocol !== "https:" ||
  !["github.com", "gitlab.com"].includes(u.hostname) ||
  u.pathname.split("/").filter(Boolean).length < 2 ||
  u.username ||
  u.password ||
  u.search ||
  u.hash
)
  throw new Error(
    "Use a public HTTPS GitHub/GitLab repository URL without credentials or query parameters.",
  );
console.log(
  `[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(u.href)})`,
);
