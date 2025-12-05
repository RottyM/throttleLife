import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CommentForm } from '@/components/CommentForm';

const addDocMock = jest.fn(() => Promise.resolve());
const collectionMock = jest.fn(() => 'collectionRef');
const serverTimestampMock = jest.fn(() => 'server-ts');

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  serverTimestamp: () => serverTimestampMock(),
}));

jest.mock('lucide-react', () => ({
  LoaderCircle: () => null,
  Send: () => null,
  Smile: () => null,
  FileImage: () => null,
}));

jest.mock('@/firebase/provider', () => ({
  useFirebase: () => ({ firestore: 'firestore-instance' }),
  useUser: () => ({
    user: { uid: 'user-1', displayName: 'Rider One', email: 'rider@example.com' },
  }),
}));

jest.mock('@giphy/react-components', () => ({
  Grid: ({ onGifClick }: { onGifClick: (gif: any, e: any) => void }) => (
    <button
      aria-label="mock-gif-grid"
      onClick={(e) =>
        onGifClick(
          { images: { original: { url: 'https://media.test/gif.gif' } } },
          e
        )
      }
    >
      GIF
    </button>
  ),
}));

describe('CommentForm', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('appends emoji to the comment input', async () => {
    render(<CommentForm photoId="photo-1" onCommentAdded={jest.fn()} />);

    fireEvent.click(screen.getByLabelText(/add emoji/i));
    fireEvent.click(screen.getByText('😀'));

    const textarea = screen.getByPlaceholderText(/add a comment/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('😀');
  });

  it('disables GIF picker when API key is missing', () => {
    process.env.NEXT_PUBLIC_GIPHY_API_KEY = '';

    render(<CommentForm photoId="photo-1" onCommentAdded={jest.fn()} />);

    const gifButton = screen.getByLabelText(/add gif/i);
    expect(gifButton).toBeDisabled();
  });

  it('submits a text comment to Firestore', async () => {
    process.env.NEXT_PUBLIC_GIPHY_API_KEY = 'test-key';
    const onAdded = jest.fn();

    render(<CommentForm photoId="photo-1" onCommentAdded={onAdded} />);

    const textarea = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(textarea, { target: { value: 'Great ride!' } });

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/send comment/i));
    });

    expect(collectionMock).toHaveBeenCalledWith('firestore-instance', 'gallery/photo-1/comments');
    expect(addDocMock).toHaveBeenCalledWith('collectionRef', expect.objectContaining({
      text: 'Great ride!',
      userId: 'user-1',
      imageUrl: '',
    }));
    expect(onAdded).toHaveBeenCalled();
  });
});
