# PRD — Halteverbot123 Website-Tools

**Status:** draft (product already shipping in mock/PAT/OAuth)

## Problem

Editors need to manage Storyblok page SEO settings, redirects, and script inventory without opening the marketing site codebase.

## Users

- Content / SEO editors in Storyblok Space `289379092634862`
- Developers configuring OAuth / PAT deployments

## Goals

1. Inspect and edit page real path, redirects, robots, canonical, tracking toggles
2. Run link checks and inspect broken / in-/outgoing links
3. Manage scripts (categories, sources, load order) for Termly-related config
4. Work offline via mock fixtures when no Storyblok credentials exist

## Non-goals

- Executing redirects or loading scripts on the live website
- Full CMS replacement

## Success signals

- Mock mode usable for demos without tokens
- PAT/OAuth persist changes to Storyblok fields documented in README
- Shared table export/column UX across both apps
