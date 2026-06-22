export interface Section {
  id: string;
  heading: string;
  level: number;
  parentID: string | null;
}

export interface Note {
  id: string;
  subjectID: string;
  moduleID: number;
  highlightID: string | null;
  sectionID: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Highlight {
  id: string;
  subjectID: string;
  moduleID: number;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  color: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  subjectID: string;
  moduleID: number;
  sectionID: string | null;
  title: string;
  scrollPosition: number;
  createdAt: string;
}
