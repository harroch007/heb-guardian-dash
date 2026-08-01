import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export function ControlTowerNotFoundPage() {
  return (
    <main className="ct-access-page">
      <section className="ct-access-card">
        <span className="ct-access-icon" aria-hidden="true"><FileQuestion size={26} /></span>
        <h1>העמוד אינו זמין</h1>
        <p>לא ניתן לפתוח את הכתובת המבוקשת.</p>
        <Link className="ct-button ct-button-secondary" to="/control-tower/inbox">חזרה ל־Inbox</Link>
      </section>
    </main>
  );
}
