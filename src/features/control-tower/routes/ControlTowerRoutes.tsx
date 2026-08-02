import { Navigate, Route, Routes } from "react-router-dom";
import { ControlTowerInboxPage } from "../pages/ControlTowerInboxPage";
import { CeoAssistantPage } from "../pages/CeoAssistantPage";
import { ControlTowerNotFoundPage } from "../pages/ControlTowerNotFoundPage";

export function ControlTowerRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="inbox" replace />} />
      <Route path="inbox" element={<ControlTowerInboxPage />} />
      <Route path="inbox/:conversationId" element={<ControlTowerInboxPage />} />
      <Route path="inbox/:conversationId/customer" element={<ControlTowerInboxPage customerRoute />} />
      <Route path="ceo-assistant" element={<CeoAssistantPage />} />
      <Route path="*" element={<ControlTowerNotFoundPage />} />
    </Routes>
  );
}
