# FrontX Development Guidelines for GitHub Copilot

Always read `.ai/GUIDELINES.md` before making changes.

## Quick Reference

For detailed guidance, use these resources:
- **Architecture**: See `.ai/GUIDELINES.md` and target files in `.ai/targets/`
- **Event-driven patterns**: `.ai/targets/EVENTS.md`
- **Screensets**: `.ai/targets/SCREENSETS.md`
- **API services**: `.ai/targets/API.md`
- **Styling**: `.ai/targets/STYLING.md`
- **Themes**: `.ai/targets/THEMES.md`

## Critical Rules

1. **REQUIRED**: Read the appropriate target file before changing code
2. **REQUIRED**: Event-driven architecture only (dispatch events, handle in actions)
3. **FORBIDDEN**: Direct slice dispatch from UI components
4. **FORBIDDEN**: Hardcoded colors or inline styles
5. **REQUIRED**: Use local shadcn/ui components for all UI
6. **REQUIRED**: Run `npm run arch:check` before committing

## Available Commands

Use `.ai/commands/` for detailed workflows:
- `frontx-new-screenset` - Create new screenset
- `frontx-new-screen` - Add screen to screenset
- `frontx-new-action` - Create action handler
- `frontx-new-api-service` - Add API service
- `frontx-new-component` - Add UI component
- `frontx-validate` - Validate changes
- `frontx-quick-ref` - Quick reference guide

## Routing

Always consult `.ai/GUIDELINES.md` ROUTING section to find the correct target file for your task.
