# AI Business Core

A local-first business operations workspace for a creator-led online business.

## Dashboard capabilities

- Overview of tasks, research records, content pipeline and approval requests.
- Task management with priority, due date and status.
- Research library for source links, observations, hypotheses and contradictory evidence.
- Content planning for YouTube, Instagram and store content.
- Schedule for production deadlines and milestones.
- Manual approval queue for proposed sensitive/external actions.
- Local JSON backup export and import.
- Responsive dark interface, web-app manifest, app icons and service-worker shell cache.

## Secure AI gateway

A provider-compatible Cloudflare Worker is included under `ai-gateway/`. It keeps the provider API key server-side, uses a master token only to mint workspace-scoped 15-minute signed sessions, restricts browser origins, limits request size, and supports an allowlist of content tasks.

**AI Studio includes a manual gateway connection form**: enter the deployed Worker HTTPS endpoint and the app access token in the AI Studio tab. The endpoint is prefilled; the token is entered per session and is not saved in local storage. Follow [the setup guide](docs/ai-gateway-setup.md) to deploy and configure the Worker and its secrets. An AI provider key may incur charges; this code does not make AI usage free. The gateway does not browse the web, verify facts, publish content, or execute external actions.

## Run the dashboard

1. Host the repository on a static HTTPS host such as GitHub Pages.
2. Open the published HTTPS URL in a supported browser.
3. Add it to the home screen if the browser offers installation.
4. In Settings & data, export JSON backups periodically.

Opening `index.html` directly as a file is not equivalent to hosting it: service workers and installability require a supported secure context.

## Data and security limits

- Dashboard records are stored in the current browser's local storage. They do not sync across devices or users.
- Clearing browser/site data may erase records. Export backups and keep them private.
- The approval queue only records a human decision; it does not publish content, spend money, or perform external actions.
- No authentication or multi-user access control exists for the static dashboard. Do not store confidential customer data in the public deployment.
- Never commit API keys, passwords, tokens, recovery codes, or private credentials to GitHub.
- The gateway has basic request checks but no durable per-user identity, advanced rate limiting, or billing controls. Set provider spending limits and rotate exposed tokens.
- CI checks syntax and required files; it does not replace browser-level tests or prove all browsers support installation/offline behavior.

## Research integrity

The existing `-niche-research.md` file is a framework, not a completed market study. Live market evidence has not been collected and no niche has been scored or selected. Keep verified facts, hypotheses, tool estimates and questions separate.

## Development direction

1. Reliable local-first workspace.
2. Evidence-based YouTube research and content workflows.
3. Instagram repurposing.
4. Secure provider integrations with explicit owner approval.
5. Persian e-commerce operations as a later module.
