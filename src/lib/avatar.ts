export const generateRandomAvatarPlaceholder = (userId: string) => {
    // Using i.pravatar.cc for more realistic random people avatars, consistent per user ID.
    return `https://i.pravatar.cc/150?u=${userId}`;
};
