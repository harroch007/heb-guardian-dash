import { useAuth } from "@/contexts/AuthContext";

export const HomeGreeting = () => {
  const { user, guardianDisplayName } = useAuth();
  const rawName =
    guardianDisplayName?.trim() ||
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "";
  const parentName = rawName ? rawName.split(" ")[0] : null;

  const getGreeting = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const timeVal = h * 60 + m;
    if (timeVal < 330) return "לילה טוב";
    if (timeVal < 720) return "בוקר טוב";
    if (timeVal < 1020) return "צהריים טובים";
    if (timeVal < 1260) return "ערב טוב";
    return "לילה טוב";
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">
        {getGreeting()}
        {parentName ? `, ${parentName}` : ""} 👋
      </h1>
    </div>
  );
};
