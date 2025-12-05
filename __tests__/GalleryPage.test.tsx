import React from 'react';
import { render, screen, act } from '@testing-library/react';
import GalleryPage from '@/app/dashboard/gallery/page';

const mockOnSnapshot = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'collection-ref'),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: jest.fn(() => 'limit-ref'),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  orderBy: jest.fn(() => 'order-by-ref'),
  query: jest.fn(() => 'query-ref'),
  startAfter: jest.fn(() => 'start-after-ref'),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('@/firebase', () => ({
  useFirebase: () => ({
    user: { uid: 'user-1' },
    firestore: {},
    storage: {},
  }),
  useUser: () => ({ user: { uid: 'user-1' } }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/PhotoUpload', () => () => <div data-testid="photo-upload" />);

jest.mock('next/image', () => (props: any) => <img {...props} alt={props.alt} />);
jest.mock('next/link', () => ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href}>{children}</a>
));

jest.mock('lucide-react', () => ({
  Video: () => null,
  PlayCircle: () => null,
  Trash2: () => null,
  Loader2: () => null,
}));

jest.mock('@/components/ui/alert-dialog', () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const ButtonLike = ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>;
  return {
    AlertDialog: Container,
    AlertDialogContent: Container,
    AlertDialogHeader: Container,
    AlertDialogFooter: Container,
    AlertDialogTitle: Container,
    AlertDialogDescription: Container,
    AlertDialogAction: ButtonLike,
    AlertDialogCancel: ButtonLike,
  };
});

const createDoc = (id: string) => ({
  id,
  data: () => ({
    mediaUrl: `https://example.com/${id}.jpg`,
    description: `Media ${id}`,
    userId: 'user-1',
    mediaType: 'image',
  }),
});

describe('GalleryPage', () => {
  beforeAll(() => {
    class IntersectionObserverMock {
      observe = jest.fn();
      disconnect = jest.fn();
    }
    (global as any).IntersectionObserver = IntersectionObserverMock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows end-of-gallery message when fewer than a page of items are available', async () => {
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      onNext({ docs: [createDoc('1'), createDoc('2')] });
      return jest.fn();
    });

    render(<GalleryPage />);

    expect(await screen.findByText(/Photo & Video Gallery/i)).toBeInTheDocument();
    expect(screen.getByText(/end of the gallery/i)).toBeInTheDocument();
  });

  it('requests the next page when load more is clicked', async () => {
    mockOnSnapshot.mockImplementation((_query, onNext) => {
      const docs = Array.from({ length: 12 }, (_val, idx) => createDoc(String(idx + 1)));
      onNext({ docs });
      return jest.fn();
    });
    mockGetDocs.mockResolvedValue({ docs: [createDoc('13')] });

    render(<GalleryPage />);

    const loadMoreButton = await screen.findByRole('button', { name: /load more/i });
    await act(async () => {
      loadMoreButton.click();
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });
});
