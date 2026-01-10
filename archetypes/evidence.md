---
title: "{{ replace .File.ContentBaseName "-" " " | title }}"
date: {{ .Date }}
draft: true
evidence_type: "document"  # document, video, photo, audio, correspondence
source: ""  # FOIA Request, Court Filing, Deposition Exhibit, etc.
source_reference: ""  # FOIA request number, case number, etc.
related_incident: ""  # incident slug
related_people: []
  # - person-slug
files:
  - name: ""
    type: "document"  # document, video, photo, audio
redacted: false
tags: []
# Page Bundle Resources (for bundled evidence with multiple files):
# resources:
#   - src: "*.pdf"
#     title: "Primary Document"
#   - src: "*.jpg"
#     title: "Photo Evidence"
#   - src: "*.mp4"
#     title: "Video Evidence"
---

<!--
PAGE BUNDLE PATTERN FOR EVIDENCE ITEMS
======================================

For evidence with multiple files (PDFs, videos, photos), use a Page Bundle:

STRUCTURE:
  content/evidence/
  └── my-evidence-bundle/
      ├── index.md           <- Main content file (this template)
      ├── document.pdf       <- Attached files
      ├── photo-001.jpg
      ├── photo-002.jpg
      └── video-clip.mp4

CREATE WITH:
  hugo new evidence/my-evidence-bundle/index.md

ACCESS FILES IN TEMPLATES:
  {{ range .Resources.Match "*.pdf" }}
    <a href="{{ .RelPermalink }}">{{ .Title }}</a>
  {{ end }}

  {{ with .Resources.GetMatch "*.jpg" }}
    <img src="{{ .RelPermalink }}" alt="{{ .Title }}">
  {{ end }}

  {{ $video := .Resources.GetMatch "*.mp4" }}
  {{ with $video }}
    <video src="{{ .RelPermalink }}" controls></video>
  {{ end }}

BENEFITS:
  - Files stay with content (no separate static/ folder)
  - Hugo handles URL generation
  - Easy to move/rename entire evidence bundles
  - Supports image processing (resize, crop, filters)

For simple evidence (analysis/documentation without files), use regular single-file:
  hugo new evidence/my-analysis.md
-->

## Description

What this evidence shows and why it's significant.

## Source Information

How this evidence was obtained and its chain of custody.

## Relevance

How this evidence relates to documented incidents.
