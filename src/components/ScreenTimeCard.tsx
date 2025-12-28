import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Gamepad2, MessageCircle, Video, Globe, Settings2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface AppUsageData {
  app_name: string | null;
  package_name: string;
  usage_minutes: number;
}

interface ScreenTimeCardProps {
  appUsage: AppUsageData[];
  showChart?: boolean;
  screenTimeLimit?: number | null;
  onSettingsClick?: () => void;
}

// Category colors using design system colors
const CATEGORY_COLORS = {
  games: 'hsl(280, 100%, 60%)', // accent
  social: 'hsl(45, 100%, 50%)', // warning
  video: 'hsl(0, 90%, 55%)', // destructive
  other: 'hsl(180, 100%, 50%)', // primary
};

// Get app category based on package name
const getAppCategory = (packageName: string): { name: string; color: string; icon: typeof Gamepad2 } => {
  const pkg = packageName.toLowerCase();
  
  if (pkg.includes('game') || pkg.includes('play') || pkg.includes('minecraft') || pkg.includes('roblox') || pkg.includes('fortnite')) {
    return { name: 'משחקים', color: CATEGORY_COLORS.games, icon: Gamepad2 };
  }
  if (pkg.includes('tiktok') || pkg.includes('instagram') || pkg.includes('snapchat') || pkg.includes('whatsapp') || pkg.includes('telegram') || pkg.includes('facebook') || pkg.includes('twitter')) {
    return { name: 'רשתות חברתיות', color: CATEGORY_COLORS.social, icon: MessageCircle };
  }
  if (pkg.includes('youtube') || pkg.includes('netflix') || pkg.includes('twitch') || pkg.includes('video') || pkg.includes('player')) {
    return { name: 'וידאו', color: CATEGORY_COLORS.video, icon: Video };
  }
  return { name: 'אחר', color: CATEGORY_COLORS.other, icon: Globe };
};

// Format minutes to readable time (Hebrew)
export const formatScreenTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}ד'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}ש' ${mins}ד'` : `${hours}ש'`;
};

// Get emoji for app category
const getCategoryEmoji = (packageName: string): string => {
  const pkg = packageName.toLowerCase();
  
  if (pkg.includes('game') || pkg.includes('minecraft') || pkg.includes('roblox')) return '🎮';
  if (pkg.includes('tiktok')) return '📱';
  if (pkg.includes('instagram')) return '📷';
  if (pkg.includes('whatsapp')) return '💬';
  if (pkg.includes('youtube')) return '📺';
  if (pkg.includes('netflix')) return '🎬';
  return '📱';
};

export function ScreenTimeCard({ appUsage, showChart = true, screenTimeLimit, onSettingsClick }: ScreenTimeCardProps) {
  const totalMinutes = appUsage.reduce((sum, app) => sum + (app.usage_minutes || 0), 0);
  
  // Prepare data for pie chart - group by category
  const categoryData = appUsage.reduce((acc, app) => {
    const category = getAppCategory(app.package_name);
    const existing = acc.find(c => c.name === category.name);
    if (existing) {
      existing.value += app.usage_minutes;
    } else {
      acc.push({
        name: category.name,
        value: app.usage_minutes,
        color: category.color,
      });
    }
    return acc;
  }, [] as { name: string; value: number; color: string }[]);

  // Sort by usage
  categoryData.sort((a, b) => b.value - a.value);

  // Top apps for list
  const topApps = appUsage.slice(0, 5);

  if (appUsage.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            זמן מסך
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>אין נתוני שימוש זמינים</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
          <span className="truncate">זמן מסך</span>
          {screenTimeLimit && (
            <Badge variant="outline" className="text-xs font-normal">
              מגבלה: {Math.floor(screenTimeLimit / 60)}ש' {screenTimeLimit % 60 > 0 ? `${screenTimeLimit % 60}ד'` : ''}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="text-lg sm:text-xl font-bold text-primary flex-shrink-0">
            {formatScreenTime(totalMinutes)}
          </div>
          {onSettingsClick && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onSettingsClick}
              className="text-muted-foreground h-8 px-2"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className={`flex flex-col gap-4 ${showChart ? 'md:grid md:grid-cols-2 md:gap-6' : ''}`}>
          {/* Pie Chart */}
          {showChart && categoryData.length > 0 && (
            <div className="h-36 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={25}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatScreenTime(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(222, 47%, 10%)',
                      border: '1px solid hsl(180, 50%, 20%)',
                      borderRadius: '8px',
                      direction: 'rtl',
                      fontSize: '12px',
                    }}
                  />
                  <Legend 
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
                    formatter={(value) => <span className="text-xs sm:text-sm text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* App List */}
          <div className="space-y-1.5 sm:space-y-2">
            {topApps.map((app, index) => {
              const category = getAppCategory(app.package_name);
              return (
                <div 
                  key={`${app.package_name}-${index}`}
                  className="flex items-center justify-between p-1.5 sm:p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors gap-2"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div 
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm sm:text-lg flex-shrink-0"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      {getCategoryEmoji(app.package_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs sm:text-sm truncate">
                        {app.app_name || app.package_name.split('.').pop()}
                      </p>
                    </div>
                  </div>
                  <span 
                    className="text-xs sm:text-sm font-semibold flex-shrink-0"
                    style={{ color: category.color }}
                  >
                    {formatScreenTime(app.usage_minutes)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}