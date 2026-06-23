import { ReactNode } from 'react';

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export default function PageContent({ children, className = '' }: PageContentProps) {
  return <main className={`overflow-y-auto flex-1 px-6 py-8 ${className}`}>{children}</main>;
}
