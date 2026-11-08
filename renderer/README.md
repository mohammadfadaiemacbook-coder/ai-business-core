# Archived optional renderer (not part of the free deployment)

This folder contains an experimental Mac renderer that depends on Cloudflare R2 and a separate shared secret. It is intentionally not enabled in the active AI Business Core UI or release workflow. Do not create an R2 bucket, add a renderer secret, or run this agent as part of the free deployment.

The supported free video path is browser-based composition, local preview/download, and direct YouTube upload after the user reviews and confirms the action. Reintroducing a remote renderer requires a new storage design that does not depend on R2, its own security review, and a separately approved change.
