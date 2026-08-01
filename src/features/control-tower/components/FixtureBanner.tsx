import { FlaskConical } from "lucide-react";

export function FixtureBanner() {
  return (
    <div className="ct-fixture-banner" role="status" data-testid="fixture-banner">
      <FlaskConical aria-hidden="true" size={16} />
      <span>נתוני דמה • Staging בלבד</span>
    </div>
  );
}

