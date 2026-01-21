import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, Share, MoreVertical, Plus, Check, ArrowRight, Smartphone } from "lucide-react";
import kippyLogo from "@/assets/kippy-logo.png";

const Install = () => {
  const navigate = useNavigate();
  const { isInstalled, isInstallable, install, isIOS, isAndroid } = usePWAInstall();

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      navigate('/auth');
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <img src={kippyLogo} alt="Kippy" className="h-16 w-16 mx-auto" />
            </div>
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Check className="h-6 w-6 text-primary" />
              Kippy מותקן!
            </CardTitle>
            <CardDescription>
              האפליקציה כבר מותקנת במכשיר שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              המשך להתחברות
              <ArrowRight className="h-4 w-4 mr-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={kippyLogo} alt="Kippy" className="h-16 w-16 mx-auto" />
          </div>
          <CardTitle className="text-2xl">התקנת Kippy</CardTitle>
          <CardDescription>
            התקינו את Kippy למסך הבית לגישה מהירה וחוויה משופרת
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Direct install button for supported browsers */}
          {isInstallable && (
            <div className="space-y-4">
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="h-5 w-5 ml-2" />
                התקן את Kippy
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                לחצו על הכפתור והאפליקציה תתווסף למסך הבית
              </p>
            </div>
          )}

          {/* iOS instructions */}
          {isIOS && !isInstallable && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium">לחצו על כפתור השיתוף</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Share className="h-4 w-4" />
                    בתחתית המסך ב-Safari
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium">בחרו "הוסף למסך הבית"</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    Add to Home Screen
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium">אשרו את ההתקנה</p>
                  <p className="text-sm text-muted-foreground">
                    לחצו "הוסף" בפינה הימנית העליונה
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Android instructions */}
          {isAndroid && !isInstallable && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium">פתחו את תפריט הדפדפן</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MoreVertical className="h-4 w-4" />
                    שלוש נקודות בפינה העליונה
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium">בחרו "התקן אפליקציה"</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    Install app / Add to Home screen
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium">אשרו את ההתקנה</p>
                  <p className="text-sm text-muted-foreground">
                    לחצו "התקן" בחלון שיופיע
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Desktop instructions */}
          {!isIOS && !isAndroid && !isInstallable && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <Smartphone className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">פתחו את הדף במכשיר נייד</p>
                  <p className="text-sm text-muted-foreground">
                    להתקנה הכי קלה, גשו לאתר מהטלפון שלכם
                  </p>
                </div>
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                או חפשו את סמל ההתקנה בסרגל הכתובות של הדפדפן
              </div>
            </div>
          )}

          {/* Benefits section */}
          <div className="pt-4 border-t border-border">
            <h3 className="font-medium mb-3 text-center">למה כדאי להתקין?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                גישה מהירה ישירות ממסך הבית
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                חוויה כמו אפליקציה נייטיבית
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                טעינה מהירה יותר
              </li>
            </ul>
          </div>

          {/* Back to login */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/auth')}
            className="w-full"
          >
            חזרה להתחברות
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
