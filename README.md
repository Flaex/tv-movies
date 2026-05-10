# Media Tracker

A structured Markdown-based system for tracking and organizing a collection of movies and TV shows.

## Overview
This project transforms a raw text list of media into a comprehensive tracking table. It helps users manage their "Watched" vs "Pending" status, provides metadata (Genre, Year, Rating), and identifies where to stream the content.

## Key Files
- `media-tracker.md`: The main tracking table containing all movies and TV shows.
- `tv-shows-and-movie-list.txt`: The original source list of titles.
- `GEMINI.md`: Project-specific instructions and goals for AI assistants.
- `PLAN.md`: The historical and future execution plan for the project.

## Table Structure
The tracker is organized into the following columns to prioritize tracking and decision-making:
1. **Title**: Name of the movie or show.
2. **Status**: Current tracking state (e.g., Watched, Pending, In Progress).
3. **Type**: Category (Movie or TV Show).
4. **Seasons/Episodes**: Progress tracking for series.
5. **Streaming Platform**: Where the content is available.
6. **Genre**: Category of the media.
7. **Year**: Release date/range.
8. **Rating**: IMDb or personal rating.
9. **Notes**: Personal comments or reminders.

## Project Standards
- **Sorting**: The table is grouped by `Type` (Movies first, then TV Shows) for better organization.
- **Commits**: This project follows the [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/).
- **Formatting**: Keep table cells concise to avoid line wrapping in Markdown viewers.

## Automation
This project includes a Node.js script, `updateClickUp.js`, to automate the process of populating ClickUp custom fields from the `media-tracker.md` file.

### Usage
1.  **Install Dependencies**: Run `npm install axios`.
2.  **Set API Token**: In your terminal, run `export CLICKUP_API_TOKEN="your_token"`, replacing `"your_token"` with your personal ClickUp API key.
3.  **Execute**: Run the script with `node updateClickUp.js`.
