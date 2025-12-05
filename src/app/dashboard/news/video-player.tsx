
'use client';

import React from 'react';

interface VideoPlayerProps {
  videoUrl: string;
}

// A simple utility to extract YouTube video ID from various URL formats
const getYouTubeId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);

    return (match && match[2].length === 11)
      ? match[2]
      : null;
}


export const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl }) => {
  const videoId = getYouTubeId(videoUrl);

  if (!videoId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-white">
        <p>Invalid YouTube URL</p>
      </div>
    );
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <div className="relative h-full w-full">
      <iframe
        src={embedUrl}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute top-0 left-0 h-full w-full"
      ></iframe>
    </div>
  );
};
