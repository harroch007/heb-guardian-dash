import type { ControlTowerRepository } from "./ControlTowerRepository";
import { UnavailableControlTowerRepository } from "./UnavailableControlTowerRepository";

export async function createControlTowerRepository(): Promise<ControlTowerRepository> {
  const fixtureAllowed =
    !import.meta.env.PROD && import.meta.env.VITE_CONTROL_TOWER_FIXTURES === "true";

  if (fixtureAllowed) {
    const { createFixtureControlTowerRepository } = await import(
      "../fixtures/FixtureControlTowerRepository"
    );
    return createFixtureControlTowerRepository();
  }

  try {
    const { createRemoteReadOnlyControlTowerRepository } = await import(
      "./RemoteReadOnlyControlTowerRepository"
    );
    return createRemoteReadOnlyControlTowerRepository();
  } catch {
    return new UnavailableControlTowerRepository("STAFF_BACKEND_NOT_CONFIGURED");
  }
}
