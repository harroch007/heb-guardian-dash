"use client";

import { FormEvent, useState } from "react";

export function BetaDemo() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="beta-demo">
      <p>הקלידו מייל כדי לנסות את זרימת ההרשמה בקונספט.</p>
      {!submitted ? (
        <form onSubmit={handleSubmit}>
          <label htmlFor="beta-email">כתובת מייל</label>
          <div className="beta-form-row">
            <input
              id="beta-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              dir="ltr"
              required
            />
            <button type="submit">נסו הרשמת דמו</button>
          </div>
        </form>
      ) : (
        <div className="beta-success" role="status">
          <span aria-hidden="true">✦</span>
          <div>
            <strong>אהבנו את האנרגיה.</strong>
            <p>זהו קונספט חי, ולכן שום פרט לא נשמר. החיבור לרשימת ההמתנה הוא השלב הבא.</p>
          </div>
        </div>
      )}
      <small>הדגמה בלבד · הטופס אינו שולח או שומר מידע</small>
    </div>
  );
}
