interface PlatformBadgeProps {
  platform: string;
  size?: 'sm' | 'md';
}

const PLATFORM_STYLES: Record<string, string> = {
  YouTube: 'bg-red-600 text-white',
  TikTok: 'bg-black text-white border border-gray-700',
  Instagram: 'bg-purple-600 text-white',
  X: 'bg-black text-white border border-gray-700',
  Discord: 'bg-indigo-600 text-white',
  Snapchat: 'bg-yellow-400 text-black',
};

export default function PlatformBadge({ platform, size = 'sm' }: PlatformBadgeProps) {
  const style = PLATFORM_STYLES[platform] ?? 'bg-gray-600 text-white';
  const sizeClass = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${style}`}>
      {platform}
    </span>
  );
}
