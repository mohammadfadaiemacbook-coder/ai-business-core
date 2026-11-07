# YouTube Agent Skill integration

This branch adapts the MIT-licensed workflow ideas from [Jakeschincariol/youtube-agent-skill](https://github.com/Jakeschincariol/youtube-agent-skill) for AI Business Core.

## Integration

- `ai-gateway/youtube-agent-skills.js` contains model-agnostic workflow instructions for all eleven upstream skills.
- `ai-gateway/worker.js` imports those instructions and exposes the additional `yt_*` tasks through the existing authenticated `/api/generate` endpoint.
- `app.js` exposes the new workflows in the Persian AI Studio task selector.
- Existing YouTube OAuth, D1, media generation, review, and upload paths remain separate and are not replaced.

## Skill mapping

| Upstream skill | AI Business Core |
|---|---|
| yt-script | `video_script` |
| yt-package | `title_ideas` |
| yt-edit | `yt_edit` |
| yt-comment | `comment_reply` |
| yt-plan | `yt_plan` |
| yt-viral | `yt_viral` / `trend_strategy` |
| yt-retention | `yt_retention` |
| yt-shorts | `yt_shorts` |
| yt-seo | `yt_seo` |
| yt-chapters | `yt_chapters` |
| yt-audit | `yt_audit` |

## Runtime differences

The upstream package's six Python command-line tools target Claude Code and are not executed by Cloudflare Workers. This integration adapts their workflows into provider-agnostic prompts. Exact deterministic scoring/processing utilities can be ported separately to JavaScript and tested against upstream fixtures.

The integration only generates drafts and analyses. It does not publish. Existing upload endpoints and the app's explicit approval flow remain responsible for external YouTube actions. Trend and competitor analysis must use supplied/public evidence; the model must not invent browsing, view counts, retention values, or source citations.

## Validation before production

1. Run repository CI and Worker syntax checks.
2. Test each new `yt_*` task against the deployed Worker in a non-publishing workflow.
3. Confirm the app's existing review/approval and YouTube upload confirmation gates still work.
4. Deploy the Worker only after reviewing and merging this branch.
