import { Timestamp } from "firebase/firestore";

export type NewsArticle = {
  id: string;
  sourceName: string;
  title: string;
  url: string;
  imageUrl: string;
  publishedAt: string; // ISO date string
  description: string;
  videoUrl?: string; // Optional for video articles
};

export type GalleryMedia = {

  id: string;

  userId: string; // ID of the user who uploaded the media

  description: string;

  timestamp: any; // Firestore ServerTimestamp

  mediaUrl?: string; // Made optional for backward compatibility

  mediaType?: 'image' | 'video' | 'videoUrl'; // Made optional for backward compatibility

  // Old fields, kept for backward compatibility during migration

  imageUrl?: string;

  videoUrl?: string;

};

export type SocialLink = {
  name: 'Twitter' | 'Instagram' | 'Youtube';
  url: string;
  icon: string;
};

// Represents the UserProfile schema from backend.json for Firestore
export interface UserProfile {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  roadName?: string;
  email: string;
  socialLinks?: { name: string; url: string }[];
  profilePicture?: string;
  aboutMe?: string;
  clubName?: string;
  clubChapter?: string; // Added Club Chapter
  clubColors?: {
    primary: string;
    enabled: boolean;
  };
  rank?: string;
  contactInfo?: string;
  emergencyContact?: string;
  gpsActive?: boolean;
  latitude?: number;
  longitude?: number;
}

// Represents the Motorcycle schema from backend.json for Firestore
export interface Motorcycle {
  id: string;
  userId: string;
  make: string;
  model: string;
  year: number;
  name?: string;
  mileage?: number;
  isDefault?: boolean;
  imageId?: string; // For local placeholder mapping if needed
}

export interface MileageLog {
  id: string;
  userId: string;
  motorcycleId: string;
  mileage: number;
  photoUrl: string;
  timestamp: string; // ISO String
  type: 'start_of_year' | 'end_of_year';
  year: number;
}


export interface PhotoComment {
  id: string;
  photoId: string;
  userId: string;
  text: string;
  timestamp: any; // Can be a server timestamp object or a Firestore Timestamp
  imageUrl?: string;
  parentId?: string | null;
  userProfile?: { // Denormalized user data for display
    userName: string;
    profilePicture?: string;
  };
  replies?: PhotoComment[];
}

export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    message: string;
    timestamp: any; // Firestore ServerTimestamp
    userProfile?: { // Denormalized user data
        userName: string;
        profilePicture?: string;
    }
}

export interface Chat {
    id: string;
    name?: string; // Name for group chats
    participantIds: string[];
    lastMessage?: string;
    lastUpdated: any; // Firestore ServerTimestamp
    createdBy: string;
}

export interface Notification {
    id: string;
    userId: string;
    type: string;
    message: string;
    timestamp: any; // Firestore ServerTimestamp
    isRead: boolean;
    relatedEntityId: string;
}

export type TimeSlotRequest = {
  id: string;
  requestorId: string;
  requestedUserIds: string[];
  title: string;
  purpose: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  participantStatus: { [key: string]: 'Pending' | 'Approved' | 'Rejected' };
  createdAt: Timestamp;
  location?: {
    description?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

export type CalendarEvent = {
  title: string;
  date: Date;
  duration?: string;
};

export interface TrafficEvent {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  startDate: Date;
  endDate: Date;
  category?: string;
  subcategory?: string;
  source: 'json' | 'xml';
}