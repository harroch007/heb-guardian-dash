import { 
  Smartphone, 
  MessageCircle, 
  Play, 
  Music, 
  Camera, 
  Gamepad2, 
  ShoppingBag, 
  Chrome, 
  Instagram, 
  Facebook, 
  Twitter, 
  Mail, 
  Video, 
  Image, 
  BookOpen,
  LucideIcon
} from "lucide-react";

export interface AppIconInfo {
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

// App icons and colors mapping
export const APP_ICONS: Record<string, AppIconInfo> = {
  // Messaging apps
  'com.whatsapp': { icon: MessageCircle, color: '#25D366', bgColor: 'rgba(37, 211, 102, 0.15)' },
  'com.whatsapp.w4b': { icon: MessageCircle, color: '#25D366', bgColor: 'rgba(37, 211, 102, 0.15)' },
  'org.telegram.messenger': { icon: MessageCircle, color: '#0088cc', bgColor: 'rgba(0, 136, 204, 0.15)' },
  'com.facebook.orca': { icon: MessageCircle, color: '#0084FF', bgColor: 'rgba(0, 132, 255, 0.15)' },
  'com.discord': { icon: MessageCircle, color: '#5865F2', bgColor: 'rgba(88, 101, 242, 0.15)' },
  'com.snapchat.android': { icon: Camera, color: '#FFFC00', bgColor: 'rgba(255, 252, 0, 0.15)' },
  
  // Video & Streaming
  'com.google.android.youtube': { icon: Play, color: '#FF0000', bgColor: 'rgba(255, 0, 0, 0.15)' },
  'com.zhiliaoapp.musically': { icon: Music, color: '#000000', bgColor: 'rgba(255, 0, 80, 0.15)' }, // TikTok
  'com.ss.android.ugc.trill': { icon: Music, color: '#000000', bgColor: 'rgba(255, 0, 80, 0.15)' }, // TikTok
  'com.netflix.mediaclient': { icon: Video, color: '#E50914', bgColor: 'rgba(229, 9, 20, 0.15)' },
  'com.disney.disneyplus': { icon: Video, color: '#113CCF', bgColor: 'rgba(17, 60, 207, 0.15)' },
  'com.amazon.avod.thirdpartyclient': { icon: Video, color: '#00A8E1', bgColor: 'rgba(0, 168, 225, 0.15)' },
  'tv.twitch.android.app': { icon: Video, color: '#9146FF', bgColor: 'rgba(145, 70, 255, 0.15)' },
  
  // Social Media
  'com.instagram.android': { icon: Instagram, color: '#E4405F', bgColor: 'rgba(228, 64, 95, 0.15)' },
  'com.facebook.katana': { icon: Facebook, color: '#1877F2', bgColor: 'rgba(24, 119, 242, 0.15)' },
  'com.twitter.android': { icon: Twitter, color: '#1DA1F2', bgColor: 'rgba(29, 161, 242, 0.15)' },
  'com.pinterest': { icon: Image, color: '#E60023', bgColor: 'rgba(230, 0, 35, 0.15)' },
  
  // Games
  'com.supercell.clashofclans': { icon: Gamepad2, color: '#F5A623', bgColor: 'rgba(245, 166, 35, 0.15)' },
  'com.supercell.clashroyale': { icon: Gamepad2, color: '#0084FF', bgColor: 'rgba(0, 132, 255, 0.15)' },
  'com.mojang.minecraftpe': { icon: Gamepad2, color: '#7BC043', bgColor: 'rgba(123, 192, 67, 0.15)' },
  'com.kiloo.subwaysurf': { icon: Gamepad2, color: '#FF6B35', bgColor: 'rgba(255, 107, 53, 0.15)' },
  'com.king.candycrushsaga': { icon: Gamepad2, color: '#FF6B35', bgColor: 'rgba(255, 107, 53, 0.15)' },
  
  // Music
  'com.spotify.music': { icon: Music, color: '#1DB954', bgColor: 'rgba(29, 185, 84, 0.15)' },
  'com.apple.android.music': { icon: Music, color: '#FC3C44', bgColor: 'rgba(252, 60, 68, 0.15)' },
  'com.google.android.apps.youtube.music': { icon: Music, color: '#FF0000', bgColor: 'rgba(255, 0, 0, 0.15)' },
  
  // Browsers
  'com.android.chrome': { icon: Chrome, color: '#4285F4', bgColor: 'rgba(66, 133, 244, 0.15)' },
  'org.mozilla.firefox': { icon: Chrome, color: '#FF7139', bgColor: 'rgba(255, 113, 57, 0.15)' },
  'com.opera.browser': { icon: Chrome, color: '#FF1B2D', bgColor: 'rgba(255, 27, 45, 0.15)' },
  
  // Shopping
  'com.amazon.mShop.android.shopping': { icon: ShoppingBag, color: '#FF9900', bgColor: 'rgba(255, 153, 0, 0.15)' },
  'com.alibaba.aliexpresshd': { icon: ShoppingBag, color: '#FF4747', bgColor: 'rgba(255, 71, 71, 0.15)' },
  
  // Education
  'com.duolingo': { icon: BookOpen, color: '#58CC02', bgColor: 'rgba(88, 204, 2, 0.15)' },
  
  // Email
  'com.google.android.gm': { icon: Mail, color: '#EA4335', bgColor: 'rgba(234, 67, 53, 0.15)' },
};

// Get app icon info based on package name
export const getAppIconInfo = (packageName: string | undefined | null): AppIconInfo => {
  if (!packageName) {
    return { icon: Smartphone, color: 'hsl(var(--muted-foreground))', bgColor: 'hsl(var(--muted) / 0.3)' };
  }
  
  // Exact match first
  if (APP_ICONS[packageName]) {
    return APP_ICONS[packageName];
  }
  
  // Partial match for games
  if (packageName.includes('game') || packageName.includes('play')) {
    return { icon: Gamepad2, color: 'hsl(var(--primary))', bgColor: 'hsl(var(--primary) / 0.15)' };
  }
  
  // Default
  return { icon: Smartphone, color: 'hsl(var(--muted-foreground))', bgColor: 'hsl(var(--muted) / 0.3)' };
};
