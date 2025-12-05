
import type { GalleryMedia, NewsArticle } from '@/lib/types';
import { subDays } from 'date-fns';

const seededUserId = 'seed-user';
const seedTimestamp = new Date().toISOString();

export const galleryPhotos: GalleryMedia[] = [
  {
    id: 'gallery-1',
    userId: seededUserId,
    description: 'Sunset ride through the mountains.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1517949908111-ef1acb65e0fd?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
  {
    id: 'gallery-2',
    userId: seededUserId,
    description: 'Early morning coffee stop.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1502872364588-894d7d7f4987?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
  {
    id: 'gallery-3',
    userId: seededUserId,
    description: 'Details of a classic engine.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
  {
    id: 'gallery-4',
    userId: seededUserId,
    description: 'Coastal highway cruise.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1517244683847-7456b63c5969?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
  {
    id: 'gallery-5',
    userId: seededUserId,
    description: 'Bike maintenance day.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
  {
    id: 'gallery-6',
    userId: seededUserId,
    description: 'Group ride with friends.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
  {
    id: 'gallery-7',
    userId: seededUserId,
    description: 'A quiet moment on a dirt trail.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1520962919430-5f6249a6c0c0?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
  {
    id: 'gallery-8',
    userId: seededUserId,
    description: 'City lights and chrome.',
    timestamp: seedTimestamp,
    mediaUrl:
      'https://images.unsplash.com/photo-1527443224154-d2e0c5600ea1?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
  },
];


export const sampleNews: Omit<NewsArticle, 'id'>[] = [
  {
    sourceName: 'Cycle World',
    title: 'The Future is Electric: A Look at the Newest EV Bikes',
    url: '#',
    imageUrl:
      'https://images.unsplash.com/photo-1623079397242-c2e809a6ef1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxMHx8ZWxlY3RyaWMlMjBtb3RvcmN5Y2xlfGVufDB8fHx8MTc2Mjc0NzkyN3ww&ixlib=rb-4.1.0&q=80&w=1080',
    publishedAt: subDays(new Date(), 2).toISOString(),
    description:
      "Electric motorcycles are no longer a niche market. We dive into the latest models from top manufacturers, exploring their range, performance, and what they mean for the future of riding.",
  },
  {
    sourceName: 'RevZilla',
    title: 'How to Choose the Perfect Adventure Riding Gear',
    url: '#',
    imageUrl:
      'https://images.unsplash.com/photo-1758550713888-c1a76af44cc8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwyfHxtb3RvcmN5Y2xlJTIwZ2VhcnxlbnwwfHx8fDE3NjI4MjM1NzV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publishedAt: subDays(new Date(), 5).toISOString(),
    description:
      "Adventure riding demands gear that's as versatile as the terrain. Our comprehensive guide breaks down the essentials, from helmets and jackets to boots and luggage systems.",
    videoUrl: 'https://www.youtube.com/watch?v=VIDEO_ID_HERE',
  },
  {
    sourceName: 'BikeEXIF',
    title: 'Masterclass: The Art of the Urban Scrambler',
    url: '#',
    imageUrl:
      'https://images.unsplash.com/photo-1760229306350-e6cb85e93977?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxMHx8Y3VzdG9tJTIwbW90b3JjeWNsZXxlbnwwfHx8fDE3NjI4MDgyODZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    publishedAt: subDays(new Date(), 10).toISOString(),
    description:
      'A deep dive into the philosophy and design behind creating the ultimate city-carving custom scrambler. Featuring interviews with top builders and a showcase of stunning machines.',
  },
  {
    sourceName: 'Motorcyclist Magazine',
    title: 'Riding the Loneliest Road: A Route 66 Adventure',
    url: '#',
    imageUrl:
      'https://images.unsplash.com/photo-1632077532902-c1de2815fc3b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwyfHxtb3RvcmN5Y2xlJTIwZGVzZXJ0fGVufDB8fHx8MTc2MjgyMzU3NXww&ixlib=rb-4.1.0&q=80&w=1080',
    publishedAt: subDays(new Date(), 15).toISOString(),
    description:
      'An epic journey across the American southwest, exploring the history and solitude of the iconic Route 66. Tips, tricks, and tales from the open road.',
  },
];
