---
name: "Acme Gallery"
colors:
  ink: "#203040"
  accent: "#285c98"
  paper: "#f4f7fa"
  surface: "#ffffff"
typography:
  body:
    fontFamily: "Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
spacing:
  sm: "8px"
  md: "24px"
  frame: "16px"
  lg: "32px"
rounded:
  control: "8px"
  large: "16px"
---

## Overview
Acme Gallery is a small synthetic reading card with a working action.
Keep its heading, explanatory paragraph, accent label and confirmation button.

## Colors
Ink carries the reading text. Accent identifies the field-note category and
the action. Keep those two roles visibly distinct; surface is the card and
paper is the page behind it.

## Typography
The body role is 16px and the title is 24px. Text must wrap at a narrow viewport
without shrinking, hiding, clipping or changing its semantic element.

## Layout
The Gallery card uses the 24px medium spacing step; 16px is reserved for the page frame. Small 8px spacing is for the compact
action. The named 32px large step is not an alternative card or button default.

## Shapes
The card and compact action use the 8px control radius.

## Components
The button must remain keyboard focusable and open its native confirmation
popover. Its label and confirmation are part of the task, not decoration.

## Do's and Don'ts
Repair the HTML while retaining content and behavior. Do not edit this document,
add tokens or exceptions, remove the styling, or change recipe identity.
