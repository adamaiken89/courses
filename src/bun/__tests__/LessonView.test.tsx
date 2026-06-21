import { describe, expect, test, afterEach } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import LessonView from "../../mainview/components/LessonView";
import { mockFetch, restoreFetch } from "./mock-fetch";

const mockContent = `# Introduction

Welcome to the lesson.

## Chapter 1

First chapter content.

### Section 1.1

Details here.

## Chapter 2

Second chapter.`;

const mockSections = [
  { id: "introduction", heading: "Introduction", level: 1, parentID: null },
  { id: "chapter-1", heading: "Chapter 1", level: 2, parentID: "introduction" },
  { id: "section-11", heading: "Section 1.1", level: 3, parentID: "chapter-1" },
  { id: "chapter-2", heading: "Chapter 2", level: 2, parentID: "introduction" },
];

const mockNotes = [
  { id: "n1", content: "Important concept", createdAt: "2024-06-15T12:00:00.000Z" },
];

const defaultProps = {
  subjectId: "test",
  module: { id: 1, name: "Intro Module", timeHours: 2, prerequisites: [] },
  onStartQuiz: () => {},
};

afterEach(restoreFetch);

function mockAll(opts?: { content?: string }) {
  mockFetch({
    "/api/storage/bookmarks/module": [],
    "/api/storage/highlights": [],
    "/lesson": opts?.content ? { content: opts.content } : { content: "" },
    "/sections": [],
    "/notes": [],
  });
}

describe("LessonView snapshots", () => {
  test("loading state", () => {
    mockAll();
    const { container } = render(<LessonView {...defaultProps} />);
    expect(container.innerHTML).toMatchSnapshot();
  });

  test("content loaded", async () => {
    mockAll({ content: mockContent });
    const { container } = render(<LessonView {...defaultProps} />);
    await waitFor(() =>
      expect(container.textContent).toContain("Introduction")
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
