# AI Business Core

A local-first business operations workspace for a creator-led online business. The project is being developed directly in this repository; this branch contains the first operational dashboard foundation.

## Current dashboard capabilities

- Overview of tasks, research records, content pipeline and approval requests.
- Task management with priority, due date and status.
- Research library for source links, observations, hypotheses and contradictory evidence.
- Content planning for YouTube, Instagram and store content.
- Schedule for production deadlines and milestones.
- Manual approval queue for proposed sensitive/external actions.
- Local JSON backup export and import.
- Responsive dark interface for mobile and desktop.
- Installable web-app manifest and service-worker shell cache for supported HTTPS hosting.

## Run it

The app is a static web application. It does not need a build step or package installation.

1. Host the repository on a static HTTPS host, such as GitHub Pages.
2. Open the published HTTPS URL in a supported browser.
3. Add it to the home screen / install it from the browser menu if the browser offers that option.
4. Open Settings & data and export a JSON backup periodically.

Opening index.html directly as a file URL is not equivalent to hosting it: service workers and installability require a supported secure context.

## Important data and security limits

- Records are stored in the current browser's local storage. They do not sync across devices or users.
- Clearing browser/site data may erase records. Export backups and keep them in a safe location.
- JSON backups may contain business notes. Treat them as private.
- No AI model, YouTube, Instagram, analytics, scheduling, or e-commerce API is connected in this version.
- The approval queue only records a human decision in the dashboard. It does not publish content, spend money, or perform external actions.
- No authentication or multi-user access control is implemented. Do not use this public static deployment to store confidential customer data.
- Never commit API keys, passwords, tokens, recovery codes, or private credentials to GitHub.
- Do not describe this app as tested or production-verified until actual browser and deployment checks have been run.

## Project direction

1. Establish a reliable local-first operations workspace.
2. Add evidence-based YouTube research and content production workflows.
3. Add Instagram repurposing workflows.
4. Design secure, permission-limited integrations only after the relevant providers and hosting environment are selected.
5. Add Persian e-commerce operations as a later module.

## Evidence and research integrity

The existing -niche-research.md document is a research framework, not a completed market study. It explicitly states that live market evidence has not been collected and that no niche has been scored or selected. Keep observations, hypotheses, tool estimates, and verified facts separate.

## Development branch

The dashboard changes are being prepared on build/operational-core-v1. Review the branch before merging it into main.
