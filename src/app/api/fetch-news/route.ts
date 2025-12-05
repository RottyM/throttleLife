
import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { db } from '@/firebase/admin';
import type { NewsArticle } from '@/lib/types';
import { JSDOM } from 'jsdom';

// List of RSS feeds to fetch
const FEEDS = [
    'http://motorcycledaily.com/feed',
    'https://thepack.news/feed/',
    'https://www.rideapart.com/rss/news/all/',
    'https://www.motorcyclistonline.com/arcio/rss/',
    'https://www.roadrunner.travel/feed/'
];

// Helper to extract image from HTML content
const getFirstImage = (htmlContent: string): string | undefined => {
    if (!htmlContent) return undefined;
    const dom = new JSDOM(htmlContent);
    const img = dom.window.document.querySelector('img');
    return img?.src;
};

export async function GET() {
    const parser = new Parser();
    let allItems: any[] = [];

    try {
        // Fetch all feeds in parallel
        const feedPromises = FEEDS.map(feedUrl => parser.parseURL(feedUrl).catch(e => {
            console.error(`Failed to fetch ${feedUrl}:`, e.message);
            return null; // Return null on failure so one broken feed doesn't stop others
        }));

        const feeds = await Promise.all(feedPromises);

        // Process items from successfully fetched feeds
        for (const feed of feeds) {
            if (feed?.items) {
                allItems.push(...feed.items);
            }
        }

        // Sort all items by publication date, newest first
        allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

        // Take the top 20
        const topItems = allItems.slice(0, 20);

        // Transform into our NewsArticle format
        const newsArticles: Omit<NewsArticle, 'id'>[] = topItems.map(item => ({
            sourceName: new URL(item.link!).hostname.replace('www.', ''),
            title: item.title!,
            url: item.link!,
            // Try to find an image from enclosure, media content, or the HTML content itself
            imageUrl: item.enclosure?.url || item['media:content']?.$?.url || getFirstImage(item['content:encoded'] || item.content) || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80', // Fallback image
            publishedAt: new Date(item.pubDate!).toISOString(),
            description: item.contentSnippet || item.content?.replace(/<[^>]*>/g, '').substring(0, 200) || 'No description available.',
            videoUrl: item.link?.includes('youtube.com') ? item.link : undefined
        }));

        // Delete all existing articles in the collection
        const articlesCollection = db.collection('news_articles');
        const snapshot = await articlesCollection.get();
        if (!snapshot.empty) {
            const deleteBatch = db.batch();
            snapshot.docs.forEach(doc => {
                deleteBatch.delete(doc.ref);
            });
            await deleteBatch.commit();
        }

        // Add new articles in a new batch
        const addBatch = db.batch();
        newsArticles.forEach(article => {
            const docRef = articlesCollection.doc();
            addBatch.set(docRef, article);
        });
        await addBatch.commit();

        return NextResponse.json({
            message: `Successfully fetched and stored ${newsArticles.length} articles.`,
            count: newsArticles.length
        });

    } catch (error) {
        console.error('Error fetching news:', error);
        // It's better to cast to Error to get a meaningful message
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Error fetching news', error: errorMessage }, { status: 500 });
    }
}
